from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Protocol
from xml.etree import ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"
NS_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("", NS_MAIN)
ET.register_namespace("", NS_CONTENT_TYPES)
ET.register_namespace("", NS_RELATIONSHIPS)

TEMPLATE_CODE = "mikoton-commercial-proposal"
TEMPLATE_VERSION = "1"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_CONTENT_TYPE = "application/pdf"
REQUIRED_XLSX_TEMPLATE_PARTS = (
    "[Content_Types].xml",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/worksheets/sheet1.xml",
    "xl/drawings/drawing1.xml",
    "xl/printerSettings/printerSettings1.bin",
)
DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60


class DocumentGenerationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class GeneratedLocalFile:
    format: str
    file_name: str
    content_type: str
    size: int
    sha256: str
    path: Path


@dataclass(frozen=True)
class StoredDocument:
    id: str
    format: str
    file_name: str
    content_type: str
    size: int
    sha256: str
    storage_key: str
    download_url: str
    download_url_expires_at: str


class DocumentStorage(Protocol):
    def put(self, *, source_path: Path, storage_key: str, content_type: str) -> str:
        ...

    def get_download_url(self, *, storage_key: str, expires_in_seconds: int) -> tuple[str, datetime]:
        ...

    def delete(self, *, storage_key: str) -> None:
        ...

    def is_ready(self) -> bool:
        ...


class LocalDocumentStorage:
    def __init__(self, root: Path, public_base_url: str):
        self.root = root
        self.public_base_url = public_base_url.rstrip("/")

    def put(self, *, source_path: Path, storage_key: str, content_type: str) -> str:
        destination = (self.root / storage_key).resolve()
        root = self.root.resolve()
        if root not in destination.parents and destination != root:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Invalid storage key")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, destination)
        return storage_key

    def get_download_url(self, *, storage_key: str, expires_in_seconds: int) -> tuple[str, datetime]:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        if self.public_base_url:
            return f"{self.public_base_url}/{storage_key}", expires_at
        return f"/documents/{storage_key}", expires_at

    def delete(self, *, storage_key: str) -> None:
        target = (self.root / storage_key).resolve()
        root = self.root.resolve()
        if root in target.parents or target == root:
            target.unlink(missing_ok=True)

    def is_ready(self) -> bool:
        self.root.mkdir(parents=True, exist_ok=True)
        probe = self.root / ".readyz"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True


class S3DocumentStorage:
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool,
        public_base_url: str | None = None,
    ):
        try:
            import boto3
            from botocore.client import Config
        except Exception as exc:
            raise DocumentGenerationError(
                "DOCUMENT_STORAGE_FAILED",
                "boto3 is required for S3-compatible storage",
            ) from exc

        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/") if public_base_url else None
        client_options = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "use_ssl": secure,
            "config": Config(signature_version="s3v4"),
        }
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            **client_options,
        )
        self.presign_client = boto3.client(
            "s3",
            endpoint_url=self.public_base_url or endpoint,
            **client_options,
        )

    def put(self, *, source_path: Path, storage_key: str, content_type: str) -> str:
        try:
            self.client.upload_file(
                str(source_path),
                self.bucket,
                storage_key,
                ExtraArgs={"ContentType": content_type},
            )
            return storage_key
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Storage upload failed") from exc

    def get_download_url(self, *, storage_key: str, expires_in_seconds: int) -> tuple[str, datetime]:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        try:
            return (
                self.presign_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": storage_key},
                    ExpiresIn=expires_in_seconds,
                ),
                expires_at,
            )
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Could not create download URL") from exc

    def delete(self, *, storage_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=storage_key)

    def is_ready(self) -> bool:
        try:
            self.client.head_bucket(Bucket=self.bucket)
            return True
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Storage bucket is not reachable") from exc


@dataclass(frozen=True)
class GeneratorConfig:
    template_path: Path
    mapping_path: Path
    temp_dir: Path
    pdf_engine: str
    libreoffice_binary: str
    timeout_seconds: int
    storage: DocumentStorage
    signed_url_ttl_seconds: int = DEFAULT_SIGNED_URL_TTL_SECONDS


def _cell_tag(name: str) -> str:
    return f"{{{NS_MAIN}}}{name}"


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _sanitize_filename_part(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-zА-Яа-яЁё._-]+", "-", value.strip())
    slug = re.sub(r"-{2,}", "-", slug).strip(".-")
    return slug[:80] or "commercial-proposal"


def _sanitize_storage_segment(value: str) -> str:
    return _sanitize_filename_part(value).replace("..", "-")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _is_macro_or_control_part(name: str) -> bool:
    normalized = name.replace("\\", "/").lower()
    return (
        normalized in {"xl/vbaproject.bin", "xl/vbaprojectsignature.bin"}
        or "vbaproject" in normalized
        or "vmldrawing" in normalized
        or "ctrlprops/" in normalized
        or "activex/" in normalized
        or normalized.startswith("xl/ctrlprops/")
        or normalized.startswith("xl/activex/")
        or normalized.startswith("xl/embeddings/")
        or normalized.startswith("xl/drawings/vmldrawing")
    )


def _remove_macro_content_types(content_types_xml: bytes) -> bytes:
    root = ET.fromstring(content_types_xml)
    for node in list(root):
        part_name = node.attrib.get("PartName", "").lstrip("/").lower()
        content_type = node.attrib.get("ContentType", "")
        if _is_macro_or_control_part(part_name):
            root.remove(node)
            continue
        if part_name == "xl/workbook.xml" and "macroEnabled" in content_type:
            node.attrib["ContentType"] = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
            )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _remove_macro_relationships(relationships_xml: bytes) -> bytes:
    root = ET.fromstring(relationships_xml)
    for node in list(root):
        target = node.attrib.get("Target", "")
        relationship_type = node.attrib.get("Type", "")
        if _is_macro_or_control_part(target) or relationship_type.endswith("/vbaProject"):
            root.remove(node)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _remove_macro_sheet_markup(sheet: ET.Element) -> None:
    for node in list(sheet):
        if _local_name(node.tag) in {"legacyDrawing", "controls"}:
            sheet.remove(node)


def _excel_serial(value: str) -> int:
    parsed = date.fromisoformat(value)
    epoch = date(1899, 12, 30)
    return (parsed - epoch).days


def _plural_days(days: int) -> str:
    last_two = days % 100
    last = days % 10
    if 11 <= last_two <= 14:
        form = "дней"
    elif last == 1:
        form = "день"
    elif 2 <= last <= 4:
        form = "дня"
    else:
        form = "дней"
    return f"{days} {form}"


def _as_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} must be a number")
    return float(value)


def _as_text(value: Any, field: str, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} must be a string")
    if not allow_empty and value.strip() == "":
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} is required")
    return value


def validate_payload(payload: dict[str, Any], mapping: dict[str, Any]) -> None:
    if payload.get("schemaVersion") != "1.0":
        raise DocumentGenerationError("PAYLOAD_INVALID", "schemaVersion must be 1.0")
    if payload.get("templateCode") != TEMPLATE_CODE:
        raise DocumentGenerationError("TEMPLATE_NOT_FOUND", "Unsupported templateCode")
    if str(payload.get("templateVersion")) != TEMPLATE_VERSION:
        raise DocumentGenerationError("TEMPLATE_NOT_FOUND", "Unsupported templateVersion")

    proposal = payload.get("proposal")
    customer = payload.get("customer")
    content = payload.get("content")
    if not isinstance(proposal, dict) or not isinstance(customer, dict) or not isinstance(content, dict):
        raise DocumentGenerationError("PAYLOAD_INVALID", "proposal, customer and content are required")

    for key in ("id", "number", "title", "date", "language", "currencyCode"):
        _as_text(proposal.get(key), f"proposal.{key}")

    work_items = content.get("workItems")
    plan = content.get("plan")
    if not isinstance(work_items, list) or len(work_items) == 0:
        raise DocumentGenerationError("PAYLOAD_INVALID", "content.workItems must contain at least one item")
    if len(work_items) > int(mapping["limits"]["maxWorkItems"]):
        raise DocumentGenerationError(
            "PAYLOAD_INVALID",
            f"Шаблон версии 1 поддерживает не более {mapping['limits']['maxWorkItems']} позиций работ.",
        )
    if not isinstance(plan, list) or not (int(mapping["limits"]["minPlanStages"]) <= len(plan) <= int(mapping["limits"]["maxPlanStages"])):
        raise DocumentGenerationError("PAYLOAD_INVALID", "content.plan must contain 1 to 3 stages")

    for index, item in enumerate(work_items, start=1):
        if not isinstance(item, dict):
            raise DocumentGenerationError("PAYLOAD_INVALID", f"content.workItems[{index}] must be an object")
        _as_number(item.get("quantity"), f"content.workItems[{index}].quantity")
        _as_number(item.get("rate"), f"content.workItems[{index}].rate")
        _as_number(item.get("discount"), f"content.workItems[{index}].discount")
        for key in ("block", "description", "unit"):
            _as_text(item.get(key), f"content.workItems[{index}].{key}")


def _find_row(sheet: ET.Element, row_index: int) -> ET.Element:
    sheet_data = sheet.find(_cell_tag("sheetData"))
    if sheet_data is None:
        raise DocumentGenerationError("TEMPLATE_INVALID", "sheetData is missing")
    for row in sheet_data.findall(_cell_tag("row")):
        if int(row.attrib.get("r", "0")) == row_index:
            return row
    row = ET.Element(_cell_tag("row"), {"r": str(row_index)})
    sheet_data.append(row)
    return row


def _find_or_create_cell(sheet: ET.Element, ref: str) -> ET.Element:
    row_index = int(re.sub(r"^[A-Z]+", "", ref))
    row = _find_row(sheet, row_index)
    for cell in row.findall(_cell_tag("c")):
        if cell.attrib.get("r") == ref:
            return cell
    cell = ET.Element(_cell_tag("c"), {"r": ref})
    row.append(cell)
    row[:] = sorted(row, key=lambda c: c.attrib.get("r", ""))
    return cell


def _clear_cell_children(cell: ET.Element) -> None:
    for child in list(cell):
        cell.remove(child)


def _set_text(sheet: ET.Element, ref: str, value: str) -> None:
    cell = _find_or_create_cell(sheet, ref)
    style = cell.attrib.get("s")
    cell.attrib.clear()
    cell.attrib["r"] = ref
    if style is not None:
        cell.attrib["s"] = style
    cell.attrib["t"] = "inlineStr"
    _clear_cell_children(cell)
    is_node = ET.SubElement(cell, _cell_tag("is"))
    text_node = ET.SubElement(is_node, _cell_tag("t"))
    text_node.text = value


def _set_number(sheet: ET.Element, ref: str, value: int | float) -> None:
    cell = _find_or_create_cell(sheet, ref)
    style = cell.attrib.get("s")
    cell.attrib.clear()
    cell.attrib["r"] = ref
    if style is not None:
        cell.attrib["s"] = style
    _clear_cell_children(cell)
    v_node = ET.SubElement(cell, _cell_tag("v"))
    v_node.text = str(int(value)) if float(value).is_integer() else str(value)


def _set_formula(sheet: ET.Element, ref: str, formula: str, cached_value: int | float) -> None:
    cell = _find_or_create_cell(sheet, ref)
    style = cell.attrib.get("s")
    cell.attrib.clear()
    cell.attrib["r"] = ref
    if style is not None:
        cell.attrib["s"] = style
    _clear_cell_children(cell)
    f_node = ET.SubElement(cell, _cell_tag("f"))
    f_node.text = formula
    v_node = ET.SubElement(cell, _cell_tag("v"))
    v_node.text = str(int(cached_value)) if float(cached_value).is_integer() else f"{cached_value:.2f}"


def _apply_workbook_mapping(sheet: ET.Element, payload: dict[str, Any], mapping: dict[str, Any]) -> None:
    proposal = payload["proposal"]
    customer = payload["customer"]
    contractor = payload.get("contractor") if isinstance(payload.get("contractor"), dict) else mapping["contractor"]
    content = payload["content"]
    cells = mapping["cells"]
    validity_days = int(proposal.get("validityDays") or mapping["defaults"]["validityDays"])
    contact_name = customer.get("contactName") or mapping["defaults"]["customerContactName"]

    _set_text(sheet, cells["proposalNumberPrefix"], proposal["number"])
    _set_number(sheet, cells["proposalDate"], _excel_serial(proposal["date"]))
    _set_text(sheet, cells["proposalTitle"], proposal["title"])
    _set_text(sheet, cells["customerCompanyName"], customer.get("companyName") or "Компания не указана")
    _set_text(sheet, cells["customerContactName"], contact_name)
    _set_text(sheet, cells["contractorName"], contractor["name"])
    _set_text(sheet, cells["contractorEmail"], contractor["email"])
    _set_text(sheet, cells["validityPeriod"], _plural_days(validity_days))
    _set_text(sheet, cells["currencyCode"], proposal["currencyCode"])
    _set_text(sheet, cells["contextAndGoal"], content.get("contextAndGoal") or proposal["title"])
    _set_text(sheet, cells["paymentTerms"], content.get("paymentTerms") or "Оплата: по согласованию сторон.")
    _set_text(sheet, cells["assumptions"], content.get("assumptions") or "Допущения и исключения не указаны.")
    _set_text(sheet, cells["nextStep"], content.get("nextStep") or "Согласовать состав работ и дату старта.")
    _set_text(sheet, cells["footer"], f"MIKOTON · {contractor['email']} · КП действительно в течение {validity_days} календарных дней")

    work = mapping["workItems"]
    work_items = content["workItems"]
    for offset in range(int(work["lastTemplateRow"]) - int(work["firstRow"]) + 1):
        row = int(work["firstRow"]) + offset
        item = work_items[offset] if offset < len(work_items) else None
        if item is None:
            for column in ("position", "block", "description", "quantity", "unit", "rate", "discount"):
                ref = f"{work['columns'][column]}{row}"
                if column in ("quantity", "rate", "discount"):
                    _set_number(sheet, ref, 0)
                else:
                    _set_text(sheet, ref, "")
            _set_formula(sheet, f"I{row}", f"E{row}*G{row}*(1-H{row})", 0)
            continue
        quantity = _as_number(item["quantity"], "quantity")
        rate = _as_number(item["rate"], "rate")
        discount = _as_number(item["discount"], "discount")
        line_total = quantity * rate * (1 - discount)
        _set_number(sheet, f"B{row}", int(item.get("position") or offset + 1))
        _set_text(sheet, f"C{row}", item["block"])
        _set_text(sheet, f"D{row}", item["description"])
        _set_number(sheet, f"E{row}", quantity)
        _set_text(sheet, f"F{row}", item["unit"])
        _set_number(sheet, f"G{row}", rate)
        _set_number(sheet, f"H{row}", discount)
        _set_formula(sheet, f"I{row}", f"E{row}*G{row}*(1-H{row})", line_total)

    total = sum(_as_number(item["quantity"], "quantity") * _as_number(item["rate"], "rate") * (1 - _as_number(item["discount"], "discount")) for item in work_items)
    _set_formula(sheet, "I22", work["grandTotalFormula"], total)

    plan = mapping["plan"]
    stages = content["plan"]
    for offset in range(int(plan["lastTemplateRow"]) - int(plan["firstRow"]) + 1):
        row = int(plan["firstRow"]) + offset
        stage = stages[offset] if offset < len(stages) else None
        _set_text(sheet, f"B{row}", "" if stage is None else str(stage.get("position") or offset + 1))
        _set_text(sheet, f"C{row}", "" if stage is None else _as_text(stage.get("title"), "stage.title"))
        _set_text(sheet, f"D{row}", "" if stage is None else _as_text(stage.get("result"), "stage.result"))
        _set_text(sheet, f"G{row}", "" if stage is None else _as_text(stage.get("duration"), "stage.duration"))


def generate_xlsx(payload: dict[str, Any], template_path: Path, mapping_path: Path, output_dir: Path) -> GeneratedLocalFile:
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    validate_payload(payload, mapping)
    output_dir.mkdir(parents=True, exist_ok=True)

    proposal_number = payload["proposal"]["number"]
    company_slug = _sanitize_filename_part(payload["customer"].get("companyName") or "no-company")
    file_name = f"{_sanitize_filename_part(proposal_number)}-{company_slug}.xlsx"
    output_path = output_dir / file_name

    with zipfile.ZipFile(template_path, "r") as source_zip:
        names = set(source_zip.namelist())
        missing = [name for name in REQUIRED_XLSX_TEMPLATE_PARTS if name not in names]
        if missing:
            raise DocumentGenerationError("TEMPLATE_INVALID", f"Template is missing required parts: {', '.join(missing)}")

        sheet_path = mapping["workbook"]["sheetXmlPath"]
        sheet = ET.fromstring(source_zip.read(sheet_path))
        _apply_workbook_mapping(sheet, payload, mapping)
        _remove_macro_sheet_markup(sheet)
        updated_sheet = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
            for item in source_zip.infolist():
                if _is_macro_or_control_part(item.filename):
                    continue

                if item.filename == sheet_path:
                    data = updated_sheet
                elif item.filename == "[Content_Types].xml":
                    data = _remove_macro_content_types(source_zip.read(item.filename))
                elif item.filename.endswith(".rels"):
                    data = _remove_macro_relationships(source_zip.read(item.filename))
                else:
                    data = source_zip.read(item.filename)
                target_zip.writestr(copy.copy(item), data)

    return GeneratedLocalFile(
        format="xlsx",
        file_name=file_name,
        content_type=XLSX_CONTENT_TYPE,
        size=output_path.stat().st_size,
        sha256=_sha256(output_path),
        path=output_path,
    )


def generate_pdf_from_xlsx(
    xlsx: GeneratedLocalFile,
    output_dir: Path,
    *,
    libreoffice_binary: str,
    timeout_seconds: int,
) -> GeneratedLocalFile:
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mikoton-lo-", dir=str(output_dir)) as profile_dir:
        command = [
            libreoffice_binary,
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            f"-env:UserInstallation=file://{Path(profile_dir).resolve().as_posix()}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(xlsx.path),
        ]
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise DocumentGenerationError("PDF_EXPORT_FAILED", "LibreOffice PDF export timed out") from exc
        except FileNotFoundError as exc:
            raise DocumentGenerationError("PDF_EXPORT_FAILED", "LibreOffice binary is not available") from exc

    if completed.returncode != 0:
        raise DocumentGenerationError("PDF_EXPORT_FAILED", "LibreOffice PDF export failed")

    pdf_path = output_dir / f"{xlsx.path.stem}.pdf"
    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise DocumentGenerationError("PDF_EXPORT_FAILED", "LibreOffice did not produce a PDF")
    with pdf_path.open("rb") as handle:
        if handle.read(5) != b"%PDF-":
            raise DocumentGenerationError("PDF_EXPORT_FAILED", "Generated PDF is invalid")

    return GeneratedLocalFile(
        format="pdf",
        file_name=pdf_path.name,
        content_type=PDF_CONTENT_TYPE,
        size=pdf_path.stat().st_size,
        sha256=_sha256(pdf_path),
        path=pdf_path,
    )


def _store_file(
    *,
    file: GeneratedLocalFile,
    storage: DocumentStorage,
    proposal_id: str,
    generation_id: str,
    ttl_seconds: int,
) -> StoredDocument:
    storage_key = "/".join(
        [
            "commercial-proposals",
            _sanitize_storage_segment(proposal_id),
            _sanitize_storage_segment(generation_id),
            _sanitize_storage_segment(file.file_name),
        ]
    )
    storage.put(source_path=file.path, storage_key=storage_key, content_type=file.content_type)
    download_url, expires_at = storage.get_download_url(
        storage_key=storage_key,
        expires_in_seconds=ttl_seconds,
    )
    return StoredDocument(
        id=str(uuid.uuid4()),
        format=file.format,
        file_name=file.file_name,
        content_type=file.content_type,
        size=file.size,
        sha256=file.sha256,
        storage_key=storage_key,
        download_url=download_url,
        download_url_expires_at=expires_at.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    )


def _generation_id(payload: dict[str, Any], idempotency_key: str) -> str:
    seed = f"{payload['proposal']['id']}:{idempotency_key}:{TEMPLATE_VERSION}"
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def generate_documents(
    payload: dict[str, Any],
    template_path: Path,
    mapping_path: Path,
    output_dir: Path,
    *,
    storage: DocumentStorage | None = None,
    idempotency_key: str | None = None,
    libreoffice_binary: str = "libreoffice",
    timeout_seconds: int = 60,
    signed_url_ttl_seconds: int = DEFAULT_SIGNED_URL_TTL_SECONDS,
) -> dict[str, Any]:
    generation_key = idempotency_key or f"{payload['proposal']['id']}:{payload['proposal']['number']}"
    generation_id = _generation_id(payload, generation_key)
    generation_dir = output_dir / generation_id
    generation_dir.mkdir(parents=True, exist_ok=True)

    xlsx = generate_xlsx(payload, template_path, mapping_path, generation_dir)
    pdf = generate_pdf_from_xlsx(
        xlsx,
        generation_dir,
        libreoffice_binary=libreoffice_binary,
        timeout_seconds=timeout_seconds,
    )
    document_storage = storage or LocalDocumentStorage(generation_dir / "storage", "")
    stored_files = [
        _store_file(
            file=xlsx,
            storage=document_storage,
            proposal_id=payload["proposal"]["id"],
            generation_id=generation_id,
            ttl_seconds=signed_url_ttl_seconds,
        ),
        _store_file(
            file=pdf,
            storage=document_storage,
            proposal_id=payload["proposal"]["id"],
            generation_id=generation_id,
            ttl_seconds=signed_url_ttl_seconds,
        ),
    ]

    return {
        "status": "success",
        "generationId": generation_id,
        "templateCode": TEMPLATE_CODE,
        "templateVersion": TEMPLATE_VERSION,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "files": [
            {
                "id": file.id,
                "format": file.format,
                "fileName": file.file_name,
                "contentType": file.content_type,
                "size": file.size,
                "sha256": file.sha256,
                "storageKey": file.storage_key,
                "downloadUrl": file.download_url,
                "downloadUrlExpiresAt": file.download_url_expires_at,
            }
            for file in stored_files
        ],
    }


def storage_from_environment() -> DocumentStorage:
    storage_type = os.environ.get("DOCUMENT_STORAGE_TYPE", "local").lower()
    if storage_type == "local":
        root = Path(os.environ.get("DOCUMENT_STORAGE_PATH", "/var/lib/mikoton-document-service/storage"))
        return LocalDocumentStorage(root, os.environ.get("DOCUMENT_PUBLIC_BASE_URL", ""))
    if storage_type in {"s3", "s3-compatible", "minio"}:
        return S3DocumentStorage(
            endpoint=os.environ["MINIO_ENDPOINT"],
            access_key=os.environ["MINIO_ACCESS_KEY"],
            secret_key=os.environ["MINIO_SECRET_KEY"],
            bucket=os.environ.get("MINIO_BUCKET", "commercial-proposals"),
            secure=os.environ.get("MINIO_SECURE", "false").lower() == "true",
            public_base_url=os.environ.get("MINIO_PUBLIC_BASE_URL") or None,
        )
    raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", f"Unsupported storage type: {storage_type}")


def config_from_environment(project_root: Path) -> GeneratorConfig:
    template_path = Path(
        os.environ.get(
            "DOCUMENT_TEMPLATE_PATH",
            str(project_root / "templates" / "mikoton-commercial-proposal-v1.xlsm"),
        )
    )
    mapping_path = Path(
        os.environ.get(
            "DOCUMENT_MAPPING_PATH",
            str(project_root / "templates" / "mikoton-commercial-proposal-v1.mapping.json"),
        )
    )
    temp_dir = Path(os.environ.get("DOCUMENT_TEMP_PATH", "/tmp/mikoton-document-service"))
    return GeneratorConfig(
        template_path=template_path,
        mapping_path=mapping_path,
        temp_dir=temp_dir,
        pdf_engine=os.environ.get("PDF_ENGINE", "libreoffice").lower(),
        libreoffice_binary=os.environ.get("LIBREOFFICE_BINARY", "libreoffice"),
        timeout_seconds=int(os.environ.get("GENERATION_TIMEOUT_SECONDS", "60")),
        storage=storage_from_environment(),
        signed_url_ttl_seconds=int(
            os.environ.get("DOCUMENT_SIGNED_URL_TTL_SECONDS", str(DEFAULT_SIGNED_URL_TTL_SECONDS))
        ),
    )


def readiness(config: GeneratorConfig) -> dict[str, Any]:
    checks = {
        "template": config.template_path.exists(),
        "mapping": config.mapping_path.exists(),
        "tempWritable": False,
        "storage": False,
        "pdfEngine": False,
    }
    try:
        config.temp_dir.mkdir(parents=True, exist_ok=True)
        probe = config.temp_dir / ".readyz"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        checks["tempWritable"] = True
    except Exception:
        checks["tempWritable"] = False
    try:
        checks["storage"] = config.storage.is_ready()
    except Exception:
        checks["storage"] = False
    checks["pdfEngine"] = config.pdf_engine == "libreoffice" and shutil.which(config.libreoffice_binary) is not None
    return {"ready": all(checks.values()), "checks": checks}
