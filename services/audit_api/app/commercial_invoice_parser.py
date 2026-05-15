from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re
import shutil
import subprocess


MIN_TEXT_LENGTH = 40
INVOICE_MARKER_RE = re.compile(
    r"\b(?:invoice\s*(?:no\.?|number|#)|factura|num\.?\s*factura|commercial\s+invoice)\b",
    re.I,
)
INVOICE_NUMBER_PATTERNS = [
    r"\b(?:invoice\s*(?:no\.?|number|#)|factura|num\.?\s*factura)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})",
    r"\b(?:no\.?\s*(?:de\s*)?factura)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})",
]
DATE_RE = r"(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})|\d{4}[/-]\d{1,2}[/-]\d{1,2})"
MONEY_RE = r"([$]?\s*[\d,]+(?:\.\d{2,})?)"
CURRENCY_RE = re.compile(r"\b(USD|MXN|EUR|CAD|GBP|JPY|CNY)\b", re.I)
INCOTERM_RE = re.compile(r"\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b", re.I)
COVE_RE = re.compile(r"\b(COVE[A-Z0-9]{6,30})\b", re.I)
EXCHANGE_RATE_RE = re.compile(
    r"\b(?:exchange\s*rate|rate\s*of\s*exchange|tipo\s*(?:de\s*)?cambio|t\.?\s*cambio|tc)\s*[:=.-]?\s*([0-9]+(?:\.[0-9]+)?)",
    re.I,
)


@dataclass
class CommercialInvoiceParseResult:
    invoice_details: list[dict[str, object | None]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    used_ocr: bool = False


def parse_commercial_invoice_pdf(pdf_path: Path, source_file: str, work_dir: Path) -> CommercialInvoiceParseResult:
    pages = _extract_pdf_text_by_page(pdf_path)
    used_ocr = False

    if not _has_enough_text(pages):
        used_ocr = True
        pages = _ocr_pdf_by_page(pdf_path, work_dir)

    if not _has_enough_text(pages):
        return CommercialInvoiceParseResult(
            errors=["Factura comercial cargada, pero no fue posible extraer texto; requiere OCR/manual review."],
            used_ocr=used_ocr,
        )

    invoices = _extract_invoices_from_pages(pages, source_file)

    if not invoices:
        return CommercialInvoiceParseResult(
            errors=["Factura comercial cargada, pero no fue posible segmentar facturas; requiere revisión manual."],
            used_ocr=used_ocr,
        )

    return CommercialInvoiceParseResult(invoice_details=invoices, used_ocr=used_ocr)


def _extract_pdf_text_by_page(pdf_path: Path) -> list[tuple[int, str]]:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        return []

    page_count = _pdf_page_count(pdf_path)
    if page_count <= 0:
        output = _run_text_command([pdftotext, "-layout", str(pdf_path), "-"])
        return [(1, output)] if output else []

    pages: list[tuple[int, str]] = []
    for page in range(1, page_count + 1):
        output = _run_text_command([pdftotext, "-layout", "-f", str(page), "-l", str(page), str(pdf_path), "-"])
        pages.append((page, output))

    return pages


def _ocr_pdf_by_page(pdf_path: Path, work_dir: Path) -> list[tuple[int, str]]:
    pdftoppm = shutil.which("pdftoppm")
    tesseract = shutil.which("tesseract")
    if not pdftoppm or not tesseract:
        return []

    page_count = max(_pdf_page_count(pdf_path), 1)
    ocr_dir = work_dir / "commercial-invoice-ocr"
    ocr_dir.mkdir(parents=True, exist_ok=True)
    pages: list[tuple[int, str]] = []

    for page in range(1, page_count + 1):
        image_prefix = ocr_dir / f"page-{page}"
        image_path = image_prefix.with_suffix(".png")
        try:
            subprocess.run(
                [pdftoppm, "-f", str(page), "-l", str(page), "-png", "-singlefile", str(pdf_path), str(image_prefix)],
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = _run_tesseract(tesseract, image_path)
        except (OSError, subprocess.SubprocessError):
            output = ""

        pages.append((page, output))

    return pages


def _run_tesseract(tesseract: str, image_path: Path) -> str:
    for command in (
        [tesseract, str(image_path), "stdout", "-l", "eng+spa"],
        [tesseract, str(image_path), "stdout", "-l", "eng"],
        [tesseract, str(image_path), "stdout"],
    ):
        output = _run_text_command(command)
        if output.strip():
            return output

    return ""


def _pdf_page_count(pdf_path: Path) -> int:
    pdfinfo = shutil.which("pdfinfo")
    if not pdfinfo:
        return 0

    output = _run_text_command([pdfinfo, str(pdf_path)])
    match = re.search(r"^Pages:\s*(\d+)", output, re.M)
    return int(match.group(1)) if match else 0


def _run_text_command(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=45)
    except (OSError, subprocess.SubprocessError):
        return ""

    if result.returncode != 0:
        return ""

    return result.stdout or ""


def _has_enough_text(pages: list[tuple[int, str]]) -> bool:
    return sum(len(text.strip()) for _, text in pages) >= MIN_TEXT_LENGTH


def _extract_invoices_from_pages(pages: list[tuple[int, str]], source_file: str) -> list[dict[str, object | None]]:
    segments = _segment_pages(pages)
    invoices: list[dict[str, object | None]] = []
    seen: set[tuple[str, str]] = set()

    for page_start, page_end, text in segments:
        invoice = _parse_invoice_segment(text, source_file, page_start, page_end)
        invoice_number = str(invoice.get("invoice_number") or "")

        if not invoice_number:
            continue

        dedupe_key = (invoice_number.upper(), str(invoice.get("page_range") or ""))
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        invoices.append(invoice)

    return invoices


def _segment_pages(pages: list[tuple[int, str]]) -> list[tuple[int, int, str]]:
    segments: list[tuple[int, int, str]] = []
    current_pages: list[int] = []
    current_text: list[str] = []
    current_invoice = ""

    for page_number, page_text in pages:
        page_segments = _split_page_by_invoice_markers(page_text)

        if not page_segments:
            if current_text:
                current_pages.append(page_number)
                current_text.append(page_text)
            continue

        for segment in page_segments:
            invoice_number = _invoice_number(segment)
            starts_new_invoice = bool(invoice_number and invoice_number != current_invoice)

            if starts_new_invoice and current_text and current_invoice:
                segments.append((min(current_pages), max(current_pages), "\n".join(current_text)))
                current_pages = []
                current_text = []

            current_pages.append(page_number)
            current_text.append(segment)
            if invoice_number:
                current_invoice = invoice_number

    if current_text:
        segments.append((min(current_pages), max(current_pages), "\n".join(current_text)))

    return segments


def _split_page_by_invoice_markers(text: str) -> list[str]:
    markers = [match.start() for match in INVOICE_MARKER_RE.finditer(text)]
    if not markers:
        return []

    starts = _dedupe_close_positions([0, *markers])
    segments: list[str] = []

    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        segment = text[start:end].strip()
        if segment:
            segments.append(segment)

    return segments


def _dedupe_close_positions(positions: list[int]) -> list[int]:
    deduped: list[int] = []
    for position in sorted(set(positions)):
        if deduped and position - deduped[-1] < 80:
            continue
        deduped.append(position)
    return deduped


def _parse_invoice_segment(text: str, source_file: str, page_start: int, page_end: int) -> dict[str, object | None]:
    invoice_number = _invoice_number(text)
    invoice_date = _invoice_date(text)
    currency = _currency(text)
    amount = _amount(text)
    exchange_rate = _exchange_rate(text)

    return {
        "invoice_number": invoice_number,
        "provider_name": _provider_name(text),
        "date": invoice_date,
        "invoice_date": invoice_date,
        "currency": currency,
        "amount": amount,
        "exchange_rate": exchange_rate,
        "incoterm": _incoterm(text),
        "cove": _cove(text),
        "source_file": source_file,
        "page_range": str(page_start) if page_start == page_end else f"{page_start}-{page_end}",
    }


def _invoice_number(text: str) -> str:
    for pattern in INVOICE_NUMBER_PATTERNS:
        match = re.search(pattern, text, re.I)
        if match:
            return _clean_token(match.group(1))

    return ""


def _provider_name(text: str) -> str:
    labeled_patterns = [
        r"\b(?:provider|supplier|seller|vendor|exporter|shipper|proveedor|vendedor)\s*[:.-]\s*(.+)",
        r"\b(?:sold\s+by|issued\s+by)\s*[:.-]\s*(.+)",
    ]

    for pattern in labeled_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            candidate = _clean_line(match.group(1))
            if _valid_provider_line(candidate):
                return candidate

    for line in text.splitlines()[:16]:
        candidate = _clean_line(line)
        if _valid_provider_line(candidate):
            return candidate

    return ""


def _invoice_date(text: str) -> str:
    labeled_patterns = [
        rf"\b(?:invoice\s+date|fecha\s+(?:de\s+)?factura|fecha)\s*[:.-]?\s*{DATE_RE}",
        rf"\b(?:date)\s*{DATE_RE}",
    ]

    for pattern in labeled_patterns:
        labeled = re.search(pattern, text, re.I)
        if labeled:
            return labeled.group(1)

    fallback = re.search(DATE_RE, text)
    return fallback.group(1) if fallback else ""


def _currency(text: str) -> str:
    labeled = re.search(r"\b(?:currency|moneda|moneda\s+fact)\s*[:.-]?\s*(USD|MXN|EUR|CAD|GBP|JPY|CNY)\b", text, re.I)
    if labeled:
        return labeled.group(1).upper()

    symbol_match = re.search(r"\b(US\$|USD\$|MX\$|CAD\$)\s*[\d,]+(?:\.\d{2,})?", text, re.I)
    if symbol_match:
        symbol = symbol_match.group(1).upper()
        if symbol in {"US$", "USD$"}:
            return "USD"
        if symbol == "MX$":
            return "MXN"
        if symbol == "CAD$":
            return "CAD"

    match = CURRENCY_RE.search(text)
    return match.group(1).upper() if match else ""


def _amount(text: str) -> float | None:
    patterns = [
        rf"\b(?:grand\s+total|invoice\s+total|total\s+invoice|amount\s+due|total\s+amount|importe\s+total)\s*[:.-]?\s*(?:USD|MXN|EUR|CAD|GBP|US\$|MX\$)?\s*{MONEY_RE}",
        rf"\b(?:val\.\s*mon\.\s*fact|valor\s+(?:moneda\s+)?factura|valor\s+factura|amount)\s*[:.-]?\s*(?:USD|MXN|EUR|CAD|GBP|US\$|MX\$)?\s*{MONEY_RE}",
        rf"\b(?:total)\s*[:.-]?\s*(?:USD|MXN|EUR|CAD|GBP|US\$|MX\$)\s*{MONEY_RE}",
    ]

    for pattern in patterns:
        matches = [match for match in re.finditer(pattern, text, re.I) if _amount_context_is_valid(text, match.start())]
        if matches:
            return _money(matches[-1].group(1))

    table_match = re.search(
        rf"\b(?:num\.?\s*factura|invoice\s*(?:no\.?|number)).{{0,220}}?\b(?:val\.?\s*mon\.?\s*fact|amount|total).{{0,180}}?{MONEY_RE}",
        text,
        re.I | re.S,
    )
    if table_match:
        return _money(table_match.group(1))

    return None


def _exchange_rate(text: str) -> float | None:
    match = EXCHANGE_RATE_RE.search(text)
    if not match:
        return None

    try:
        return float(match.group(1))
    except ValueError:
        return None


def _incoterm(text: str) -> str:
    labeled = re.search(r"\b(?:incoterm|incoterms)\s*[:.-]?\s*(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b", text, re.I)
    if labeled:
        return labeled.group(1).upper()

    match = INCOTERM_RE.search(text)
    return match.group(1).upper() if match else ""


def _cove(text: str) -> str:
    match = COVE_RE.search(text)
    return match.group(1).upper() if match else ""


def _money(value: str) -> float | None:
    normalized = re.sub(r"[^\d.]", "", value)
    if not normalized:
        return None

    try:
        return float(normalized)
    except ValueError:
        return None


def _amount_context_is_valid(text: str, start: int) -> bool:
    context = text[max(0, start - 40):start].upper()
    return not any(blocked in context for blocked in ("TAX ID", "RFC", "PHONE", "TEL", "ZIP", "POSTAL"))


def _clean_token(value: str) -> str:
    return re.sub(r"[^A-Z0-9._/-]", "", value.upper()).strip(".-/")


def _clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" :.-")


def _valid_provider_line(value: str) -> bool:
    if not value or len(value) < 4 or len(value) > 90:
        return False

    blocked = {
        "COMMERCIAL INVOICE",
        "INVOICE",
        "FACTURA",
        "INVOICE NO",
        "INVOICE NUMBER",
        "BILL TO",
        "SHIP TO",
        "SOLD TO",
        "PAGE",
        "DATE",
    }
    upper = value.upper()
    if upper in blocked or any(token in upper for token in ("TOTAL", "AMOUNT", "CURRENCY", "INCOTERM")):
        return False

    return bool(re.search(r"[A-ZÁÉÍÓÚÑ]{3,}", upper))
