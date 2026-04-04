import Link from "next/link";

import { AuditFlowCard } from "@/components/dashboard/AuditFlowCard";
import { AuditsTable } from "@/components/dashboard/AuditsTable";
import { findings, audits, auditFlowSteps, modules, stats } from "@/components/dashboard/data";
import { FindingsPanel } from "@/components/dashboard/FindingsPanel";
import { Header } from "@/components/dashboard/Header";
import { ModulesOverview } from "@/components/dashboard/ModulesOverview";
import { PageShell } from "@/components/dashboard/PageShell";
import { StatsGrid } from "@/components/dashboard/StatsGrid";

export default function AuditorDashboardDemo() {
  return (
    <PageShell currentPath="/">
      <Header
        actions={
          <>
            <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              Cargar documento
            </button>
            <Link
              href="/nueva-auditoria"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Ejecutar auditoría
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <StatsGrid stats={stats} />

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <AuditsTable audits={audits} />
          <FindingsPanel findings={findings} />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <ModulesOverview modules={modules} />
          <AuditFlowCard steps={auditFlowSteps} />
        </section>
      </div>
    </PageShell>
  );
}
