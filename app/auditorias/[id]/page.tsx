import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/Header";
import { auditDetails, severityClasses, statusClasses } from "@/components/dashboard/data";
import { PageShell } from "@/components/dashboard/PageShell";

type AuditDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  const { id } = await params;
  const audit = auditDetails[id];

  if (!audit) {
    notFound();
  }

  return (
    <PageShell>
      <Header
        eyebrow="Detalle de Auditoría"
        title={audit.document}
        description="Consulta el resultado documental, la trazabilidad de revisión y las acciones correctivas sugeridas para el expediente evaluado."
        actions={
          <>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Volver al dashboard
            </Link>
            <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              Descargar PDF
            </button>
            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              Descargar CSV
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contratante / Cliente</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{audit.client}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contratista</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{audit.contractor}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tipo de riesgo</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{audit.risk}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Score de cumplimiento</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-4xl font-bold tracking-tight text-slate-900">{audit.score}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[audit.level]}`}>
                {audit.level}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Dictamen</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{audit.dictamen}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Brechas principales</h3>
              <div className="mt-6 space-y-4">
                {audit.findings.map((finding) => (
                  <div key={finding.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{finding.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{finding.impact}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClasses[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Criterios evaluados</h3>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Criterio</th>
                      <th className="pb-3 pr-4 font-medium">Resultado</th>
                      <th className="pb-3 font-medium">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.criteria.map((criterion) => (
                      <tr key={criterion.criterion} className="border-b border-slate-100 align-top last:border-b-0">
                        <td className="py-4 pr-4 font-medium text-slate-900">{criterion.criterion}</td>
                        <td className="py-4 pr-4 text-slate-700">{criterion.result}</td>
                        <td className="py-4 text-slate-600">{criterion.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Evidencia resumida</h3>
              <div className="mt-4 space-y-3">
                {audit.evidence.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Acciones recomendadas</h3>
              <ol className="mt-6 space-y-4">
                {audit.actions.map((action, index) => (
                  <li key={action} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-slate-600">{action}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Bitácora</h3>
              <div className="mt-6 space-y-4">
                {audit.timeline.map((entry) => (
                  <div key={`${entry.when}-${entry.event}`} className="flex gap-4">
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-medium text-slate-900">{entry.event}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{entry.meta}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        {entry.when}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </PageShell>
  );
}
