from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import json
from typing import Any


CATALOG_PATH = Path(__file__).with_name("customs_rules_catalog.json")


def load_active_rules() -> list[dict[str, Any]]:
    return [rule for rule in _load_rules_catalog() if rule.get("enabled") is True]


def evaluate_customs_rules(context: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    for rule in load_active_rules():
        rule_code = str(rule.get("rule_code") or "")

        if rule_code == "INV_PED_VALUE_MATCH":
            finding = _evaluate_invoice_pedimento_value(rule, context)
        elif rule_code == "CERTIFICATE_OF_ORIGIN_REQUIRED":
            finding = _evaluate_required_document(rule, context, "certificate_of_origin")
        elif rule_code == "COVE_REQUIRED":
            finding = _evaluate_cove_required(rule, context)
        elif rule_code == "INCOTERM_CONSISTENCY":
            finding = _evaluate_incoterm_consistency(rule, context)
        elif rule_code == "DATA_SHEET_AUTHENTICITY":
            finding = _evaluate_data_sheet_authenticity(rule, context)
        else:
            finding = None

        if finding:
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
        return template.format(**values)
    except KeyError:
        return template


def _has_loaded_document(context: dict[str, Any], document_type: str) -> bool:
    return any(_document_type(document) == document_type for document in _list(context.get("loaded_documents")))


def _has_missing_document(context: dict[str, Any], document_type: str) -> bool:
    missing_documents = [*_list(context.get("missing_required_documents")), *_list(context.get("missing_support_documents"))]
    return any(_document_type(document) == document_type for document in missing_documents)


def _document_type(document: Any) -> str:
    row = _record(document)
    return str(row.get("document_type") or row.get("type") or "").strip()


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
