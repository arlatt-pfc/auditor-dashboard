import Link from "next/link";
import { connection } from "next/server";

import { CustomsKpiGrid } from "@/components/dashboard/customs/CustomsKpiGrid";
import { customsKpis, customsOperationMock, formatCurrency } from "@/components/dashboard/customs/mock-data";
import { CustomsOperationsTable } from "@/components/dashboard/customs/CustomsOperationsTable";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanCreateEngine, userCanExecuteEngine, userCanReadEngine } from "@/lib/auth/session";
import { getCustomsOperations } from "@/lib/customs/supabase";
import type { CustomsOperation } from "@/lib/customs/types";
import type { Stat } from "@/components/dashboard/types";

const currentPath = "/dashboard/customs-compliance";

export default async function CustomsCompliancePage() {
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

  const supabaseOperations = await getCustomsOperations({
    accessToken: auth?.accessToken,
  });
  const usesMockData = supabaseOperations.length === 0;
  const operations = usesMockData ? [customsOperationMock] : supabaseOperations;
  const kpis = usesMockData ? customsKpis.slice(0, 3) : buildCustomsKpis(operations);

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Customs Compliance"
        description="Auditoría inteligente de expedientes aduanales de importación para identificar sobrepagos, cargos indebidos y recuperación potencial."
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
        <CustomsKpiGrid kpis={kpis} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Expedientes aduanales</h3>
              <p className="mt-1 text-sm text-slate-500">
                Consulta operaciones existentes o inicia un expediente nuevo para ejecutar la auditoria documental.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {usesMockData ? "Mock fallback" : "Supabase activo"}
            </span>
          </div>
        </section>

        <CustomsOperationsTable operations={operations} />

        {!canManageCustoms ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Tu rol permite consultar expedientes, pero no crear ni ejecutar auditorias de Customs Compliance.
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function buildCustomsKpis(operations: CustomsOperation[]): Stat[] {
  const totals = operations.reduce(
    (current, operation) => ({
      criticalFindings: current.criticalFindings + operation.metrics.criticalFindings,
      potentialRecovery: current.potentialRecovery + operation.metrics.potentialRecovery,
      riskScore: current.riskScore + operation.metrics.riskScore,
    }),
    {
      criticalFindings: 0,
      potentialRecovery: 0,
      riskScore: 0,
    },
  );
  const riskScoreAverage = operations.length > 0 ? Math.round(totals.riskScore / operations.length) : 0;
  const topOperation = operations[0];

  return [
    {
      label: "Operaciones Auditadas",
      value: String(operations.length),
      hint: topOperation?.operationId ?? "customs_operations",
    },
    {
      label: "Recuperacion Potencial",
      value: formatCurrency(totals.potentialRecovery),
      hint: "customs_operations",
    },
    {
      label: "Hallazgos Criticos",
      value: String(totals.criticalFindings),
      hint: getRiskLabel(riskScoreAverage),
    },
  ];
}

function getRiskLabel(score: number) {
  if (score >= 90) return "Critico";
  if (score >= 70) return "Alto";
  if (score >= 40) return "Medio";
  return "Bajo";
}
