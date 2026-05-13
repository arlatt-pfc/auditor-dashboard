from pydantic import BaseModel, Field


class AuditRunResponse(BaseModel):
    compliance_percent: float = Field(ge=0, le=100)
    risk_level: str
    executive_dictamen: str
    top_critical_gaps: list[str]
    report_pdf_url: str | None = None

