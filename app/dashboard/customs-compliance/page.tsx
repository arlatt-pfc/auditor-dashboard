import Link from "next/link";

import { CustomsExecutiveSummary } from "@/components/dashboard/customs/CustomsExecutiveSummary";
import { CustomsFindingsTable } from "@/components/dashboard/customs/CustomsFindingsTable";
import { CustomsKpiGrid } from "@/components/dashboard/customs/CustomsKpiGrid";
import { customsKpis, customsOperationMock, formatCurrency } from "@/components/dashboard/customs/mock-data";
import { CustomsUploadForm } from "@/components/dashboard/customs/CustomsUploadForm";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";

const currentPath = "/dashboard/customs-compliance";

export default function CustomsCompliancePage() {
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
              Mock funcional
            </span>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <CustomsKpiGrid kpis={customsKpis} />

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <OperationMetric label="Operation ID" value={customsOperationMock.operationId} />
                <OperationMetric label="Pedimento" value={customsOperationMock.pedimento} />
                <OperationMetric label="Factura" value={customsOperationMock.commercialInvoice} />
                <OperationMetric label="Recuperacion" value={formatCurrency(customsOperationMock.metrics.potentialRecovery)} />
              </div>
            </section>

            <CustomsUploadForm operation={customsOperationMock} />
            <CustomsFindingsTable findings={customsOperationMock.findings} />
          </div>

          <CustomsExecutiveSummary operation={customsOperationMock} />
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
