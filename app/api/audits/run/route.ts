import { NextResponse } from "next/server";

import { getAuthContext, userCanExecuteEngine } from "@/lib/auth/session";
import { supabaseInsert, supabaseUpdate } from "@/lib/supabase/client";

type AuditApiResponse = {
  compliance_percent?: number | string;
  executive_dictamen?: string;
  report_pdf_url?: string | null;
  risk_level?: string;
  top_critical_gaps?: unknown;
};

type NormalizedAuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

const CUSTOMS_ENGINE_CODE = "CUSTOMS_COMPLIANCE";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthContext();

  if (!auth?.profile) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!userCanExecuteEngine(auth, CUSTOMS_ENGINE_CODE)) {
    return NextResponse.json({ error: "ENGINE_EXECUTE_FORBIDDEN" }, { status: 403 });
  }

  const auditApiUrl = process.env.AUDIT_API_URL?.trim();
  const auditApiKey = process.env.AUDIT_API_KEY?.trim();

  if (!auditApiUrl || !auditApiKey) {
    return NextResponse.json({ error: "AUDIT_API_NOT_CONFIGURED" }, { status: 500 });
  }

  const incomingFormData = await request.formData().catch(() => null);

  if (!incomingFormData) {
    return NextResponse.json({ error: "INVALID_MULTIPART_FORM_DATA" }, { status: 400 });
  }

  const file = incomingFormData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF_FILE_REQUIRED" }, { status: 400 });
  }

  if (!isPdf(file)) {
    return NextResponse.json({ error: "PDF_FILE_REQUIRED" }, { status: 400 });
  }

  const operationId = text(incomingFormData.get("operation_id"));
  const operationRecordId =
    text(incomingFormData.get("operation_record_id")) ||
    (await createCustomsOperationIfNeeded({
      accessToken: auth.accessToken,
      broker: text(incomingFormData.get("broker")),
      companyId: auth.profile.companyId,
      customsReference: text(incomingFormData.get("customs_reference")),
      importer: text(incomingFormData.get("importer")),
      operationId,
      pedimento: text(incomingFormData.get("pedimento")),
      userId: auth.user.id,
    })) ||
    operationId;
  const auditTopic = text(incomingFormData.get("audit_topic")) || `Customs Compliance - ${operationId || file.name}`;
  const engineId = text(incomingFormData.get("engine_id")) || CUSTOMS_ENGINE_CODE;

  const outboundFormData = new FormData();
  outboundFormData.append("file", file, file.name);
  outboundFormData.append("audit_topic", auditTopic);
  outboundFormData.append("engine_id", engineId);
  outboundFormData.append("company_id", auth.profile.companyId);
  outboundFormData.append("user_id", auth.user.id);

  const auditResponse = await fetch(auditApiUrl, {
    body: outboundFormData,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${auditApiKey}`,
    },
    method: "POST",
  }).catch(() => null);

  if (!auditResponse) {
    return NextResponse.json({ error: "AUDIT_API_UNREACHABLE" }, { status: 502 });
  }

  const payload = (await auditResponse.json().catch(() => null)) as AuditApiResponse | { detail?: string } | null;

  if (!auditResponse.ok) {
    return NextResponse.json(
      {
        detail: payload && "detail" in payload ? payload.detail : undefined,
        error: "AUDIT_API_FAILED",
      },
      { status: 502 },
    );
  }

  const result = normalizeAuditResult(payload as AuditApiResponse);
  const persisted = await persistAuditResult({
    accessToken: auth.accessToken,
    auditTopic,
    companyId: auth.profile.companyId,
    engineId,
    operationRecordId,
    result,
    userId: auth.user.id,
  });

  return NextResponse.json({
    ...result,
    persisted,
  });
}

async function persistAuditResult({
  accessToken,
  auditTopic,
  companyId,
  engineId,
  operationRecordId,
  result,
  userId,
}: {
  accessToken: string;
  auditTopic: string;
  companyId: string;
  engineId: string;
  operationRecordId: string;
  result: NormalizedAuditResult;
  userId: string;
}) {
  await supabaseUpdate<Record<string, unknown>>(
    "customs_operations",
    {
      critical_findings: result.top_critical_gaps.length,
      dictamen: result.executive_dictamen,
      metrics: {
        audited_operations: 1,
        critical_findings: result.top_critical_gaps.length,
        potential_recovery: 0,
        risk_score: riskScore(result),
        risk_score_average: riskScore(result),
        severity: severityFromRisk(result.risk_level),
      },
      next_steps: [
        "Validar los hallazgos generados por el motor externo.",
        "Documentar evidencia fuente y responsable de accion correctiva.",
        "Preparar recuperacion, rectificacion o aclaracion cuando aplique.",
      ],
      recommendations: result.top_critical_gaps.length > 0 ? result.top_critical_gaps : ["Mantener expediente auditado y evidencia de cumplimiento."],
      risk_score: riskScore(result),
      severity: severityFromRisk(result.risk_level),
    },
    {
      accessToken,
      eq: {
        id: operationRecordId,
      },
    },
  );

  const auditRun = await supabaseInsert<Record<string, unknown>>(
    "customs_audit_batches",
    {
      audit_topic: auditTopic,
      company_id: companyId,
      engine_id: engineId,
      executed_by: userId,
      operation_id: operationRecordId,
      report_pdf_url: result.report_pdf_url,
      result_json: result,
      status: "completed",
    },
    {
      accessToken,
    },
  );

  const findingResults = await Promise.all(
    result.top_critical_gaps.map((gap, index) =>
      supabaseInsert<Record<string, unknown>>(
        "customs_findings",
        {
          created_by: userId,
          description: gap,
          evidence: "External audit API",
          operation_id: operationRecordId,
          potential_recovery: 0,
          recommendation: "Revisar brecha crítica y documentar acción correctiva.",
          rule: `External audit gap ${index + 1}`,
          severity: "High",
          status: "Open",
        },
        {
          accessToken,
        },
      ),
    ),
  );

  return Boolean(auditRun) && findingResults.every(Boolean);
}

async function createCustomsOperationIfNeeded({
  accessToken,
  broker,
  companyId,
  customsReference,
  importer,
  operationId,
  pedimento,
  userId,
}: {
  accessToken: string;
  broker: string;
  companyId: string;
  customsReference: string;
  importer: string;
  operationId: string;
  pedimento: string;
  userId: string;
}) {
  if (!operationId) {
    return "";
  }

  const row = await supabaseInsert<Record<string, unknown>>(
    "customs_operations",
    {
      broker,
      company_id: companyId,
      created_by: userId,
      customs_reference: customsReference,
      dictamen: `Expediente aduanal ${operationId} creado desde el wizard de Customs Compliance.`,
      framework: CUSTOMS_ENGINE_CODE,
      importer,
      metrics: {
        audited_operations: 1,
        broker_account_total: 0,
        critical_findings: 0,
        igi_paid: 0,
        potential_recovery: 0,
        risk_score: 0,
        risk_score_average: 0,
        severity: "Low",
      },
      operation_code: operationId,
      pedimento,
      provider: "",
      recommendations: ["Ejecutar auditoria documental para generar dictamen y hallazgos."],
    },
    {
      accessToken,
    },
  );

  return text(row?.id);
}

function normalizeAuditResult(payload: AuditApiResponse | null): NormalizedAuditResult {
  return {
    compliance_percent: number(payload?.compliance_percent),
    executive_dictamen: text(payload?.executive_dictamen),
    persisted: false,
    report_pdf_url: text(payload?.report_pdf_url) || null,
    risk_level: text(payload?.risk_level) || "unknown",
    top_critical_gaps: normalizeGaps(payload?.top_critical_gaps),
  };
}

function normalizeGaps(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((gap) => (typeof gap === "string" ? gap : JSON.stringify(gap))).filter(Boolean).slice(0, 10);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isPdf(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".pdf") && (!file.type || file.type === "application/pdf" || file.type === "application/octet-stream");
}

function riskScore(result: NormalizedAuditResult) {
  const riskLevel = result.risk_level.toLowerCase();

  if (riskLevel.includes("critical") || riskLevel.includes("critico") || riskLevel.includes("crítico")) {
    return 95;
  }

  if (riskLevel.includes("high") || riskLevel.includes("alto")) {
    return 82;
  }

  if (riskLevel.includes("medium") || riskLevel.includes("medio")) {
    return 55;
  }

  if (riskLevel.includes("low") || riskLevel.includes("bajo")) {
    return 25;
  }

  return Math.max(0, Math.min(100, Math.round(100 - result.compliance_percent)));
}

function severityFromRisk(riskLevel: string) {
  const normalized = riskLevel.toLowerCase();

  if (normalized.includes("critical") || normalized.includes("critico") || normalized.includes("crítico")) {
    return "Critical";
  }

  if (normalized.includes("high") || normalized.includes("alto")) {
    return "High";
  }

  if (normalized.includes("medium") || normalized.includes("medio")) {
    return "Medium";
  }

  return "Low";
}
