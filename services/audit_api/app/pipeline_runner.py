from pathlib import Path
import json
import subprocess
from typing import Any

from .config import Settings
from .schemas import AuditRunResponse


class PipelineExecutionError(RuntimeError):
    pass


def run_pipeline(
    *,
    audit_topic: str,
    company_id: str,
    engine_id: str,
    pdf_path: Path,
    settings: Settings,
    user_id: str,
    work_dir: Path,
) -> AuditRunResponse:
    if not settings.pipeline_script.exists():
        raise PipelineExecutionError(f"Pipeline script not found: {settings.pipeline_script}")

    output_json_path = work_dir / "audit_result.json"
    command = [
        settings.python_bin,
        str(settings.pipeline_script),
        "--input",
        str(pdf_path),
        "--audit-topic",
        audit_topic,
        "--engine-id",
        engine_id,
        "--company-id",
        company_id,
        "--user-id",
        user_id,
        "--output-json",
        str(output_json_path),
    ]

    completed = subprocess.run(
        command,
        capture_output=True,
        check=False,
        cwd=str(work_dir),
        text=True,
        timeout=settings.timeout_seconds,
    )

    if completed.returncode != 0:
        stderr = completed.stderr.strip() or "Pipeline failed without stderr."
        raise PipelineExecutionError(stderr[-2000:])

    payload = _load_pipeline_payload(output_json_path, completed.stdout)
    return _normalize_payload(payload, settings)


def _load_pipeline_payload(output_json_path: Path, stdout: str) -> dict[str, Any]:
    if output_json_path.exists():
        return json.loads(output_json_path.read_text(encoding="utf-8"))

    stdout = stdout.strip()
    if not stdout:
        raise PipelineExecutionError("Pipeline completed but did not produce JSON output.")

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise PipelineExecutionError("Pipeline stdout is not valid JSON.") from exc


def _normalize_payload(payload: dict[str, Any], settings: Settings) -> AuditRunResponse:
    report_pdf_url = _first_text(payload, "report_pdf_url", "outputPdfUrl", "pdf_url", "report_url")
    report_pdf_path = _first_text(payload, "report_pdf_path", "output_pdf_path")

    if not report_pdf_url and report_pdf_path and settings.report_base_url:
        report_pdf_url = f"{settings.report_base_url}/{Path(report_pdf_path).name}"

    gaps = payload.get("top_critical_gaps") or payload.get("critical_gaps") or payload.get("gaps") or []
    if not isinstance(gaps, list):
        gaps = [str(gaps)]

    return AuditRunResponse(
        compliance_percent=float(payload.get("compliance_percent", payload.get("score", 0))),
        executive_dictamen=_first_text(payload, "executive_dictamen", "dictamen", "summary") or "",
        report_pdf_url=report_pdf_url,
        risk_level=_first_text(payload, "risk_level", "risk", "level") or "unknown",
        top_critical_gaps=[str(gap) for gap in gaps[:10]],
    )


def _first_text(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None

