import Link from "next/link";

import type { MenuSection } from "@/components/dashboard/types";

type SidebarProps = {
  currentPath?: string;
  menuSections: MenuSection[];
};

export function Sidebar({ currentPath, menuSections }: SidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
          LOGÍSTICA DE DATOS
        </div>
        <Link href="/" className="mt-2 block text-2xl font-bold text-slate-900">
          Auditor AI
        </Link>
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
                <li key={`${section.title}-${item.label}`}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`block rounded-xl px-3 py-2 transition hover:bg-white hover:text-slate-900 ${
                        currentPath === item.href ? "bg-white font-medium text-slate-900 shadow-sm" : ""
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.description ? (
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                      ) : null}
                    </Link>
                  ) : (
                    <div className="rounded-xl px-3 py-2 transition hover:bg-white hover:text-slate-900">
                      <span>{item.label}</span>
                      {item.description ? (
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
