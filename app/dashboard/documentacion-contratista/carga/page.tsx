import Link from "next/link";

import { AuditFlowCard } from "@/components/dashboard/AuditFlowCard";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { newAuditNotes, newAuditOptions } from "@/components/dashboard/data";
import { DocumentAuditForm } from "@/components/dashboard/documentation/DocumentAuditForm";
import { getDefaultAuditQuery } from "@/lib/auditor/service";

const currentPath = "/dashboard/documentacion-contratista/carga";

export default function ContractorDocumentationUploadPage() {
  const defaultQuery = getDefaultAuditQuery();
  const suggestedContexts = [...newAuditOptions.risks, "Plan de emergencias", "Anexos SSPA"];

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="Documentación Contratista"
        title="Carga y auditoría documental"
        description="Carga un PDF, envía el contexto operativo al backend y ejecuta la auditoría documental desde la interfaz de Auditor AI."
        actions={
          <>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Volver al dashboard
            </Link>
            <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              Endpoint interno listo
            </div>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.55fr_0.75fr]">
        <section className="space-y-6">
          <DocumentAuditForm defaultQuery={defaultQuery} suggestedContexts={suggestedContexts} />
        </section>

        <aside className="space-y-6">
          <AuditFlowCard
            steps={[
              "Seleccionar PDF del contratista.",
              "Definir o elegir el contexto de auditoría.",
              "Enviar archivo al endpoint interno.",
              "Delegar la ejecución al backend/pipeline.",
              "Revisar resumen y PDF de salida si existe.",
            ]}
          />

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Notas de integración</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                El endpoint `POST /api/auditor/upload` recibe `multipart/form-data` con `file` y `query`, persiste el PDF
                temporalmente y delega la ejecución a un servicio del servidor.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Si defines `AUDITOR_PIPELINE_URL`, la app reenviará el PDF al backend operativo que hoy encapsula
                `run_pipeline(...)`.
              </div>
              {newAuditNotes.slice(0, 2).map((note) => (
                <div key={note} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
