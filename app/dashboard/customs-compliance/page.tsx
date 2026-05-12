import Link from "next/link";
import { connection } from "next/server";

import { CustomsExecutiveSummary } from "@/components/dashboard/customs/CustomsExecutiveSummary";
import { CustomsFindingsTable } from "@/components/dashboard/customs/CustomsFindingsTable";
import { CustomsKpiGrid } from "@/components/dashboard/customs/CustomsKpiGrid";
import { customsKpis, customsOperationMock, formatCurrency } from "@/components/dashboard/customs/mock-data";
import { CustomsOperationsTable } from "@/components/dashboard/customs/CustomsOperationsTable";
import { CustomsUploadForm } from "@/components/dashboard/customs/CustomsUploadForm";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getCustomsFindings, getCustomsOperations } from "@/lib/customs/supabase";
import type { CustomsOperation } from "@/lib/customs/types";
import type { Stat } from "@/components/dashboard/types";

const currentPath = "/dashboard/customs-compliance";

export default async function CustomsCompliancePage() {
  await connection();

  const supabaseOperations = await getCustomsOperations();
  const usesMockData = supabaseOperations.length === 0;
  const operations = usesMockData ? [customsOperationMock] : supabaseOperations;
  const selectedOperation = operations[0] ?? customsOperationMock;
  const supabaseFindings = usesMockData ? customsOperationMock.findings : await getCustomsFindings(selectedOperation.operationId);
  const selectedFindings = supabaseFindings.length > 0 ? supabaseFindings : selectedOperation.findings;
  const operation = {
    ...selectedOperation,
    findings: selectedFindings,
  };
  const kpis = usesMockData ? customsKpis : buildCustomsKpis(operations);

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Customs Compliance"
        description="Auditoría inteligente de operaciones de importación para identificar sobrepagos, cargos indebidos y recuperación potencial."
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              href="/"
            >
              Volver al dashboard
            </Link>
            <span className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              {usesMockData ? "Mock fallback" : "Supabase activo"}
            </span>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <CustomsKpiGrid kpis={kpis} />

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <OperationMetric label="Operation ID" value={operation.operationId} />
                <OperationMetric label="Pedimento" value={operation.pedimento} />
                <OperationMetric label="Factura" value={operation.commercialInvoice} />
                <OperationMetric label="Recuperacion" value={formatCurrency(operation.metrics.potentialRecovery)} />
              </div>
            </section>

            <CustomsOperationsTable operations={operations} selectedOperationId={operation.operationId} />
            <CustomsUploadForm operation={operation} />
            <CustomsFindingsTable findings={operation.findings} />
          </div>

          <CustomsExecutiveSummary operation={operation} />
        </section>
      </div>
    </PageShell>
  );
}

function OperationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
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
    {
      label: "Risk Score Promedio",
      value: String(riskScoreAverage),
      hint: "Promedio",
    },
  ];
}

function getRiskLabel(score: number) {
  if (score >= 90) return "Critico";
  if (score >= 70) return "Alto";
  if (score >= 40) return "Medio";
  return "Bajo";
}
