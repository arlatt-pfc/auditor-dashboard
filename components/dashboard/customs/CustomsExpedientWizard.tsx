"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CustomsDocumentType } from "@/lib/customs/types";

type PedimentoXmlData = {
  broker_name: string;
  broker_person_name: string;
  broker_patent: string;
  commercial_value_usd: number | null;
  paid_commercial_value_mxn: number | null;
  customs_office: string;
  customs_value_mxn: number | null;
  dta_mxn: number | null;
  exchange_rate: number | string | null;
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
  invoice_details: InvoiceDetail[];
  invoices: string[];
  providers: string[];
  reference: string;
  tariff_items: string[];
  total_contributions_mxn: number | null;
};

type InvoiceDetail = {
  amount?: number | null;
  cove?: string;
  currency?: string;
  date?: string;
  exchange_factor?: string;
  incoterm?: string;
  invoice_number?: string;
  usd_value?: number | null;
};

type BaseDocumentKind = "xml_pedimento" | "pdf_pedimento" | "cfdi_invalid" | "";

type ParseResponse = {
  confidence: number;
  detected: PedimentoXmlData;
  detected_fields: string[];
  missing_fields: string[];
};

type RemoteParseResponse = {
  confidence: number;
  data: PedimentoXmlData;
  detected_fields: string[];
  document_type: string;
  error_code?: string;
  is_supported_as_primary_document: boolean;
  is_supported_as_primary_xml?: boolean;
  missing_fields: string[];
  user_message?: string;
  warning?: string;
};

type ParseError = {
  code: string;
  message: string;
};

type SupportDocumentType = CustomsDocumentType | "forwarding_invoice";

type DocumentSlot = {
  accept: string;
  documentType: SupportDocumentType;
  label: string;
};

type LoadedDocument = DocumentSlot & {
  file?: File;
  reusedFromBase?: boolean;
};

type AuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

type AuditReadinessDebug = {
  baseDocumentKind: BaseDocumentKind;
  baseFileExists: boolean;
  baseFileName: string;
  canRunAudit: boolean;
  isCfdiInvalid: boolean;
  isParsing: boolean;
  isRunning: boolean;
  missingReasons: string[];
  operationCode: string;
  pedimentoNumber: string;
};

const emptyXmlData: PedimentoXmlData = {
  broker_name: "",
  broker_person_name: "",
  broker_patent: "",
  commercial_value_usd: null,
  paid_commercial_value_mxn: null,
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
  invoice_details: [],
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
  { key: "broker_person_name", label: "Agente responsable" },
  { key: "broker_patent", label: "Patente agente" },
  { key: "customs_office", label: "Aduana" },
  { key: "import_date", label: "Fecha importación" },
  { key: "payment_date", label: "Fecha pago" },
  { key: "exchange_rate", label: "Tipo de cambio", numeric: true },
  { key: "customs_value_mxn", label: "Valor aduana MXN", numeric: true },
  { key: "commercial_value_usd", label: "Valor en dólares", numeric: true },
  { key: "paid_commercial_value_mxn", label: "Precio pagado / Valor comercial MXN", numeric: true },
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
  void canExecute;

  const router = useRouter();
  const [step, setStep] = useState(1);
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [baseDocumentKind, setBaseDocumentKind] = useState<BaseDocumentKind>("");
  const [xmlData, setXmlData] = useState<PedimentoXmlData>(emptyXmlData);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [files, setFiles] = useState<Partial<Record<SupportDocumentType, File>>>({});
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const data = xmlData;
  const normalizedPedimentoNumber = (xmlData.pedimento_number || data.pedimento_number || "").trim();
  const normalizedOperationCode = (xmlData.operation_code || data.operation_code || "").trim();
  const hasPedimentoNumber = normalizedPedimentoNumber.length > 0;
  const isCfdiInvalid = baseDocumentKind === "cfdi_invalid";
  const canRunAudit = hasMinimumAuditData() && !isRunning;
  const basePdfPedimentoFile = baseDocumentKind === "pdf_pedimento" ? baseFile : null;
  const effectiveFiles = useMemo(
    () => ({
      ...files,
      ...(basePdfPedimentoFile && !files.pedimento ? { pedimento: basePdfPedimentoFile } : {}),
    }),
    [basePdfPedimentoFile, files],
  );
  const missingAuditReasons = [
    !baseFile ? "archivo base" : "",
    normalizedPedimentoNumber.length === 0 ? "pedimento" : "",
    normalizedOperationCode.length === 0 ? "código expediente" : "",
    isCfdiInvalid ? "documento válido" : "",
  ].filter(Boolean);
  const auditReadinessDebug: AuditReadinessDebug = {
    baseDocumentKind,
    baseFileExists: Boolean(baseFile),
    baseFileName: baseFile?.name ?? "",
    canRunAudit,
    isCfdiInvalid,
    isParsing,
    isRunning,
    missingReasons: missingAuditReasons,
    operationCode: normalizedOperationCode,
    pedimentoNumber: normalizedPedimentoNumber,
  };

  function hasMinimumAuditData() {
    return (
      Boolean(baseFile) &&
      Boolean((xmlData.pedimento_number || "").trim()) &&
      Boolean((xmlData.operation_code || "").trim()) &&
      baseDocumentKind !== "cfdi_invalid"
    );
  }
  const stepOneCanContinue = hasPedimentoNumber && baseDocumentKind !== "cfdi_invalid";
  const missingRequiredDocuments = useMemo(
    () => requiredDocuments.filter((document) => !effectiveFiles[document.documentType]),
    [effectiveFiles],
  );
  const loadedDocuments = useMemo(
    () =>
      [...requiredDocuments, ...optionalDocuments]
        .map((document) => ({
          ...document,
          file: effectiveFiles[document.documentType],
          reusedFromBase: document.documentType === "pedimento" && Boolean(basePdfPedimentoFile) && !files.pedimento,
        }))
        .filter((document) => document.file),
    [basePdfPedimentoFile, effectiveFiles, files.pedimento],
  );

  function selectBaseDocument(file?: File) {
    if (!file) {
      return;
    }

    setBaseFile(file);
    setBaseDocumentKind("");
    setError("");
    setParseResult(null);
    setParseError(null);
    setResult(null);
  }

  async function extractBaseDocument() {
    if (!baseFile) {
      setParseError({
        code: "PEDIMENTO_FILE_REQUIRED",
        message: "Selecciona un XML o PDF del pedimento antes de extraer datos.",
      });
      return;
    }

    setIsParsing(true);
    setError("");
    setParseResult(null);
    setParseError(null);
    await parseDocument(baseFile);
  }

  async function parseDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch("/api/customs/parse-pedimento", {
      body: formData,
      method: "POST",
    }).catch(() => null);

    setIsParsing(false);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { document_type?: string; error?: string; error_code?: string; user_message?: string } | null;
      const code = payload?.error_code ?? payload?.error ?? "PARSE_FAILED";
      setBaseDocumentKind(kindFromDocumentType(payload?.document_type));
      setParseError({
        code,
        message: payload?.user_message || parsingErrorMessage(code),
      });
      return;
    }

    const payload = (await response.json()) as RemoteParseResponse;
    const documentKind = kindFromDocumentType(payload.document_type);
    setBaseDocumentKind(documentKind);

    if (!payload.is_supported_as_primary_document) {
      setXmlData(emptyXmlData);
      setParseError({
        code: payload.error_code || payload.document_type || "UNSUPPORTED_BASE_DOCUMENT",
        message: payload.user_message || payload.warning || "El documento no es válido como pedimento base.",
      });
      return;
    }

    const parseResultPayload = {
      confidence: payload.confidence,
      detected: payload.data,
      detected_fields: payload.detected_fields,
      missing_fields: payload.missing_fields,
    };

    setParseResult(parseResultPayload);
    setXmlData(payload.data);

    if (payload.warning || payload.user_message) {
      setParseError({
        code: payload.error_code || "REMOTE_PARSE_WARNING",
        message: payload.user_message || payload.warning || "",
      });
    }
  }

  function updateXmlData(key: keyof PedimentoXmlData, value: string) {
    setXmlData((current) => {
      const next = {
        ...current,
        [key]: arrayKey(key) ? splitList(value) : numericKey(key) ? numberOrNull(value) : value,
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

  function useManualCapture() {
    setParseError(null);
    setParseResult(null);
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
    console.log("AUDIT_READY", {
      baseDocumentKind,
      baseFile: Boolean(baseFile),
      canRunAudit,
      isRunning,
      operation_code: xmlData.operation_code,
      pedimento_number: xmlData.pedimento_number,
    });

    if (!hasMinimumAuditData()) {
      setError("Carga un XML o PDF de pedimento con número de pedimento detectado.");
      return;
    }

    const selectedBaseFile = baseFile;

    if (!selectedBaseFile) {
      setError("Carga un XML o PDF de pedimento con número de pedimento detectado.");
      return;
    }

    setIsRunning(true);
    setError("");

    const formData = new FormData();
    if (baseDocumentKind === "xml_pedimento") {
      formData.append("pedimento_xml", selectedBaseFile, selectedBaseFile.name);
    }

    formData.append("file", files.pedimento ?? selectedBaseFile, files.pedimento?.name ?? selectedBaseFile.name);
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
    formData.append("pedimento_data", JSON.stringify(xmlData));
    formData.append("missing_required_documents", JSON.stringify(documentSummary(missingRequiredDocuments)));
    formData.append("loaded_documents", JSON.stringify(documentSummary(loadedDocuments)));

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

  async function handleRunAuditClick() {
    if (!canRunAudit) {
      console.warn("Botón presionado pero canRunAudit es false");
      return;
    }

    await runAudit();
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
            onExtract={extractBaseDocument}
            onFileChange={selectBaseDocument}
            onManualCapture={useManualCapture}
            parseError={parseError}
            parseResult={parseResult}
          />
        ) : null}
        {step === 2 ? (
          <DocumentsStep
            basePdfPedimentoFile={basePdfPedimentoFile}
            documents={requiredDocuments}
            files={effectiveFiles}
            onChange={updateFile}
            title="Documentos soporte requeridos"
          />
        ) : null}
        {step === 3 ? <DocumentsStep basePdfPedimentoFile={null} documents={optionalDocuments} files={files} onChange={updateFile} title="Documentos opcionales / preferenciales" /> : null}
        {step === 4 ? (
          <ReviewStep
            auditReadinessDebug={auditReadinessDebug}
            data={xmlData}
            error={error}
            canRunAudit={canRunAudit}
            isRunning={isRunning}
            loadedDocuments={loadedDocuments}
            missingRequiredDocuments={missingRequiredDocuments}
            onRun={handleRunAuditClick}
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
  onExtract,
  onFileChange,
  onManualCapture,
  parseError,
  parseResult,
}: {
  baseDocumentKind: BaseDocumentKind;
  data: PedimentoXmlData;
  fileName?: string;
  isParsing: boolean;
  onChange: (key: keyof PedimentoXmlData, value: string) => void;
  onExtract: () => void;
  onFileChange: (file?: File) => void;
  onManualCapture: () => void;
  parseError: ParseError | null;
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

      <button
        className="mt-4 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!fileName || isParsing}
        onClick={onExtract}
        type="button"
      >
        {isParsing ? "Extrayendo datos..." : "Extraer datos del pedimento"}
      </button>

      {parseError ? <ParseErrorCard error={parseError} onManualCapture={onManualCapture} /> : null}

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
            longTextKey(field.key) ? (
              <TextAreaField
                key={field.key}
                label={field.label}
                missing={parseResult ? parseResult.missing_fields.includes(field.key) : false}
                onChange={(value) => onChange(field.key, value)}
                value={stringValue(data[field.key])}
              />
            ) : (
              <TextField
                key={field.key}
                label={field.label}
                missing={parseResult ? parseResult.missing_fields.includes(field.key) : false}
                onChange={(value) => onChange(field.key, value)}
                value={stringValue(data[field.key])}
              />
            )
          ))}
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Fracciones arancelarias</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => onChange("tariff_items", event.target.value)}
              value={data.tariff_items.join(", ")}
            />
          </label>
          <ArrayTextAreaField label="Proveedores detectados" onChange={(value) => onChange("providers", value)} value={data.providers.join("\n")} />
          <ArrayTextAreaField label="Facturas detectadas" onChange={(value) => onChange("invoices", value)} value={data.invoices.join("\n")} />
          <ArrayTextAreaField label="COVEs detectados" onChange={(value) => onChange("coves", value)} value={data.coves.join("\n")} />
          {data.invoice_details.length > 0 ? <InvoiceDetailsTable invoices={data.invoice_details} /> : null}
        </div>
      </div>
    </div>
  );
}

function ParseErrorCard({ error, onManualCapture }: { error: ParseError; onManualCapture: () => void }) {
  const isWarning = error.code === "CFDI_INVALID_FOR_STEP_1";

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${isWarning ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
      <p className={`text-sm font-semibold ${isWarning ? "text-amber-900" : "text-red-900"}`}>No se pudo procesar el documento base</p>
      <p className={`mt-2 text-sm leading-6 ${isWarning ? "text-amber-800" : "text-red-800"}`}>{error.message}</p>
      {!isWarning ? (
        <button
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={onManualCapture}
          type="button"
        >
          Usar captura manual
        </button>
      ) : null}
    </div>
  );
}

function DocumentsStep({
  basePdfPedimentoFile,
  documents,
  files,
  onChange,
  title,
}: {
  basePdfPedimentoFile: File | null;
  documents: DocumentSlot[];
  files: Partial<Record<SupportDocumentType, File>>;
  onChange: (documentType: SupportDocumentType, file?: File) => void;
  title: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      {basePdfPedimentoFile ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">
          El PDF del pedimento cargado en el Paso 1 se utilizará como documento base y soporte documental.
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {documents.map((document) => {
          const isReusedPedimentoPdf = document.documentType === "pedimento" && Boolean(basePdfPedimentoFile);

          return (
            <label
              className={`block rounded-2xl border border-dashed p-4 ${
                isReusedPedimentoPdf ? "border-emerald-200 bg-emerald-50" : "border-slate-300 bg-slate-50"
              }`}
              key={document.documentType}
            >
              <span className={`text-sm font-semibold ${isReusedPedimentoPdf ? "text-emerald-900" : "text-slate-800"}`}>{document.label}</span>
              {isReusedPedimentoPdf ? (
                <span className="mt-3 block text-sm font-medium text-emerald-800">Usando el PDF cargado en Paso 1</span>
              ) : (
                <input
                  accept={document.accept}
                  className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  onChange={(event) => onChange(document.documentType, event.target.files?.[0])}
                  type="file"
                />
              )}
              <span className="mt-3 block text-xs text-slate-500">{files[document.documentType]?.name ?? "Pendiente de carga"}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({
  auditReadinessDebug,
  canRunAudit,
  data,
  error,
  isRunning,
  loadedDocuments,
  missingRequiredDocuments,
  onRun,
  result,
  baseDocumentKind,
  baseFileName,
}: {
  auditReadinessDebug: AuditReadinessDebug;
  canRunAudit: boolean;
  data: PedimentoXmlData;
  error: string;
  isRunning: boolean;
  loadedDocuments: LoadedDocument[];
  missingRequiredDocuments: DocumentSlot[];
  onRun: () => void | Promise<void>;
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
                {document.reusedFromBase ? <span className="mt-1 block text-xs font-semibold text-emerald-700">Reutilizado desde Paso 1</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
      {missingRequiredDocuments.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Documentos faltantes</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            La auditoría se ejecutará con brechas documentales por documentos no cargados. Puedes ejecutar la auditoría; los documentos faltantes se reportarán como hallazgos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingRequiredDocuments.map((document) => (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800" key={document.documentType}>
                {document.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">{result.compliance_percent}% cumplimiento · Riesgo {result.risk_level}</p>
          <p className="mt-2 leading-6">{result.executive_dictamen}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className={`mt-5 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
          isRunning
            ? "bg-slate-300 cursor-not-allowed"
            : "bg-slate-900 hover:bg-slate-800"
        }`}
      >
        {isRunning ? "Ejecutando auditoría..." : "Ejecutar auditoría"}
      </button>
      <p className="mt-3 text-sm font-medium text-emerald-700">
        Listo para ejecutar auditoría.
      </p>
      {!canRunAudit && !isRunning && auditReadinessDebug.missingReasons.length > 0 ? (
        <p className="mt-3 text-sm font-medium text-amber-700">
          No se puede ejecutar porque falta: {auditReadinessDebug.missingReasons.join(" / ")}
        </p>
      ) : null}
      {process.env.NODE_ENV !== "production" ? <AuditDebugPanel debug={auditReadinessDebug} /> : null}
    </div>
  );
}

function AuditDebugPanel({ debug }: { debug: AuditReadinessDebug }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Debug ejecución auditoría</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
        <DebugRow label="baseFile exists" value={String(debug.baseFileExists)} />
        <DebugRow label="baseFileName" value={debug.baseFileName || "(vacío)"} />
        <DebugRow label="pedimento_number" value={debug.pedimentoNumber || "(vacío)"} />
        <DebugRow label="operation_code" value={debug.operationCode || "(vacío)"} />
        <DebugRow label="baseDocumentKind" value={debug.baseDocumentKind || "(vacío)"} />
        <DebugRow label="isCfdiInvalid" value={String(debug.isCfdiInvalid)} />
        <DebugRow label="isParsing" value={String(debug.isParsing)} />
        <DebugRow label="isRunning" value={String(debug.isRunning)} />
        <DebugRow label="canRunAudit" value={String(debug.canRunAudit)} />
      </div>
    </section>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="mt-1 block break-words font-mono text-slate-900">{value}</span>
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

function TextAreaField({
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
    <label className="block md:col-span-2">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
        {label}
        {missing ? <span className="text-xs font-medium text-amber-600">Faltante</span> : null}
      </span>
      <textarea
        className="mt-2 min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function ArrayTextAreaField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function InvoiceDetailsTable({ invoices }: { invoices: InvoiceDetail[] }) {
  return (
    <div className="md:col-span-2">
      <p className="text-sm font-semibold text-slate-700">Detalle de facturas</p>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Factura</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Incoterm</th>
              <th className="px-3 py-2">Moneda</th>
              <th className="px-3 py-2">Importe</th>
              <th className="px-3 py-2">Valor USD</th>
              <th className="px-3 py-2">COVE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {invoices.map((invoice, index) => (
              <tr key={`${invoice.invoice_number ?? "invoice"}-${index}`}>
                <td className="px-3 py-2 font-medium text-slate-900">{invoice.invoice_number}</td>
                <td className="px-3 py-2">{invoice.date}</td>
                <td className="px-3 py-2">{invoice.incoterm}</td>
                <td className="px-3 py-2">{invoice.currency}</td>
                <td className="px-3 py-2">{simpleStringValue(invoice.amount ?? null)}</td>
                <td className="px-3 py-2">{simpleStringValue(invoice.usd_value ?? null)}</td>
                <td className="px-3 py-2">{invoice.cove}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function longTextKey(key: keyof PedimentoXmlData) {
  return key === "importer_name";
}

function documentSummary(documents: (DocumentSlot & { file?: File })[]) {
  return documents.map((document) => ({
    document_type: document.documentType,
    file_name: document.file?.name ?? null,
    label: document.label,
  }));
}

function numberOrNull(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringValue(value: PedimentoXmlData[keyof PedimentoXmlData]) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value === null ? "" : String(value);
}

function simpleStringValue(value: number | string | null) {
  return value === null ? "" : String(value);
}

function operationCodeFromPedimento(pedimentoNumber: string, importDate: string) {
  const fullYear = importDate.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  const shortYear = importDate.match(/[/-](\d{2})$/)?.[1];
  const year = fullYear ?? (shortYear ? `20${shortYear}` : String(new Date().getFullYear()));
  const digits = pedimentoNumber.replace(/\D/g, "");
  return digits ? `IMP-${year}-${digits}` : "";
}

function parsingErrorMessage(code: string) {
  if (code === "PDF_TEXT_NOT_EXTRACTABLE") {
    return "No fue posible extraer texto del PDF. El archivo puede estar escaneado o usar una codificación no compatible. Puedes cargar el XML del pedimento, capturar los datos manualmente o continuar adjuntando el PDF como soporte.";
  }

  if (code === "PEDIMENTO_FILE_MUST_BE_PDF_OR_XML") {
    return "Carga un archivo XML o PDF de pedimento.";
  }

  if (code === "AUDIT_API_NOT_CONFIGURED") {
    return "El servicio externo de parsing no está configurado.";
  }

  if (code === "AUDIT_API_UNREACHABLE") {
    return "No se pudo conectar con el servicio externo de parsing.";
  }

  return "No se pudo extraer información del pedimento.";
}

function kindFromDocumentType(documentType?: string): BaseDocumentKind {
  const normalized = documentType?.toUpperCase() ?? "";

  if (normalized === "XML_PEDIMENTO" || normalized === "PEDIMENTO_XML") {
    return "xml_pedimento";
  }

  if (normalized === "PDF_PEDIMENTO" || normalized === "PEDIMENTO_PDF") {
    return "pdf_pedimento";
  }

  if (normalized === "CFDI" || normalized === "CFDI_XML") {
    return "cfdi_invalid";
  }

  return "";
}
