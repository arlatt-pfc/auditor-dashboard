import Link from "next/link";
import type { ReactNode } from "react";

import { CustomsAuditPdfButton } from "@/components/dashboard/customs/CustomsAuditPdfButton";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";
import { formatMexicoDateTime } from "@/lib/date-format";
import { supabaseSelect } from "@/lib/supabase/client";

type CustomsAuditDetailPageProps = {
  params: Promise<{ id: string }>;
};

type CustomsAuditRow = {
  audit_group_id?: string | null;
  audit_version?: number | string | null;
  broker_name?: string | null;
  compliance_percent?: number | string | null;
  created_at?: string | null;
  customs_office?: string | null;
  delete_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  executive_dictamen?: string | null;
  findings?: unknown;
  id?: string | null;
  importer_name?: string | null;
  is_latest?: boolean | null;
  loaded_documents?: unknown;
  missing_documents?: unknown;
  operation_code?: string | null;
  parent_audit_id?: string | null;
  pedimento_data?: unknown;
  pedimento_number?: string | null;
  result_json?: unknown;
  risk_level?: string | null;
  documents_added?: unknown;
  status?: string | null;
  superseded_by?: string | null;
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

  const versionRows = await getVersionHistory(audit, auth?.accessToken);
  const delta = buildVersionDelta(audit, versionRows);
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
            {!audit.deleted_at ? (
              <Link
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                href={`/dashboard/customs-compliance/new?parent_audit_id=${encodeURIComponent(text(audit.id))}`}
              >
                Reauditar expediente
              </Link>
            ) : null}
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
        {audit.deleted_at ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Auditoría archivada</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Esta auditoría fue archivada el {formatMexicoDateTime(audit.deleted_at)} y no puede reauditarse.
            </p>
            {text(audit.delete_reason) ? <p className="mt-2 text-sm text-amber-800">Motivo: {text(audit.delete_reason)}</p> : null}
          </section>
        ) : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Cumplimiento" value={formatPercent(audit.compliance_percent)} hint="estimado" />
          <KpiCard label="Nivel de riesgo" value={text(audit.risk_level, "unknown")} hint={text(audit.status, "completed")} />
          <KpiCard label="Versión" value={`v${number(audit.audit_version) || 1}`} hint={audit.is_latest ? "Última versión" : "Histórica"} />
          <KpiCard label="Documentos cargados" value={String(loadedDocuments.length)} hint="recibidos" />
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
                  ["Fecha de ejecución", formatMexicoDateTime(audit.created_at)],
                  ["Cumplimiento", formatPercent(audit.compliance_percent)],
                  ["Nivel de riesgo", text(audit.risk_level, "unknown")],
                  ["Versión", `v${number(audit.audit_version) || 1}${audit.is_latest ? " · Última versión" : ""}`],
                ]}
              />
              <p className="mt-5 text-sm leading-6 text-slate-700">{text(audit.executive_dictamen, "Sin dictamen ejecutivo disponible.")}</p>
            </DetailCard>

            <DocumentsCard title="Documentos cargados" documents={loadedDocuments} emptyText="No se registraron documentos cargados." />
            <DocumentsCard title="Brechas documentales" documents={missingDocuments} emptyText="No se registraron brechas documentales." />
            <VersionDeltaCard delta={delta} />
            <VersionHistoryCard audits={versionRows} />
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

async function getVersionHistory(audit: CustomsAuditRow, accessToken?: string) {
  const auditGroupId = text(audit.audit_group_id);

  if (!auditGroupId) {
    return [audit];
  }

  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken,
    eq: {
      audit_group_id: auditGroupId,
    },
    order: {
      ascending: false,
      column: "audit_version",
    },
    params: audit.deleted_at ? undefined : {
      deleted_at: "is.null",
    },
  });

  return rows.length > 0 ? rows : [audit];
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
                <DocumentFileList document={row} />
              </div>
            );
          })}
        </div>
      )}
    </DetailCard>
  );
}

function DocumentFileList({ document }: { document: Record<string, unknown> }) {
  const files = arrayFrom(document.files);

  if (files.length === 0) {
    return <p className="mt-2 break-words text-sm text-slate-500">{text(document.file_name, "Sin archivo")}</p>;
  }

  return (
    <ul className="mt-2 space-y-1">
      {files.map((file, index) => {
        const row = asRecord(file);
        return (
          <li className="break-words text-sm text-slate-500" key={`${text(row.file_name, "archivo")}-${index}`}>
            {text(row.file_name, `Archivo ${index + 1}`)}
          </li>
        );
      })}
    </ul>
  );
}

function VersionHistoryCard({ audits }: { audits: CustomsAuditRow[] }) {
  return (
    <DetailCard title="Historial de versiones">
      <div className="space-y-3">
        {audits.map((audit) => (
          <Link
            className={`block rounded-2xl border p-4 text-sm transition hover:bg-slate-50 ${
              audit.is_latest ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
            href={`/dashboard/customs-compliance/${encodeURIComponent(text(audit.id, audit.operation_code))}`}
            key={text(audit.id, audit.operation_code)}
          >
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-slate-900">v{number(audit.audit_version) || 1}</span>
              {audit.is_latest ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Última versión</span> : null}
            </span>
            <span className="mt-2 block text-slate-600">{formatMexicoDateTime(audit.created_at)} · {formatPercent(audit.compliance_percent)} · {text(audit.risk_level, "unknown")}</span>
          </Link>
        ))}
      </div>
    </DetailCard>
  );
}

type VersionDelta = {
  addedDocuments: string[];
  currentCompliance: number;
  currentRisk: string;
  currentVersion: number;
  deltaPoints: number;
  missingCurrent: number;
  missingPrevious: number;
  newFindings: FindingView[];
  previousCompliance: number;
  previousRisk: string;
  previousVersion: number;
  resolvedFindings: FindingView[];
  totalVersions: number;
};

function VersionDeltaCard({ delta }: { delta: VersionDelta | null }) {
  if (!delta) {
    return (
      <DetailCard title="Comparación de versiones">
        <p className="text-sm text-slate-500">Sin versiones comparables todavía.</p>
      </DetailCard>
    );
  }

  const deltaLabel = `${delta.deltaPoints >= 0 ? "+" : ""}${delta.deltaPoints} pts`;

  return (
    <DetailCard title="Comparación de versiones">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DeltaMetricCard
          label="Cumplimiento"
          value={`v${delta.previousVersion} ${Math.round(delta.previousCompliance)}% -> v${delta.currentVersion} ${Math.round(delta.currentCompliance)}%`}
          hint={deltaLabel}
          tone={delta.deltaPoints >= 0 ? "positive" : "negative"}
        />
        <DeltaMetricCard label="Riesgo" value={`${delta.previousRisk} -> ${delta.currentRisk}`} hint="nivel" tone="neutral" />
        <DeltaMetricCard label="Brechas" value={`${delta.missingPrevious} -> ${delta.missingCurrent}`} hint={`${delta.missingPrevious - delta.missingCurrent >= 0 ? "-" : "+"}${Math.abs(delta.missingPrevious - delta.missingCurrent)}`} tone={delta.missingCurrent <= delta.missingPrevious ? "positive" : "negative"} />
        <DeltaMetricCard label="Versiones" value={`v${delta.previousVersion} -> v${delta.currentVersion}`} hint={`${delta.totalVersions} total`} tone="neutral" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DeltaList title="Documentos agregados" emptyText="No se detectaron documentos agregados." items={delta.addedDocuments} />
        <DeltaList title="Hallazgos resueltos" emptyText="No se detectaron hallazgos resueltos." items={delta.resolvedFindings.map((finding) => finding.title)} />
        <DeltaList title="Hallazgos nuevos" emptyText="No se detectaron hallazgos nuevos." items={delta.newFindings.map((finding) => finding.title)} />
      </div>
    </DetailCard>
  );
}

function DeltaMetricCard({ hint, label, tone, value }: { hint: string; label: string; tone: "negative" | "neutral" | "positive"; value: string }) {
  const toneClass = {
    negative: "bg-red-50 text-red-700",
    neutral: "bg-slate-100 text-slate-700",
    positive: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-3 text-base font-semibold text-slate-900">{value}</p>
      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{hint}</span>
    </div>
  );
}

function DeltaList({ emptyText, items, title }: { emptyText: string; items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li className="break-words text-sm text-slate-600" key={`${item}-${index}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
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

function buildVersionDelta(currentAudit: CustomsAuditRow, audits: CustomsAuditRow[]): VersionDelta | null {
  const sorted = [...audits].sort((first, second) => number(first.audit_version) - number(second.audit_version));
  const currentVersion = number(currentAudit.audit_version) || 1;
  const currentIndex = sorted.findIndex((audit) => text(audit.id) === text(currentAudit.id) || number(audit.audit_version) === currentVersion);
  const previousAudit = currentIndex > 0 ? sorted[currentIndex - 1] : null;

  if (!previousAudit) {
    return null;
  }

  const currentFindings = normalizeFindings(currentAudit.findings);
  const previousFindings = normalizeFindings(previousAudit.findings);
  const currentFindingKeys = new Set(currentFindings.map(findingKey));
  const previousFindingKeys = new Set(previousFindings.map(findingKey));
  const currentCompliance = number(currentAudit.compliance_percent);
  const previousCompliance = number(previousAudit.compliance_percent);

  return {
    addedDocuments: addedDocuments(currentAudit, previousAudit),
    currentCompliance,
    currentRisk: text(currentAudit.risk_level, "unknown"),
    currentVersion,
    deltaPoints: Math.round(currentCompliance - previousCompliance),
    missingCurrent: arrayFrom(currentAudit.missing_documents).length,
    missingPrevious: arrayFrom(previousAudit.missing_documents).length,
    newFindings: currentFindings.filter((finding) => !previousFindingKeys.has(findingKey(finding))),
    previousCompliance,
    previousRisk: text(previousAudit.risk_level, "unknown"),
    previousVersion: number(previousAudit.audit_version) || 1,
    resolvedFindings: previousFindings.filter((finding) => !currentFindingKeys.has(findingKey(finding))),
    totalVersions: sorted.length,
  };
}

function addedDocuments(currentAudit: CustomsAuditRow, previousAudit: CustomsAuditRow) {
  const explicit = documentNamesFromList(currentAudit.documents_added);

  if (explicit.length > 0) {
    return explicit;
  }

  const previousNames = new Set(documentNamesFromList(previousAudit.loaded_documents).map((name) => name.toLowerCase()));
  return documentNamesFromList(currentAudit.loaded_documents).filter((name) => !previousNames.has(name.toLowerCase()));
}

function documentNamesFromList(value: unknown) {
  return arrayFrom(value).flatMap((item) => {
    if (typeof item === "string") {
      return text(item) ? [text(item)] : [];
    }

    const row = asRecord(item);
    const files = arrayFrom(row.files);
    const names = files.flatMap((file) => {
      const fileRow = asRecord(file);
      const fileName = text(fileRow.file_name, fileRow.name);
      return fileName ? [fileName] : [];
    });
    const fallback = text(row.file_name, row.label, row.document_type);

    return names.length > 0 ? names : fallback ? [fallback] : [];
  });
}

function findingKey(finding: FindingView) {
  return `${finding.severity}|${finding.title}|${finding.description}`.toLowerCase();
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
