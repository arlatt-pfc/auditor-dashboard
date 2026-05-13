import Link from "next/link";

import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";

const currentPath = "/dashboard";

export default async function OperationalDashboardPage() {
  const auth = await getAuthContext();
  const modules = [
    {
      available: userCanReadEngine(auth, "CUSTOMS_COMPLIANCE"),
      eyebrow: "Motor activo",
      href: "/dashboard/customs-compliance",
      title: "Customs Compliance",
      description: "Auditoría de expedientes aduanales, pedimentos, cuentas de gastos y evidencia fiscal.",
      action: "Abrir módulo",
    },
    {
      available: userCanReadEngine(auth, "STPS_PEMEX_COMPLIANCE"),
      eyebrow: "Motor activo",
      href: "/dashboard/stps-pemex-compliance",
      title: "STPS / PEMEX Compliance",
      description: "Auditoría documental contra normatividad STPS, PEMEX y requisitos HSE.",
      action: "Abrir módulo",
    },
    {
      available: true,
      eyebrow: "Vista ejecutiva",
      href: "/",
      title: "Executive Dashboard",
      description: "Indicadores consolidados, hallazgos críticos y tendencias de cumplimiento.",
      action: "Ver tablero",
    },
  ].filter((module) => module.available);

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="LDA Compliance Platform"
        title="Inicio operativo"
        description="Selecciona el motor de auditoría con el que vas a trabajar. Cada flujo mantiene su propia carga, resultados y reportes."
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-5 lg:grid-cols-3">
          {modules.map((module) => (
            <Link
              className="group flex min-h-64 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              href={module.href}
              key={module.title}
            >
              <span>
                <span className="text-sm font-semibold text-emerald-600">{module.eyebrow}</span>
                <span className="mt-4 block text-2xl font-bold tracking-tight text-slate-900">{module.title}</span>
                <span className="mt-3 block text-sm leading-6 text-slate-500">{module.description}</span>
              </span>
              <span className="mt-8 inline-flex w-fit rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-slate-800">
                {module.action}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
