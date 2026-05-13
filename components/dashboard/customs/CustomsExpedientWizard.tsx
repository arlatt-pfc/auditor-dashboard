"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CustomsDocumentType } from "@/lib/customs/types";

type PedimentoXmlData = {
  broker_name: string;
  broker_patent: string;
  commercial_value_usd: number | null;
  customs_office: string;
  customs_value_mxn: number | null;
  dta_mxn: number | null;
  exchange_rate: number | null;
  igi_mxn: number | null;
  import_date: string;
  importer_name: string;
  importer_rfc: string;
  iva_mxn: number | null;
  operation_code: string;
  payment_date: string;
  pedimento_full: string;
  pedimento_number: string;
  prv_mxn: number | null;
  coves: string[];
  invoices: string[];
  providers: string[];
  reference: string;
  tariff_items: string[];
  total_contributions_mxn: number | null;
};

type BaseDocumentKind = "xml_pedimento" | "pdf_pedimento" | "cfdi_invalid" | "";

type ParseResponse = {
  confidence: number;
  detected: PedimentoXmlData;
  detected_fields: string[];
  missing_fields: string[];
};

type SupportDocumentType = CustomsDocumentType | "forwarding_invoice";

type DocumentSlot = {
  accept: string;
  documentType: SupportDocumentType;
  label: string;
};

type AuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

const emptyXmlData: PedimentoXmlData = {
  broker_name: "",
  broker_patent: "",
  commercial_value_usd: null,
  customs_office: "",
  customs_value_mxn: null,
  dta_mxn: null,
  exchange_rate: null,
  igi_mxn: null,
  import_date: "",
  importer_name: "",
  importer_rfc: "",
  iva_mxn: null,
  operation_code: "",
  payment_date: "",
  pedimento_full: "",
  pedimento_number: "",
  prv_mxn: null,
  coves: [],
  invoices: [],
  providers: [],
  reference: "",
  tariff_items: [],
  total_contributions_mxn: null,
};

const requiredDocuments: DocumentSlot[] = [
  { documentType: "pedimento", label: "Pedimento PDF", accept: "application/pdf,.pdf" },
  { documentType: "commercial_invoice", label: "Facturas comerciales", accept: "application/pdf,.pdf" },
  { documentType: "bill_of_lading", label: "Bill of Lading / documento transporte", accept: "application/pdf,.pdf" },
  { documentType: "broker_expense_account", label: "Cuenta de gastos", accept: "application/pdf,.pdf" },
  { documentType: "cfdi_pdf", label: "CFDI PDF del agente", accept: "application/pdf,.pdf" },
  { documentType: "cfdi_xml", label: "CFDI XML del agente", accept: "application/xml,text/xml,.xml" },
  { documentType: "data_sheet", label: "Hoja de datos", accept: "application/pdf,.pdf" },
];

const optionalDocuments: DocumentSlot[] = [
  { documentType: "certificate_of_origin", label: "Certificado de origen T-MEC", accept: "application/pdf,.pdf" },
  { documentType: "cove", label: "COVE", accept: "application/pdf,.pdf" },
  { documentType: "annex", label: "Anexos", accept: "application/pdf,.pdf" },
  { documentType: "forwarding_invoice", label: "Factura forwarding", accept: "application/pdf,.pdf" },
];

const detectedFieldLabels: { key: keyof PedimentoXmlData; label: string; numeric?: boolean }[] = [
  { key: "operation_code", label: "Código expediente" },
  { key: "pedimento_number", label: "Pedimento number" },
  { key: "pedimento_full", label: "Pedimento full" },
  { key: "reference", label: "Referencia aduanal" },
  { key: "importer_name", label: "Importador" },
  { key: "importer_rfc", label: "RFC importador" },
  { key: "broker_name", label: "Agente aduanal" },
  { key: "broker_patent", label: "Patente agente" },
  { key: "customs_office", label: "Aduana" },
  { key: "import_date", label: "Fecha importación" },
  { key: "payment_date", label: "Fecha pago" },
  { key: "exchange_rate", label: "Tipo de cambio", numeric: true },
  { key: "customs_value_mxn", label: "Valor aduana MXN", numeric: true },
  { key: "commercial_value_usd", label: "Valor comercial USD", numeric: true },
  { key: "igi_mxn", label: "IGI MXN", numeric: true },
  { key: "iva_mxn", label: "IVA MXN", numeric: true },
  { key: "dta_mxn", label: "DTA MXN", numeric: true },
  { key: "prv_mxn", label: "PRV MXN", numeric: true },
  { key: "total_contributions_mxn", label: "Total contribuciones MXN", numeric: true },
];

const baseDocumentLabels: Record<BaseDocumentKind, string> = {
  "": "Pendiente",
  cfdi_invalid: "CFDI no válido para paso 1",
  pdf_pedimento: "PDF Pedimento",
  xml_pedimento: "XML Pedimento",
};

export function CustomsExpedientWizard({ canExecute }: { canExecute: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [baseDocumentKind, setBaseDocumentKind] = useState<BaseDocumentKind>("");
  const [xmlData, setXmlData] = useState<PedimentoXmlData>(emptyXmlData);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [files, setFiles] = useState<Partial<Record<SupportDocumentType, File>>>({});
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const requiredReady = requiredDocuments.every((document) => files[document.documentType]);
  const hasPedimentoNumber = xmlData.pedimento_number.trim().length > 0;
  const stepOneCanContinue = hasPedimentoNumber && baseDocumentKind !== "cfdi_invalid";
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

  async function parseBaseDocument(file?: File) {
    if (!file) {
      return;
    }

    setBaseFile(file);
    setIsParsing(true);
    setError("");
    setParseResult(null);

    if (isXmlFile(file)) {
      const xml = await file.text().catch(() => "");

      if (isCfdiXml(xml)) {
        setIsParsing(false);
        setBaseDocumentKind("cfdi_invalid");
        setXmlData(emptyXmlData);
        setError("Este XML parece ser un CFDI. Para el paso 1 carga el XML del pedimento o el PDF del pedimento.");
        return;
      }

      setBaseDocumentKind("xml_pedimento");
      await parseDocument(file, "/api/customs/parse-pedimento-xml", "No se pudo leer el XML del pedimento.");
      return;
    }

    if (isPdfFile(file)) {
      setBaseDocumentKind("pdf_pedimento");
      setFiles((current) => ({
        ...current,
        pedimento: file,
      }));
      await parseDocument(file, "/api/customs/parse-pedimento-pdf", "No se pudo leer el PDF del pedimento.");
      return;
    }

    setIsParsing(false);
    setBaseDocumentKind("");
    setError("Carga un archivo XML o PDF de pedimento.");
  }

  async function parseDocument(file: File, endpoint: string, fallbackError: string) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(endpoint, {
      body: formData,
      method: "POST",
    }).catch(() => null);

    setIsParsing(false);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? fallbackError);
      return;
    }

    const payload = (await response.json()) as ParseResponse;
    setParseResult(payload);
    setXmlData(payload.detected);
  }

  function updateXmlData(key: keyof PedimentoXmlData, value: string) {
    setXmlData((current) => {
      const next = {
        ...current,
        [key]: arrayKey(key) ? value.split(",").map((item) => item.trim()).filter(Boolean) : numericKey(key) ? numberOrNull(value) : value,
      };

      if (key === "pedimento_number" || key === "import_date") {
        next.operation_code = operationCodeFromPedimento(
          key === "pedimento_number" ? value : current.pedimento_number,
          key === "import_date" ? value : current.import_date,
        );
      }

      return next;
    });
    setError("");
  }

  function updateFile(documentType: SupportDocumentType, file?: File) {
    setFiles((current) => ({
      ...current,
      [documentType]: file,
    }));
    setResult(null);
    setError("");
  }

  async function runAudit() {
    if (!baseFile || !hasPedimentoNumber || baseDocumentKind === "cfdi_invalid") {
      setError("Carga un XML o PDF de pedimento con número de pedimento detectado.");
      return;
    }

    setIsRunning(true);
    setError("");

    const formData = new FormData();
    if (baseDocumentKind === "xml_pedimento") {
      formData.append("pedimento_xml", baseFile, baseFile.name);
    }

    formData.append("file", files.pedimento ?? baseFile, files.pedimento?.name ?? baseFile.name);
    formData.append("audit_topic", `Customs Compliance - Expediente ${xmlData.operation_code}`);
    formData.append("engine_id", "CUSTOMS_COMPLIANCE");
    formData.append("operation_id", xmlData.operation_code);
    formData.append("pedimento", xmlData.pedimento_full || xmlData.pedimento_number);
    formData.append("pedimento_number", xmlData.pedimento_number);
    formData.append("customs_reference", xmlData.reference);
    formData.append("importer", xmlData.importer_name);
    formData.append("importer_rfc", xmlData.importer_rfc);
    formData.append("broker", xmlData.broker_name);
    formData.append("broker_patent", xmlData.broker_patent);
    formData.append("customs_office", xmlData.customs_office);
    formData.append("import_date", xmlData.import_date);
    formData.append("payment_date", xmlData.payment_date);
    formData.append("pedimento_xml_json", JSON.stringify(xmlData));

    for (const [documentType, file] of Object.entries(files)) {
      if (file) {
        formData.append("support_files", file, file.name);
        formData.append("support_document_types", documentType);
      }
    }

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
        {step === 1 ? (
          <XmlStep
            baseDocumentKind={baseDocumentKind}
            data={xmlData}
            fileName={baseFile?.name}
            isParsing={isParsing}
            onChange={updateXmlData}
            onFileChange={parseBaseDocument}
            parseResult={parseResult}
          />
        ) : null}
        {step === 2 ? <DocumentsStep documents={requiredDocuments} files={files} onChange={updateFile} title="Documentos soporte requeridos" /> : null}
        {step === 3 ? <DocumentsStep documents={optionalDocuments} files={files} onChange={updateFile} title="Documentos opcionales / preferenciales" /> : null}
        {step === 4 ? (
          <ReviewStep
            canExecute={canExecute}
            data={xmlData}
            error={error}
            hasPedimentoNumber={hasPedimentoNumber}
            isRunning={isRunning}
            loadedDocuments={loadedDocuments}
            onRun={runAudit}
            requiredReady={requiredReady}
            result={result}
            baseDocumentKind={baseDocumentKind}
            baseFileName={baseFile?.name}
          />
        ) : null}
      </div>

      {error && step !== 4 ? <p className="mt-5 text-sm font-semibold text-red-700">{error}</p> : null}

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
          disabled={step === 4 || (step === 1 && !stepOneCanContinue)}
          onClick={() => setStep((current) => Math.min(4, current + 1))}
          type="button"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}

function XmlStep({
  baseDocumentKind,
  data,
  fileName,
  isParsing,
  onChange,
  onFileChange,
  parseResult,
}: {
  baseDocumentKind: BaseDocumentKind;
  data: PedimentoXmlData;
  fileName?: string;
  isParsing: boolean;
  onChange: (key: keyof PedimentoXmlData, value: string) => void;
  onFileChange: (file?: File) => void;
  parseResult: ParseResponse | null;
}) {
  const missingCount = parseResult?.missing_fields.length ?? 0;

  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Cargar pedimento base</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        Carga el XML del pedimento cuando esté disponible. Si solo cuentas con el PDF, el sistema intentará extraer los datos principales para iniciar el expediente.
      </p>

      <label className="mt-5 block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <span className="text-sm font-semibold text-slate-800">XML del pedimento <span className="text-emerald-700">(recomendado)</span> o PDF del pedimento</span>
        <input
          accept="application/xml,text/xml,application/pdf,.xml,.pdf"
          className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          type="file"
        />
        <span className="mt-3 block text-xs text-slate-500">{isParsing ? "Leyendo documento..." : fileName ?? "Pendiente de carga"}</span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">A) XML del pedimento</p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">Recomendado por ser estructurado y más confiable.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">B) PDF del pedimento</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Se procesa por texto y heurísticas editables.</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Datos detectados</h4>
            <p className="mt-1 text-sm text-slate-500">Puedes editar manualmente cualquier campo faltante o incorrecto.</p>
            <p className={`mt-2 text-xs font-semibold ${baseDocumentKind === "cfdi_invalid" ? "text-amber-700" : "text-slate-500"}`}>
              Tipo de documento detectado: {baseDocumentLabels[baseDocumentKind]}
            </p>
          </div>
          {parseResult ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {parseResult.confidence}% confianza · {missingCount} faltantes
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {detectedFieldLabels.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              missing={parseResult ? parseResult.missing_fields.includes(field.key) : false}
              onChange={(value) => onChange(field.key, value)}
              value={stringValue(data[field.key])}
            />
          ))}
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Fracciones arancelarias</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => onChange("tariff_items", event.target.value)}
              value={data.tariff_items.join(", ")}
            />
          </label>
          <ArrayTextField label="Proveedores detectados" onChange={(value) => onChange("providers", value)} value={data.providers.join(", ")} />
          <ArrayTextField label="Facturas detectadas" onChange={(value) => onChange("invoices", value)} value={data.invoices.join(", ")} />
          <ArrayTextField label="COVEs detectados" onChange={(value) => onChange("coves", value)} value={data.coves.join(", ")} />
        </div>
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
  files: Partial<Record<SupportDocumentType, File>>;
  onChange: (documentType: SupportDocumentType, file?: File) => void;
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
  data,
  error,
  hasPedimentoNumber,
  isRunning,
  loadedDocuments,
  onRun,
  requiredReady,
  result,
  baseDocumentKind,
  baseFileName,
}: {
  canExecute: boolean;
  data: PedimentoXmlData;
  error: string;
  hasPedimentoNumber: boolean;
  isRunning: boolean;
  loadedDocuments: (DocumentSlot & { file?: File })[];
  onRun: () => void;
  requiredReady: boolean;
  result: AuditResult | null;
  baseDocumentKind: BaseDocumentKind;
  baseFileName?: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Revisión y ejecutar auditoría</h3>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Resumen del pedimento base</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <ReviewRow label="Documento base" value={baseFileName ?? "Pendiente"} />
            <ReviewRow label="Tipo detectado" value={baseDocumentLabels[baseDocumentKind]} />
            <ReviewRow label="Expediente" value={data.operation_code || "Pendiente"} />
            <ReviewRow label="Pedimento" value={data.pedimento_full || data.pedimento_number || "Pendiente"} />
            <ReviewRow label="Referencia" value={data.reference || "Pendiente"} />
            <ReviewRow label="Importador" value={data.importer_name || "Pendiente"} />
            <ReviewRow label="Agente" value={data.broker_name || "Pendiente"} />
            <ReviewRow label="Contribuciones" value={stringValue(data.total_contributions_mxn) || "Pendiente"} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Documentos cargados</p>
          <div className="mt-3 grid gap-2">
            {loadedDocuments.map((document) => (
              <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600" key={document.documentType}>
                <span className="font-medium text-slate-900">{document.label}</span>
                <span className="mt-1 block text-xs">{document.file?.name}</span>
              </div>
            ))}
          </div>
        </section>
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
        disabled={!canExecute || !hasPedimentoNumber || !requiredReady || isRunning}
        onClick={onRun}
        type="button"
      >
        {isRunning ? "Ejecutando auditoría..." : "Ejecutar auditoría"}
      </button>
    </div>
  );
}

function TextField({
  label,
  missing,
  onChange,
  value,
}: {
  label: string;
  missing?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
        {label}
        {missing ? <span className="text-xs font-medium text-amber-600">Faltante</span> : null}
      </span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function ArrayTextField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <span className="mt-1 block break-words font-medium text-slate-800">{value}</span>
    </div>
  );
}

function numericKey(key: keyof PedimentoXmlData) {
  return detectedFieldLabels.some((field) => field.key === key && field.numeric);
}

function arrayKey(key: keyof PedimentoXmlData) {
  return key === "tariff_items" || key === "providers" || key === "invoices" || key === "coves";
}

function numberOrNull(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: PedimentoXmlData[keyof PedimentoXmlData]) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value === null ? "" : String(value);
}

function operationCodeFromPedimento(pedimentoNumber: string, importDate: string) {
  const fullYear = importDate.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  const shortYear = importDate.match(/[/-](\d{2})$/)?.[1];
  const year = fullYear ?? (shortYear ? `20${shortYear}` : String(new Date().getFullYear()));
  const digits = pedimentoNumber.replace(/\D/g, "");
  return digits ? `IMP-${year}-${digits}` : "";
}

function isXmlFile(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".xml") || file.type === "application/xml" || file.type === "text/xml";
}

function isPdfFile(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".pdf") || file.type === "application/pdf";
}

function isCfdiXml(xml: string) {
  return /<(?:[\w.-]+:)?Comprobante\b/i.test(xml) && /\b(?:[\w.-]+:)?Emisor\b|\b(?:[\w.-]+:)?Receptor\b/i.test(xml);
}
