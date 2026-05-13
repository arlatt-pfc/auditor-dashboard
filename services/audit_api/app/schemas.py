from pydantic import BaseModel, Field


class AuditRunResponse(BaseModel):
    compliance_percent: float = Field(ge=0, le=100)
    risk_level: str
    executive_dictamen: str
    top_critical_gaps: list[str]
    report_pdf_url: str | None = None


class PedimentoData(BaseModel):
    broker_name: str = ""
    broker_patent: str = ""
    commercial_value_usd: float | None = None
    customs_office: str = ""
    customs_value_mxn: float | None = None
    dta_mxn: float | None = None
    exchange_rate: str | float | None = None
    igi_mxn: float | None = None
    import_date: str = ""
    importer_name: str = ""
    importer_rfc: str = ""
    iva_mxn: float | None = None
    operation_code: str = ""
    payment_date: str = ""
    pedimento_full: str = ""
    pedimento_number: str = ""
    prv_mxn: float | None = None
    coves: list[str] = Field(default_factory=list)
    invoices: list[str] = Field(default_factory=list)
    providers: list[str] = Field(default_factory=list)
    reference: str = ""
    tariff_items: list[str] = Field(default_factory=list)
    total_contributions_mxn: float | None = None


class PedimentoParseResponse(BaseModel):
    document_type: str
    is_supported_as_primary_xml: bool = False
    is_supported_as_primary_document: bool = False
    confidence: int = Field(ge=0, le=100)
    user_message: str = ""
    detected_fields: list[str]
    missing_fields: list[str]
    data: PedimentoData
    error_code: str | None = None
    warning: str | None = None
