"use client";

import { useId, useState } from "react";

import type { AuditUploadResponse, DocumentAuditUiStatus } from "@/lib/auditor/types";

import { DocumentAuditResult } from "./DocumentAuditResult";

type DocumentAuditFormProps = {
  defaultQuery: string;
  suggestedContexts: string[];
};

export function DocumentAuditForm({ defaultQuery, suggestedContexts }: DocumentAuditFormProps) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<AuditUploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [status, setStatus] = useState<DocumentAuditUiStatus>("idle");

  const isBusy = status === "uploading" || status === "processing";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setResult(null);

    if (!file) {
      setStatus("error");
      setErrorMessage("Selecciona un archivo PDF antes de continuar.");
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setStatus("error");
      setErrorMessage("Solo se permiten archivos PDF.");
      return;
    }

    const normalizedQuery = query.trim() || defaultQuery;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("query", normalizedQuery);

    try {
      const response = await submitAuditRequest(formData, setStatus);
      setResult(response);
      setStatus(response.ok ? "success" : "error");
      setQuery(normalizedQuery);

      if (!response.ok) {
        setErrorMessage(response.error);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "No fue posible completar la auditoría.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Carga de documentos</h3>
            <p className="mt-1 text-sm text-slate-500">
              Envía un PDF al backend interno, define el contexto de auditoría y dispara el proceso sin salir del dashboard.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">PDF + contexto + auditoría</span>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <label className="block cursor-pointer" htmlFor={inputId}>
              <span className="text-sm font-medium text-slate-700">Archivo PDF</span>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300">
                <p className="text-base font-semibold text-slate-900">{file ? file.name : "Seleccionar PDF"}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Solo se aceptan archivos PDF. El archivo se enviará vía `multipart/form-data` al endpoint interno.
                </p>
              </div>
            </label>
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              id={inputId}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setErrorMessage(undefined);
                if (status === "error") {
                  setStatus("idle");
                }
              }}
              type="file"
            />

            {file ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Archivo listo: <span className="font-medium text-slate-900">{file.name}</span>
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="audit-query">
              Contexto de auditoría
            </label>
            <textarea
              className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
              id="audit-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ejemplo: trabajos en altura, espacios confinados, plan de emergencias."
              value={query}
            />
            <p className="mt-2 text-xs text-slate-500">
              Si el campo queda vacío, se usará el contexto por defecto configurado en el servidor:
              {" "}
              <span className="font-medium text-slate-700">{defaultQuery}</span>.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Contextos sugeridos</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedContexts.map((context) => (
                <button
                  key={context}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                  onClick={() => setQuery(context)}
                  type="button"
                >
                  {context}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Estado del proceso</p>
              <p className="mt-1 text-sm text-slate-500">{getStatusMessage(status)}</p>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isBusy}
              type="submit"
            >
              {isBusy ? "Procesando..." : "Cargar y auditar"}
            </button>
          </div>
        </form>
      </section>

      <DocumentAuditResult errorMessage={errorMessage} result={result} status={status} />
    </div>
  );
}

function getStatusMessage(status: DocumentAuditUiStatus) {
  switch (status) {
    case "uploading":
      return "Subiendo el archivo al endpoint interno de Auditor AI.";
    case "processing":
      return "El backend recibió el PDF y está ejecutando la auditoría.";
    case "success":
      return "Proceso completado correctamente.";
    case "error":
      return "Ocurrió un error durante la carga o la auditoría.";
    default:
      return "Listo para recibir un PDF y ejecutar la auditoría documental.";
  }
}

function submitAuditRequest(
  formData: FormData,
  onStatusChange: (nextStatus: DocumentAuditUiStatus) => void,
): Promise<AuditUploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", "/api/auditor/upload");
    request.responseType = "json";

    request.upload.onloadstart = () => onStatusChange("uploading");
    request.upload.onloadend = () => onStatusChange("processing");

    request.onerror = () => {
      reject(new Error("No fue posible conectar con el endpoint de carga."));
    };

    request.onload = () => {
      const response = request.response as AuditUploadResponse | null;

      if (request.status >= 200 && request.status < 300 && response) {
        resolve(response);
        return;
      }

      reject(
        new Error(
          response && !response.ok ? response.error : "La carga terminó con un error inesperado en el servidor.",
        ),
      );
    };

    request.send(formData);
  });
}
