import type { ModuleCard } from "@/components/dashboard/types";

type ModulesOverviewProps = {
  modules: ModuleCard[];
};

export function ModulesOverview({ modules }: ModulesOverviewProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
      <h3 className="text-xl font-semibold">Módulos proyectados</h3>
      <p className="mt-1 text-sm text-slate-500">
        Funcionalidades clave del sistema Auditor para operación multi-cliente y multi-industria.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {modules.map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="font-semibold text-slate-900">{card.title}</h4>
            {card.desc ? <p className="mt-2 text-sm leading-6 text-slate-600">{card.desc}</p> : null}
            {card.items ? (
              <div className="mt-3 space-y-3">
                {card.items.map((item) => (
                  <div key={item.label} className="text-sm leading-6 text-slate-600">
                    <span className="font-semibold text-slate-900">{item.label}:</span> {item.description}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
