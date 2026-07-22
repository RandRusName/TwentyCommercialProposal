from __future__ import annotations

import json
import os
import tempfile
import unittest
import zipfile
import sys
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch
from xml.etree import ElementTree as ET

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "document-service"))

from mikoton_document_service.generator import (
    DocumentGenerationError,
    LocalDocumentStorage,
    REQUIRED_XLSX_TEMPLATE_PARTS,
    S3DocumentStorage,
    generate_xlsx,
    generate_pdf_from_xlsx,
    generate_documents,
)
from mikoton_document_service.server import (
    Handler,
    _configured_secret,
    _is_authorized,
    _max_request_bytes,
)


TEMPLATE_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.xlsm"
MAPPING_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.mapping.json"
TEMPLATE_V2_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v2.xlsx"
MAPPING_V2_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v2.mapping.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fixture_payload() -> dict:
    return {
        "schemaVersion": "1.0",
        "templateCode": "mikoton-commercial-proposal",
        "templateVersion": "1",
        "proposal": {
            "id": "e82f2712-cf74-416e-9cdc-89356f3d6d60",
            "number": "КП-005 от 13.07.2026",
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


def fixture_payload_v2() -> dict:
    payload = fixture_payload()
    payload["schemaVersion"] = "2.0"
    payload["templateVersion"] = "2"
    payload["customer"]["companyId"] = "33333333-3333-4333-8333-333333333333"
    payload["proposal"]["amount"] = 37350
    payload["content"]["workItems"] = [
        {
            "position": 1,
            "block": "Анализ",
            "name": "Интервью",
            "description": "Сбор требований",
            "quantity": 2,
            "unit": "час",
            "unitPrice": 5500,
            "discountPercent": 15,
            "lineAmount": 9350,
            "currencyCode": "RUB",
        },
        {
            "position": 2,
            "block": "Разработка",
            "name": "Интеграция",
            "description": "Реализация коннектора",
            "quantity": 4,
            "unit": "час",
            "unitPrice": 7000,
            "discountPercent": 0,
            "lineAmount": 28000,
            "currencyCode": "RUB",
        },
    ]
    payload["content"]["plan"][0]["description"] = "Рабочая встреча"
    return payload


def cell(root: ET.Element, ref: str) -> ET.Element:
    for candidate in root.findall(".//m:c", NS):
        if candidate.attrib.get("r") == ref:
            return candidate
    raise AssertionError(f"Cell {ref} not found")


def text_value(cell_node: ET.Element) -> str:
    return "".join(node.text or "" for node in cell_node.findall(".//m:t", NS))


class GeneratorTest(unittest.TestCase):
    def test_v2_writes_fifty_items_and_ten_stages_with_multipage_setup(self) -> None:
        payload = fixture_payload_v2()
        payload["content"]["workItems"] = [
            {
                "position": position,
                "block": f"Block {position}",
                "name": f"Item {position}",
                "description": f"Description {position}",
                "quantity": 1,
                "unit": "hour",
                "unitPrice": position,
                "discountPercent": 0,
                "lineAmount": position,
                "currencyCode": "RUB",
            }
            for position in range(1, 51)
        ]
        payload["content"]["plan"] = [
            {
                "position": position,
                "title": f"Stage {position}",
                "result": f"Result {position}",
                "duration": f"{position} days",
                "description": f"Stage description {position}",
            }
            for position in range(1, 11)
        ]
        payload["proposal"]["amount"] = 1275

        with tempfile.TemporaryDirectory() as tmp:
            output = generate_xlsx(
                payload, TEMPLATE_V2_PATH, MAPPING_V2_PATH, Path(tmp)
            )
            with zipfile.ZipFile(output.path) as package:
                sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
                workbook = package.read("xl/workbook.xml").decode("utf-8")

                self.assertEqual(text_value(cell(sheet, "C65")), "Item 50")
                self.assertEqual(text_value(cell(sheet, "B78")), "Stage 10")
                self.assertEqual(
                    cell(sheet, "I65").find("m:f", NS).text,
                    "E65*G65*(1-H65/100)",
                )
                self.assertEqual(
                    cell(sheet, "I66").find("m:f", NS).text,
                    "SUM(I16:I65)",
                )
                page_setup = sheet.find("m:pageSetup", NS)
                self.assertIsNotNone(page_setup)
                self.assertEqual(page_setup.attrib["fitToWidth"], "1")
                self.assertEqual(page_setup.attrib["fitToHeight"], "0")
                footer = sheet.find("m:headerFooter/m:oddFooter", NS)
                self.assertIsNotNone(footer)
                self.assertEqual(footer.text, "&RСтраница &P из &N")
                self.assertIn("$A$1:$I$87", workbook)
                self.assertIn("$15:$15", workbook)

    def test_v2_writes_twenty_items_and_eight_stages_without_truncation(self) -> None:
        payload = fixture_payload_v2()
        payload["content"]["workItems"] = [
            {
                "position": position,
                "block": f"Block {position}",
                "name": f"Item {position}",
                "description": f"Description {position}",
                "quantity": 1,
                "unit": "hour",
                "unitPrice": position,
                "discountPercent": 0,
                "lineAmount": position,
                "currencyCode": "RUB",
            }
            for position in range(1, 21)
        ]
        payload["content"]["plan"] = [
            {
                "position": position,
                "title": f"Stage {position}",
                "result": f"Result {position}",
                "duration": f"{position} days",
                "description": f"Stage description {position}",
            }
            for position in range(1, 9)
        ]
        payload["proposal"]["amount"] = 210

        with tempfile.TemporaryDirectory() as tmp:
            output = generate_xlsx(
                payload, TEMPLATE_V2_PATH, MAPPING_V2_PATH, Path(tmp)
            )
            with zipfile.ZipFile(output.path) as package:
                sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
                self.assertEqual(text_value(cell(sheet, "C35")), "Item 20")
                self.assertEqual(text_value(cell(sheet, "B76")), "Stage 8")
                self.assertEqual(
                    cell(sheet, "I35").find("m:f", NS).text,
                    "E35*G35*(1-H35/100)",
                )
                self.assertEqual(
                    cell(sheet, "I66").find("m:f", NS).text,
                    "SUM(I16:I65)",
                )

    def test_v2_generates_macro_free_xlsx_with_separate_name_and_description(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = generate_xlsx(
                fixture_payload_v2(), TEMPLATE_V2_PATH, MAPPING_V2_PATH, Path(tmp)
            )
            with zipfile.ZipFile(output.path) as package:
                names = set(package.namelist())
                self.assertNotIn("xl/vbaProject.bin", names)
                sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
                self.assertEqual(text_value(cell(sheet, "C16")), "Интервью")
                self.assertEqual(text_value(cell(sheet, "D16")), "Сбор требований")
                self.assertEqual(cell(sheet, "I16").find("m:f", NS).text, "E16*G16*(1-H16/100)")
                self.assertEqual(cell(sheet, "I66").find("m:f", NS).text, "SUM(I16:I65)")

    def test_v2_manifest_reuses_same_generation_without_second_pdf_export(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            storage = LocalDocumentStorage(tmp_path / "storage", "https://documents.example.test")
            calls = 0

            def fake_libreoffice(command: list[str], **kwargs: object) -> CompletedProcess[str]:
                nonlocal calls
                calls += 1
                outdir = Path(command[command.index("--outdir") + 1])
                source = Path(command[-1])
                (outdir / f"{source.stem}.pdf").write_bytes(b"%PDF-1.4\n% v2\n")
                return CompletedProcess(command, 0, stdout="converted", stderr="")

            with patch("mikoton_document_service.generator.subprocess.run", side_effect=fake_libreoffice):
                first = generate_documents(
                    fixture_payload_v2(), TEMPLATE_V2_PATH, MAPPING_V2_PATH, tmp_path,
                    storage=storage, idempotency_key="123e4567-e89b-42d3-a456-426614174099",
                )
                second = generate_documents(
                    fixture_payload_v2(), TEMPLATE_V2_PATH, MAPPING_V2_PATH, tmp_path,
                    storage=storage, idempotency_key="123e4567-e89b-42d3-a456-426614174099",
                    snapshot_hash=first["snapshotHash"],
                )

            self.assertEqual(calls, 1)
            self.assertEqual(first["generationId"], second["generationId"])
            self.assertEqual(
                [file["storageKey"] for file in first["files"]],
                [file["storageKey"] for file in second["files"]],
            )

    def test_v2_rejects_schema_mismatch_and_non_finite_values(self) -> None:
        mismatch = fixture_payload_v2()
        mismatch["templateVersion"] = "1"
        mapping = json.loads(MAPPING_V2_PATH.read_text(encoding="utf-8"))
        from mikoton_document_service.generator import validate_payload

        with self.assertRaises(DocumentGenerationError) as mismatch_error:
            validate_payload(mismatch, mapping)
        self.assertEqual(mismatch_error.exception.code, "DOCUMENT_SCHEMA_TEMPLATE_MISMATCH")

        invalid = fixture_payload_v2()
        invalid["content"]["workItems"][0]["quantity"] = float("nan")
        with self.assertRaises(DocumentGenerationError) as invalid_error:
            validate_payload(invalid, mapping)
        self.assertEqual(invalid_error.exception.code, "PAYLOAD_INVALID")

    def test_v2_rejects_currency_totals_positions_and_unknown_fields(self) -> None:
        from mikoton_document_service.generator import validate_payload

        mapping = json.loads(MAPPING_V2_PATH.read_text(encoding="utf-8"))
        mutations = []
        wrong_currency = fixture_payload_v2()
        wrong_currency["content"]["workItems"][0]["currencyCode"] = "USD"
        mutations.append((wrong_currency, "content.workItems[0].currencyCode"))
        wrong_line = fixture_payload_v2()
        wrong_line["content"]["workItems"][0]["lineAmount"] = 1
        mutations.append((wrong_line, "content.workItems[0].lineAmount"))
        wrong_total = fixture_payload_v2()
        wrong_total["proposal"]["amount"] = 1
        mutations.append((wrong_total, "proposal.amount"))
        wrong_position = fixture_payload_v2()
        wrong_position["content"]["workItems"][1]["position"] = 1
        mutations.append((wrong_position, "content.workItems[1].position"))
        boolean_number = fixture_payload_v2()
        boolean_number["content"]["workItems"][0]["quantity"] = True
        mutations.append((boolean_number, "content.workItems[0].quantity"))
        unknown = fixture_payload_v2()
        unknown["proposal"]["unexpected"] = "value"
        mutations.append((unknown, "proposal"))

        for payload, expected_path in mutations:
            with self.subTest(expected_path=expected_path):
                with self.assertRaises(DocumentGenerationError) as raised:
                    validate_payload(payload, mapping)
                self.assertEqual(raised.exception.code, "PAYLOAD_INVALID")
                self.assertIn(expected_path, str(raised.exception))
    def test_generates_xlsx_pdf_and_removes_macro_parts(self) -> None:
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
            self.assertIn("xlsx", files)
            self.assertIn("pdf", files)
            self.assertGreater(files["xlsx"]["size"], 10_000)
            self.assertGreater(files["pdf"]["size"], 10)
            self.assertIn("storageKey", files["xlsx"])
            self.assertIn("downloadUrl", files["xlsx"])
            self.assertNotIn("file://", files["xlsx"]["downloadUrl"])
            self.assertTrue(files["pdf"]["downloadUrl"].startswith("https://documents.example.test/"))

            xlsx_path = tmp_path / "storage" / files["xlsx"]["storageKey"]
            self.assertEqual(xlsx_path.suffix, ".xlsx")
            with zipfile.ZipFile(xlsx_path) as package:
                names = set(package.namelist())
                for required_part in REQUIRED_XLSX_TEMPLATE_PARTS:
                    self.assertIn(required_part, names)
                self.assertNotIn("xl/vbaProject.bin", names)
                self.assertFalse(any(name.startswith("xl/ctrlProps/") for name in names))
                self.assertFalse(any(name.startswith("xl/activeX/") for name in names))
                self.assertFalse(any(name.startswith("xl/drawings/vmlDrawing") for name in names))
                content_types = package.read("[Content_Types].xml").decode("utf-8")
                self.assertNotIn("macroEnabled", content_types)
                self.assertNotIn("vbaProject", content_types)
                workbook_xml = package.read("xl/workbook.xml").decode("utf-8")
                self.assertIn("_xlnm.Print_Area", workbook_xml)
                self.assertIn("$A$1:$I$37", workbook_xml)

                sheet = ET.fromstring(package.read("xl/worksheets/sheet1.xml"))
                self.assertEqual(text_value(cell(sheet, "G3")), "КП-005 от 13.07.2026")
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
            xlsx = generate_xlsx(fixture_payload(), TEMPLATE_PATH, MAPPING_PATH, Path(tmp))

            with patch(
                "mikoton_document_service.generator.subprocess.run",
                return_value=CompletedProcess(["libreoffice"], 1, stdout="", stderr="failed"),
            ):
                with self.assertRaises(DocumentGenerationError) as raised:
                    generate_pdf_from_xlsx(
                        xlsx,
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


class DocumentServiceSecurityTests(unittest.TestCase):
    def request(self, body: bytes, headers: dict[str, str]) -> tuple[int, dict]:
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            connection.request(
                "POST",
                "/v1/commercial-proposals/generate",
                body=body,
                headers=headers,
            )
            response = connection.getresponse()
            payload = json.loads(response.read().decode("utf-8"))
            connection.close()
            return response.status, payload
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_missing_or_short_secret_is_not_configured(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(_configured_secret())
        with patch.dict(os.environ, {"DOCUMENT_SERVICE_SECRET": "too-short"}, clear=True):
            self.assertIsNone(_configured_secret())

    def test_authorization_uses_exact_bearer_value(self) -> None:
        secret = "s" * 32
        self.assertTrue(_is_authorized(f"Bearer {secret}", secret))
        self.assertFalse(_is_authorized("Bearer wrong", secret))
        self.assertFalse(_is_authorized("", secret))

    def test_request_limit_is_bounded_and_configurable(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(_max_request_bytes(), 2 * 1024 * 1024)
        with patch.dict(os.environ, {"DOCUMENT_MAX_REQUEST_BYTES": "1024"}, clear=True):
            self.assertEqual(_max_request_bytes(), 1024)
        with patch.dict(os.environ, {"DOCUMENT_MAX_REQUEST_BYTES": "0"}, clear=True):
            with self.assertRaises(DocumentGenerationError):
                _max_request_bytes()

    def test_http_fails_closed_without_secret(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            status, payload = self.request(b"{}", {"content-type": "application/json"})
        self.assertEqual(status, 503)
        self.assertEqual(payload["error"]["code"], "SERVICE_NOT_READY")

    def test_http_rejects_wrong_secret(self) -> None:
        with patch.dict(os.environ, {"DOCUMENT_SERVICE_SECRET": "s" * 32}, clear=True):
            status, payload = self.request(
                b"{}",
                {"content-type": "application/json", "authorization": "Bearer wrong"},
            )
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

    def test_http_rejects_oversized_body_before_json_parsing(self) -> None:
        secret = "s" * 32
        with patch.dict(os.environ, {
            "DOCUMENT_SERVICE_SECRET": secret,
            "DOCUMENT_MAX_REQUEST_BYTES": "10",
        }, clear=True):
            status, payload = self.request(
                b"{" + (b"x" * 10),
                {"content-type": "application/json", "authorization": f"Bearer {secret}"},
            )
        self.assertEqual(status, 413)
        self.assertEqual(payload["error"]["code"], "PAYLOAD_TOO_LARGE")

    def test_http_rejects_malformed_json(self) -> None:
        secret = "s" * 32
        with patch.dict(os.environ, {"DOCUMENT_SERVICE_SECRET": secret}, clear=True):
            status, payload = self.request(
                b"not-json",
                {"content-type": "application/json", "authorization": f"Bearer {secret}"},
            )
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], "PAYLOAD_INVALID")


if __name__ == "__main__":
    unittest.main()
