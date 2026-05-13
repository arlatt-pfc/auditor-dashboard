import Link from "next/link";

import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";

const currentPath = "/dashboard/stps-pemex-compliance";

const recentAudits = [
  {
    id: "STPS-2026-014",
    document: "Procedimiento de trabajo en altura",
    owner: "Contratista Delta",
    status: "En revisión",
  },
  {
    id: "PEMEX-2026-008",
    document: "Anexo SSPA y evidencias HSE",
    owner: "Servicios Atlas",
    status: "Pendiente",
  },
  {
    id: "HSE-2026-021",
    document: "Plan de rescate y emergencias",
    owner: "Operación Marina Sur",
    status: "Completada",
  },
];

export default async function StpsPemexCompliancePage() {
  const auth = await getAuthContext();
  const canRead = userCanReadEngine(auth, "STPS_PEMEX_COMPLIANCE");

  if (!canRead) {
    return (
      <PageShell currentPath={currentPath}>
        <Header
          eyebrow="STPS_PEMEX_COMPLIANCE"
          title="Acceso restringido"
          description="Tu usuario no tiene acceso asignado al motor STPS_PEMEX_COMPLIANCE para esta empresa."
        />
      </PageShell>
    );
  }

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="STPS_PEMEX_COMPLIANCE"
        title="STPS / PEMEX Compliance"
        description="Auditoría de procedimientos, instructivos y evidencias contra normatividad STPS, PEMEX y HSE."
        actions={
          <>
            <Link
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              href="/dashboard"
            >
              Volver al inicio
            </Link>
            <Link
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
              href="/nueva-auditoria"
            >
              Nueva auditoría documental
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Auditorías recientes</h3>
              <p className="mt-1 text-sm text-slate-500">Vista operativa inicial para el motor documental STPS / PEMEX.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Mock operativo</span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Auditoría</th>
                  <th className="pb-3 pr-4 font-medium">Documento</th>
                  <th className="pb-3 pr-4 font-medium">Responsable</th>
                  <th className="pb-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentAudits.map((audit) => (
                  <tr className="border-b border-slate-100 last:border-b-0" key={audit.id}>
                    <td className="py-4 pr-4 font-semibold text-slate-900">{audit.id}</td>
                    <td className="py-4 pr-4 text-slate-600">{audit.document}</td>
                    <td className="py-4 pr-4 text-slate-600">{audit.owner}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{audit.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
