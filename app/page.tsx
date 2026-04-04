import { AuditFlowCard } from "@/components/dashboard/AuditFlowCard";
import { AuditsTable } from "@/components/dashboard/AuditsTable";
import { findings, audits, auditFlowSteps, menuSections, modules, stats } from "@/components/dashboard/data";
import { FindingsPanel } from "@/components/dashboard/FindingsPanel";
import { Header } from "@/components/dashboard/Header";
import { ModulesOverview } from "@/components/dashboard/ModulesOverview";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { StatsGrid } from "@/components/dashboard/StatsGrid";

export default function AuditorDashboardDemo() {

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar menuSections={menuSections} />

        <main className="flex-1">
          <Header />

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
        </main>
      </div>
    </div>
  );
}
