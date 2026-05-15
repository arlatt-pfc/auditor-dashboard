from pathlib import Path
from uuid import uuid4
from contextlib import contextmanager
import json
import shutil
import time
import traceback

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import Settings, get_settings
from .commercial_invoice_parser import parse_commercial_invoice_pdf
from .customs_parser import parse_uploaded_pedimento
from .customs_rules_engine import evaluate_customs_rules
from .pipeline_runner import PipelineExecutionError, run_pipeline
from .schemas import AuditRunResponse, PedimentoParseResponse

app = FastAPI(title="LDA Audit API", version="0.1.0")

ALLOWED_CORS_ORIGINS = {
    "https://auditor-dashboard.netlify.app",
    "http://localhost:3000",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_CORS_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.options("/audit/run")
async def audit_run_options(request: Request) -> Response:
    origin = request.headers.get("origin", "")
    allow_origin = origin if origin in ALLOWED_CORS_ORIGINS else "https://auditor-dashboard.netlify.app"

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers={
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Origin": allow_origin,
        },
    )


@app.post("/audit/run", response_model=AuditRunResponse)
async def run_audit(
    audit_topic: str = Form("Customs Compliance"),
    engine_id: str = Form("CUSTOMS_COMPLIANCE"),
    company_id: str = Form("customs-dashboard"),
    user_id: str = Form("customs-dashboard"),
    operation_id: str = Form(""),
    file: UploadFile | None = File(default=None),
    support_files: list[UploadFile] | None = File(default=None),
    pedimento_data: str = Form(""),
    loaded_documents: str = Form(""),
    missing_required_documents: str = Form(""),
    missing_support_documents: str = Form(""),
    support_file_metadata: str = Form(""),
    support_document_types: list[str] | None = Form(default=None),
    authorization: str | None = Header(default=None),
    x_lda_audit_client: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuditRunResponse | JSONResponse:
    execution_log: list[dict[str, object]] = []

    try:
        with _audit_stage(execution_log, "received", "Recibiendo expediente y metadata del navegador."):
            _authorize_audit_run(settings, authorization, x_lda_audit_client)

            metadata = {
                "loaded_documents": _parse_json_metadata(loaded_documents),
                "missing_required_documents": _parse_json_metadata(missing_required_documents),
                "missing_support_documents": _parse_json_metadata(missing_support_documents),
                "pedimento_data": _parse_json_metadata(pedimento_data),
                "support_file_metadata": _parse_json_metadata(support_file_metadata),
                "support_document_types": support_document_types or [],
            }
            missing_documents_count = _metadata_count(metadata["missing_required_documents"]) + _metadata_count(metadata["missing_support_documents"])

            print(
                "[audit.run] received",
                {
                    "main_file_name": file.filename if file else None,
                    "metadata_keys": [key for key, value in metadata.items() if value],
                    "missing_documents_count": missing_documents_count,
                    "support_files_count": len(support_files or []),
                },
            )

        if file is None:
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "MAIN_FILE_MISSING", "execution_log": execution_log})

        with _audit_stage(execution_log, "save_files", "Guardando pedimento base y documentos soporte en área temporal."):
            payload = await file.read()
            print(
                "[audit.run] file",
                {
                    "main_file_name": file.filename,
                    "main_file_size": len(payload),
                    "support_files_count": len(support_files or []),
                },
            )

            if not payload:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "MAIN_FILE_MISSING", "detail": "Main file is empty.", "execution_log": execution_log},
                )

            if not _is_pdf(file):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "INVALID_FILE_TYPE", "detail": "Only PDF audit files are supported.", "execution_log": execution_log},
                )

            operation_code = _operation_code(operation_id, metadata["pedimento_data"])
            work_dir = settings.tmp_dir / operation_code
            support_dir = work_dir / "support"
            work_dir.mkdir(parents=True, exist_ok=True)
            support_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = work_dir / _safe_pdf_name(file.filename or f"{operation_code}.pdf")

            with pdf_path.open("wb") as target:
                target.write(payload)

            support_metadata_items = metadata["support_file_metadata"] if isinstance(metadata["support_file_metadata"], list) else []
            saved_support_files = []
            saved_support_file_records = []
            for index, support_file in enumerate(support_files or [], start=1):
                support_payload = await support_file.read()
                support_path = support_dir / _safe_upload_name(support_file.filename or f"support-{index}")
                with support_path.open("wb") as target:
                    target.write(support_payload)
                saved_support_files.append(str(support_path))
                document_type = _support_document_type(index - 1, support_metadata_items, support_document_types or [])
                saved_support_file_records.append(
                    {
                        "document_type": document_type,
                        "file_name": support_file.filename or f"support-{index}",
                        "path": str(support_path),
                        "size": len(support_payload),
                    }
                )

        with _audit_stage(execution_log, "ocr", "Preparando extracción de texto y OCR cuando el PDF lo requiera."):
            invoice_file_count = sum(1 for record in saved_support_file_records if record.get("document_type") == "commercial_invoice")

        with _audit_stage(execution_log, "parse_invoices", "Extrayendo facturas comerciales y registros multipágina."):
            invoice_details, invoice_parse_errors = _parse_commercial_invoice_support_files(saved_support_file_records, support_dir)
            metadata["invoice_details"] = invoice_details
            metadata["commercial_invoice_parse_errors"] = invoice_parse_errors

        with _audit_stage(execution_log, "rules_engine", "Aplicando catálogo configurable de reglas aduaneras."):
            metadata["customs_rule_findings"] = evaluate_customs_rules(metadata)

        print(
            "[audit.run] saved files",
            {
                "customs_rule_findings_count": len(metadata["customs_rule_findings"]),
                "main_file_path": str(pdf_path),
                "support_files": saved_support_files,
                "invoice_details_count": len(invoice_details),
                "invoice_file_count": invoice_file_count,
            },
        )

        if x_lda_audit_client == "customs-dashboard":
            with _audit_stage(execution_log, "scoring", "Calculando cumplimiento, riesgo y dictamen ejecutivo."):
                print("[audit.run] pipeline start", {"stage": "customs_mvp_controlled_result"})
                result = _customs_mvp_result(metadata, saved_support_files)
                print("[audit.run] pipeline complete", {"stage": "customs_mvp_controlled_result"})

            with _audit_stage(execution_log, "result_ready", "Resultado listo para envío al dashboard."):
                pass

            result["execution_log"] = execution_log

            return JSONResponse(status_code=status.HTTP_200_OK, content=result)

        print("[audit.run] pipeline start", {"function": "run_pipeline"})
        result = run_pipeline(
            audit_topic=audit_topic,
            company_id=company_id,
            engine_id=engine_id,
            pdf_path=pdf_path,
            settings=settings,
            user_id=user_id,
            work_dir=work_dir,
        )
        print("[audit.run] pipeline complete", {"function": "run_pipeline"})
        return result
    except PipelineExecutionError as exc:
        print("[audit.run] error", traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "AUDIT_EXECUTION_FAILED", "detail": str(exc), "execution_log": execution_log, "stage": "pipeline_execution"},
        )
    except Exception as exc:
        print("[audit.run] error", traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "AUDIT_EXECUTION_FAILED", "detail": str(exc), "execution_log": execution_log, "stage": "pipeline_execution"},
        )


@app.post("/customs/parse-pedimento", response_model=PedimentoParseResponse)
async def parse_pedimento(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> PedimentoParseResponse | JSONResponse:
    _authorize_request(settings, authorization)

    request_id = str(uuid4())
    work_dir = settings.tmp_dir / "customs-parse" / request_id
    work_dir.mkdir(parents=True, exist_ok=False)

    try:
        payload = await file.read()

        if not payload:
            return _customs_error("PEDIMENTO_FILE_EMPTY", status.HTTP_400_BAD_REQUEST, "El archivo de pedimento está vacío.")

        result = parse_uploaded_pedimento(file.filename or "pedimento", file.content_type, payload, work_dir)

        if result.error_code == "PDF_TEXT_NOT_EXTRACTABLE":
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=result.model_dump())

        if result.error_code and not result.is_supported_as_primary_document:
            status_code = status.HTTP_200_OK if result.document_type == "CFDI" else status.HTTP_400_BAD_REQUEST
            return JSONResponse(status_code=status_code, content=result.model_dump())

        return result
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _authorize_request(settings: Settings, authorization: str | None) -> None:
    if not settings.api_key:
        return

    expected = f"Bearer {settings.api_key}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid audit API credentials.")


def _authorize_audit_run(settings: Settings, authorization: str | None, audit_client: str | None) -> None:
    if audit_client == "customs-dashboard":
        return

    _authorize_request(settings, authorization)


def _validate_pdf(file: UploadFile) -> None:
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF uploads are supported.")

    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file content type.")


def _is_pdf(file: UploadFile) -> bool:
    filename = file.filename or ""
    return filename.lower().endswith(".pdf") and file.content_type in {None, "", "application/pdf", "application/octet-stream"}


def _safe_pdf_name(filename: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "_" for character in filename)
    return safe if safe.lower().endswith(".pdf") else f"{safe}.pdf"


def _safe_upload_name(filename: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "_" for character in filename)
    return safe or "support-file"


def _parse_json_metadata(value: str) -> object:
    if not value:
        return {}

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return {}


def _metadata_count(value: object) -> int:
    if isinstance(value, list):
        return len(value)

    if isinstance(value, dict):
        return len(value)

    return 0


@contextmanager
def _audit_stage(execution_log: list[dict[str, object]], stage: str, message: str, metadata: dict[str, object] | None = None):
    start = time.perf_counter()
    status_value = "completed"
    detail = message

    try:
        yield
    except Exception as exc:
        status_value = "failed"
        detail = str(exc)
        raise
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        execution_log.append(
            {
                "duration_ms": duration_ms,
                "message": detail,
                "metadata_json": metadata or {},
                "stage": stage,
                "status": status_value,
            }
        )


def _support_document_type(index: int, metadata_items: object, support_document_types: list[str]) -> str:
    if isinstance(metadata_items, list) and index < len(metadata_items):
        item = metadata_items[index]
        if isinstance(item, dict):
            document_type = item.get("document_type")
            if isinstance(document_type, str) and document_type:
                return document_type

    if index < len(support_document_types):
        return support_document_types[index]

    return ""


def _parse_commercial_invoice_support_files(
    saved_support_file_records: list[dict[str, object]],
    support_dir: Path,
) -> tuple[list[dict[str, object | None]], list[str]]:
    invoice_details: list[dict[str, object | None]] = []
    errors: list[str] = []

    for record in saved_support_file_records:
        if record.get("document_type") != "commercial_invoice":
            continue

        path = Path(str(record.get("path") or ""))
        file_name = str(record.get("file_name") or path.name)

        if path.suffix.lower() != ".pdf":
            errors.append(f"Factura comercial {file_name} no es PDF; requiere revisión manual.")
            continue

        result = parse_commercial_invoice_pdf(path, file_name, support_dir)
        invoice_details.extend(result.invoice_details)
        errors.extend(result.errors)

    return invoice_details, _unique_strings(errors)


def _operation_code(operation_id: str, pedimento_data: object) -> str:
    if operation_id:
        return _safe_upload_name(operation_id)

    if isinstance(pedimento_data, dict):
        operation_code = pedimento_data.get("operation_code")
        if isinstance(operation_code, str) and operation_code.strip():
            return _safe_upload_name(operation_code.strip())

    return str(uuid4())


def _customs_mvp_result(metadata: dict[str, object], saved_support_files: list[str]) -> dict[str, object]:
    missing_required = metadata.get("missing_required_documents")
    missing_support = metadata.get("missing_support_documents")
    loaded_documents = metadata.get("loaded_documents")
    invoice_details = metadata.get("invoice_details")
    invoice_parse_errors = metadata.get("commercial_invoice_parse_errors")
    customs_rule_findings = metadata.get("customs_rule_findings")
    missing_count = _metadata_count(missing_required) + _metadata_count(missing_support)
    findings: list[dict[str, object]] = []

    if missing_count:
        findings.append(
            _finding(
                "DOCUMENTARY_GAPS_DECLARED",
                "Expediente parcial",
                "Expediente parcial: existen documentos no cargados que deben tratarse como brechas documentales.",
                "Integrar los documentos faltantes o documentar la brecha en el expediente.",
                "Medium",
            )
        )

    if isinstance(invoice_parse_errors, list):
        findings.extend(
            _finding(
                "COMMERCIAL_INVOICE_TEXT_EXTRACTION",
                "Factura comercial requiere revisión",
                str(error),
                "Revisar manualmente la factura comercial o cargar una versión con texto extraíble.",
                "Medium",
            )
            for error in invoice_parse_errors
            if error
        )

    if isinstance(customs_rule_findings, list):
        findings.extend(finding for finding in customs_rule_findings if isinstance(finding, dict))

    if not findings:
        findings.append(
            _finding(
                "CUSTOMS_RULES_NO_GAPS",
                "Sin brechas preliminares",
                "Expediente recibido para revisión documental aduanera sin brechas documentales declaradas.",
                "Conservar evidencia y continuar con revisión especializada cuando aplique.",
                "Low",
            )
        )

    compliance_percent = max(0, 100 - (missing_count * 8) - _finding_penalty(findings))
    risk_level = _risk_level(findings, missing_count)

    return {
        "compliance_percent": compliance_percent,
        "executive_dictamen": _executive_dictamen(compliance_percent, risk_level, findings, missing_count),
        "findings": findings,
        "invoice_details": invoice_details if isinstance(invoice_details, list) else [],
        "loaded_documents": loaded_documents,
        "metadata": {
            **metadata,
            "saved_support_files": saved_support_files,
        },
        "missing_required_documents": missing_required,
        "missing_support_documents": missing_support,
        "report_pdf_url": None,
        "risk_level": risk_level,
        "top_critical_gaps": [str(finding.get("description") or finding.get("title") or "") for finding in findings],
    }


def _unique_strings(values: list[str]) -> list[str]:
    unique = []
    seen = set()

    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        unique.append(normalized)
        seen.add(normalized)

    return unique


def _finding(rule_code: str, title: str, description: str, recommendation: str, severity: str) -> dict[str, object]:
    return {
        "category": "documentary_compliance",
        "description": description,
        "evidence": {},
        "legal_basis": "",
        "recommendation": recommendation,
        "rule_code": rule_code,
        "severity": severity,
        "title": title,
    }


def _finding_penalty(findings: list[dict[str, object]]) -> int:
    penalties = {
        "critical": 14,
        "high": 10,
        "medium": 5,
        "low": 2,
    }

    return sum(penalties.get(str(finding.get("severity") or "").lower(), 4) for finding in findings if finding.get("rule_code") != "CUSTOMS_RULES_NO_GAPS")


def _risk_level(findings: list[dict[str, object]], missing_count: int) -> str:
    severities = {str(finding.get("severity") or "").lower() for finding in findings}

    if "critical" in severities:
        return "Critical"

    if "high" in severities or missing_count >= 4:
        return "High"

    if "medium" in severities or missing_count > 0:
        return "Medium"

    return "Low"


def _executive_dictamen(compliance_percent: int, risk_level: str, findings: list[dict[str, object]], missing_count: int) -> str:
    actionable_findings = [finding for finding in findings if finding.get("rule_code") != "CUSTOMS_RULES_NO_GAPS"]

    if not actionable_findings:
        return (
            "El expediente aduanal fue procesado en el VPS sin brechas preliminares detectadas por el motor automático. "
            "Se recomienda conservar la evidencia documental y realizar validación especializada antes de cierre definitivo."
        )

    priority_titles = [str(finding.get("title") or finding.get("rule_code") or "Hallazgo") for finding in actionable_findings[:3]]
    missing_message = f" Se registraron {missing_count} documentos faltantes como brechas documentales." if missing_count else ""

    return (
        f"El expediente presenta cumplimiento estimado de {compliance_percent}% y riesgo {risk_level}. "
        f"Los principales puntos de atención son: {', '.join(priority_titles)}.{missing_message} "
        "El dictamen es preliminar y requiere remediar los hallazgos antes de considerar el expediente cerrado."
    )


def _customs_error(code: str, status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "confidence": 0,
            "data": {},
            "detected_fields": [],
            "document_type": "UNSUPPORTED",
            "error": code,
            "error_code": code,
            "is_supported_as_primary_document": False,
            "is_supported_as_primary_xml": False,
            "missing_fields": [],
            "user_message": message,
        },
    )
