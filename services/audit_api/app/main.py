from pathlib import Path
from uuid import uuid4
import json
import shutil
import traceback

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import Settings, get_settings
from .customs_parser import parse_uploaded_pedimento
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
    authorization: str | None = Header(default=None),
    x_lda_audit_client: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuditRunResponse | JSONResponse:
    try:
        _authorize_audit_run(settings, authorization, x_lda_audit_client)

        metadata = {
            "loaded_documents": _parse_json_metadata(loaded_documents),
            "missing_required_documents": _parse_json_metadata(missing_required_documents),
            "missing_support_documents": _parse_json_metadata(missing_support_documents),
            "pedimento_data": _parse_json_metadata(pedimento_data),
            "support_file_metadata": _parse_json_metadata(support_file_metadata),
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
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "MAIN_FILE_MISSING"})

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
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "MAIN_FILE_MISSING", "detail": "Main file is empty."})

        if not _is_pdf(file):
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "INVALID_FILE_TYPE", "detail": "Only PDF audit files are supported."})

        operation_code = _operation_code(operation_id, metadata["pedimento_data"])
        work_dir = settings.tmp_dir / operation_code
        support_dir = work_dir / "support"
        work_dir.mkdir(parents=True, exist_ok=True)
        support_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = work_dir / _safe_pdf_name(file.filename or f"{operation_code}.pdf")

        with pdf_path.open("wb") as target:
            target.write(payload)

        saved_support_files = []
        for index, support_file in enumerate(support_files or [], start=1):
            support_payload = await support_file.read()
            support_path = support_dir / _safe_upload_name(support_file.filename or f"support-{index}")
            with support_path.open("wb") as target:
                target.write(support_payload)
            saved_support_files.append(str(support_path))

        print(
            "[audit.run] saved files",
            {
                "main_file_path": str(pdf_path),
                "support_files": saved_support_files,
            },
        )

        if x_lda_audit_client == "customs-dashboard":
            print("[audit.run] pipeline start", {"stage": "customs_mvp_controlled_result"})
            result = _customs_mvp_result(metadata, saved_support_files)
            print("[audit.run] pipeline complete", {"stage": "customs_mvp_controlled_result"})
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
            content={"error": "AUDIT_EXECUTION_FAILED", "detail": str(exc), "stage": "pipeline_execution"},
        )
    except Exception as exc:
        print("[audit.run] error", traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "AUDIT_EXECUTION_FAILED", "detail": str(exc), "stage": "pipeline_execution"},
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
    missing_count = _metadata_count(missing_required) + _metadata_count(missing_support)
    findings = []

    if missing_count:
        findings.append("Expediente parcial: existen documentos no cargados que deben tratarse como brechas documentales.")

    if not findings:
        findings.append("Expediente recibido para revisión documental aduanera sin brechas documentales declaradas.")

    return {
        "compliance_percent": max(0, 100 - (missing_count * 8)),
        "executive_dictamen": "Resultado preliminar generado para Customs Compliance. El paquete documental fue recibido en el VPS y será evaluado con brechas documentales cuando aplique.",
        "findings": findings,
        "loaded_documents": loaded_documents,
        "metadata": {
            **metadata,
            "saved_support_files": saved_support_files,
        },
        "missing_required_documents": missing_required,
        "missing_support_documents": missing_support,
        "report_pdf_url": None,
        "risk_level": "Medium" if missing_count else "Low",
        "top_critical_gaps": findings,
    }


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
