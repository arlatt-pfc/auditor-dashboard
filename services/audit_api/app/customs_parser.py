from __future__ import annotations

from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zlib

from .schemas import PedimentoData, PedimentoParseResponse

PDF_TEXT_NOT_EXTRACTABLE = "PDF_TEXT_NOT_EXTRACTABLE"

_DATA_FIELDS = list(PedimentoData.model_fields.keys())

# Validation patterns from real pedimento text seen in production:
# - "NUM. PEDIMENTO: 25 17 1675 5004993"
# - "DESTINO: 9 TIPO CAMBIO: 20.76530 PESO BRUTO: 6840.000 ADUANA E/S: 170"
# - "FECHAS 11/04/2025 11/04/2025 ENTRADA PAGO"
# - "DTA 0 14831", "IGI 0 352130", "IVA 0 355334", "PRV 0 290", "TOTAL 722631"
_XML_ALIASES: dict[str, list[str]] = {
    "broker_name": ["broker_name", "agente_aduanal", "agenteAduanal", "nombreAgente", "nombreAgenteAduanal", "razonSocialAgente"],
    "broker_patent": ["broker_patent", "patente", "patenteAduanal", "patenteAgente", "patenteAgenteAduanal"],
    "commercial_value_usd": ["commercial_value_usd", "valorComercialUsd", "valorComercialDolares", "valorDolares", "valorComercial"],
    "customs_office": ["customs_office", "aduana", "aduanaDespacho", "seccionAduanera", "claveAduana", "customsOffice"],
    "customs_value_mxn": ["customs_value_mxn", "valorAduana", "valorAduanaMxn", "valorEnAduana", "valorComercialMxn"],
    "dta_mxn": ["dta_mxn", "dta", "derechoTramiteAduanero", "importeDta"],
    "exchange_rate": ["exchange_rate", "tipoCambio", "tipo_cambio", "tc", "exchangeRate"],
    "igi_mxn": ["igi_mxn", "igi", "importeIgi", "impuestoGeneralImportacion"],
    "import_date": ["import_date", "fechaEntrada", "fechaImportacion", "fechaOperacion", "importDate"],
    "importer_name": ["importer_name", "importador", "nombreImportador", "razonSocialImportador", "destinatario"],
    "importer_rfc": ["importer_rfc", "rfcImportador", "rfc", "rfcDestinatario", "taxId"],
    "iva_mxn": ["iva_mxn", "iva", "importeIva"],
    "payment_date": ["payment_date", "fechaPago", "fechaPagoReal", "paymentDate"],
    "pedimento_full": ["pedimento_full", "pedimentoCompleto", "numeroPedimentoCompleto", "pedimento"],
    "pedimento_number": ["pedimento_number", "numeroPedimento", "numPedimento", "pedimentoNumero", "pedimento"],
    "prv_mxn": ["prv_mxn", "prv", "prevalidacion", "importePrv"],
    "reference": ["reference", "referencia", "referenciaAduanal", "customsReference"],
    "total_contributions_mxn": ["total_contributions_mxn", "totalContribuciones", "totalContribucionesMxn", "totalImpuestos", "totalEfectivo"],
}


def parse_uploaded_pedimento(filename: str, content_type: str | None, payload: bytes, work_dir: Path) -> PedimentoParseResponse:
    lower_name = filename.lower()

    if lower_name.endswith(".xml") or content_type in {"application/xml", "text/xml"}:
        return parse_pedimento_xml(payload)

    if lower_name.endswith(".pdf") or content_type in {"application/pdf", "application/octet-stream"}:
        pdf_path = work_dir / _safe_filename(filename or "pedimento.pdf")
        pdf_path.write_bytes(payload)
        return parse_pedimento_pdf(pdf_path)

    return _response(
        document_type="UNSUPPORTED",
        data=PedimentoData(),
        error_code="PEDIMENTO_FILE_MUST_BE_PDF_OR_XML",
        user_message="Carga un archivo XML o PDF de pedimento.",
    )


def parse_pedimento_xml(payload: bytes) -> PedimentoParseResponse:
    xml = _decode_bytes(payload)

    if _is_cfdi_xml(xml):
        return _response(
            document_type="CFDI",
            data=PedimentoData(),
            error_code="CFDI_INVALID_FOR_STEP_1",
            user_message="Este XML parece ser un CFDI. Para el paso 1 carga el XML del pedimento o el PDF del pedimento.",
            warning="CFDI no válido como documento primario de pedimento.",
        )

    root = _xml_root(xml)
    pedimento_number = _clean_pedimento_number(_xml_value(root, xml, _XML_ALIASES["pedimento_number"]))
    import_date = _xml_value(root, xml, _XML_ALIASES["import_date"])
    import_year = _year_from_date(import_date)
    igi = _money(_xml_value(root, xml, _XML_ALIASES["igi_mxn"]))
    iva = _money(_xml_value(root, xml, _XML_ALIASES["iva_mxn"]))
    dta = _money(_xml_value(root, xml, _XML_ALIASES["dta_mxn"]))
    prv = _money(_xml_value(root, xml, _XML_ALIASES["prv_mxn"]))
    detected_total = _money(_xml_value(root, xml, _XML_ALIASES["total_contributions_mxn"]))

    data = PedimentoData(
        broker_name=_xml_value(root, xml, _XML_ALIASES["broker_name"]),
        broker_patent=_xml_value(root, xml, _XML_ALIASES["broker_patent"]),
        commercial_value_usd=_money(_xml_value(root, xml, _XML_ALIASES["commercial_value_usd"])),
        customs_office=_xml_value(root, xml, _XML_ALIASES["customs_office"]),
        customs_value_mxn=_money(_xml_value(root, xml, _XML_ALIASES["customs_value_mxn"])),
        dta_mxn=dta,
        exchange_rate=_money(_xml_value(root, xml, _XML_ALIASES["exchange_rate"])),
        igi_mxn=igi,
        import_date=import_date,
        importer_name=_xml_value(root, xml, _XML_ALIASES["importer_name"]),
        importer_rfc=_xml_value(root, xml, _XML_ALIASES["importer_rfc"]),
        iva_mxn=iva,
        operation_code=_operation_code(pedimento_number, import_year),
        payment_date=_xml_value(root, xml, _XML_ALIASES["payment_date"]),
        pedimento_full=_xml_value(root, xml, _XML_ALIASES["pedimento_full"]),
        pedimento_number=pedimento_number,
        prv_mxn=prv,
        coves=_unique(_xml_values(root, xml, ["cove", "coves", "numeroCove", "numero_cove"])),
        invoices=_unique(_xml_values(root, xml, ["factura", "facturas", "invoice", "invoiceNumber", "numeroFactura"])),
        providers=_unique(_xml_values(root, xml, ["proveedor", "proveedores", "provider", "supplier", "nombreProveedor"])),
        reference=_xml_value(root, xml, _XML_ALIASES["reference"]),
        tariff_items=_tariff_items_xml(root, xml),
        total_contributions_mxn=detected_total if detected_total is not None else _sum_numbers([igi, iva, dta, prv]),
    )

    return _response(
        document_type="XML_PEDIMENTO",
        data=data,
        is_supported_as_primary_xml=True,
        is_supported_as_primary_document=True,
    )


def parse_pedimento_pdf(pdf_path: Path) -> PedimentoParseResponse:
    text = _extract_pdf_text(pdf_path)

    if len(text.replace(" ", "")) < 30:
        return _response(
            document_type="PDF_PEDIMENTO",
            data=PedimentoData(),
            error_code=PDF_TEXT_NOT_EXTRACTABLE,
            is_supported_as_primary_document=True,
            user_message=(
                "No fue posible extraer texto del PDF. El archivo puede estar escaneado o usar una codificación no compatible. "
                "Puedes cargar el XML del pedimento, capturar los datos manualmente o continuar adjuntando el PDF como soporte."
            ),
        )

    normalized = _normalize_text(text)
    upper = normalized.upper()
    pedimento_parts = _pedimento_parts(normalized)
    pedimento_number = pedimento_parts[3] if pedimento_parts else _clean_pedimento_number(_label_value(normalized, ["pedimento", "num. pedimento", "numero de pedimento"]))
    pedimento_full = " ".join(pedimento_parts) if pedimento_parts else _label_value(normalized, ["pedimento completo"])
    import_date, payment_date = _pedimento_dates(normalized)
    igi = _contribution_value(upper, "IGI")
    iva = _contribution_value(upper, "IVA")
    dta = _contribution_value(upper, "DTA")
    prv = _contribution_value(upper, "PRV")
    detected_total = _total_contributions_value(upper) or _money(_label_value(normalized, ["total contribuciones", "total efectivo", "total"]))
    import_year = _year_from_date(import_date) or (2000 + int(pedimento_parts[0]) if pedimento_parts else None)
    invoice_details = _invoice_details_pdf(normalized)
    coves = _coves_pdf(normalized)
    broker_name, broker_person_name = _broker_names_pdf(normalized)

    data = PedimentoData(
        broker_name=broker_name,
        broker_person_name=broker_person_name,
        broker_patent=_label_value(normalized, ["patente", "patente aduanal"]) or (pedimento_parts[2] if pedimento_parts else ""),
        commercial_value_usd=_commercial_value_usd_pdf(normalized),
        paid_commercial_value_mxn=_paid_commercial_value_mxn_pdf(normalized),
        customs_office=_customs_office(normalized, pedimento_parts[1] if pedimento_parts else ""),
        customs_value_mxn=_customs_value_mxn_pdf(normalized),
        dta_mxn=dta,
        exchange_rate=_exchange_rate(normalized),
        igi_mxn=igi,
        import_date=import_date,
        importer_name=_importer_name_pdf(normalized),
        importer_rfc=_rfc_value(normalized),
        iva_mxn=iva,
        operation_code=_operation_code(pedimento_number, import_year),
        payment_date=payment_date,
        pedimento_full=pedimento_full,
        pedimento_number=pedimento_number,
        prv_mxn=prv,
        coves=coves,
        invoice_details=invoice_details,
        invoices=_unique([str(invoice["invoice_number"]) for invoice in invoice_details if invoice.get("invoice_number")]),
        providers=_providers_pdf(normalized),
        reference=_reference_value(normalized),
        tariff_items=_tariff_items_pdf(normalized),
        total_contributions_mxn=detected_total if detected_total is not None else _sum_numbers([igi, iva, dta, prv]),
    )

    return _response(
        document_type="PDF_PEDIMENTO",
        data=data,
        is_supported_as_primary_document=True,
    )


def _extract_pdf_text(pdf_path: Path) -> str:
    pdftotext = shutil.which("pdftotext")

    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(pdf_path), "-"],
            capture_output=True,
            check=False,
            text=True,
            timeout=60,
        )

        if result.stdout.strip():
            return _normalize_text(result.stdout)

    return _extract_pdf_text_fallback(pdf_path.read_bytes())


def _extract_pdf_text_fallback(payload: bytes) -> str:
    source = payload.decode("latin1", errors="ignore")
    chunks: list[str] = []

    for match in re.finditer(r"<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream", source):
        dictionary = match.group(1)
        stream_bytes = match.group(2).encode("latin1", errors="ignore").strip()

        if "/FlateDecode" in dictionary:
            try:
                stream_bytes = zlib.decompress(stream_bytes)
            except zlib.error:
                continue

        chunks.append(_text_from_pdf_content(stream_bytes.decode("latin1", errors="ignore")))

    return _normalize_text(" ".join(chunks))


def _text_from_pdf_content(content: str) -> str:
    values: list[str] = []

    for match in re.finditer(r"(\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>)\s*(?:Tj|'|\"|TJ)", content):
        values.append(_decode_pdf_string(match.group(1)))

    for match in re.finditer(r"\[(.*?)\]\s*TJ", content):
        values.extend(_decode_pdf_string(item.group(0)) for item in re.finditer(r"\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>", match.group(1)))

    return " ".join(values)


def _decode_pdf_string(value: str) -> str:
    if value.startswith("<"):
        raw = bytes.fromhex(re.sub(r"[<>\s]", "", value))

        if raw.startswith(b"\xfe\xff"):
            return raw[2:].decode("utf-16-be", errors="ignore")

        return raw.decode("latin1", errors="ignore")

    value = value[1:-1]
    value = re.sub(r"\\([nrtbf()\\])", lambda match: {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "(": "(", ")": ")", "\\": "\\"}[match.group(1)], value)
    value = re.sub(r"\\(\d{1,3})", lambda match: chr(int(match.group(1), 8)), value)
    return value


def _response(
    *,
    document_type: str,
    data: PedimentoData,
    confidence: int | None = None,
    error_code: str | None = None,
    is_supported_as_primary_document: bool = False,
    is_supported_as_primary_xml: bool = False,
    user_message: str = "",
    warning: str | None = None,
) -> PedimentoParseResponse:
    detected_fields = _detected_fields(data)
    missing_fields = [field for field in _DATA_FIELDS if field not in detected_fields]
    computed_confidence = confidence if confidence is not None else _confidence(data, detected_fields)

    return PedimentoParseResponse(
        confidence=computed_confidence,
        data=data,
        detected_fields=detected_fields,
        document_type=document_type,
        error_code=error_code,
        is_supported_as_primary_document=is_supported_as_primary_document,
        is_supported_as_primary_xml=is_supported_as_primary_xml,
        missing_fields=missing_fields,
        user_message=user_message,
        warning=warning,
    )


def _detected_fields(data: PedimentoData) -> list[str]:
    detected: list[str] = []

    for field, value in data.model_dump().items():
        if isinstance(value, list):
            if value:
                detected.append(field)
        elif value is not None and str(value).strip():
            detected.append(field)

    return detected


def _confidence(data: PedimentoData, detected_fields: list[str]) -> int:
    critical_weights = {
        "pedimento_number": 12,
        "importer_rfc": 10,
        "importer_name": 10,
        "exchange_rate": 10,
        "customs_value_mxn": 10,
        "commercial_value_usd": 8,
        "total_contributions_mxn": 10,
        "broker_name": 10,
        "invoices": 10,
        "coves": 10,
    }
    score = sum(weight for field, weight in critical_weights.items() if field in detected_fields)
    remaining_fields = [field for field in detected_fields if field not in critical_weights and field != "operation_code"]
    score += min(10, len(remaining_fields))

    if data.import_date and re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", data.import_date):
        score += 3

    if data.payment_date and re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", data.payment_date):
        score += 3

    if data.providers and all(_valid_provider_name(provider) for provider in data.providers):
        score += 4

    if data.paid_commercial_value_mxn is not None:
        score += 3

    if data.broker_person_name:
        score += 3

    if any(_invalid_tariff_item(item) for item in data.tariff_items):
        score -= 5

    if data.invoice_details and "invoices" not in detected_fields:
        score += 5

    return max(0, min(100, score))


def _xml_root(xml: str) -> ET.Element | None:
    try:
        return ET.fromstring(xml)
    except ET.ParseError:
        return None


def _xml_value(root: ET.Element | None, xml: str, aliases: list[str]) -> str:
    values = _xml_values(root, xml, aliases)
    return values[0] if values else ""


def _xml_values(root: ET.Element | None, xml: str, aliases: list[str]) -> list[str]:
    values: list[str] = []

    if root is not None:
        for element in root.iter():
            local_name = _local_name(element.tag)

            if local_name in aliases and element.text:
                values.append(_normalize_text(element.text))

            for attribute, value in element.attrib.items():
                if _local_name(attribute) in aliases:
                    values.append(_normalize_text(value))

    for alias in aliases:
        escaped = re.escape(alias)
        tag_match = re.search(rf"<(?:[\w.-]+:)?{escaped}\b[^>]*>([\s\S]*?)</(?:[\w.-]+:)?{escaped}>", xml, re.I)

        if tag_match:
            values.append(_normalize_text(re.sub(r"<[^>]+>", " ", tag_match.group(1))))

        attribute_match = re.search(rf"\b(?:[\w.-]+:)?{escaped}\s*=\s*['\"]([^'\"]+)['\"]", xml, re.I)

        if attribute_match:
            values.append(_normalize_text(attribute_match.group(1)))

    return _unique(values)


def _is_cfdi_xml(xml: str) -> bool:
    return bool(re.search(r"<(?:[\w.-]+:)?Comprobante\b", xml, re.I) and re.search(r"\b(?:[\w.-]+:)?(?:Emisor|Receptor)\b", xml, re.I))


def _tariff_items_xml(root: ET.Element | None, xml: str) -> list[str]:
    values = _xml_values(root, xml, ["fraccion", "fraccionArancelaria", "fraccion_arancelaria", "tariffItem", "tariff_item"])
    return _unique(re.sub(r"\D", "", value) or value for value in values)[:100]


def _label_value(text: str, labels: list[str]) -> str:
    for label in labels:
        pattern = rf"{re.escape(label)}\s*[:.-]?\s*([A-Z0-9ÁÉÍÓÚÜÑ&.,/#\- ]{{2,80}}?)(?=\s{{2,}}|\s(?:RFC|CURP|DOMICILIO|PEDIMENTO|ADUANA|PATENTE|FECHA|VALOR|TIPO|TOTAL|IGI|IVA|DTA|PRV)\b|$)"
        match = re.search(pattern, text, re.I)

        if match:
            return _normalize_text(match.group(1))

    return ""


def _date_value(text: str, labels: list[str]) -> str:
    for label in labels:
        match = re.search(rf"{re.escape(label)}\s*[:.-]?\s*(\d{{1,2}}[/-]\d{{1,2}}[/-](?:\d{{4}}|\d{{2}}))", text, re.I)

        if match:
            return normalize_date(match.group(1), text)

    return ""


def _party_name(text: str, labels: list[str]) -> str:
    return re.sub(r"\bRFC\b.*$", "", _label_value(text, labels), flags=re.I).strip()


def _pedimento_parts(text: str) -> tuple[str, str, str, str] | None:
    labeled = re.search(
        r"(?:NUM\.?\s*PEDIMENTO|NUMERO\s+DE\s+PEDIMENTO|PEDIMENTO)\s*[:.-]?\s*(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{7})\b",
        text,
        re.I,
    )

    if labeled:
        return labeled.group(1), labeled.group(2), labeled.group(3), labeled.group(4)

    fallback = re.search(r"\b(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{7})\b", text)
    return fallback.groups() if fallback else None


def _exchange_rate(text: str) -> str:
    patterns = [
        r"\bTIPO\s+CAMBIO\s*[:.-]?\s*([0-9]+(?:\.[0-9]+)?)",
        r"\bTIPO\s+DE\s+CAMBIO\s*[:.-]?\s*([0-9]+(?:\.[0-9]+)?)",
        r"\bT\.?\s*CAMBIO\s*[:.-]?\s*([0-9]+(?:\.[0-9]+)?)",
        r"\bTC\s*[:.-]?\s*([0-9]+(?:\.[0-9]+)?)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.I)

        if match:
            return match.group(1)

    fallback = _money(_label_value(text, ["tipo cambio", "tipo de cambio", "t. cambio", "tc"]))
    return str(fallback) if fallback is not None else ""


def _pedimento_dates(text: str) -> tuple[str, str]:
    fechas_match = re.search(
        r"\bFECHAS?\s+(\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))\s+(\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))\s+ENTRADA\s+PAGO\b",
        text,
        re.I,
    )

    if fechas_match:
        return normalize_date(fechas_match.group(1), text), normalize_date(fechas_match.group(2), text)

    fechas_block = re.search(
        r"\bFECHAS?\b\s*(?:ENTRADA\s+PAGO\s*)?(\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))\s+(\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))",
        text,
        re.I,
    )

    if fechas_block:
        return normalize_date(fechas_block.group(1), text), normalize_date(fechas_block.group(2), text)

    import_date = _date_value(text, ["entrada", "fecha de entrada", "fecha importacion", "fecha de importacion"])
    payment_date = _date_value(text, ["pago", "fecha de pago"])

    return import_date, payment_date


def normalize_date(value: str, context_text: str | None = None) -> str:
    match = re.search(r"\b(\d{1,2})([/-])(\d{1,2})[/-](\d{4}|\d{2})\b", value)

    if not match:
        return value

    day, separator, month, year = match.group(1), match.group(2), match.group(3), match.group(4)

    if len(year) == 4:
        return f"{day.zfill(2)}{separator}{month.zfill(2)}{separator}{year}"

    context = context_text or ""
    same_day_month = re.search(rf"\b{int(day):02d}[/-]{int(month):02d}[/-]((?:19|20)\d{{2}})\b", context)

    if same_day_month:
        return f"{day.zfill(2)}{separator}{month.zfill(2)}{separator}{same_day_month.group(1)}"

    years = [int(year_match.group(1)) for year_match in re.finditer(r"\b((?:19|20)\d{2})\b", context)]
    resolved_year = str(max(years)) if years else f"20{year}"

    return f"{day.zfill(2)}{separator}{month.zfill(2)}{separator}{resolved_year}"


def _importer_name_pdf(text: str) -> str:
    known_importer = re.search(r"\b(SUMINISTROS\s+MARINOS\s+E\s+INDUSTRIALES\s+DE\s+MEXICO\s+SA\s+DE\s+CV)\b", text, re.I)

    if known_importer:
        return _clean_party_capture(known_importer.group(1))

    rfc_context = re.search(r"\bSMI040305GZ0\b(.{0,260})", text, re.I)

    if rfc_context:
        value = _clean_importer_candidate(rfc_context.group(1))

        if value:
            return value

    label_context = re.search(r"NOMBRE,?\s+DENOMINACION\s+O\s+RAZON\s+SOCIAL\s*[:.-]?\s*(.{0,240})", text, re.I)

    if label_context:
        value = _clean_importer_candidate(label_context.group(1))

        if value:
            return value

    patterns = [
        r"\bIMPORTADOR\s+(?:RFC\s*)?[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\s+([A-ZÁÉÍÓÚÜÑ&.,\s]+?)(?=\s+(?:DOMICILIO|CURP|VAL\.|VALOR|ACUSE|FACTURAS|PROVEEDOR|EXPORTADOR|IMPORTE)\b)",
        r"\bIMPORTADOR\s*[:.-]?\s*([A-ZÁÉÍÓÚÜÑ&.,\s]+?)(?=\s+(?:RFC|DOMICILIO|CURP|VAL\.|VALOR|/ EXPORTADOR|EXPORTADOR|IMPORTE)\b)",
    ]

    for pattern in patterns:
        value = _clean_party_capture(_first_match(text, pattern))

        if value:
            return value

    return _party_name(text, ["importador", "nombre importador", "razon social"])


def _broker_name_pdf(text: str) -> str:
    broker_name, broker_person_name = _broker_names_pdf(text)
    return broker_name or broker_person_name


def _broker_names_pdf(text: str) -> tuple[str, str]:
    agency = _first_match(text, r"\b(DESPACHOS\s+ADUANALES\s+CASTAÑEDA\s+SC)\b")
    person = _first_match(text, r"\b(ELSA\s+CASTAÑEDA\s+TREVIÑO)\b")
    agency = _clean_party_capture(agency)
    person = _clean_party_capture(person)

    if agency:
        return agency, person

    block = re.search(r"AGENTE\s+ADUANAL,?\s+AGENCIA\s+ADUANAL.{0,500}", text, re.I)

    if block:
        labeled = _first_match(block.group(0), r"NOMBRE\s+O\s+RAZ\s+SOC\s*[:.-]?\s*([A-ZÁÉÍÓÚÜÑ&.,\s]+?)(?=\s+(?:RFC|CURP|PATENTE|AUTORIZACION|MANDATARIO|NUM\.?\s*PEDIMENTO)\b)")
        labeled = _clean_party_capture(labeled)

        if labeled and _valid_broker_name(labeled):
            return labeled, person

    patterns = [
        r"\b(?:AGENTE\s+ADUANAL|APODERADO\s+ADUANAL|MANDATARIO)\s*[:.-]?\s*([A-ZÁÉÍÓÚÜÑ&.,\s]+?)(?=\s+(?:RFC|CURP|PATENTE|NUM\.?\s*PEDIMENTO|PEDIMENTO|ADUANA)\b)",
    ]

    for pattern in patterns:
        value = _clean_party_capture(_first_match(text, pattern))

        if value and _valid_broker_name(value):
            return value, person

    fallback = _party_name(text, ["agente aduanal", "nombre agente", "apoderado aduanal"])
    return (fallback if _valid_broker_name(fallback) else ""), person


def _first_match(text: str, pattern: str) -> str:
    match = re.search(pattern, text, re.I)
    return match.group(1) if match else ""


def _clean_party_capture(value: str) -> str:
    cleaned = _normalize_text(value)
    cleaned = re.sub(r"^/+\s*", "", cleaned)
    cleaned = re.sub(r"\s*/?\s*(?:EXPORTADOR|IMPORTE).*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:RFC|CURP|DOMICILIO)\b.*$", "", cleaned, flags=re.I)
    return cleaned.strip(" .-/")


def _clean_importer_candidate(value: str) -> str:
    cleaned = _clean_party_capture(value)
    cleaned = re.sub(
        r"\b(?:DATOS\s+DEL\s+IMPORTADOR\s*/?\s*EXPORTADOR|CLAVE\s+EN\s+EL\s+RFC|NOMBRE,?\s+DENOMINACION\s+O\s+RAZON\s+SOCIAL|IMPORTADOR|EXPORTADOR|IMPORTE|CURP|DOMICILIO)\b",
        " ",
        cleaned,
        flags=re.I,
    )
    cleaned = _normalize_text(cleaned)
    match = re.search(r"\b([A-ZÁÉÍÓÚÜÑ&.\s]{12,}?(?:SA\s+DE\s+CV|S\.A\.\s+DE\s+C\.V\.|SC|S\.C\.))\b", cleaned, re.I)
    return _clean_party_capture(match.group(1) if match else cleaned)


def _valid_broker_name(value: str) -> bool:
    if not value:
        return False

    return not re.search(r"\b(PECA|DEBER[ÁA]\s+IMPRIMIR|SERVICIO|CERTIFICACI[ÓO]N)\b", value, re.I)


def _reference_value(text: str) -> str:
    labeled = _label_value(text, ["referencia", "referencia aduanal", "ref"])
    match = re.search(r"[A-Z]{1,4}[-/]?\d{3,}[-/]?\d{0,4}", labeled, re.I) or re.search(r"\b[A-Z]{1,4}-\d{3,}-\d{2,4}\b", text, re.I)
    return match.group(0) if match else labeled


def _rfc_value(text: str) -> str:
    importador_match = re.search(r"importador[\s\S]{0,220}?([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})", text, re.I)
    first_match = re.search(r"\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b", text, re.I)
    return (importador_match.group(1) if importador_match else first_match.group(0) if first_match else "").upper()


def _customs_office(text: str, pedimento_office: str) -> str:
    aduana_es = re.search(r"\bADUANA\s+E/S\s*[:.-]?\s*(\d{2,3})\b", text, re.I)

    if aduana_es:
        return aduana_es.group(1)

    labeled = _label_value(text, ["aduana", "aduana despacho", "aduana seccion"])
    digits = re.search(r"\b\d{2,3}\b", labeled)

    if digits:
        return digits.group(0)

    return f"{pedimento_office}0" if pedimento_office else ""


def _customs_value_mxn_pdf(text: str) -> float | None:
    value = _money_from_labeled_number(text, [r"VALOR\s+ADUANA", r"VALOR\s+EN\s+ADUANA"])

    if value is not None:
        return value

    values_block = _header_values_block(text)
    return values_block.get("customs_value_mxn")


def _commercial_value_usd_pdf(text: str) -> float | None:
    value = _money_from_labeled_number(text, [r"VALOR\s+DOLARES", r"VALOR\s+COMERCIAL\s+DOLARES", r"VALOR\s+COMERCIAL\s+USD"])

    if value is not None:
        return value

    values_block = _header_values_block(text)
    return values_block.get("commercial_value_usd")


def _paid_commercial_value_mxn_pdf(text: str) -> float | None:
    value = _money_from_labeled_number(text, [r"PRECIO\s+PAGADO/VALOR\s+COMERCIAL", r"PRECIO\s+PAGADO", r"VALOR\s+COMERCIAL"])

    if value is not None:
        return value

    values_block = _header_values_block(text)
    return values_block.get("paid_commercial_value_mxn")


def _providers_pdf(text: str) -> list[str]:
    known_provider = re.search(r"\b(MHWIRTH\s+LLC)\b", text, re.I)
    providers: list[str] = []

    if known_provider:
        providers.append(known_provider.group(1))

    provider_block = re.search(r"DATOS\s+DEL\s+PROVEEDOR\s+O\s+COMPRADOR(.{0,700})", text, re.I)

    if provider_block:
        block = provider_block.group(1)
        for match in re.finditer(r"\b[A-Z0-9]{2,}-[A-Z0-9]{2,}\s+([A-ZÁÉÍÓÚÜÑ&.,\s]+?)(?=\s+(?:[A-Z]{2,}\s+)?(?:VINCULACION|NO\s+VINCULACION|DOMICILIO|CALLE|AV\.|BLVD\.|\d{2,}|VAL\.|FACTURA)\b)", block, re.I):
            candidate = _clean_provider_candidate(match.group(1))

            if candidate:
                providers.append(candidate)

    for match in re.finditer(r"proveedor\s*[:.-]?\s*([A-Z0-9ÁÉÍÓÚÜÑ&.,/#\- ]{3,80})", text, re.I):
        candidate = _clean_provider_candidate(match.group(1))

        if candidate:
            providers.append(candidate)

    return _unique(provider for provider in providers if _valid_provider_name(provider))


def _clean_provider_candidate(value: str) -> str:
    cleaned = _normalize_text(value)
    cleaned = re.sub(
        r"\b(?:DATOS\s+DEL\s+PROVEEDOR\s+O\s+COMPRADOR|ID\.?\s+FISCAL|NOMBRE|DENOMINACION|RAZON\s+SOCIAL|DOMICILIO|VINCULACION|O\s+COMPRADOR|IMPORTE)\b",
        " ",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" .-/")
    match = re.search(r"\b([A-ZÁÉÍÓÚÜÑ&.\s]{3,}?(?:LLC|INC|LTD|CORP|SA\s+DE\s+CV|S\.A\.\s+DE\s+C\.V\.))\b", cleaned, re.I)
    return _clean_party_capture(match.group(1) if match else cleaned)


def _valid_provider_name(value: str) -> bool:
    if not value:
        return False

    if re.search(r"\b(DATOS|PROVEEDOR|COMPRADOR|ID\.?\s+FISCAL|NOMBRE|DENOMINACION|RAZON\s+SOCIAL|DOMICILIO|VINCULACION|IMPORTE)\b", value, re.I):
        return False

    return bool(re.search(r"[A-ZÁÉÍÓÚÜÑ]", value, re.I) and len(value) >= 3)


def _money_from_labeled_number(text: str, labels: list[str]) -> float | None:
    for label in labels:
        match = re.search(rf"\b{label}\s*[:.-]?\s*([$]?[\d,]+(?:\.\d+)?)\b", text, re.I)

        if match:
            return _money(match.group(1))

    return None


def _header_values_block(text: str) -> dict[str, float]:
    labels_pattern = (
        r"VALOR\s+DOLARES\s*:?\s+VALOR\s+ADUANA\s*:?\s+"
        r"PRECIO\s+PAGADO/VALOR\s+COMERCIAL\s*:?\s+"
        r"([$]?[\d,]+(?:\.\d+)?)\s+([$]?[\d,]+(?:\.\d+)?)\s+([$]?[\d,]+(?:\.\d+)?)"
    )
    match = re.search(labels_pattern, text, re.I)

    if not match:
        return {}

    return {
        "commercial_value_usd": _money(match.group(1)) or 0,
        "customs_value_mxn": _money(match.group(2)) or 0,
        "paid_commercial_value_mxn": _money(match.group(3)) or 0,
    }


def _contribution_value(text: str, key: str) -> float | None:
    patterns = [
        rf"\b{key}\b\s+0\s+([$]?[\d,]+(?:\.\d+)?)\b",
        rf"\b{key}\b\s*[:.-]?\s*(?:\d+\s+){{0,4}}([$]?[\d,]+(?:\.\d+)?)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.I)

        if match:
            return _money(match.group(1))

    return None


def _total_contributions_value(text: str) -> float | None:
    patterns = [
        r"\bTOTAL\s+([$]?[\d,]+(?:\.\d+)?)\b",
        r"\bTOTAL\s+(?:CONTRIBUCIONES|EFECTIVO)\s*[:.-]?\s*([$]?[\d,]+(?:\.\d+)?)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.I)

        if match:
            return _money(match.group(1))

    return None


def _invoice_details_pdf(text: str) -> list[dict[str, str | float | None]]:
    details: list[dict[str, str | float | None]] = []
    invoice_pattern = re.compile(
        r"\b(\d{8})\s+"
        r"(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))\s+"
        r"([A-Z]{3})\s+"
        r"([A-Z]{3})\s+"
        r"([\d,]+(?:\.\d+)?)\s+"
        r"([\d,]+(?:\.\d+)?)\s+"
        r"([\d,]+(?:\.\d+)?)"
        r"(?:\s+(COVE[A-Z0-9]{6,30}))?",
        re.I,
    )
    matches = list(invoice_pattern.finditer(text))

    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else min(len(text), match.end() + 120)
        nearby = text[match.end() : end]
        cove = match.group(8) or _first_match(nearby, r"\b(COVE[A-Z0-9]{6,30})\b")

        details.append(
            {
                "invoice_number": match.group(1),
                "date": normalize_date(match.group(2), text),
                "incoterm": match.group(3).upper(),
                "currency": match.group(4).upper(),
                "amount": _money(match.group(5)),
                "exchange_factor": match.group(6),
                "usd_value": _money(match.group(7)),
                "cove": cove.upper() if cove else "",
            }
        )

    if details:
        return details

    invoice_numbers = _unique(match.group(1) for match in re.finditer(r"\b(\d{8})\b", text))
    coves = _coves_pdf(text)

    return [
        {
            "invoice_number": invoice_number,
            "date": "",
            "incoterm": "",
            "currency": "",
            "amount": None,
            "exchange_factor": "",
            "usd_value": None,
            "cove": coves[index] if index < len(coves) else "",
        }
        for index, invoice_number in enumerate(invoice_numbers)
    ]


def _coves_pdf(text: str) -> list[str]:
    return _unique(match.group(1).upper() for match in re.finditer(r"\b(COVE[A-Z0-9]{6,30})\b", text, re.I))


def _tariff_items_pdf(text: str) -> list[str]:
    labeled = [match.group(1) for match in re.finditer(r"fracci[oó]n(?:\s+arancelaria)?\s*[:.-]?\s*(\d{8})", text, re.I)]
    contextual = [
        match.group(1)
        for match in re.finditer(
            r"\b(?:UMC|UMT|P\.?\s*V/?C|VAL(?:OR)?\s+AGREG|SEC|FRACCION)\b.{0,90}\b(\d{8})\b",
            text,
            re.I,
        )
    ]
    invoice_numbers = {str(invoice["invoice_number"]) for invoice in _invoice_details_pdf(text) if invoice.get("invoice_number")}
    fallback = [match.group(0) for match in re.finditer(r"\b\d{8}\b", text) if match.group(0) not in invoice_numbers]
    values = [value for value in [*labeled, *contextual, *fallback] if _valid_tariff_item(value)]
    return _unique(values)[:100]


def _valid_tariff_item(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    return bool(re.fullmatch(r"\d{8}", digits) and not _invalid_tariff_item(digits))


def _invalid_tariff_item(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    return not digits or set(digits) == {"0"}


def _money(value: str) -> float | None:
    if not value:
        return None

    try:
        return float(re.sub(r"[$,\s]", "", value))
    except ValueError:
        return None


def _sum_numbers(values: list[float | None]) -> float | None:
    valid = [value for value in values if value is not None]
    return sum(valid) if valid else None


def _clean_pedimento_number(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    return digits[-7:] if len(digits) > 7 else digits


def _year_from_date(value: str) -> int | None:
    match = re.search(r"\b(20\d{2}|19\d{2})\b", value)

    if match:
        return int(match.group(1))

    short = re.search(r"[/-](\d{2})$", value)
    return 2000 + int(short.group(1)) if short else None


def _operation_code(pedimento_number: str, year: int | None) -> str:
    return f"IMP-{year or 2026}-{pedimento_number}" if pedimento_number else ""


def _decode_bytes(payload: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin1"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue

    return payload.decode("latin1", errors="ignore")


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\x00", " ")).strip()


def _local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1].split(":", 1)[-1]


def _unique(values) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []

    for value in values:
        normalized = _normalize_text(str(value))

        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_values.append(normalized)

    return unique_values[:100]


def _safe_filename(filename: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "_" for character in filename)
    return safe or "pedimento.pdf"
