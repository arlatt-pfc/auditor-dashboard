import { NextResponse } from "next/server";

import { getAuthContext, userCanExecuteEngine } from "@/lib/auth/session";
import { supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/supabase/client";

type PersistAuditPayload = {
  auditGroupId?: string;
  audit_group_id?: string;
  auditResult?: Record<string, unknown>;
  audit_result?: Record<string, unknown>;
  documentsAdded?: unknown;
  documents_added?: unknown;
  executionLog?: unknown;
  execution_log?: unknown;
  loadedDocuments?: unknown;
  loaded_documents?: unknown;
  missingDocuments?: unknown;
  missing_documents?: unknown;
  parentAuditId?: string;
  parent_audit_id?: string;
  pedimentoData?: Record<string, unknown>;
  pedimento_data?: Record<string, unknown>;
  pdfStoragePath?: string;
  pdf_storage_path?: string;
  rerunReason?: string;
  rerun_reason?: string;
};

type CustomsAuditRow = {
  audit_group_id?: string;
  audit_version?: number | string;
  deleted_at?: string | null;
  id?: string;
};

type CustomsAuditLogRow = {
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

  const auditResult = payload?.auditResult ?? payload?.audit_result;
  const pedimentoData = payload?.pedimentoData ?? payload?.pedimento_data;

  if (!auditResult || !pedimentoData) {
    return NextResponse.json({ error: "INVALID_CUSTOMS_AUDIT_PAYLOAD" }, { status: 400 });
  }

  const requestPayload = payload ?? {};
  const operationCode = text(pedimentoData.operation_code);
  const newAuditId = crypto.randomUUID();
  const parentAudit = await getParentAudit(requestPayload.parentAuditId ?? requestPayload.parent_audit_id, requestPayload.auditGroupId ?? requestPayload.audit_group_id, auth.accessToken);

  if (parentAudit?.deleted_at) {
    return NextResponse.json({ error: "PARENT_AUDIT_ARCHIVED" }, { status: 409 });
  }

  const auditGroupId = text(parentAudit?.audit_group_id, requestPayload.auditGroupId, requestPayload.audit_group_id, parentAudit?.id, newAuditId);
  const auditVersion = parentAudit ? number(parentAudit.audit_version, 1) + 1 : 1;

  if (!operationCode) {
    return NextResponse.json({ error: "OPERATION_CODE_REQUIRED" }, { status: 400 });
  }

  const row = await supabaseInsert<CustomsAuditRow>(
    "customs_audits",
    {
      audit_group_id: auditGroupId,
      audit_version: auditVersion,
      broker_name: text(pedimentoData.broker_name),
      company_id: auth.profile.companyId,
      compliance_percent: numberOrNull(auditResult.compliance_percent),
      created_by: auth.user.id,
      customs_office: text(pedimentoData.customs_office),
      documents_added: jsonArray(requestPayload.documentsAdded ?? requestPayload.documents_added),
      executive_dictamen: text(auditResult.executive_dictamen),
      findings: jsonArray(auditResult.findings ?? auditResult.top_critical_gaps),
      id: newAuditId,
      importer_name: text(pedimentoData.importer_name),
      is_latest: true,
      loaded_documents: jsonArray(requestPayload.loadedDocuments ?? requestPayload.loaded_documents),
      missing_documents: jsonArray(requestPayload.missingDocuments ?? requestPayload.missing_documents),
      operation_code: operationCode,
      parent_audit_id: parentAudit?.id ?? null,
      pdf_storage_path: text(requestPayload.pdfStoragePath, requestPayload.pdf_storage_path),
      pedimento_data: pedimentoData,
      pedimento_number: text(pedimentoData.pedimento_number),
      rerun_reason: text(requestPayload.rerunReason, requestPayload.rerun_reason),
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

  if (parentAudit?.id) {
    await supabaseUpdate<CustomsAuditRow>(
      "customs_audits",
      {
        is_latest: false,
        superseded_by: row.id,
      },
      {
        accessToken: auth.accessToken,
        eq: {
          id: parentAudit.id,
        },
        select: "id",
      },
    );
  }

  await persistExecutionLog(row.id, operationCode, requestPayload.executionLog ?? requestPayload.execution_log ?? auditResult.execution_log, auth.accessToken);

  return NextResponse.json({ audit_group_id: auditGroupId, audit_version: auditVersion, id: row.id });
}

async function persistExecutionLog(auditId: string, operationCode: string, executionLog: unknown, accessToken: string) {
  const rows = jsonArray(executionLog);

  for (const item of rows) {
    const row = record(item);

    await supabaseInsert<CustomsAuditLogRow>(
      "customs_audit_logs",
      {
        audit_id: auditId,
        duration_ms: numberOrNull(row.duration_ms),
        message: text(row.message),
        metadata_json: record(row.metadata_json),
        operation_code: operationCode,
        stage: text(row.stage),
        status: text(row.status),
      },
      {
        accessToken,
        select: "id",
      },
    );
  }
}

async function getParentAudit(parentAuditId: unknown, auditGroupId: unknown, accessToken: string) {
  const explicitParentId = text(parentAuditId);

  if (explicitParentId) {
    const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
      accessToken,
      eq: {
        id: explicitParentId,
      },
      limit: 1,
    });

    return rows[0] ?? null;
  }

  const groupId = text(auditGroupId);

  if (!groupId) {
    return null;
  }

  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken,
    eq: {
      audit_group_id: groupId,
      is_latest: true,
    },
    limit: 1,
    params: {
      deleted_at: "is.null",
    },
  });

  return rows[0] ?? null;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
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

function number(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
