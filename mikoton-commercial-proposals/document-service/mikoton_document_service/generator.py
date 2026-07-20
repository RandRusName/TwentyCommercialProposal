from __future__ import annotations

import copy
import hashlib
import json
import math
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

    def exists(self, *, storage_key: str) -> bool:
        ...

    def get_bytes(self, *, storage_key: str) -> bytes:
        ...

    def put_bytes(self, *, data: bytes, storage_key: str, content_type: str) -> str:
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

    def exists(self, *, storage_key: str) -> bool:
        target = (self.root / storage_key).resolve()
        return self.root.resolve() in target.parents and target.is_file()

    def get_bytes(self, *, storage_key: str) -> bytes:
        if not self.exists(storage_key=storage_key):
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Stored document is missing")
        return (self.root / storage_key).read_bytes()

    def put_bytes(self, *, data: bytes, storage_key: str, content_type: str) -> str:
        destination = (self.root / storage_key).resolve()
        if self.root.resolve() not in destination.parents:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Invalid storage key")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return storage_key

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

    def exists(self, *, storage_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception:
            return False

    def get_bytes(self, *, storage_key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=storage_key)["Body"].read()
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Stored document is missing") from exc

    def put_bytes(self, *, data: bytes, storage_key: str, content_type: str) -> str:
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=storage_key,
                Body=data,
                ContentType=content_type,
            )
            return storage_key
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Storage upload failed") from exc

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


def _set_print_area(
    workbook_xml: bytes,
    sheet_name: str,
    print_area: str,
    repeat_rows: str | None = None,
) -> bytes:
    workbook = ET.fromstring(workbook_xml)
    defined_names = workbook.find(_cell_tag("definedNames"))
    if defined_names is None:
        defined_names = ET.SubElement(workbook, _cell_tag("definedNames"))
    for node in list(defined_names):
        if node.attrib.get("name") in {"_xlnm.Print_Area", "_xlnm.Print_Titles"}:
            defined_names.remove(node)
    defined_name = ET.SubElement(
        defined_names,
        _cell_tag("definedName"),
        {"name": "_xlnm.Print_Area", "localSheetId": "0"},
    )
    area = print_area.split("!", 1)[-1]
    defined_name.text = f"'{sheet_name}'!{area}"
    if repeat_rows:
        titles = ET.SubElement(
            defined_names,
            _cell_tag("definedName"),
            {"name": "_xlnm.Print_Titles", "localSheetId": "0"},
        )
        titles.text = f"'{sheet_name}'!{repeat_rows}"
    return ET.tostring(workbook, encoding="utf-8", xml_declaration=True)


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
    result = float(value)
    if not math.isfinite(result):
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} must be finite")
    return result


def _as_text(value: Any, field: str, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} must be a string")
    if not allow_empty and value.strip() == "":
        raise DocumentGenerationError("PAYLOAD_INVALID", f"{field} is required")
    return value


def validate_payload(payload: dict[str, Any], mapping: dict[str, Any]) -> None:
    schema_version = str(payload.get("schemaVersion"))
    template_version = str(payload.get("templateVersion"))
    expected_schema = "1.0" if template_version == "1" else "2.0" if template_version == "2" else None
    if expected_schema is None or schema_version != expected_schema:
        raise DocumentGenerationError(
            "DOCUMENT_SCHEMA_TEMPLATE_MISMATCH",
            "schemaVersion and templateVersion do not match",
        )
    if payload.get("templateCode") != TEMPLATE_CODE:
        raise DocumentGenerationError("TEMPLATE_NOT_FOUND", "Unsupported templateCode")
    if template_version != str(mapping.get("templateVersion")):
        raise DocumentGenerationError("DOCUMENT_SCHEMA_TEMPLATE_MISMATCH", "Mapping version does not match payload")

    proposal = payload.get("proposal")
    customer = payload.get("customer")
    content = payload.get("content")
    if not isinstance(proposal, dict) or not isinstance(customer, dict) or not isinstance(content, dict):
        raise DocumentGenerationError("PAYLOAD_INVALID", "proposal, customer and content are required")

    for key in ("id", "number", "title", "date", "language", "currencyCode"):
        _as_text(proposal.get(key), f"proposal.{key}")
    if schema_version == "2.0":
        total = _as_number(proposal.get("amount"), "proposal.amount")
        if total <= 0:
            raise DocumentGenerationError("PAYLOAD_INVALID", "proposal.amount must be greater than zero")

    work_items = content.get("workItems")
    plan = content.get("plan")
    if not isinstance(work_items, list) or len(work_items) == 0:
        raise DocumentGenerationError("PAYLOAD_INVALID", "content.workItems must contain at least one item")
    if len(work_items) > int(mapping["limits"]["maxWorkItems"]):
        raise DocumentGenerationError(
            "PAYLOAD_INVALID",
            f"Template version {template_version} supports at most {mapping['limits']['maxWorkItems']} work items",
        )
    if not isinstance(plan, list) or not (int(mapping["limits"]["minPlanStages"]) <= len(plan) <= int(mapping["limits"]["maxPlanStages"])):
        raise DocumentGenerationError("PAYLOAD_INVALID", "content.plan is outside template limits")

    for index, item in enumerate(work_items, start=1):
        if not isinstance(item, dict):
            raise DocumentGenerationError("PAYLOAD_INVALID", f"content.workItems[{index}] must be an object")
        _as_number(item.get("quantity"), f"content.workItems[{index}].quantity")
        price_key = "rate" if schema_version == "1.0" else "unitPrice"
        discount_key = "discount" if schema_version == "1.0" else "discountPercent"
        _as_number(item.get(price_key), f"content.workItems[{index}].{price_key}")
        _as_number(item.get(discount_key), f"content.workItems[{index}].{discount_key}")
        if schema_version == "2.0":
            _as_number(item.get("lineAmount"), f"content.workItems[{index}].lineAmount")
        for key in (("block", "description", "unit") if schema_version == "1.0" else ("block", "name", "unit")):
            _as_text(item.get(key), f"content.workItems[{index}].{key}")

    for index, stage in enumerate(plan, start=1):
        if not isinstance(stage, dict):
            raise DocumentGenerationError("PAYLOAD_INVALID", f"content.plan[{index}] must be an object")
        for key in ("title", "result", "duration"):
            _as_text(stage.get(key), f"content.plan[{index}].{key}")


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


def _set_row_hidden(sheet: ET.Element, row_index: int, hidden: bool) -> None:
    row = _find_row(sheet, row_index)
    if hidden:
        row.attrib["hidden"] = "1"
    else:
        row.attrib.pop("hidden", None)


def _apply_page_setup(sheet: ET.Element, page_setup: dict[str, Any] | None) -> None:
    if not page_setup:
        return
    sheet_pr = sheet.find(_cell_tag("sheetPr"))
    if sheet_pr is None:
        sheet_pr = ET.Element(_cell_tag("sheetPr"))
        sheet.insert(0, sheet_pr)
    page_setup_pr = sheet_pr.find(_cell_tag("pageSetUpPr"))
    if page_setup_pr is None:
        page_setup_pr = ET.SubElement(sheet_pr, _cell_tag("pageSetUpPr"))
    page_setup_pr.attrib["fitToPage"] = "1"

    margins = sheet.find(_cell_tag("pageMargins"))
    if margins is None:
        margins = ET.SubElement(sheet, _cell_tag("pageMargins"))
    margins.attrib.update({
        "left": "0.25", "right": "0.25", "top": "0.4", "bottom": "0.4",
        "header": "0.15", "footer": "0.15",
    })
    setup = sheet.find(_cell_tag("pageSetup"))
    if setup is None:
        setup = ET.SubElement(sheet, _cell_tag("pageSetup"))
    setup.attrib.update({
        "orientation": str(page_setup.get("orientation", "landscape")),
        "fitToWidth": str(page_setup.get("fitToWidth", 1)),
        "fitToHeight": str(page_setup.get("fitToHeight", 0)),
        "paperSize": str(page_setup.get("paperSize", 9)),
    })


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
    schema_v2 = payload["schemaVersion"] == "2.0"
    for offset in range(int(work["lastTemplateRow"]) - int(work["firstRow"]) + 1):
        row = int(work["firstRow"]) + offset
        item = work_items[offset] if offset < len(work_items) else None
        _set_row_hidden(sheet, row, item is None)
        if item is None:
            empty_columns = (
                ("position", "block", "name", "description", "quantity", "unit", "unitPrice", "discountPercent")
                if schema_v2
                else ("position", "block", "description", "quantity", "unit", "rate", "discount")
            )
            for column in empty_columns:
                ref = f"{work['columns'][column]}{row}"
                if column in ("quantity", "rate", "discount", "unitPrice", "discountPercent"):
                    _set_number(sheet, ref, 0)
                else:
                    _set_text(sheet, ref, "")
            total_ref = f"{work['columns']['lineTotal']}{row}"
            _set_formula(sheet, total_ref, work["lineTotalFormula"].format(row=row), 0)
            continue
        quantity = _as_number(item["quantity"], "quantity")
        price_key = "unitPrice" if schema_v2 else "rate"
        discount_key = "discountPercent" if schema_v2 else "discount"
        rate = _as_number(item[price_key], price_key)
        discount = _as_number(item[discount_key], discount_key)
        line_total = _as_number(item["lineAmount"], "lineAmount") if schema_v2 else quantity * rate * (1 - discount)
        values = {
            "position": int(item.get("position") or offset + 1),
            "block": item["block"],
            "description": item.get("description") or "",
            "quantity": quantity,
            "unit": item["unit"],
            price_key: rate,
            discount_key: discount,
        }
        if schema_v2:
            values["name"] = item["name"]
        for key, value in values.items():
            ref = f"{work['columns'][key]}{row}"
            if isinstance(value, (int, float)):
                _set_number(sheet, ref, value)
            else:
                _set_text(sheet, ref, value)
        total_ref = f"{work['columns']['lineTotal']}{row}"
        _set_formula(sheet, total_ref, work["lineTotalFormula"].format(row=row), line_total)

    total = (
        _as_number(proposal["amount"], "proposal.amount")
        if schema_v2
        else sum(_as_number(item["quantity"], "quantity") * _as_number(item["rate"], "rate") * (1 - _as_number(item["discount"], "discount")) for item in work_items)
    )
    _set_formula(sheet, work["grandTotalCell"], work["grandTotalFormula"], total)

    plan = mapping["plan"]
    stages = content["plan"]
    for offset in range(int(plan["lastTemplateRow"]) - int(plan["firstRow"]) + 1):
        row = int(plan["firstRow"]) + offset
        stage = stages[offset] if offset < len(stages) else None
        _set_row_hidden(sheet, row, stage is None)
        for key in ("position", "title", "result", "duration", "description"):
            if key not in plan["columns"]:
                continue
            value = "" if stage is None else stage.get(key, "")
            _set_text(sheet, f"{plan['columns'][key]}{row}", str(value or ""))


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
        required_parts = tuple(mapping["workbook"].get("requiredParts", REQUIRED_XLSX_TEMPLATE_PARTS))
        missing = [name for name in required_parts if name not in names]
        if missing:
            raise DocumentGenerationError("TEMPLATE_INVALID", f"Template is missing required parts: {', '.join(missing)}")

        sheet_path = mapping["workbook"]["sheetXmlPath"]
        sheet = ET.fromstring(source_zip.read(sheet_path))
        _apply_workbook_mapping(sheet, payload, mapping)
        _apply_page_setup(sheet, mapping["workbook"].get("pageSetup"))
        _remove_macro_sheet_markup(sheet)
        updated_sheet = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
            for item in source_zip.infolist():
                if _is_macro_or_control_part(item.filename):
                    continue

                if item.filename == sheet_path:
                    data = updated_sheet
                elif item.filename == "xl/workbook.xml":
                    data = _set_print_area(
                        source_zip.read(item.filename),
                        mapping["workbook"]["sheetName"],
                        mapping["workbook"]["printArea"],
                        mapping["workbook"].get("pageSetup", {}).get("repeatRows"),
                    )
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
    seed = f"{payload['proposal']['id']}:{idempotency_key}:{payload['templateVersion']}"
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def _snapshot_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _refresh_manifest_urls(
    manifest: dict[str, Any], storage: DocumentStorage, ttl_seconds: int
) -> dict[str, Any]:
    files = manifest.get("files")
    if not isinstance(files, list):
        raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Generation manifest is invalid")
    refreshed = []
    for file in files:
        storage_key = file.get("storageKey") if isinstance(file, dict) else None
        if not isinstance(storage_key, str) or not storage.exists(storage_key=storage_key):
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Generated file referenced by manifest is missing")
        url, expires_at = storage.get_download_url(
            storage_key=storage_key, expires_in_seconds=ttl_seconds
        )
        refreshed.append(
            {
                **file,
                "downloadUrl": url,
                "downloadUrlExpiresAt": expires_at.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            }
        )
    return {**manifest, "status": "success", "files": refreshed}


def generate_documents(
    payload: dict[str, Any],
    template_path: Path,
    mapping_path: Path,
    output_dir: Path,
    *,
    storage: DocumentStorage | None = None,
    idempotency_key: str | None = None,
    snapshot_hash: str | None = None,
    libreoffice_binary: str = "libreoffice",
    timeout_seconds: int = 60,
    signed_url_ttl_seconds: int = DEFAULT_SIGNED_URL_TTL_SECONDS,
) -> dict[str, Any]:
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    validate_payload(payload, mapping)
    actual_snapshot_hash = _snapshot_hash(payload)
    if snapshot_hash is not None and snapshot_hash != actual_snapshot_hash:
        raise DocumentGenerationError("SNAPSHOT_HASH_MISMATCH", "snapshotHash does not match payload")
    generation_key = idempotency_key or f"{payload['proposal']['id']}:{payload['proposal']['number']}"
    generation_id = _generation_id(payload, generation_key)
    generation_dir = output_dir / generation_id
    generation_dir.mkdir(parents=True, exist_ok=True)
    document_storage = storage or LocalDocumentStorage(generation_dir / "storage", "")
    manifest_key = "/".join(
        [
            "commercial-proposals",
            _sanitize_storage_segment(payload["proposal"]["id"]),
            _sanitize_storage_segment(generation_id),
            "manifest.json",
        ]
    )

    if document_storage.exists(storage_key=manifest_key):
        try:
            manifest = json.loads(document_storage.get_bytes(storage_key=manifest_key).decode("utf-8"))
        except Exception as exc:
            raise DocumentGenerationError("DOCUMENT_STORAGE_FAILED", "Generation manifest is unreadable") from exc
        if manifest.get("idempotencyKey") != generation_key:
            raise DocumentGenerationError("GENERATION_IDEMPOTENCY_CONFLICT", "Generation identity is inconsistent")
        if manifest.get("snapshotHash") != actual_snapshot_hash:
            raise DocumentGenerationError("GENERATION_IDEMPOTENCY_CONFLICT", "Idempotency key was used with another snapshot")
        return _refresh_manifest_urls(manifest, document_storage, signed_url_ttl_seconds)

    xlsx = generate_xlsx(payload, template_path, mapping_path, generation_dir)
    pdf = generate_pdf_from_xlsx(
        xlsx,
        generation_dir,
        libreoffice_binary=libreoffice_binary,
        timeout_seconds=timeout_seconds,
    )
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

    result = {
        "status": "success",
        "generationId": generation_id,
        "templateCode": TEMPLATE_CODE,
        "templateVersion": str(payload["templateVersion"]),
        "schemaVersion": str(payload["schemaVersion"]),
        "snapshotHash": actual_snapshot_hash,
        "idempotencyKey": generation_key,
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
    document_storage.put_bytes(
        data=json.dumps(result, ensure_ascii=False, sort_keys=True).encode("utf-8"),
        storage_key=manifest_key,
        content_type="application/json",
    )
    return result


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


def resolve_template_paths(
    payload: dict[str, Any], project_root: Path
) -> tuple[Path, Path]:
    version = str(payload.get("templateVersion"))
    schema = str(payload.get("schemaVersion"))
    registry = {
        ("1.0", "1"): (
            "DOCUMENT_TEMPLATE_V1_PATH",
            project_root / "templates" / "mikoton-commercial-proposal-v1.xlsm",
            "DOCUMENT_MAPPING_V1_PATH",
            project_root / "templates" / "mikoton-commercial-proposal-v1.mapping.json",
        ),
        ("2.0", "2"): (
            "DOCUMENT_TEMPLATE_V2_PATH",
            project_root / "templates" / "mikoton-commercial-proposal-v2.xlsx",
            "DOCUMENT_MAPPING_V2_PATH",
            project_root / "templates" / "mikoton-commercial-proposal-v2.mapping.json",
        ),
    }
    entry = registry.get((schema, version))
    if entry is None:
        raise DocumentGenerationError(
            "DOCUMENT_SCHEMA_TEMPLATE_MISMATCH",
            "Unsupported schema/template pair",
        )
    template_env, template_default, mapping_env, mapping_default = entry
    return (
        Path(os.environ.get(template_env, str(template_default))),
        Path(os.environ.get(mapping_env, str(mapping_default))),
    )


def readiness(config: GeneratorConfig) -> dict[str, Any]:
    project_root = Path(__file__).resolve().parents[2]
    v2_template, v2_mapping = resolve_template_paths(
        {"schemaVersion": "2.0", "templateVersion": "2"}, project_root
    )
    checks = {
        "template": config.template_path.exists(),
        "mapping": config.mapping_path.exists(),
        "templateV2": v2_template.exists(),
        "mappingV2": v2_mapping.exists(),
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
