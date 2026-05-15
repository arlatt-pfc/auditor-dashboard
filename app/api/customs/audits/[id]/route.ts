import { NextResponse } from "next/server";

import { getAuthContext, userCanExecuteEngine } from "@/lib/auth/session";
import { supabaseSelect, supabaseUpdate } from "@/lib/supabase/client";

type CustomsAuditRouteProps = {
  params: Promise<{ id: string }>;
};

type DeleteAuditPayload = {
  delete_reason?: string;
  reason?: string;
};

type CustomsAuditRow = {
  audit_group_id?: string | null;
  audit_version?: number | string | null;
  deleted_at?: string | null;
  id?: string | null;
  is_latest?: boolean | null;
};

const CUSTOMS_ENGINE_CODE = "CUSTOMS_COMPLIANCE";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: CustomsAuditRouteProps) {
  const auth = await getAuthContext();

  if (!auth?.profile) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!userCanExecuteEngine(auth, CUSTOMS_ENGINE_CODE)) {
    return NextResponse.json({ error: "ENGINE_EXECUTE_FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const auditId = decodeURIComponent(id);
  const payload = (await request.json().catch(() => null)) as DeleteAuditPayload | null;
  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken: auth.accessToken,
    eq: {
      id: auditId,
    },
    limit: 1,
  });
  const audit = rows[0] ?? null;

  if (!audit?.id) {
    return NextResponse.json({ error: "CUSTOMS_AUDIT_NOT_FOUND" }, { status: 404 });
  }

  if (audit.deleted_at) {
    return NextResponse.json({ archived: true, id: audit.id });
  }

  const archived = await supabaseUpdate<CustomsAuditRow>(
    "customs_audits",
    {
      deleted_at: new Date().toISOString(),
      deleted_by: auth.user.id,
      delete_reason: text(payload?.delete_reason, payload?.reason, "Archivada desde histórico Customs Compliance."),
      is_latest: false,
    },
    {
      accessToken: auth.accessToken,
      eq: {
        id: audit.id,
      },
      select: "id,audit_group_id,audit_version,is_latest,deleted_at",
    },
  );

  if (!archived?.id) {
    return NextResponse.json({ error: "CUSTOMS_AUDIT_ARCHIVE_FAILED" }, { status: 500 });
  }

  let newLatestId = "";

  if (audit.is_latest) {
    newLatestId = await markLatestActiveVersion(audit, auth.accessToken);
  }

  return NextResponse.json({ archived: true, id: archived.id, latest_audit_id: newLatestId || null });
}

async function markLatestActiveVersion(audit: CustomsAuditRow, accessToken: string) {
  const auditGroupId = text(audit.audit_group_id);

  if (!auditGroupId) {
    return "";
  }

  const activeRows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken,
    eq: {
      audit_group_id: auditGroupId,
    },
    limit: 1,
    order: {
      ascending: false,
      column: "audit_version",
    },
    params: {
      deleted_at: "is.null",
    },
    select: "id,audit_group_id,audit_version,is_latest,deleted_at",
  });
  const latest = activeRows[0];

  if (!latest?.id) {
    return "";
  }

  const updated = await supabaseUpdate<CustomsAuditRow>(
    "customs_audits",
    {
      is_latest: true,
      superseded_by: null,
    },
    {
      accessToken,
      eq: {
        id: latest.id,
      },
      select: "id",
    },
  );

  return updated?.id ?? "";
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
