from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
import sys
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch
from xml.etree import ElementTree as ET

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "document-service"))

from mikoton_document_service.generator import (
    DocumentGenerationError,
    LocalDocumentStorage,
    REQUIRED_XLSM_PARTS,
    S3DocumentStorage,
    generate_xlsm,
    generate_pdf_from_xlsm,
    generate_documents,
)


TEMPLATE_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.xlsm"
MAPPING_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.mapping.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fixture_payload() -> dict:
    return {
        "schemaVersion": "1.0",
        "templateCode": "mikoton-commercial-proposal",
        "templateVersion": "1",
        "proposal": {
            "id": "e82f2712-cf74-416e-9cdc-89356f3d6d60",
            "number": "CP-20260713-200410-1NXH",
            "title": "Реализация коннектора",
            "date": "2026-07-13",
            "language": "ru-RU",
            "currencyCode": "RUB",
            "validityDays": 14,
        },
        "customer": {
            "companyId": "company-1",
            "companyName": "ООО Промобит",
            "contactName": "Иванов Александр",
        },
        "contractor": {
            "name": "Шибеев Роман",
            "email": "consulting@mikoton.ru",
        },
        "content": {
            "contextAndGoal": "Подготовить рабочий контур автоматизации.",
            "workItems": [
                {
                    "position": 1,
                    "block": "Анализ",
                    "description": "Сбор требований",
                    "quantity": 2,
                    "unit": "час",
                    "rate": 5500,
                    "discount": 0.15,
                },
                {
                    "position": 2,
                    "block": "Разработка",
                    "description": "Реализация интеграции",
                    "quantity": 4,
                    "unit": "час",
                    "rate": 7000,
                    "discount": 0,
                },
            ],
            "plan": [
                {
                    "position": 1,
                    "title": "Старт и диагностика",
                    "result": "Зафиксированные требования",
                    "duration": "2 дня",
                }
            ],
            "paymentTerms": "Оплата после передачи результатов.",
            "assumptions": "Лицензии стороннего ПО не входят.",
            "nextStep": "Согласовать дату старта.",
        },
    }


def cell(root: ET.Element, ref: str) -> ET.Element:
    for candidate in root.findall(".//m:c", NS):
        if candidate.attrib.get("r") == ref:
            return candidate
    raise AssertionError(f"Cell {ref} not found")


def text_value(cell_node: ET.Element) -> str:
    return "".join(node.text or "" for node in cell_node.findall(".//m:t", NS))


class GeneratorTest(unittest.TestCase):
    def test_generates_xlsm_pdf_and_preserves_template_parts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)

            def fake_libreoffice(command: list[str], **kwargs: object) -> CompletedProcess[str]:
                outdir = Path(command[command.index("--outdir") + 1])
                source = Path(command[-1])
                pdf_path = outdir / f"{source.stem}.pdf"
                pdf_path.write_bytes(b"%PDF-1.4\n% fake libreoffice export\n")
                return CompletedProcess(command, 0, stdout="converted", stderr="")

            with patch("mikoton_document_service.generator.subprocess.run", side_effect=fake_libreoffice):
                result = generate_documents(
                    fixture_payload(),
                    TEMPLATE_PATH,
                    MAPPING_PATH,
                    tmp_path,
                    storage=LocalDocumentStorage(tmp_path / "storage", "https://documents.example.test"),
                    idempotency_key="123e4567-e89b-42d3-a456-426614174099",
                    libreoffice_binary="libreoffice",
                )

            self.assertEqual(result["status"], "success")
            files = {file["format"]: file for file in result["files"]}
            self.assertIn("xlsm", files)
            self.assertIn("pdf", files)
            self.assertGreater(files["xlsm"]["size"], 10_000)
            self.assertGreater(files["pdf"]["size"], 10)
            self.assertIn("storageKey", files["xlsm"])
            self.assertIn("downloadUrl", files["xlsm"])
            self.assertNotIn("file://", files["xlsm"]["downloadUrl"])
            self.assertTrue(files["pdf"]["downloadUrl"].startswith("https://documents.example.test/"))

            xlsm_path = tmp_path / "storage" / files["xlsm"]["storageKey"]
            with zipfile.ZipFile(xlsm_path) as package:
                names = set(package.namelist())
                for required_part in REQUIRED_XLSM_PARTS:
                    self.assertIn(required_part, names)
                workbook_xml = package.read("xl/workbook.xml").decode("utf-8")
                self.assertIn("_xlnm.Print_Area", workbook_xml)
                self.assertIn("$A$1:$I$37", workbook_xml)

                sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
                self.assertEqual(text_value(cell(sheet, "G3")), "КП № CP-20260713-200410-1NXH от")
                self.assertEqual(text_value(cell(sheet, "B5")), "Реализация коннектора")
                self.assertEqual(text_value(cell(sheet, "C8")), "ООО Промобит")
                self.assertEqual(text_value(cell(sheet, "C9")), "Иванов Александр")
                self.assertEqual(text_value(cell(sheet, "F8")), "Шибеев Роман")
                self.assertEqual(text_value(cell(sheet, "F9")), "consulting@mikoton.ru")
                self.assertEqual(text_value(cell(sheet, "I8")), "14 дней")
                self.assertEqual(text_value(cell(sheet, "I9")), "RUB")
                self.assertEqual(text_value(cell(sheet, "B12")), "Подготовить рабочий контур автоматизации.")
                self.assertEqual(text_value(cell(sheet, "B32")), "Оплата после передачи результатов.")
                self.assertEqual(text_value(cell(sheet, "E32")), "Лицензии стороннего ПО не входят.")
                self.assertEqual(text_value(cell(sheet, "B35")), "Согласовать дату старта.")
                self.assertEqual(cell(sheet, "I17").find("m:f", NS).text, "E17*G17*(1-H17)")
                self.assertEqual(cell(sheet, "I22").find("m:f", NS).text, "SUM(I17:I21)")

    def test_rejects_more_than_five_work_items(self) -> None:
        payload = fixture_payload()
        payload["content"]["workItems"] = payload["content"]["workItems"] * 3
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(DocumentGenerationError) as raised:
                generate_documents(
                    payload,
                    TEMPLATE_PATH,
                    MAPPING_PATH,
                    Path(tmp),
                    storage=LocalDocumentStorage(Path(tmp) / "storage", "https://documents.example.test"),
                    idempotency_key="123e4567-e89b-42d3-a456-426614174099",
                )
            self.assertEqual(raised.exception.code, "PAYLOAD_INVALID")

    def test_pdf_export_failure_is_structured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            xlsm = generate_xlsm(fixture_payload(), TEMPLATE_PATH, MAPPING_PATH, Path(tmp))

            with patch(
                "mikoton_document_service.generator.subprocess.run",
                return_value=CompletedProcess(["libreoffice"], 1, stdout="", stderr="failed"),
            ):
                with self.assertRaises(DocumentGenerationError) as raised:
                    generate_pdf_from_xlsm(
                        xlsm,
                        Path(tmp),
                        libreoffice_binary="libreoffice",
                        timeout_seconds=1,
                    )

            self.assertEqual(raised.exception.code, "PDF_EXPORT_FAILED")

    def test_s3_public_base_url_is_used_for_presigned_query(self) -> None:
        storage = object.__new__(S3DocumentStorage)
        storage.bucket = "commercial-proposals"
        storage.public_base_url = "http://192.168.100.11:9000"

        class FakeClient:
            def generate_presigned_url(self, *args, **kwargs):
                return "http://192.168.100.11:9000/commercial-proposals/path/file.pdf?X-Amz-Signature=abc"

        storage.presign_client = FakeClient()

        url, _expires_at = storage.get_download_url(
            storage_key="path/file.pdf",
            expires_in_seconds=900,
        )

        self.assertEqual(
            url,
            "http://192.168.100.11:9000/commercial-proposals/path/file.pdf?X-Amz-Signature=abc",
        )


if __name__ == "__main__":
    unittest.main()
