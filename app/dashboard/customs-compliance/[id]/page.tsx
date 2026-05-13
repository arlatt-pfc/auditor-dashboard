import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomsExecutiveSummary } from "@/components/dashboard/customs/CustomsExecutiveSummary";
import { CustomsFindingsTable } from "@/components/dashboard/customs/CustomsFindingsTable";
import { CustomsKpiGrid } from "@/components/dashboard/customs/CustomsKpiGrid";
import { customsOperationMock, formatCurrency } from "@/components/dashboard/customs/mock-data";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";
import { getCustomsFindings, getCustomsOperationById } from "@/lib/customs/supabase";
import type { CustomsOperation } from "@/lib/customs/types";

type CustomsDetailPageProps = {
  params: Promise<{ id: string }>;
};

const currentPath = "/dashboard/customs-compliance";

export default async function CustomsDetailPage({ params }: CustomsDetailPageProps) {
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

  const supabaseOperation = await getCustomsOperationById(decodeURIComponent(id), {
    accessToken: auth?.accessToken,
  });
  const operation = supabaseOperation ?? (id === customsOperationMock.operationId || id === customsOperationMock.operationRecordId ? customsOperationMock : null);

  if (!operation) {
    notFound();
  }

  const findings = supabaseOperation
    ? await getCustomsFindings(operation.operationRecordId ?? operation.operationId, {
        accessToken: auth?.accessToken,
      })
    : operation.findings;
  const detailOperation = {
    ...operation,
    findings: findings.length > 0 ? findings : operation.findings,
  };

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title={detailOperation.operationId}
        description={`Detalle del expediente aduanal y resultados de auditoría para pedimento ${detailOperation.pedimento}.`}
        actions={
          <Link
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            href="/dashboard/customs-compliance"
          >
            Volver a expedientes
          </Link>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <CustomsKpiGrid
          kpis={[
            { label: "Risk Score", value: String(detailOperation.metrics.riskScore), hint: detailOperation.metrics.severity },
            { label: "Hallazgos", value: String(detailOperation.findings.length), hint: "Abiertos" },
            { label: "Recuperacion Potencial", value: formatCurrency(detailOperation.metrics.potentialRecovery), hint: "MXN" },
            { label: "Contribuciones", value: formatCurrency(detailOperation.metrics.igiPaid), hint: "IGI/SAT" },
          ]}
        />

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-6">
            <CustomsFindingsTable findings={detailOperation.findings} />
            <DocumentsPanel operation={detailOperation} />
            <ReportsPanel />
            <ActivityPanel />
          </div>
          <CustomsExecutiveSummary operation={detailOperation} />
        </section>
      </div>
    </PageShell>
  );
}

function DocumentsPanel({ operation }: { operation: CustomsOperation }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">Documentos procesados</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {operation.documents.map((document) => (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={document.id}>
            <p className="text-sm font-semibold text-slate-900">{document.label}</p>
            <p className="mt-2 break-words text-sm text-slate-500">{document.filename || "Pendiente"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">Reportes</h3>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button">
          Reporte PDF
        </button>
        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800" type="button">
          Exportar Excel
        </button>
      </div>
    </section>
  );
}

function ActivityPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">Bitácora</h3>
      <div className="mt-5 space-y-3">
        {["Expediente consultado", "Documentos clasificados", "Auditoría lista para revisión"].map((event) => (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" key={event}>
            {event}
          </div>
        ))}
      </div>
    </section>
  );
}
