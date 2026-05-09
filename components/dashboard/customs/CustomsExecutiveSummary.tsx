import { formatCurrency } from "@/components/dashboard/customs/mock-data";
import type { CustomsOperation } from "@/lib/customs/types";

type CustomsExecutiveSummaryProps = {
  operation: CustomsOperation;
};

export function CustomsExecutiveSummary({ operation }: CustomsExecutiveSummaryProps) {
  return (
    <aside className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Dictamen Ejecutivo</h3>
            <p className="mt-1 text-sm text-slate-500">{operation.pedimento}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            Risk {operation.metrics.riskScore}
          </span>
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-600">{operation.dictamen}</p>

        <div className="mt-5 grid gap-3">
          <SummaryRow label="Importador" value={operation.importer} />
          <SummaryRow label="Proveedor" value={operation.provider} />
          <SummaryRow label="Agente Aduanal" value={operation.broker} />
          <SummaryRow label="Cuenta de Gastos" value={formatCurrency(operation.metrics.brokerAccountTotal)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Recomendaciones</h3>
        <div className="mt-4 space-y-3">
          {operation.recommendations.map((recommendation) => (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600" key={recommendation}>
              {recommendation}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Proximos Pasos</h3>
        <ol className="mt-5 space-y-4">
          {operation.nextSteps.map((step, index) => (
            <li className="flex gap-4" key={step}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-sm leading-6 text-slate-600">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
