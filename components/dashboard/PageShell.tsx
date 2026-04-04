import type { ReactNode } from "react";

import { menuSections } from "@/components/dashboard/data";
import { Sidebar } from "@/components/dashboard/Sidebar";

type PageShellProps = {
  children: ReactNode;
  currentPath?: string;
};

export function PageShell({ children, currentPath }: PageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar currentPath={currentPath} menuSections={menuSections} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
