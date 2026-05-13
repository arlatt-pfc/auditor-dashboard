from pathlib import Path
from uuid import uuid4
import shutil

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .customs_parser import parse_uploaded_pedimento
from .pipeline_runner import PipelineExecutionError, run_pipeline
from .schemas import AuditRunResponse, PedimentoParseResponse

app = FastAPI(title="LDA Audit API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/audit/run", response_model=AuditRunResponse)
async def run_audit(
    audit_topic: str = Form(...),
    engine_id: str = Form(...),
    company_id: str = Form(...),
    user_id: str = Form(...),
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuditRunResponse:
    _authorize_request(settings, authorization)
    _validate_pdf(file)

    request_id = str(uuid4())
    work_dir = settings.tmp_dir / request_id
    work_dir.mkdir(parents=True, exist_ok=False)
    pdf_path = work_dir / _safe_pdf_name(file.filename or f"{request_id}.pdf")

    try:
        with pdf_path.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        return run_pipeline(
            audit_topic=audit_topic,
            company_id=company_id,
            engine_id=engine_id,
            pdf_path=pdf_path,
            settings=settings,
            user_id=user_id,
            work_dir=work_dir,
        )
    except PipelineExecutionError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


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


def _validate_pdf(file: UploadFile) -> None:
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF uploads are supported.")

    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file content type.")


def _safe_pdf_name(filename: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "_" for character in filename)
    return safe if safe.lower().endswith(".pdf") else f"{safe}.pdf"


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
