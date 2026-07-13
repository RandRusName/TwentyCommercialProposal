from __future__ import annotations

import copy
import hashlib
import json
import re
import zipfile
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
ET.register_namespace("", NS_MAIN)

TEMPLATE_CODE = "mikoton-commercial-proposal"
TEMPLATE_VERSION = "1"
XLSM_CONTENT_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12"
PDF_CONTENT_TYPE = "application/pdf"
REQUIRED_XLSM_PARTS = (
    "xl/vbaProject.bin",
    "xl/drawings/drawing1.xml",
    "xl/drawings/vmlDrawing1.vml",
    "xl/ctrlProps/ctrlProp1.xml",
    "xl/printerSettings/printerSettings1.bin",
)


class DocumentGenerationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class GeneratedFile:
    format: str
    file_name: str
    content_type: str
    size: int
    sha256: str
    url: str
    path: Path


def _cell_tag(name: str) -> str:
    return f"{{{NS_MAIN}}}{name}"


def _sanitize_filename_part(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-zА-Яа-яЁё._-]+", "-", value.strip())
    slug = re.sub(r"-{2,}", "-", slug).strip(".-")
    return slug[:80] or "commercial-proposal"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
            f"content.workItems supports at most {mapping['limits']['maxWorkItems']} items in template v1",
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

    _set_text(sheet, cells["proposalNumberPrefix"], f"КП № {proposal['number']} от")
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


def generate_xlsm(payload: dict[str, Any], template_path: Path, mapping_path: Path, output_dir: Path) -> GeneratedFile:
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    validate_payload(payload, mapping)
    output_dir.mkdir(parents=True, exist_ok=True)

    proposal_number = payload["proposal"]["number"]
    company_slug = _sanitize_filename_part(payload["customer"].get("companyName") or "no-company")
    file_name = f"{_sanitize_filename_part(proposal_number)}-{company_slug}.xlsm"
    output_path = output_dir / file_name

    with zipfile.ZipFile(template_path, "r") as source_zip:
        names = set(source_zip.namelist())
        missing = [name for name in REQUIRED_XLSM_PARTS if name not in names]
        if missing:
            raise DocumentGenerationError("TEMPLATE_INVALID", f"Template is missing required parts: {', '.join(missing)}")

        sheet_path = mapping["workbook"]["sheetXmlPath"]
        sheet = ET.fromstring(source_zip.read(sheet_path))
        _apply_workbook_mapping(sheet, payload, mapping)
        updated_sheet = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
            for item in source_zip.infolist():
                data = updated_sheet if item.filename == sheet_path else source_zip.read(item.filename)
                target_zip.writestr(copy.copy(item), data)

    return GeneratedFile(
        format="xlsm",
        file_name=file_name,
        content_type=XLSM_CONTENT_TYPE,
        size=output_path.stat().st_size,
        sha256=_sha256(output_path),
        url=output_path.resolve().as_uri(),
        path=output_path,
    )


def generate_pdf(payload: dict[str, Any], output_dir: Path) -> GeneratedFile:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
    except Exception as exc:
        raise DocumentGenerationError("PDF_EXPORT_FAILED", "ReportLab PDF engine is unavailable") from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    proposal_number = payload["proposal"]["number"]
    company_slug = _sanitize_filename_part(payload["customer"].get("companyName") or "no-company")
    file_name = f"{_sanitize_filename_part(proposal_number)}-{company_slug}.pdf"
    output_path = output_dir / file_name

    font_name = "Helvetica"
    font_candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for font_path in font_candidates:
        if font_path.exists():
            pdfmetrics.registerFont(TTFont("MikotonSans", str(font_path)))
            font_name = "MikotonSans"
            break

    proposal = payload["proposal"]
    customer = payload["customer"]
    content = payload["content"]
    page = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    y = height - 50

    def line(text: str, size: int = 10, gap: int = 16) -> None:
        nonlocal y
        page.setFont(font_name, size)
        page.drawString(40, y, text[:120])
        y -= gap

    line("КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", 16, 24)
    line(f"КП № {proposal['number']} от {proposal['date']}", 11)
    line(proposal["title"], 12, 22)
    line(f"Заказчик: {customer.get('companyName') or 'Компания не указана'}")
    line(f"Контакт: {customer.get('contactName') or 'Не указан'}")
    line(f"Валюта: {proposal['currencyCode']}; срок действия: {proposal.get('validityDays', 14)} дней", 10, 22)
    line("Работы:", 12)
    total = 0.0
    for item in content["workItems"]:
        line_total = float(item["quantity"]) * float(item["rate"]) * (1 - float(item["discount"]))
        total += line_total
        line(f"{item.get('position')}. {item['block']}: {item['description']} — {line_total:,.2f} {proposal['currencyCode']}")
    line(f"Итого: {total:,.2f} {proposal['currencyCode']}", 12, 22)
    line("План:", 12)
    for stage in content["plan"]:
        line(f"{stage.get('position')}. {stage['title']} — {stage['duration']}: {stage['result']}")
    page.showPage()
    page.save()

    return GeneratedFile(
        format="pdf",
        file_name=file_name,
        content_type=PDF_CONTENT_TYPE,
        size=output_path.stat().st_size,
        sha256=_sha256(output_path),
        url=output_path.resolve().as_uri(),
        path=output_path,
    )


def generate_documents(payload: dict[str, Any], template_path: Path, mapping_path: Path, output_dir: Path) -> dict[str, Any]:
    xlsm = generate_xlsm(payload, template_path, mapping_path, output_dir)
    pdf = generate_pdf(payload, output_dir)
    return {
        "status": "success",
        "generationId": hashlib.sha256(f"{payload['proposal']['id']}:{payload['proposal']['number']}:{TEMPLATE_VERSION}".encode()).hexdigest()[:32],
        "templateCode": TEMPLATE_CODE,
        "templateVersion": TEMPLATE_VERSION,
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "files": [
            {k: getattr(xlsm, k) for k in ("format", "file_name", "content_type", "size", "sha256", "url")},
            {k: getattr(pdf, k) for k in ("format", "file_name", "content_type", "size", "sha256", "url")},
        ],
    }
