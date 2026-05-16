import Link from "next/link";

import type { MenuSection } from "@/components/dashboard/types";
import { UserProfileChip } from "@/components/dashboard/UserProfileChip";
import type { UserProfile } from "@/lib/auth/types";

type SidebarProps = {
  currentPath?: string;
  menuSections: MenuSection[];
  userContext?: UserProfile | null;
  userEmail?: string;
};

export function Sidebar({ currentPath, menuSections, userContext, userEmail }: SidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
          LOGÍSTICA DE DATOS
        </div>
        <Link href="/dashboard" className="mt-2 block text-2xl font-bold text-slate-900">
          LDA Compliance
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

      <div className="border-t border-slate-200 p-4">
        {userContext ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <UserProfileChip
              className="border-none bg-transparent px-0 py-0 shadow-none"
              email={userEmail}
              fullName={userContext.fullName}
              role={userContext.role}
            />
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>{userContext.companyName}</p>
            </div>
            <form action="/api/auth/logout" className="mt-4" method="post">
              <button className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" type="submit">
                Cerrar sesion
              </button>
            </form>
          </div>
        ) : (
          <Link className="block rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white" href="/login">
            Iniciar sesion
          </Link>
        )}
      </div>
    </aside>
  );
}
