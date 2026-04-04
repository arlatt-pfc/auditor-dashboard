import type { Stat } from "@/components/dashboard/types";

type StatsGridProps = {
  stats: Stat[];
};

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{stat.label}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-4xl font-bold tracking-tight">{stat.value}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {stat.hint}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
