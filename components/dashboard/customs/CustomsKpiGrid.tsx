import type { Stat } from "@/components/dashboard/types";

type CustomsKpiGridProps = {
  kpis: Stat[];
};

export function CustomsKpiGrid({ kpis }: CustomsKpiGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{kpi.label}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{kpi.value}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {kpi.hint}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
