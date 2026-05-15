import Link from "next/link";

import { CustomsExpedientWizard, type CustomsRerunContext } from "@/components/dashboard/customs/CustomsExpedientWizard";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanCreateEngine, userCanExecuteEngine, userCanReadEngine } from "@/lib/auth/session";
import { supabaseSelect } from "@/lib/supabase/client";

const currentPath = "/dashboard/customs-compliance";

type NewCustomsExpedientPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CustomsAuditRow = {
  audit_group_id?: string | null;
  audit_version?: number | string | null;
  id?: string | null;
  loaded_documents?: unknown;
  missing_documents?: unknown;
  operation_code?: string | null;
  pedimento_data?: Record<string, unknown> | null;
};

export default async function NewCustomsExpedientPage({ searchParams }: NewCustomsExpedientPageProps) {
  const auth = await getAuthContext();
  const canRead = userCanReadEngine(auth, "CUSTOMS_COMPLIANCE");
  const canExecute = userCanCreateEngine(auth, "CUSTOMS_COMPLIANCE") && userCanExecuteEngine(auth, "CUSTOMS_COMPLIANCE");
  const params = (await searchParams) ?? {};
  const parentAuditId = firstParam(params.parent_audit_id);

  if (!canRead) {
    return (
      <PageShell currentPath={currentPath}>
        <Header
          eyebrow="CUSTOMS_COMPLIANCE"
          title="Acceso restringido"
          description="Tu usuario no tiene acceso asignado al motor CUSTOMS_COMPLIANCE para esta empresa."
        />
      </PageShell>
    );
  }

  const rerunContext = parentAuditId ? await getRerunContext(parentAuditId, auth?.accessToken) : null;

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title={rerunContext ? "Reauditar expediente aduanal" : "Nuevo expediente aduanal"}
        description={rerunContext ? "Agrega documentos faltantes o reemplaza evidencia existente para generar una nueva versión del expediente." : "Carga los datos base y documentos del expediente antes de ejecutar la auditoría con el motor externo."}
        actions={
          <Link
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            href={rerunContext ? `/dashboard/customs-compliance/${encodeURIComponent(rerunContext.parentAuditId)}` : "/dashboard/customs-compliance"}
          >
            {rerunContext ? "Volver al detalle" : "Volver a expedientes"}
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <CustomsExpedientWizard canExecute={canExecute} rerunContext={rerunContext ?? undefined} />
      </div>
    </PageShell>
  );
}

async function getRerunContext(parentAuditId: string, accessToken?: string): Promise<CustomsRerunContext | null> {
  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken,
    eq: {
      id: parentAuditId,
    },
    limit: 1,
  });
  const parent = rows[0];

  if (!parent?.id) {
    return null;
  }

  return {
    auditGroupId: text(parent.audit_group_id, parent.id),
    loadedDocuments: arrayFrom(parent.loaded_documents),
    missingDocuments: arrayFrom(parent.missing_documents),
    nextAuditVersion: number(parent.audit_version, 1) + 1,
    parentAuditId: parent.id,
    pedimentoData: parent.pedimento_data ?? {},
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function arrayFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
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
