import type { MenuSection } from "@/components/dashboard/types";

type SidebarProps = {
  menuSections: MenuSection[];
};

export function Sidebar({ menuSections }: SidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
          LOGÍSTICA DE DATOS
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Auditor AI</h1>
        <p className="mt-2 text-sm text-slate-500">
          Plataforma de auditoría documental y cumplimiento asistido por IA.
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {menuSections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="rounded-xl px-3 py-2 transition hover:bg-white hover:text-slate-900"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
