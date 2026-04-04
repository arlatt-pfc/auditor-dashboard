import type { AuditUploadResponse, DocumentAuditUiStatus } from "@/lib/auditor/types";

type DocumentAuditResultProps = {
  errorMessage?: string;
  result: AuditUploadResponse | null;
  status: DocumentAuditUiStatus;
};

const statusCopy: Record<DocumentAuditUiStatus, { label: string; tone: string; description: string }> = {
  idle: {
    label: "Idle",
    tone: "bg-slate-100 text-slate-700",
    description: "Selecciona un PDF y define el contexto para iniciar la auditoría documental.",
  },
  uploading: {
    label: "Uploading",
    tone: "bg-amber-100 text-amber-800",
    description: "Subiendo el archivo al backend interno de Auditor AI.",
  },
  processing: {
    label: "Processing",
    tone: "bg-blue-100 text-blue-800",
    description: "El documento ya se cargó y la auditoría se está ejecutando.",
  },
  success: {
    label: "Success",
    tone: "bg-emerald-100 text-emerald-800",
    description: "La solicitud terminó correctamente y ya hay un resultado disponible.",
  },
  error: {
    label: "Error",
    tone: "bg-rose-100 text-rose-800",
    description: "La ejecución falló. Revisa el mensaje y vuelve a intentarlo.",
  },
};

export function DocumentAuditResult({ errorMessage, result, status }: DocumentAuditResultProps) {
  const currentStatus = statusCopy[status];
  const successResult = result?.ok ? result : null;
  const failureMessage = !result?.ok ? result?.error || errorMessage : errorMessage;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Resultado de auditoría</h3>
          <p className="mt-1 text-sm text-slate-500">{currentStatus.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${currentStatus.tone}`}>{currentStatus.label}</span>
      </div>

      {successResult ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documento</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{successResult.originalFilename}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contexto</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{successResult.query}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Resumen Ejecutivo</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{successResult.summary}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Estado backend: {successResult.status}</p>
              <p className="mt-1 text-xs text-slate-500">Document ID: {successResult.documentId}</p>
            </div>
            {successResult.outputPdfUrl ? (
              <a
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                href={successResult.outputPdfUrl}
                rel="noreferrer"
                target="_blank"
              >
                Ver PDF de salida
              </a>
            ) : (
              <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                El backend no devolvió un PDF de salida.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {failureMessage ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{failureMessage}</div>
      ) : null}
    </section>
  );
}
