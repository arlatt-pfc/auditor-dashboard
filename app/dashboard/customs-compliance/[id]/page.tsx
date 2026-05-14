import Link from "next/link";
import type { ReactNode } from "react";

import { CustomsAuditPdfButton } from "@/components/dashboard/customs/CustomsAuditPdfButton";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";
import { supabaseSelect } from "@/lib/supabase/client";

type CustomsAuditDetailPageProps = {
  params: Promise<{ id: string }>;
};

type CustomsAuditRow = {
  broker_name?: string | null;
  compliance_percent?: number | string | null;
  created_at?: string | null;
  customs_office?: string | null;
  executive_dictamen?: string | null;
  findings?: unknown;
  id?: string | null;
  importer_name?: string | null;
  loaded_documents?: unknown;
  missing_documents?: unknown;
  operation_code?: string | null;
  pedimento_data?: unknown;
  pedimento_number?: string | null;
  result_json?: unknown;
  risk_level?: string | null;
  status?: string | null;
};

type FindingView = {
  description: string;
  recommendation: string;
  severity: string;
  title: string;
};

const currentPath = "/dashboard/customs-compliance";

export default async function CustomsAuditDetailPage({ params }: CustomsAuditDetailPageProps) {
  const { id } = await params;
  const auth = await getAuthContext();
  const canRead = userCanReadEngine(auth, "CUSTOMS_COMPLIANCE");

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

  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken: auth?.accessToken,
    eq: {
      id: decodeURIComponent(id),
    },
    limit: 1,
  });
  const audit = rows[0] ?? null;

  if (!audit) {
    return <AuditNotFound />;
  }

  const loadedDocuments = arrayFrom(audit.loaded_documents);
  const missingDocuments = arrayFrom(audit.missing_documents);
  const findings = normalizeFindings(audit.findings);
  const technicalJson = {
    audit,
    pedimento_data: audit.pedimento_data,
    result_json: audit.result_json,
  };

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Detalle de Auditoría Customs"
        description={`Expediente ${text(audit.operation_code, "Sin expediente")} · Pedimento ${text(audit.pedimento_number, "pendiente")}`}
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              href="/dashboard/customs-compliance"
            >
              Volver al histórico
            </Link>
            <CustomsAuditPdfButton
              auditResult={auditResult(audit)}
              expediente={text(audit.operation_code, audit.id, "expediente")}
              loadedDocuments={loadedDocuments}
              missingDocuments={missingDocuments}
              pedimentoData={pedimentoData(audit)}
            />
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Cumplimiento" value={formatPercent(audit.compliance_percent)} hint="estimado" />
          <KpiCard label="Nivel de riesgo" value={text(audit.risk_level, "unknown")} hint={text(audit.status, "completed")} />
          <KpiCard label="Documentos cargados" value={String(loadedDocuments.length)} hint="recibidos" />
          <KpiCard label="Brechas" value={String(missingDocuments.length)} hint="documentales" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-6">
            <DetailCard title="Resumen ejecutivo">
              <DetailGrid
                rows={[
                  ["Expediente", text(audit.operation_code, "Pendiente")],
                  ["Pedimento", text(audit.pedimento_number, "Pendiente")],
                  ["Importador", text(audit.importer_name, "Sin importador")],
                  ["Agente aduanal", text(audit.broker_name, "Sin agente")],
                  ["Aduana", text(audit.customs_office, "Pendiente")],
                  ["Fecha de ejecución", formatDate(audit.created_at)],
                  ["Cumplimiento", formatPercent(audit.compliance_percent)],
                  ["Nivel de riesgo", text(audit.risk_level, "unknown")],
                ]}
              />
              <p className="mt-5 text-sm leading-6 text-slate-700">{text(audit.executive_dictamen, "Sin dictamen ejecutivo disponible.")}</p>
            </DetailCard>

            <DocumentsCard title="Documentos cargados" documents={loadedDocuments} emptyText="No se registraron documentos cargados." />
            <DocumentsCard title="Brechas documentales" documents={missingDocuments} emptyText="No se registraron brechas documentales." />
          </div>

          <div className="space-y-6">
            <FindingsCard findings={findings} />
            <DetailCard title="JSON técnico">
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Ver payload técnico</summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                  {JSON.stringify(technicalJson, null, 2)}
                </pre>
              </details>
            </DetailCard>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function AuditNotFound() {
  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Auditoría no encontrada"
        description="No se encontró una auditoría guardada con el identificador solicitado o tu usuario no tiene acceso a ella."
        actions={
          <Link
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            href="/dashboard/customs-compliance"
          >
            Volver al histórico
          </Link>
        }
      />
    </PageShell>
  );
}

function KpiCard({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{value}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{hint}</span>
      </div>
    </div>
  );
}

function DetailCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}>
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentsCard({ documents, emptyText, title }: { documents: unknown[]; emptyText: string; title: string }) {
  return (
    <DetailCard title={title}>
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((document, index) => {
            const row = asRecord(document);

            return (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={`${text(row.document_type, row.label, "documento")}-${index}`}>
                <p className="text-sm font-semibold text-slate-900">{text(row.label, row.document_type, `Documento ${index + 1}`)}</p>
                <p className="mt-2 break-words text-sm text-slate-500">{text(row.file_name, "Sin archivo")}</p>
              </div>
            );
          })}
        </div>
      )}
    </DetailCard>
  );
}

function FindingsCard({ findings }: { findings: FindingView[] }) {
  return (
    <DetailCard title="Hallazgos preliminares">
      {findings.length === 0 ? (
        <p className="text-sm text-slate-500">No se detectaron hallazgos preliminares.</p>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding, index) => (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm" key={`${finding.title}-${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass(finding.severity)}`}>{finding.severity}</span>
                <span className="font-semibold text-slate-900">{finding.title}</span>
              </div>
              <p className="mt-3 leading-6 text-slate-700">{finding.description}</p>
              <p className="mt-3 leading-6 text-slate-600">
                <span className="font-semibold text-slate-800">Recomendación: </span>
                {finding.recommendation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

function normalizeFindings(value: unknown): FindingView[] {
  return arrayFrom(value).map((finding, index) => {
    if (typeof finding === "string") {
      return {
        description: finding,
        recommendation: "Revisar evidencia documental y registrar acción correctiva.",
        severity: "Medium",
        title: `Hallazgo ${index + 1}`,
      };
    }

    const row = asRecord(finding);
    return {
      description: text(row.description, "Sin descripción disponible."),
      recommendation: text(row.recommendation, "Sin recomendación disponible."),
      severity: text(row.severity, "Medium"),
      title: text(row.title, `Hallazgo ${index + 1}`),
    };
  });
}

function auditResult(audit: CustomsAuditRow) {
  const result = asRecord(audit.result_json);

  return {
    compliance_percent: audit.compliance_percent,
    executive_dictamen: audit.executive_dictamen,
    findings: arrayFrom(audit.findings),
    risk_level: audit.risk_level,
    top_critical_gaps: arrayFrom(result.top_critical_gaps),
    ...result,
  };
}

function pedimentoData(audit: CustomsAuditRow) {
  return {
    broker_name: audit.broker_name,
    customs_office: audit.customs_office,
    importer_name: audit.importer_name,
    operation_code: audit.operation_code,
    pedimento_number: audit.pedimento_number,
    ...asRecord(audit.pedimento_data),
  };
}

function formatDate(value: unknown) {
  const date = new Date(text(value));

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPercent(value: unknown) {
  const parsed = number(value);
  return `${Math.round(parsed)}%`;
}

function riskClass(value: unknown) {
  switch (text(value).toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function arrayFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
