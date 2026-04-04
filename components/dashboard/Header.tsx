export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">Dashboard Ejecutivo</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">Panel de control del sistema Auditor</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Vista conceptual para un producto SaaS de auditoría documental con data lake, scoring, RBAC,
            trazabilidad y generación de matrices de cumplimiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Cargar documento
          </button>
          <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
            Ejecutar auditoría
          </button>
        </div>
      </div>
    </header>
  );
}
