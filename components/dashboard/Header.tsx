import type { ReactNode } from "react";

type HeaderProps = {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
};

export function Header({
  actions,
  description = "Vista conceptual para un producto SaaS de auditoría documental con data lake, scoring, RBAC, trazabilidad y generación de matrices de cumplimiento.",
  eyebrow = "Dashboard Ejecutivo",
  title = "Panel de control del sistema Auditor",
}: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">{eyebrow}</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
