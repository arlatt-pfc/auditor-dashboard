import { NextResponse } from "next/server";

import { getAuthContext, userCanExecuteEngine } from "@/lib/auth/session";
import { supabaseInsert } from "@/lib/supabase/client";

type PersistAuditPayload = {
  auditResult?: Record<string, unknown>;
  loadedDocuments?: unknown;
  missingDocuments?: unknown;
  pedimentoData?: Record<string, unknown>;
  pdfStoragePath?: string;
};

type CustomsAuditRow = {
  id?: string;
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

  const payload = (await request.json().catch(() => null)) as PersistAuditPayload | null;

  if (!payload?.auditResult || !payload.pedimentoData) {
    return NextResponse.json({ error: "INVALID_CUSTOMS_AUDIT_PAYLOAD" }, { status: 400 });
  }

  const pedimentoData = payload.pedimentoData;
  const auditResult = payload.auditResult;
  const operationCode = text(pedimentoData.operation_code);

  if (!operationCode) {
    return NextResponse.json({ error: "OPERATION_CODE_REQUIRED" }, { status: 400 });
  }

  const row = await supabaseInsert<CustomsAuditRow>(
    "customs_audits",
    {
      broker_name: text(pedimentoData.broker_name),
      company_id: auth.profile.companyId,
      compliance_percent: numberOrNull(auditResult.compliance_percent),
      created_by: auth.user.id,
      customs_office: text(pedimentoData.customs_office),
      executive_dictamen: text(auditResult.executive_dictamen),
      findings: jsonArray(auditResult.findings ?? auditResult.top_critical_gaps),
      importer_name: text(pedimentoData.importer_name),
      loaded_documents: jsonArray(payload.loadedDocuments),
      missing_documents: jsonArray(payload.missingDocuments),
      operation_code: operationCode,
      pdf_storage_path: text(payload.pdfStoragePath),
      pedimento_data: pedimentoData,
      pedimento_number: text(pedimentoData.pedimento_number),
      result_json: auditResult,
      risk_level: text(auditResult.risk_level),
      status: "completed",
    },
    {
      accessToken: auth.accessToken,
      select: "id",
    },
  );

  if (!row?.id) {
    return NextResponse.json({ error: "CUSTOMS_AUDIT_PERSIST_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ id: row.id });
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}
