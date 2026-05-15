from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import json
import re
from typing import Any


CATALOG_PATH = Path(__file__).with_name("customs_rules_catalog.json")

DOCUMENT_ALIASES = {
    "bill_of_lading": {"bill_of_lading", "transport_document", "bl", "awb", "sea_waybill"},
    "cfdi_pdf_agent": {"cfdi_pdf", "cfdi_pdf_agent", "agent_cfdi_pdf", "broker_cfdi_pdf"},
    "cfdi_xml_agent": {"cfdi_xml", "cfdi_xml_agent", "agent_cfdi_xml", "broker_cfdi_xml"},
    "data_sheet": {"data_sheet", "technical_spec", "catalog", "technical_sheet"},
    "translation": {"translation", "translated_invoice", "annex_translation"},
}

TECHNICAL_TARIFF_PREFIXES = ("84", "85", "90", "40", "59", "73")
GENERIC_DESCRIPTION_PATTERNS = (
    "goods",
    "merchandise",
    "mercancia",
    "mercancias",
    "parts",
    "partes",
    "spare parts",
    "varios",
    "various",
)


def load_active_rules() -> list[dict[str, Any]]:
    return [rule for rule in _load_rules_catalog() if rule.get("enabled") is True]


def evaluate_customs_rules(context: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    for rule in load_active_rules():
        rule_code = str(rule.get("rule_code") or "")
        evaluator = _RULE_DISPATCHER.get(rule_code)
        finding = evaluator(rule, context) if evaluator else None

        print("[customs.rules] evaluated", {"rule_code": rule_code, "triggered": bool(finding)})

        if finding:
            print("[customs.rules] triggered", {"rule_code": rule_code, "severity": finding.get("severity")})
            findings.append(finding)

    return findings


@lru_cache(maxsize=1)
def _load_rules_catalog() -> tuple[dict[str, Any], ...]:
    with CATALOG_PATH.open("r", encoding="utf-8") as catalog_file:
        payload = json.load(catalog_file)

    if not isinstance(payload, list):
        return tuple()

    return tuple(rule for rule in payload if isinstance(rule, dict))


def _evaluate_invoice_pedimento_value(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    invoice_details = _list(context.get("invoice_details"))
    commercial_value_usd = _number(pedimento_data.get("commercial_value_usd"))
    if len(invoice_details) > 1 and _rule_enabled("MULTI_INVOICE_TOTAL_MATCH"):
        return None

    invoice_total = sum(_number(_record(invoice).get("usd_value")) or _number(_record(invoice).get("amount")) for invoice in invoice_details)

    if not invoice_details or not commercial_value_usd or invoice_total <= 0:
        return _finding(
            rule,
            "No fue posible comparar valor de facturas contra pedimento por datos incompletos.",
            "Integrar facturas comerciales legibles y validar valor en dólares declarado.",
            evidence={"commercial_value_usd": commercial_value_usd, "invoice_count": len(invoice_details)},
        )

    variance_percent = abs(invoice_total - commercial_value_usd) / commercial_value_usd * 100
    allowed_variance = _number(_record(rule.get("parameters")).get("allowed_variance_percent")) or 0

    if variance_percent <= allowed_variance:
        return None

    return _finding(
        rule,
        f"El valor total de facturas ({invoice_total:.2f}) difiere del valor en dólares del pedimento ({commercial_value_usd:.2f}).",
        _template(rule, variance_percent=f"{variance_percent:.2f}"),
        evidence={
            "allowed_variance_percent": allowed_variance,
            "commercial_value_usd": commercial_value_usd,
            "invoice_total": round(invoice_total, 2),
            "variance_percent": round(variance_percent, 2),
        },
    )


def _evaluate_multi_invoice_total_match(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    invoice_details = _list(context.get("invoice_details"))

    if len(invoice_details) <= 1:
        return None

    total_invoices = sum(_number(_record(invoice).get("amount")) for invoice in invoice_details)
    pedimento_value = _number(pedimento_data.get("commercial_value_usd"))
    tolerance = _tolerance_percent(rule)

    if total_invoices <= 0 or pedimento_value <= 0:
        return _finding(
            rule,
            "No fue posible conciliar el total multipágina de facturas contra el valor en dólares del pedimento por datos incompletos.",
            _template(rule),
            evidence={
                "invoice_count": len(invoice_details),
                "pedimento_value": pedimento_value,
                "total_invoices": round(total_invoices, 2),
                "tolerance": tolerance,
            },
        )

    difference = total_invoices - pedimento_value
    variance_percent = abs(difference) / pedimento_value * 100

    if variance_percent <= tolerance:
        return None

    return _finding(
        rule,
        f"El total de facturas detectadas ({total_invoices:.2f}) no coincide con el valor en dólares del pedimento ({pedimento_value:.2f}).",
        _template(rule, variance_percent=f"{variance_percent:.2f}"),
        evidence={
            "difference": round(difference, 2),
            "invoice_count": len(invoice_details),
            "pedimento_value": round(pedimento_value, 2),
            "tolerance": tolerance,
            "total_invoices": round(total_invoices, 2),
            "variance_percent": round(variance_percent, 2),
        },
    )


def _evaluate_exchange_rate_validation(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    exchange_rate = _number(pedimento_data.get("exchange_rate"))
    usd_value = _number(pedimento_data.get("commercial_value_usd"))
    mxn_value = _number(pedimento_data.get("paid_commercial_value_mxn"))
    tolerance = _tolerance_percent(rule)

    if exchange_rate <= 0:
        return _finding(
            rule,
            "El tipo de cambio del pedimento no está presente o no es numérico.",
            _template(rule),
            evidence={"exchange_rate": pedimento_data.get("exchange_rate")},
        )

    if usd_value <= 0 or mxn_value <= 0:
        return None

    calculated_mxn = usd_value * exchange_rate
    variance_percent = abs(calculated_mxn - mxn_value) / mxn_value * 100

    if variance_percent <= tolerance:
        return None

    return _finding(
        rule,
        "El valor comercial MXN no coincide razonablemente con valor USD por tipo de cambio.",
        _template(rule, variance_percent=f"{variance_percent:.2f}"),
        evidence={
            "calculated_mxn": round(calculated_mxn, 2),
            "exchange_rate": exchange_rate,
            "mxn_value": mxn_value,
            "tolerance": tolerance,
            "usd_value": usd_value,
            "variance_percent": round(variance_percent, 2),
        },
    )


def _evaluate_cfdi_xml_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    return _evaluate_required_loaded_document(rule, context, "cfdi_xml_agent")


def _evaluate_cfdi_pdf_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    return _evaluate_required_loaded_document(rule, context, "cfdi_pdf_agent")


def _evaluate_bill_of_lading_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    return _evaluate_required_loaded_document(rule, context, "bill_of_lading")


def _evaluate_translation_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    invoice_details = _list(context.get("invoice_details"))
    pedimento_data = _record(context.get("pedimento_data"))
    providers = [str(provider).strip() for provider in _list(pedimento_data.get("providers")) if str(provider).strip()]
    likely_foreign_provider = bool(providers) and not any(_contains_mexico_signal(provider) for provider in providers)
    english_invoice = any(_invoice_looks_english(_record(invoice)) for invoice in invoice_details)

    if not likely_foreign_provider and not english_invoice:
        return None

    if _has_loaded_document(context, "translation") or _has_loaded_document(context, "annex"):
        return None

    return _finding(
        rule,
        "Las facturas o proveedor presentan señales de idioma extranjero y no se localizó traducción o anexo aclaratorio.",
        _template(rule),
        evidence={
            "english_invoice_detected": english_invoice,
            "providers": providers,
            "likely_foreign_provider": likely_foreign_provider,
        },
    )


def _evaluate_product_description_completeness(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    invoice_details = _list(context.get("invoice_details"))
    tariff_items = _list(pedimento_data.get("tariff_items"))
    descriptions = _product_descriptions(pedimento_data, invoice_details)
    min_length = int(_number(_record(rule.get("parameters")).get("min_description_length")) or 12)
    generic_descriptions = [description for description in descriptions if _is_generic_description(description)]
    short_descriptions = [description for description in descriptions if len(description) < min_length]

    if tariff_items and not descriptions:
        return _finding(
            rule,
            "Existen fracciones arancelarias sin descripción de mercancía suficiente en pedimento o facturas.",
            _template(rule),
            evidence={"invoice_count": len(invoice_details), "tariff_items_count": len(tariff_items)},
        )

    if generic_descriptions or short_descriptions:
        return _finding(
            rule,
            "Se detectaron descripciones de mercancía genéricas o insuficientes para soportar clasificación.",
            _template(rule),
            evidence={
                "generic_descriptions": generic_descriptions[:5],
                "short_descriptions": short_descriptions[:5],
                "tariff_items_count": len(tariff_items),
            },
        )

    return None


def _evaluate_technical_support_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    tariff_items = [str(item) for item in _list(pedimento_data.get("tariff_items"))]
    technical_items = [item for item in tariff_items if item.startswith(TECHNICAL_TARIFF_PREFIXES)]

    if not technical_items:
        return None

    if _has_loaded_document(context, "data_sheet"):
        return None

    return _finding(
        rule,
        "Se detectaron fracciones de mercancía técnica sin ficha técnica, catálogo o especificación soporte.",
        _template(rule),
        evidence={"technical_tariff_items": technical_items[:10]},
    )


def _evaluate_country_of_origin_match(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    invoice_details = _list(context.get("invoice_details"))
    pedimento_country = _first_present(pedimento_data, ["country_of_origin", "origin_country", "pais_origen"])
    invoice_countries = {
        str(_record(invoice).get("country_of_origin") or _record(invoice).get("origin_country") or "").strip().upper()
        for invoice in invoice_details
        if str(_record(invoice).get("country_of_origin") or _record(invoice).get("origin_country") or "").strip()
    }
    certificate_country = _first_present(pedimento_data, ["certificate_country_of_origin", "origin_certificate_country"])

    if not pedimento_country or not invoice_countries:
        return None

    normalized_pedimento_country = pedimento_country.upper()
    mismatched_invoice_countries = sorted(country for country in invoice_countries if country != normalized_pedimento_country)
    normalized_certificate_country = certificate_country.upper() if certificate_country else ""

    if not mismatched_invoice_countries and (not normalized_certificate_country or normalized_certificate_country == normalized_pedimento_country):
        return None

    return _finding(
        rule,
        "El país de origen declarado no coincide entre pedimento, factura o certificado.",
        _template(rule),
        evidence={
            "certificate_country": normalized_certificate_country,
            "invoice_countries": sorted(invoice_countries),
            "pedimento_country": normalized_pedimento_country,
        },
    )


def _evaluate_tax_base_consistency(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    customs_value = _number(pedimento_data.get("customs_value_mxn"))
    paid_value = _number(pedimento_data.get("paid_commercial_value_mxn"))
    total_contributions = _number(pedimento_data.get("total_contributions_mxn"))
    tolerance = _tolerance_percent(rule)

    if customs_value <= 0 or paid_value <= 0 or total_contributions <= 0:
        return None

    base_difference = customs_value - paid_value
    base_variance = abs(base_difference) / paid_value * 100
    contribution_ratio = total_contributions / customs_value * 100
    max_contribution_ratio = _number(_record(rule.get("parameters")).get("max_contribution_ratio_percent")) or 60

    if base_variance <= tolerance and contribution_ratio <= max_contribution_ratio:
        return None

    return _finding(
        rule,
        "La base gravable o contribuciones presentan variación relevante contra valor comercial pagado.",
        _template(rule, variance_percent=f"{base_variance:.2f}"),
        evidence={
            "base_difference": round(base_difference, 2),
            "base_variance_percent": round(base_variance, 2),
            "customs_value_mxn": customs_value,
            "max_contribution_ratio_percent": max_contribution_ratio,
            "paid_commercial_value_mxn": paid_value,
            "total_contributions_mxn": total_contributions,
            "total_contributions_ratio_percent": round(contribution_ratio, 2),
            "tolerance": tolerance,
        },
    )


def _evaluate_required_document(rule: dict[str, Any], context: dict[str, Any], document_type: str) -> dict[str, Any] | None:
    if _has_loaded_document(context, document_type):
        return None

    if not _has_missing_document(context, document_type):
        return None

    return _finding(
        rule,
        f"No se localizó documento soporte: {document_type}.",
        _template(rule),
        evidence={"document_type": document_type},
    )


def _evaluate_required_loaded_document(rule: dict[str, Any], context: dict[str, Any], document_type: str) -> dict[str, Any] | None:
    if _has_loaded_document(context, document_type):
        return None

    return _finding(
        rule,
        f"No se localizó documento soporte: {document_type}.",
        _template(rule),
        evidence={"document_type": document_type},
    )


def _evaluate_cove_required(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    invoice_details = _list(context.get("invoice_details"))
    pedimento_coves = _list(pedimento_data.get("coves"))
    invoice_coves = [str(_record(invoice).get("cove") or "").strip() for invoice in invoice_details]

    if _has_loaded_document(context, "cove") or any(invoice_coves) or pedimento_coves:
        return None

    if not invoice_details and not _has_missing_document(context, "cove"):
        return None

    return _finding(
        rule,
        "No se localizó COVE asociado a las facturas comerciales.",
        _template(rule),
        evidence={"invoice_count": len(invoice_details), "pedimento_coves": pedimento_coves},
    )


def _evaluate_incoterm_consistency(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    invoice_details = _list(context.get("invoice_details"))
    allowed = {str(value).upper() for value in _list(_record(rule.get("parameters")).get("allowed_incoterms"))}
    incoterms = [str(_record(invoice).get("incoterm") or "").upper() for invoice in invoice_details]
    invalid = sorted({incoterm for incoterm in incoterms if incoterm and incoterm not in allowed})

    if invalid:
        return _finding(
            rule,
            f"Se detectaron Incoterms no reconocidos: {', '.join(invalid)}.",
            _template(rule),
            evidence={"invalid_incoterms": invalid},
        )

    if invoice_details and not any(incoterms):
        return _finding(
            rule,
            "Las facturas detectadas no contienen Incoterm legible.",
            _template(rule),
            evidence={"invoice_count": len(invoice_details)},
        )

    return None


def _evaluate_data_sheet_authenticity(rule: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    pedimento_data = _record(context.get("pedimento_data"))
    tariff_items = _list(pedimento_data.get("tariff_items"))

    if not tariff_items or _has_loaded_document(context, "data_sheet"):
        return None

    return _finding(
        rule,
        "Existen fracciones arancelarias sin hoja de datos cargada como soporte.",
        _template(rule),
        evidence={"tariff_items_count": len(tariff_items)},
    )


def _finding(
    rule: dict[str, Any],
    description: str,
    recommendation: str,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "category": str(rule.get("category") or "customs"),
        "description": description,
        "evidence": evidence or {},
        "legal_basis": str(rule.get("legal_basis") or ""),
        "recommendation": recommendation,
        "rule_code": str(rule.get("rule_code") or ""),
        "severity": str(rule.get("severity") or "Medium"),
        "title": str(rule.get("rule_name") or rule.get("rule_code") or "Regla aduanera"),
    }


def _template(rule: dict[str, Any], **values: Any) -> str:
    template = str(rule.get("recommendation_template") or "Revisar evidencia documental.")

    try:
        rendered = template.format(**values)
    except KeyError:
        rendered = template

    if re.search(r"\{[^{}]+\}", rendered):
        return "No fue posible calcular la diferencia por información insuficiente."

    return rendered


def _has_loaded_document(context: dict[str, Any], document_type: str) -> bool:
    aliases = _document_aliases(document_type)
    return any(_document_type(document) in aliases for document in _iter_documents(context.get("loaded_documents")))


def _has_missing_document(context: dict[str, Any], document_type: str) -> bool:
    missing_documents = [*_list(context.get("missing_required_documents")), *_list(context.get("missing_support_documents"))]
    aliases = _document_aliases(document_type)
    return any(_document_type(document) in aliases for document in _iter_documents(missing_documents))


def _document_aliases(document_type: str) -> set[str]:
    return DOCUMENT_ALIASES.get(document_type, {document_type})


def _iter_documents(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value

    if isinstance(value, dict):
        documents: list[Any] = []
        for document_type, files in value.items():
            if isinstance(files, list):
                documents.extend({"document_type": document_type, **_record(file)} for file in files)
            else:
                documents.append({"document_type": document_type, **_record(files)})
        return documents

    return []


def _document_type(document: Any) -> str:
    row = _record(document)
    return str(row.get("document_type") or row.get("type") or "").strip().lower()


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            return float(value.replace(",", "").replace("$", "").strip())
        except ValueError:
            return 0.0

    return 0.0


def _rule_enabled(rule_code: str) -> bool:
    return any(str(rule.get("rule_code") or "") == rule_code and rule.get("enabled") is True for rule in _load_rules_catalog())


def _tolerance_percent(rule: dict[str, Any]) -> float:
    parameters = _record(rule.get("parameters"))
    return _number(parameters.get("tolerance_percent")) or _number(parameters.get("allowed_variance_percent")) or 0.0


def _contains_mexico_signal(value: str) -> bool:
    normalized = value.lower()
    return any(signal in normalized for signal in ("mexico", "méxico", "mx", "mex"))


def _invoice_looks_english(invoice: dict[str, Any]) -> bool:
    currency = str(invoice.get("currency") or "").upper()
    incoterm = str(invoice.get("incoterm") or "").upper()
    source_text = " ".join(str(invoice.get(key) or "") for key in ("title", "description", "source_text")).lower()
    return currency == "USD" or incoterm in {"EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"} or "commercial invoice" in source_text


def _product_descriptions(pedimento_data: dict[str, Any], invoice_details: list[Any]) -> list[str]:
    values: list[str] = []
    for key in ("description", "product_description", "goods_description", "descripcion"):
        value = pedimento_data.get(key)
        if isinstance(value, str) and value.strip():
            values.append(value.strip())

    for item in _list(pedimento_data.get("tariff_items")):
        if isinstance(item, dict):
            for key in ("description", "product_description", "descripcion"):
                value = item.get(key)
                if isinstance(value, str) and value.strip():
                    values.append(value.strip())

    for invoice in invoice_details:
        invoice_record = _record(invoice)
        for key in ("description", "product_description", "goods_description"):
            value = invoice_record.get(key)
            if isinstance(value, str) and value.strip():
                values.append(value.strip())

    return values


def _is_generic_description(description: str) -> bool:
    normalized = re.sub(r"\s+", " ", description.strip().lower())
    return normalized in GENERIC_DESCRIPTION_PATTERNS or any(pattern in normalized for pattern in GENERIC_DESCRIPTION_PATTERNS)


def _first_present(record: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return ""


_RULE_DISPATCHER = {
    "BILL_OF_LADING_REQUIRED": _evaluate_bill_of_lading_required,
    "CERTIFICATE_OF_ORIGIN_REQUIRED": lambda rule, context: _evaluate_required_document(rule, context, "certificate_of_origin"),
    "CFDI_PDF_REQUIRED": _evaluate_cfdi_pdf_required,
    "CFDI_XML_REQUIRED": _evaluate_cfdi_xml_required,
    "COUNTRY_OF_ORIGIN_MATCH": _evaluate_country_of_origin_match,
    "COVE_REQUIRED": _evaluate_cove_required,
    "DATA_SHEET_AUTHENTICITY": _evaluate_data_sheet_authenticity,
    "EXCHANGE_RATE_VALIDATION": _evaluate_exchange_rate_validation,
    "INCOTERM_CONSISTENCY": _evaluate_incoterm_consistency,
    "INV_PED_VALUE_MATCH": _evaluate_invoice_pedimento_value,
    "MULTI_INVOICE_TOTAL_MATCH": _evaluate_multi_invoice_total_match,
    "PRODUCT_DESCRIPTION_COMPLETENESS": _evaluate_product_description_completeness,
    "TAX_BASE_CONSISTENCY": _evaluate_tax_base_consistency,
    "TECHNICAL_SUPPORT_REQUIRED": _evaluate_technical_support_required,
    "TRANSLATION_REQUIRED": _evaluate_translation_required,
}
