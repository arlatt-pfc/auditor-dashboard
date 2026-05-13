"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CustomsDocumentType } from "@/lib/customs/types";

type ExpedientData = {
  broker: string;
  customsReference: string;
  importer: string;
  operationCode: string;
  pedimento: string;
};

type DocumentSlot = {
  documentType: CustomsDocumentType;
  label: string;
  accept: string;
};

type AuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

const requiredDocuments: DocumentSlot[] = [
  { documentType: "pedimento", label: "Pedimento", accept: "application/pdf,.pdf" },
  { documentType: "commercial_invoice", label: "Facturas comerciales", accept: "application/pdf,.pdf" },
  { documentType: "bill_of_lading", label: "Bill of Lading", accept: "application/pdf,.pdf" },
  { documentType: "broker_expense_account", label: "Cuenta de gastos", accept: "application/pdf,.pdf" },
  { documentType: "cfdi_pdf", label: "CFDI PDF", accept: "application/pdf,.pdf" },
  { documentType: "cfdi_xml", label: "CFDI XML", accept: "application/xml,text/xml,.xml" },
  { documentType: "data_sheet", label: "Hoja de datos", accept: "application/pdf,.pdf" },
];

const optionalDocuments: DocumentSlot[] = [
  { documentType: "certificate_of_origin", label: "Certificado de origen T-MEC", accept: "application/pdf,.pdf" },
  { documentType: "cove", label: "COVE", accept: "application/pdf,.pdf" },
  { documentType: "annex", label: "Anexos", accept: "application/pdf,.pdf" },
];

export function CustomsExpedientWizard({ canExecute }: { canExecute: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ExpedientData>({
    broker: "",
    customsReference: "",
    importer: "",
    operationCode: "",
    pedimento: "",
  });
  const [files, setFiles] = useState<Partial<Record<CustomsDocumentType, File>>>({});
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const requiredReady = requiredDocuments.every((document) => files[document.documentType]);
  const dataReady = Object.values(data).every((value) => value.trim().length > 0);
  const loadedDocuments = useMemo(
    () =>
      [...requiredDocuments, ...optionalDocuments]
        .map((document) => ({
          ...document,
          file: files[document.documentType],
        }))
        .filter((document) => document.file),
    [files],
  );

  function updateData(key: keyof ExpedientData, value: string) {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
  }

  function updateFile(documentType: CustomsDocumentType, file?: File) {
    setFiles((current) => ({
      ...current,
      [documentType]: file,
    }));
    setResult(null);
    setError("");
  }

  async function runAudit() {
    const auditFile = files.pedimento ?? Object.values(files).find((file) => file?.type === "application/pdf");

    if (!auditFile) {
      setError("Carga el PDF del pedimento para ejecutar la auditoria.");
      return;
    }

    setIsRunning(true);
    setError("");

    const formData = new FormData();
    formData.append("file", auditFile, auditFile.name);
    formData.append("audit_topic", `Customs Compliance - Expediente ${data.operationCode}`);
    formData.append("engine_id", "CUSTOMS_COMPLIANCE");
    formData.append("operation_id", data.operationCode);
    formData.append("pedimento", data.pedimento);
    formData.append("customs_reference", data.customsReference);
    formData.append("importer", data.importer);
    formData.append("broker", data.broker);

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
    setResult(payload);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((item) => (
          <button
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              step === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            key={item}
            onClick={() => setStep(item)}
            type="button"
          >
            Paso {item}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {step === 1 ? <ExpedientStep data={data} onChange={updateData} /> : null}
        {step === 2 ? <DocumentsStep documents={requiredDocuments} files={files} onChange={updateFile} title="Documentos requeridos" /> : null}
        {step === 3 ? <DocumentsStep documents={optionalDocuments} files={files} onChange={updateFile} title="Documentos opcionales" /> : null}
        {step === 4 ? (
          <ReviewStep
            canExecute={canExecute}
            dataReady={dataReady}
            error={error}
            isRunning={isRunning}
            loadedDocuments={loadedDocuments}
            onRun={runAudit}
            requiredReady={requiredReady}
            result={result}
          />
        ) : null}
      </div>

      <div className="mt-6 flex justify-between border-t border-slate-200 pt-5">
        <button
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={step === 1}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          type="button"
        >
          Anterior
        </button>
        <button
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={step === 4}
          onClick={() => setStep((current) => Math.min(4, current + 1))}
          type="button"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}

function ExpedientStep({ data, onChange }: { data: ExpedientData; onChange: (key: keyof ExpedientData, value: string) => void }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Datos del expediente</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField label="Código expediente" value={data.operationCode} onChange={(value) => onChange("operationCode", value)} />
        <TextField label="Pedimento" value={data.pedimento} onChange={(value) => onChange("pedimento", value)} />
        <TextField label="Referencia aduanal" value={data.customsReference} onChange={(value) => onChange("customsReference", value)} />
        <TextField label="Importador" value={data.importer} onChange={(value) => onChange("importer", value)} />
        <TextField label="Agente aduanal" value={data.broker} onChange={(value) => onChange("broker", value)} />
      </div>
    </div>
  );
}

function DocumentsStep({
  documents,
  files,
  onChange,
  title,
}: {
  documents: DocumentSlot[];
  files: Partial<Record<CustomsDocumentType, File>>;
  onChange: (documentType: CustomsDocumentType, file?: File) => void;
  title: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {documents.map((document) => (
          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4" key={document.documentType}>
            <span className="text-sm font-semibold text-slate-800">{document.label}</span>
            <input
              accept={document.accept}
              className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              onChange={(event) => onChange(document.documentType, event.target.files?.[0])}
              type="file"
            />
            <span className="mt-3 block text-xs text-slate-500">{files[document.documentType]?.name ?? "Pendiente de carga"}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({
  canExecute,
  dataReady,
  error,
  isRunning,
  loadedDocuments,
  onRun,
  requiredReady,
  result,
}: {
  canExecute: boolean;
  dataReady: boolean;
  error: string;
  isRunning: boolean;
  loadedDocuments: (DocumentSlot & { file?: File })[];
  onRun: () => void;
  requiredReady: boolean;
  result: AuditResult | null;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Revisión y ejecutar auditoría</h3>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Documentos cargados</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {loadedDocuments.map((document) => (
            <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600" key={document.documentType}>
              <span className="font-medium text-slate-900">{document.label}</span>
              <span className="mt-1 block text-xs">{document.file?.name}</span>
            </div>
          ))}
        </div>
      </div>
      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">{result.compliance_percent}% cumplimiento · Riesgo {result.risk_level}</p>
          <p className="mt-2 leading-6">{result.executive_dictamen}</p>
        </div>
      ) : null}
      <button
        className="mt-5 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!canExecute || !dataReady || !requiredReady || isRunning}
        onClick={onRun}
        type="button"
      >
        {isRunning ? "Ejecutando auditoría..." : "Ejecutar auditoría"}
      </button>
    </div>
  );
}

function TextField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
