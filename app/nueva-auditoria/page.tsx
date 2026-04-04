import Link from "next/link";

import { AuditFlowCard } from "@/components/dashboard/AuditFlowCard";
import { Header } from "@/components/dashboard/Header";
import { auditFlowSteps, newAuditNotes, newAuditOptions, uploadedDocuments } from "@/components/dashboard/data";
import { PageShell } from "@/components/dashboard/PageShell";

export default function NewAuditPage() {
  return (
    <PageShell currentPath="/nueva-auditoria">
      <Header
        eyebrow="Módulo de Auditoría"
        title="Nueva auditoría"
        description="Configura el contexto operativo, carga la evidencia documental y deja preparada la ejecución del scoring sin salir del flujo de cumplimiento."
        actions={
          <>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Volver al dashboard
            </Link>
            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              Ejecutar auditoría
            </button>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Contexto de la auditoría</h3>
              <p className="mt-1 text-sm text-slate-500">
                Define las partes involucradas y el tipo de riesgo para preparar el expediente documental.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Contratante / Cliente</span>
                <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white">
                  <option>Seleccionar cliente</option>
                  {newAuditOptions.clients.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Contratista</span>
                <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white">
                  <option>Seleccionar contratista</option>
                  {newAuditOptions.contractors.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Tipo de riesgo</span>
                <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white">
                  <option>Seleccionar riesgo</option>
                  {newAuditOptions.risks.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Carga documental</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Arrastra evidencia o usa el selector para incorporar archivos al expediente.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Mock UI sin integración
              </div>
            </div>

            <label className="mt-6 block cursor-pointer rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-emerald-300 hover:bg-white">
              <input className="hidden" multiple type="file" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
                +
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Drag & drop documental</p>
              <p className="mt-2 text-sm text-slate-500">
                PDF, Word, Excel o evidencia de soporte. También puedes hacer clic para seleccionar archivos.
              </p>
            </label>

            <div className="mt-6 space-y-3">
              {uploadedDocuments.map((document) => (
                <div
                  key={document.name}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{document.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{document.meta}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {document.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Observaciones de auditoría</h3>
            <p className="mt-1 text-sm text-slate-500">
              Registra notas preliminares, criterios especiales o contexto que deba acompañar el dictamen.
            </p>

            <textarea
              className="mt-6 min-h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
              placeholder="Ejemplo: la evidencia del contratista debe revisarse contra requisitos internos del cliente y anexos SSPA aplicables."
            />

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500">Estado sugerido: listo para clasificación y scoring.</div>
              <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
                Ejecutar auditoría
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <AuditFlowCard steps={auditFlowSteps} />

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Notas operativas</h3>
            <div className="mt-4 space-y-4">
              {newAuditNotes.map((note) => (
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
