import Link from "next/link";
import { connection } from "next/server";

import { ArchiveCustomsAuditButton } from "@/components/dashboard/customs/ArchiveCustomsAuditButton";
import { CustomsAuditPdfButton } from "@/components/dashboard/customs/CustomsAuditPdfButton";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanCreateEngine, userCanExecuteEngine, userCanReadEngine } from "@/lib/auth/session";
import { formatMexicoDateTime } from "@/lib/date-format";
import { supabaseSelect } from "@/lib/supabase/client";

type CustomsCompliancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CustomsAuditRow = {
  audit_group_id?: string | null;
  audit_version?: number | string | null;
  broker_name?: string | null;
  compliance_percent?: number | string | null;
  created_at?: string | null;
  customs_office?: string | null;
  executive_dictamen?: string | null;
  findings?: unknown;
  id?: string | null;
  importer_name?: string | null;
  deleted_at?: string | null;
  loaded_documents?: unknown;
  missing_documents?: unknown;
  operation_code?: string | null;
  pedimento_data?: unknown;
  pedimento_number?: string | null;
  result_json?: unknown;
  risk_level?: string | null;
  is_latest?: boolean | null;
};

type Filters = {
  date: string;
  importer: string;
  pedimento: string;
  risk: string;
};

const currentPath = "/dashboard/customs-compliance";

export default async function CustomsCompliancePage({ searchParams }: CustomsCompliancePageProps) {
  await connection();

  const auth = await getAuthContext();
  const canReadCustoms = userCanReadEngine(auth, "CUSTOMS_COMPLIANCE");
  const canManageCustoms = userCanCreateEngine(auth, "CUSTOMS_COMPLIANCE") && userCanExecuteEngine(auth, "CUSTOMS_COMPLIANCE");

  if (!canReadCustoms) {
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

  const filters = normalizeFilters((await searchParams) ?? {});
  const rows = await supabaseSelect<CustomsAuditRow>("customs_audits", {
    accessToken: auth?.accessToken,
    order: {
      ascending: false,
      column: "created_at",
    },
    params: {
      deleted_at: "is.null",
    },
  });
  const audits = rows.filter((row) => matchesFilters(row, filters));
  const kpis = buildKpis(audits);
  const versionGroups = buildVersionGroups(audits);

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Histórico de Auditorías Customs"
        description="Consulta auditorías aduanales ejecutadas, filtra expedientes y descarga reportes ejecutivos en PDF."
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              href="/dashboard"
            >
              Volver al inicio
            </Link>
            {canManageCustoms ? (
              <Link
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                href="/dashboard/customs-compliance/new"
              >
                Nuevo expediente aduanal
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={kpi.label}>
              <p className="text-sm text-slate-500">{kpi.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{kpi.value}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{kpi.hint}</span>
              </div>
            </div>
          ))}
        </section>

        <FiltersPanel filters={filters} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Auditorías registradas</h3>
              <p className="mt-1 text-sm text-slate-500">Datos leídos desde public.customs_audits.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{audits.length} auditorías</span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Fecha</th>
                  <th className="pb-3 pr-4 font-medium">Expediente</th>
                  <th className="pb-3 pr-4 font-medium">Pedimento</th>
                  <th className="pb-3 pr-4 font-medium">Importador</th>
                  <th className="pb-3 pr-4 font-medium">Agente aduanal</th>
                  <th className="pb-3 pr-4 font-medium">Cumplimiento</th>
                  <th className="pb-3 pr-4 font-medium">Riesgo</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => {
                  const improvement = complianceImprovement(audit, rows);

                  return (
                    <tr className="border-b border-slate-100 align-top last:border-b-0" key={text(audit.id, audit.operation_code)}>
                      <td className="py-4 pr-4 text-slate-600">{formatMexicoDateTime(audit.created_at)}</td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-slate-900">{text(audit.operation_code, "Sin expediente")}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">v{number(audit.audit_version) || 1}</span>
                          {audit.is_latest ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Última versión</span> : null}
                          {improvement > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">+{improvement} pts</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{text(audit.id)}</div>
                      </td>
                      <td className="py-4 pr-4 text-slate-600">{text(audit.pedimento_number, "Pendiente")}</td>
                      <td className="max-w-sm py-4 pr-4 text-slate-600">{text(audit.importer_name, "Sin importador")}</td>
                      <td className="max-w-sm py-4 pr-4 text-slate-600">{text(audit.broker_name, "Sin agente")}</td>
                      <td className="py-4 pr-4 font-medium text-slate-900">{formatPercent(audit.compliance_percent)}</td>
                      <td className="py-4 pr-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClass(audit.risk_level)}`}>
                          {text(audit.risk_level, "unknown")}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            href={`/dashboard/customs-compliance/${encodeURIComponent(text(audit.id, audit.operation_code))}`}
                          >
                            Ver
                          </Link>
                          <CustomsAuditPdfButton
                            auditResult={auditResult(audit)}
                            expediente={text(audit.operation_code, audit.id, "expediente")}
                            loadedDocuments={arrayFrom(audit.loaded_documents)}
                            missingDocuments={arrayFrom(audit.missing_documents)}
                            pedimentoData={pedimentoData(audit)}
                          />
                          {text(audit.id) ? <ArchiveCustomsAuditButton auditId={text(audit.id)} /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {audits.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-sm text-slate-500" colSpan={8}>
                      No hay auditorías que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Historial de versiones por expediente</h3>
          <div className="mt-5 grid gap-3">
            {versionGroups.map((group) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={group.key}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{group.operationCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{group.items.length} versiones</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((audit) => (
                      <Link
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${audit.is_latest ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"}`}
                        href={`/dashboard/customs-compliance/${encodeURIComponent(text(audit.id, audit.operation_code))}`}
                        key={text(audit.id, audit.operation_code)}
                      >
                        v{number(audit.audit_version) || 1}{complianceImprovement(audit, group.items) > 0 ? ` +${complianceImprovement(audit, group.items)} pts` : ""}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {versionGroups.length === 0 ? <p className="text-sm text-slate-500">No hay versiones registradas.</p> : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function FiltersPanel({ filters }: { filters: Filters }) {
  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto]">
        <FilterInput label="Importador" name="importer" value={filters.importer} />
        <FilterInput label="Pedimento" name="pedimento" value={filters.pedimento} />
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Nivel de riesgo</span>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            defaultValue={filters.risk}
            name="risk"
          >
            <option value="">Todos</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <FilterInput label="Fecha" name="date" type="date" value={filters.date} />
        <div className="flex items-end gap-2">
          <button className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800" type="submit">
            Filtrar
          </button>
          <Link className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/dashboard/customs-compliance">
            Limpiar
          </Link>
        </div>
      </div>
    </form>
  );
}

function FilterInput({ label, name, type = "text", value }: { label: string; name: keyof Filters; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        defaultValue={value}
        name={name}
        type={type}
      />
    </label>
  );
}

function buildKpis(audits: CustomsAuditRow[]) {
  const total = audits.length;
  const complianceTotal = audits.reduce((sum, audit) => sum + number(audit.compliance_percent), 0);
  const averageCompliance = total > 0 ? Math.round(complianceTotal / total) : 0;
  const highRisk = audits.filter((audit) => normalizedRisk(audit.risk_level) === "high" || normalizedRisk(audit.risk_level) === "critical").length;
  const mediumRisk = audits.filter((audit) => normalizedRisk(audit.risk_level) === "medium").length;

  return [
    { label: "Total auditorías", value: String(total), hint: "customs_audits" },
    { label: "Cumplimiento promedio", value: `${averageCompliance}%`, hint: "estimado" },
    { label: "Riesgo alto", value: String(highRisk), hint: "High/Critical" },
    { label: "Riesgo medio", value: String(mediumRisk), hint: "Medium" },
  ];
}

function buildVersionGroups(audits: CustomsAuditRow[]) {
  const groups = new Map<string, CustomsAuditRow[]>();

  for (const audit of audits) {
    const key = text(audit.audit_group_id, audit.operation_code, audit.id, "sin-grupo");
    groups.set(key, [...(groups.get(key) ?? []), audit]);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    items: items.sort((first, second) => number(second.audit_version) - number(first.audit_version)),
    key,
    operationCode: text(items[0]?.operation_code, "Sin expediente"),
  }));
}

function complianceImprovement(audit: CustomsAuditRow, audits: CustomsAuditRow[]) {
  const groupKey = text(audit.audit_group_id, audit.operation_code, audit.id, "sin-grupo");
  const currentVersion = number(audit.audit_version) || 1;
  const group = audits
    .filter((row) => text(row.audit_group_id, row.operation_code, row.id, "sin-grupo") === groupKey)
    .sort((first, second) => number(first.audit_version) - number(second.audit_version));
  const currentIndex = group.findIndex((row) => text(row.id) === text(audit.id) || number(row.audit_version) === currentVersion);
  const previous = currentIndex > 0 ? group[currentIndex - 1] : null;

  if (!previous) {
    return 0;
  }

  return Math.round(number(audit.compliance_percent) - number(previous.compliance_percent));
}

function normalizeFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  return {
    date: firstParam(searchParams.date),
    importer: firstParam(searchParams.importer),
    pedimento: firstParam(searchParams.pedimento),
    risk: firstParam(searchParams.risk),
  };
}

function matchesFilters(row: CustomsAuditRow, filters: Filters) {
  return (
    contains(row.importer_name, filters.importer) &&
    contains(row.pedimento_number, filters.pedimento) &&
    (!filters.risk || normalizedRisk(row.risk_level) === filters.risk.toLowerCase()) &&
    (!filters.date || text(row.created_at).startsWith(filters.date))
  );
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

function contains(value: unknown, query: string) {
  if (!query) {
    return true;
  }

  return text(value).toLowerCase().includes(query.toLowerCase());
}

function formatPercent(value: unknown) {
  const parsed = number(value);
  return `${Math.round(parsed)}%`;
}

function riskClass(value: unknown) {
  switch (normalizedRisk(value)) {
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

function normalizedRisk(value: unknown) {
  return text(value).toLowerCase();
}

function arrayFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
