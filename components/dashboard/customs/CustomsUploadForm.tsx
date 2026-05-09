"use client";

import { useState } from "react";

import type { CustomsOperation, CustomsOperationDocument } from "@/lib/customs/types";

type CustomsUploadFormProps = {
  operation: CustomsOperation;
};

type SelectedFiles = Partial<Record<CustomsOperationDocument["documentType"], string>>;

export function CustomsUploadForm({ operation }: CustomsUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({});
  const [auditState, setAuditState] = useState<"idle" | "ready" | "completed">("idle");

  const requiredDocuments = operation.documents.filter((document) => document.required);
  const selectedRequiredCount = requiredDocuments.filter((document) => selectedFiles[document.documentType]).length;
  const canExecute = selectedRequiredCount === requiredDocuments.length;

  function handleFileChange(documentType: CustomsOperationDocument["documentType"], file?: File) {
    setSelectedFiles((current) => ({
      ...current,
      [documentType]: file?.name,
    }));
    setAuditState("ready");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Carga documental 1:1</h3>
          <p className="mt-1 text-sm text-slate-500">
            Simula el paquete documental de importacion que despues se enviara al pipeline del VPS.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {selectedRequiredCount}/{requiredDocuments.length} obligatorios
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {operation.documents.map((document) => (
          <label
            className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-white"
            key={document.id}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-800">{document.label}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {document.required ? "PDF requerido" : "Opcional"}
              </span>
            </span>
            <input
              accept="application/pdf,.pdf"
              className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              onChange={(event) => handleFileChange(document.documentType, event.target.files?.[0])}
              type="file"
            />
            <p className="mt-3 text-xs text-slate-500">
              {selectedFiles[document.documentType] || `Mock esperado: ${document.filename}`}
            </p>
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Operacion {operation.operationId}</p>
          <p className="mt-1 text-sm text-slate-500">{getStatusMessage(auditState, canExecute)}</p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canExecute}
          onClick={() => setAuditState("completed")}
          type="button"
        >
          Ejecutar Auditoría
        </button>
      </div>
    </section>
  );
}

function getStatusMessage(auditState: "idle" | "ready" | "completed", canExecute: boolean) {
  if (auditState === "completed") {
    return "Auditoria simulada completada con datos mock. Los hallazgos se muestran abajo.";
  }

  if (canExecute) {
    return "Paquete documental completo. Listo para ejecutar auditoria simulada.";
  }

  return "Carga los cuatro PDFs obligatorios para habilitar la auditoria.";
}
