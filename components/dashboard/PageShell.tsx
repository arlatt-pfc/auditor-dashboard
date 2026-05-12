import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { menuSections } from "@/components/dashboard/data";
import { Sidebar } from "@/components/dashboard/Sidebar";
import type { MenuSection } from "@/components/dashboard/types";
import { getAuthContext } from "@/lib/auth/session";

type PageShellProps = {
  children: ReactNode;
  currentPath?: string;
};

export async function PageShell({ children, currentPath }: PageShellProps) {
  const auth = await getAuthContext();

  if (currentPath?.startsWith("/dashboard") && !auth) {
    redirect("/login");
  }

  const filteredMenuSections = filterMenuSections(menuSections, auth?.engines.map((engine) => engine.code) ?? []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar currentPath={currentPath} menuSections={filteredMenuSections} userContext={auth?.profile ?? null} userEmail={auth?.user.email} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function filterMenuSections(menu: MenuSection[], engineCodes: string[]) {
  return menu
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.engine || engineCodes.includes(item.engine)),
    }))
    .filter((section) => section.items.length > 0);
}
