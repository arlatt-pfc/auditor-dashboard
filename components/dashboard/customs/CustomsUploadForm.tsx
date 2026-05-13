"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { CustomsOperation, CustomsOperationDocument } from "@/lib/customs/types";

type CustomsUploadFormProps = {
  canManage?: boolean;
  operation: CustomsOperation;
};

type SelectedFiles = Partial<Record<CustomsOperationDocument["documentType"], string>>;
type SelectedFileObjects = Partial<Record<CustomsOperationDocument["documentType"], File>>;
type AuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

export function CustomsUploadForm({ canManage = true, operation }: CustomsUploadFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({});
  const [selectedFileObjects, setSelectedFileObjects] = useState<SelectedFileObjects>({});
  const [auditState, setAuditState] = useState<"idle" | "ready" | "completed">("idle");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const requiredDocuments = operation.documents.filter((document) => document.required);
  const selectedRequiredCount = requiredDocuments.filter((document) => selectedFiles[document.documentType]).length;
  const hasRequiredDocuments = selectedRequiredCount === requiredDocuments.length;

  function handleFileChange(documentType: CustomsOperationDocument["documentType"], file?: File) {
    setSelectedFiles((current) => ({
      ...current,
      [documentType]: file?.name,
    }));
    setSelectedFileObjects((current) => ({
      ...current,
      [documentType]: file,
    }));
    setAuditState("ready");
    setAuditResult(null);
    setError("");
  }

  async function handleRunAudit() {
    const auditFile = selectedFileObjects.pedimento ?? Object.values(selectedFileObjects).find((file) => file?.type === "application/pdf");

    if (!auditFile) {
      setError("Selecciona al menos un PDF del expediente para ejecutar la auditoria.");
      return;
    }

    setIsRunning(true);
    setError("");

    const formData = new FormData();
    formData.append("file", auditFile, auditFile.name);
    formData.append("audit_topic", `Customs Compliance - Expediente ${operation.operationId}`);
    formData.append("engine_id", "CUSTOMS_COMPLIANCE");
    formData.append("operation_id", operation.operationId);
    formData.append("operation_record_id", operation.operationRecordId ?? operation.operationId);

    const response = await fetch("/api/audits/run", {
      body: formData,
      method: "POST",
    }).catch(() => null);

    setIsRunning(false);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { detail?: string; error?: string } | null;
      setError(payload?.detail ?? payload?.error ?? "No se pudo ejecutar la auditoria externa.");
      return;
    }

    const payload = (await response.json()) as AuditResult;
    setAuditResult(payload);
    setAuditState("completed");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Carga del expediente aduanal</h3>
          <p className="mt-1 text-sm text-slate-500">
            Cargue todos los documentos que integran el expediente aduanal para ejecutar la auditoria integral.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {selectedRequiredCount}/{requiredDocuments.length} obligatorios
        </span>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <ExpedientField label="Código de Expediente" value={operation.operationId} />
        <ExpedientField label="Número de Pedimento" value={operation.pedimento} />
        <ExpedientField label="Referencia Aduanal" value={operation.customsReference || "Sin referencia"} />
        <ExpedientField label="Importador" value={operation.importer} />
        <ExpedientField label="Agente Aduanal" value={operation.broker} />
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
                {document.required ? "Requerido" : "Opcional"}
              </span>
            </span>
            <input
              accept={document.documentType === "cfdi_xml" ? "application/xml,text/xml,.xml" : "application/pdf,.pdf"}
              className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              disabled={!canManage}
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
          <p className="text-sm font-medium text-slate-900">Expediente aduanal {operation.operationId}</p>
          <p className="mt-1 text-sm text-slate-500">{getStatusMessage(auditState, hasRequiredDocuments, canManage, isRunning)}</p>
          {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!hasRequiredDocuments || !canManage || isRunning}
          onClick={handleRunAudit}
          type="button"
        >
          {isRunning ? "Ejecutando..." : "Ejecutar Auditoría"}
        </button>
      </div>

      {auditResult ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Auditoria completada: {auditResult.compliance_percent}% cumplimiento · Riesgo {auditResult.risk_level}</p>
          <p className="mt-2 leading-6">{auditResult.executive_dictamen}</p>
          {auditResult.report_pdf_url ? (
            <a className="mt-3 inline-flex font-semibold text-emerald-700 hover:text-emerald-900" href={auditResult.report_pdf_url} rel="noreferrer" target="_blank">
              Abrir reporte PDF
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getStatusMessage(auditState: "idle" | "ready" | "completed", hasRequiredDocuments: boolean, canManage: boolean, isRunning: boolean) {
  if (!canManage) {
    return "Tu rol permite consultar este expediente, pero no cargar documentos ni ejecutar auditorias.";
  }

  if (isRunning) {
    return "Ejecutando auditoria real en el VPS de LDA Compliance.";
  }

  if (auditState === "completed") {
    return "Auditoria integral completada. El dashboard se actualizara con los hallazgos persistidos.";
  }

  if (hasRequiredDocuments) {
    return "Expediente documental completo. Listo para ejecutar auditoria integral.";
  }

  return "Carga todos los documentos obligatorios del expediente para habilitar la auditoria.";
}

function ExpedientField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
