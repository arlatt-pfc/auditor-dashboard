"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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

type EvidenceType = "primary" | "complementary";
type DocumentCriticality = "mandatory" | "recommended";

type DocumentSlot = {
  accept: string;
  criticality: DocumentCriticality;
  description: string;
  documentType: SupportDocumentType;
  evidenceType: EvidenceType;
  examples: string[];
  label: string;
};

type LoadedDocument = DocumentSlot & {
  existingDocument?: ExistingDocument;
  files?: File[];
  reusedFromBase?: boolean;
  reusedFromPrevious?: boolean;
};

type AuditResult = {
  compliance_percent: number;
  executive_dictamen: string;
  execution_log?: AuditExecutionLog[];
  findings?: (AuditFinding | string)[];
  persisted: boolean;
  report_pdf_url: string | null;
  risk_level: string;
  top_critical_gaps: string[];
};

type AuditFinding = {
  description?: string;
  evidence?: Record<string, unknown>;
  recommendation?: string;
  severity?: "Critical" | "High" | "Medium" | "Low" | string;
  title?: string;
};

type AuditExecutionLog = {
  duration_ms?: number | null;
  message?: string;
  metadata_json?: Record<string, unknown>;
  stage?: string;
  status?: string;
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

type ExistingDocument = {
  document_type?: string;
  file_name?: string | null;
  files?: { file_name?: string | null }[];
  label?: string;
};

export type CustomsRerunContext = {
  auditGroupId: string;
  currentAuditVersion: number;
  loadedDocuments: unknown[];
  missingDocuments: unknown[];
  nextAuditVersion: number;
  parentAuditId: string;
  pedimentoData: Record<string, unknown>;
  previousCompliancePercent: number;
  previousRiskLevel: string;
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
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Copia oficial del pedimento para cotejar contra el documento base.",
    documentType: "pedimento",
    evidenceType: "primary",
    examples: ["Pedimento pagado", "Pedimento simplificado"],
    label: "Pedimento PDF",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "mandatory",
    description: "Evidencia comercial del proveedor para validar valor, moneda e incoterm.",
    documentType: "commercial_invoice",
    evidenceType: "primary",
    examples: ["Commercial invoice", "Factura de proveedor"],
    label: "Facturas comerciales",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Documento de transporte usado para confirmar embarque, origen y consignatario.",
    documentType: "bill_of_lading",
    evidenceType: "primary",
    examples: ["Bill of Lading", "Air Waybill", "Carta porte internacional"],
    label: "Bill of Lading / documento transporte",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "mandatory",
    description: "Documento del agente aduanal con gastos, contribuciones y conceptos cobrados.",
    documentType: "broker_expense_account",
    evidenceType: "primary",
    examples: ["Cuenta de gastos", "Estado de cuenta del agente"],
    label: "Cuenta de gastos",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Representacion impresa del CFDI emitido por el agente aduanal.",
    documentType: "cfdi_pdf",
    evidenceType: "primary",
    examples: ["CFDI honorarios PDF", "CFDI gastos PDF"],
    label: "CFDI PDF del agente",
  },
  {
    accept: "application/xml,text/xml,.xml",
    criticality: "recommended",
    description: "Archivo fiscal estructurado para validar datos timbrados del agente.",
    documentType: "cfdi_xml",
    evidenceType: "primary",
    examples: ["CFDI honorarios XML", "CFDI gastos XML"],
    label: "CFDI XML del agente",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Soporte tecnico o descriptivo para identificar mercancias y atributos.",
    documentType: "data_sheet",
    evidenceType: "complementary",
    examples: ["Ficha tecnica", "Catalogo", "Especificaciones"],
    label: "Hoja de datos",
  },
];

const optionalDocuments: DocumentSlot[] = [
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Evidencia de origen para trato preferencial cuando aplique.",
    documentType: "certificate_of_origin",
    evidenceType: "primary",
    examples: ["Certificacion T-MEC", "Certificado de origen"],
    label: "Certificado de origen T-MEC",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Acuse o comprobante COVE asociado a las facturas comerciales.",
    documentType: "cove",
    evidenceType: "primary",
    examples: ["Acuse COVE", "Detalle COVE"],
    label: "COVE",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Documentos adicionales para soportar clasificacion, valor u operacion.",
    documentType: "annex",
    evidenceType: "complementary",
    examples: ["Fotografias", "Cartas aclaratorias", "Correos soporte"],
    label: "Anexos",
  },
  {
    accept: "application/pdf,.pdf",
    criticality: "recommended",
    description: "Factura del forwarder para validar cargos logisticos relacionados.",
    documentType: "forwarding_invoice",
    evidenceType: "complementary",
    examples: ["Invoice forwarder", "Cargos de flete", "Handling"],
    label: "Factura forwarding",
  },
];

const minimumSupportDocumentTypes = new Set<SupportDocumentType>(["commercial_invoice", "broker_expense_account"]);

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

const evidenceTypeMeta: Record<EvidenceType, { badgeClass: string; cardClass: string; iconClass: string; label: string; tooltip: string }> = {
  complementary: {
    badgeClass: "bg-violet-50 text-violet-700 ring-violet-200",
    cardClass: "border-violet-200 bg-violet-50/40",
    iconClass: "bg-violet-100 text-violet-700",
    label: "Complementaria",
    tooltip: "Documentación de apoyo para robustecer el expediente.",
  },
  primary: {
    badgeClass: "bg-blue-50 text-blue-700 ring-blue-200",
    cardClass: "border-blue-200 bg-blue-50/40",
    iconClass: "bg-blue-100 text-blue-700",
    label: "Primaria",
    tooltip: "Evidencia oficial emitida por terceros.",
  },
};

const criticalityMetaByType: Record<DocumentCriticality, { badgeClass: string; label: string; tooltip: string }> = {
  mandatory: {
    badgeClass: "bg-red-50 text-red-700 ring-red-200",
    label: "Obligatorio",
    tooltip: "Bloquea la auditoría cuando forma parte de la evidencia mínima.",
  },
  recommended: {
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Recomendado",
    tooltip: "No bloquea la auditoría; si falta, se reporta como brecha documental.",
  },
};

const customsAuditEndpoint = "https://api.logisticadedatos.com.mx/audit/run";
const auditProgressSteps = ["Recibiendo expediente", "Procesando OCR", "Extrayendo facturas", "Aplicando reglas", "Generando resultado"];

export function CustomsExpedientWizard({ canExecute, rerunContext }: { canExecute: boolean; rerunContext?: CustomsRerunContext }) {
  void canExecute;

  const router = useRouter();
  const [step, setStep] = useState(1);
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [baseDocumentKind, setBaseDocumentKind] = useState<BaseDocumentKind>("");
  const [xmlData, setXmlData] = useState<PedimentoXmlData>(() => normalizePedimentoData(rerunContext?.pedimentoData));
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [files, setFiles] = useState<Partial<Record<SupportDocumentType, File[]>>>({});
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [customsAuditId, setCustomsAuditId] = useState("");
  const [auditProgressIndex, setAuditProgressIndex] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setAuditProgressIndex((current) => Math.min(current + 1, auditProgressSteps.length - 1));
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  const data = xmlData;
  const normalizedPedimentoNumber = (xmlData.pedimento_number || data.pedimento_number || "").trim();
  const normalizedOperationCode = (xmlData.operation_code || data.operation_code || "").trim();
  const hasPedimentoNumber = normalizedPedimentoNumber.length > 0;
  const isCfdiInvalid = baseDocumentKind === "cfdi_invalid";
  const basePdfPedimentoFile = baseDocumentKind === "pdf_pedimento" ? baseFile : null;
  const existingDocumentsByType = useMemo(() => existingDocumentMap(rerunContext?.loadedDocuments), [rerunContext?.loadedDocuments]);
  const effectiveFiles = useMemo(
    () => ({
      ...files,
      ...(basePdfPedimentoFile && !hasFiles(files.pedimento) ? { pedimento: [basePdfPedimentoFile] } : {}),
    }),
    [basePdfPedimentoFile, files],
  );
  const canRunAudit = hasMinimumAuditData() && !isRunning;
  const missingAuditReasons = [
    !baseFile && !rerunContext ? "archivo base" : "",
    normalizedPedimentoNumber.length === 0 ? "pedimento" : "",
    normalizedOperationCode.length === 0 ? "código expediente" : "",
    isCfdiInvalid ? "documento válido" : "",
    !hasDocument("commercial_invoice") ? "factura comercial" : "",
    !hasDocument("broker_expense_account") ? "cuenta de gastos" : "",
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
      (Boolean(baseFile) || Boolean(rerunContext)) &&
      Boolean((xmlData.pedimento_number || "").trim()) &&
      Boolean((xmlData.operation_code || "").trim()) &&
      baseDocumentKind !== "cfdi_invalid" &&
      hasDocument("commercial_invoice") &&
      hasDocument("broker_expense_account")
    );
  }
  function hasDocument(documentType: SupportDocumentType) {
    return hasFiles(effectiveFiles[documentType]) || existingDocumentsByType.has(documentType);
  }
  const stepOneCanContinue = hasPedimentoNumber && baseDocumentKind !== "cfdi_invalid";
  const missingRequiredDocuments = useMemo(
    () =>
      requiredDocuments.filter(
        (document) => minimumSupportDocumentTypes.has(document.documentType) && !hasFiles(effectiveFiles[document.documentType]) && !existingDocumentsByType.has(document.documentType),
      ),
    [effectiveFiles, existingDocumentsByType],
  );
  const missingSupportDocuments = useMemo(
    () =>
      [
        ...requiredDocuments.filter(
          (document) => document.documentType !== "pedimento" && !minimumSupportDocumentTypes.has(document.documentType),
        ),
        ...optionalDocuments,
      ].filter((document) => !hasFiles(effectiveFiles[document.documentType]) && !existingDocumentsByType.has(document.documentType)),
    [effectiveFiles, existingDocumentsByType],
  );
  const loadedDocuments = useMemo(
    () =>
      [...requiredDocuments, ...optionalDocuments]
        .map((document) => ({
          ...document,
          existingDocument: existingDocumentsByType.get(document.documentType),
          files: effectiveFiles[document.documentType],
          reusedFromBase: document.documentType === "pedimento" && Boolean(basePdfPedimentoFile) && !hasFiles(files.pedimento),
          reusedFromPrevious: !hasFiles(effectiveFiles[document.documentType]) && existingDocumentsByType.has(document.documentType),
        }))
        .filter((document) => hasFiles(document.files) || document.reusedFromPrevious),
    [basePdfPedimentoFile, effectiveFiles, existingDocumentsByType, files.pedimento],
  );
  const documentsAdded = useMemo(
    () =>
      [...requiredDocuments, ...optionalDocuments]
        .map((document) => ({
          ...document,
          files: files[document.documentType],
        }))
        .filter((document) => hasFiles(document.files)),
    [files],
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
    setCustomsAuditId("");
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

  function updateFiles(documentType: SupportDocumentType, selectedFiles: File[]) {
    if (selectedFiles.length === 0) {
      return;
    }

    setFiles((current) => ({
      ...current,
      [documentType]: [...(current[documentType] ?? []), ...selectedFiles],
    }));
    setResult(null);
    setCustomsAuditId("");
    setError("");
  }

  function removeFile(documentType: SupportDocumentType, fileIndex: number) {
    setFiles((current) => {
      const nextFiles = (current[documentType] ?? []).filter((_, index) => index !== fileIndex);

      return {
        ...current,
        [documentType]: nextFiles,
      };
    });
    setResult(null);
    setCustomsAuditId("");
    setError("");
  }

  async function runAudit() {
    console.log("[customs.audit.run.start]");
    console.log("AUDIT_READY", {
      baseDocumentKind,
      baseFile: Boolean(baseFile),
      canRunAudit,
      isRunning,
      operation_code: xmlData.operation_code,
      pedimento_number: xmlData.pedimento_number,
    });

    if (!hasMinimumAuditData()) {
      setError("Para ejecutar auditoría se requiere como mínimo pedimento, factura comercial y cuenta de gastos.");
      return;
    }

    const selectedBaseFile = baseFile ?? (rerunContext ? rerunBaseFile(xmlData) : null);

    if (!selectedBaseFile) {
      setError("Para ejecutar auditoría se requiere como mínimo pedimento, factura comercial y cuenta de gastos.");
      return;
    }

    setIsRunning(true);
    setAuditProgressIndex(0);
    setError("");
    setCustomsAuditId("");

    const formData = new FormData();
    if (baseDocumentKind === "xml_pedimento") {
      formData.append("pedimento_xml", selectedBaseFile, selectedBaseFile.name);
    }

    const selectedPedimentoFile = files.pedimento?.[0] ?? selectedBaseFile;
    formData.append("file", selectedPedimentoFile, selectedPedimentoFile.name);
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
    formData.append("missing_support_documents", JSON.stringify(documentSummary(missingSupportDocuments)));
    formData.append("loaded_documents", JSON.stringify(documentSummary(loadedDocuments)));
    formData.append("support_file_metadata", JSON.stringify(supportFileMetadata(files)));

    for (const [documentType, documentFiles] of Object.entries(files)) {
      for (const file of documentFiles ?? []) {
        formData.append("support_files", file, file.name);
        formData.append("support_document_types", documentType);
      }
    }

    console.log("[customs.audit.fetch.start]", {
      endpoint: customsAuditEndpoint,
      hasBaseFile: Boolean(baseFile),
      operationCode: xmlData.operation_code,
      pedimentoNumber: xmlData.pedimento_number,
    });

    let response: Response;

    try {
      response = await fetch(customsAuditEndpoint, {
        body: formData,
        headers: {
          "X-LDA-Audit-Client": "customs-dashboard",
        },
        method: "POST",
      });
      console.log("[customs.audit.fetch.response]", {
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      console.error("[customs.audit.run.error]", error);
      setIsRunning(false);
      setError("No se pudo ejecutar la auditoria externa.");
      return;
    }

    setIsRunning(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
      setError(payload?.detail ?? payload?.error ?? "No se pudo ejecutar la auditoria externa.");
      return;
    }

    const payload = (await response.json()) as AuditResult;
    setResult(payload);
    const persistedAuditId = await persistCustomsAudit(payload);
    setCustomsAuditId(persistedAuditId);
    if (rerunContext && persistedAuditId) {
      router.push(`/dashboard/customs-compliance/${encodeURIComponent(persistedAuditId)}`);
      return;
    }
    router.refresh();
  }

  async function persistCustomsAudit(auditResult: AuditResult) {
    const response = await fetch("/api/customs/audits", {
      body: JSON.stringify({
        auditGroupId: rerunContext?.auditGroupId,
        auditResult,
        documentsAdded: documentSummary(documentsAdded),
        executionLog: auditResult.execution_log ?? [],
        loadedDocuments: documentSummary(loadedDocuments),
        missingDocuments: documentSummary([...missingRequiredDocuments, ...missingSupportDocuments]),
        parentAuditId: rerunContext?.parentAuditId,
        pedimentoData: xmlData,
        rerunReason: rerunContext ? "Reauditoría de expediente con documentos agregados o reemplazados." : "",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
      console.error("[customs.audit.persist.error]", payload?.error ?? "CUSTOMS_AUDIT_PERSIST_FAILED");
      return "";
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    return payload?.id ?? "";
  }

  async function generateReportPdf() {
    if (!result) {
      return;
    }

    setIsGeneratingPdf(true);
    setError("");

    const response = await fetch("/api/reports/customs-pdf", {
      body: JSON.stringify({
        auditResult: result,
        loadedDocuments: documentSummary(loadedDocuments),
        missingDocuments: documentSummary([...missingRequiredDocuments, ...missingSupportDocuments]),
        pedimentoData: {
          ...xmlData,
          audit_group_id: rerunContext?.auditGroupId,
          audit_version: rerunContext?.nextAuditVersion,
          is_latest: true,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    setIsGeneratingPdf(false);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "No se pudo generar el reporte PDF.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFilename(xmlData.operation_code || xmlData.pedimento_number);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {rerunContext?.parentAuditId ? <RerunSummaryCard context={rerunContext} data={xmlData} /> : null}

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
            rerunContext={rerunContext}
          />
        ) : null}
        {step === 2 ? (
          <DocumentsStep
            basePdfPedimentoFile={basePdfPedimentoFile}
            documents={requiredDocuments}
            existingDocumentsByType={existingDocumentsByType}
            files={effectiveFiles}
            onChange={updateFiles}
            onRemove={removeFile}
            rerunContext={rerunContext}
            title="Documentos soporte requeridos"
          />
        ) : null}
        {step === 3 ? (
          <DocumentsStep
            basePdfPedimentoFile={null}
            documents={optionalDocuments}
            existingDocumentsByType={existingDocumentsByType}
            files={files}
            onChange={updateFiles}
            onRemove={removeFile}
            rerunContext={rerunContext}
            title="Documentos opcionales / preferenciales"
          />
        ) : null}
        {step === 4 ? (
          <ReviewStep
            auditProgressIndex={auditProgressIndex}
            auditReadinessDebug={auditReadinessDebug}
            data={xmlData}
            error={error}
            canRunAudit={canRunAudit}
            customsAuditId={customsAuditId}
            isGeneratingPdf={isGeneratingPdf}
            isRunning={isRunning}
            loadedDocuments={loadedDocuments}
            missingRequiredDocuments={missingRequiredDocuments}
            missingSupportDocuments={missingSupportDocuments}
            onGenerateReport={generateReportPdf}
            onRun={runAudit}
            result={result}
            baseDocumentKind={baseDocumentKind}
            baseFileName={baseFile?.name}
            rerunContext={rerunContext}
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
  rerunContext,
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
  rerunContext?: CustomsRerunContext;
}) {
  const missingCount = parseResult?.missing_fields.length ?? 0;

  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Cargar pedimento base</h3>
      {rerunContext ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Reauditoría del expediente</p>
          <p className="mt-2 text-sm leading-6 text-emerald-800">
            Se precargaron los datos del pedimento y la evidencia registrada. Puedes cargar un nuevo pedimento si quieres reemplazar el documento base.
          </p>
        </div>
      ) : null}
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
  existingDocumentsByType,
  files,
  onChange,
  onRemove,
  rerunContext,
  title,
}: {
  basePdfPedimentoFile: File | null;
  documents: DocumentSlot[];
  existingDocumentsByType: Map<SupportDocumentType, ExistingDocument>;
  files: Partial<Record<SupportDocumentType, File[]>>;
  onChange: (documentType: SupportDocumentType, files: File[]) => void;
  onRemove: (documentType: SupportDocumentType, fileIndex: number) => void;
  rerunContext?: CustomsRerunContext;
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
      {rerunContext ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Los documentos ya cargados se conservan desde la versión anterior. Puedes agregar faltantes o cargar nuevos archivos para reemplazar evidencia existente.
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {documents.map((document) => {
          const isReusedPedimentoPdf = document.documentType === "pedimento" && Boolean(basePdfPedimentoFile);
          const documentFiles = files[document.documentType] ?? [];
          const existingDocument = existingDocumentsByType.get(document.documentType);
          const previousFileNames = existingDocumentFileNames(existingDocument);
          const evidenceMeta = evidenceTypeMeta[document.evidenceType];
          const criticalityMeta = criticalityMetaByType[document.criticality];

          return (
            <div
              className={`block rounded-2xl border border-dashed p-4 transition ${
                isReusedPedimentoPdf ? "border-emerald-200 bg-emerald-50" : evidenceMeta.cardClass
              }`}
              key={document.documentType}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${evidenceMeta.iconClass}`}>
                  <EvidenceIcon type={document.evidenceType} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${isReusedPedimentoPdf ? "text-emerald-900" : "text-slate-900"}`}>{document.label}</span>
                    <DocumentBadge className={evidenceMeta.badgeClass} title={evidenceMeta.tooltip}>
                      {evidenceMeta.label}
                    </DocumentBadge>
                    <DocumentBadge className={criticalityMeta.badgeClass} title={criticalityMeta.tooltip}>
                      <CriticalityIcon type={document.criticality} />
                      {criticalityMeta.label}
                    </DocumentBadge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{document.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Ejemplos:</span> {document.examples.join(", ")}
                  </p>
                </div>
              </div>
              {isReusedPedimentoPdf ? (
                <span className="mt-3 block text-sm font-medium text-emerald-800">Usando el PDF cargado en Paso 1</span>
              ) : (
                <>
                  {existingDocument ? (
                    <div className="mt-3 rounded-xl border border-white bg-white/80 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700">Cargado en versión anterior</p>
                      <ul className="mt-1 space-y-1">
                        {previousFileNames.map((fileName, index) => (
                          <li className="break-all text-xs text-slate-500" key={`${fileName}-${index}`}>
                            {fileName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <input
                    accept={document.accept}
                    className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                    multiple
                    onChange={(event) => {
                      onChange(document.documentType, Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                    type="file"
                  />
                  {existingDocument ? <p className="mt-2 text-xs font-medium text-slate-500">Los archivos nuevos reemplazarán esta evidencia para la nueva versión.</p> : null}
                </>
              )}
              {documentFiles.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">{documentFiles.length} archivo{documentFiles.length === 1 ? "" : "s"} cargado{documentFiles.length === 1 ? "" : "s"}</p>
                  <ul className="space-y-2">
                    {documentFiles.map((file, index) => (
                      <li className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600" key={`${file.name}-${index}`}>
                        <span className="break-all">{file.name}</span>
                        {!isReusedPedimentoPdf ? (
                          <button
                            className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => onRemove(document.documentType, index)}
                            type="button"
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span className="mt-3 block text-xs text-slate-500">Pendiente de carga</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentBadge({ children, className, title }: { children: ReactNode; className: string; title: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`} title={title}>
      {children}
    </span>
  );
}

function EvidenceIcon({ type }: { type: EvidenceType }) {
  if (type === "primary") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 3 5.5 5.5v5.8c0 4.4 2.7 7.3 6.5 9.7 3.8-2.4 6.5-5.3 6.5-9.7V5.5L12 3Z" />
        <path d="m9.2 12.1 1.8 1.8 3.9-4.1" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M7 5.5h10a2 2 0 0 1 2 2v9.5H7a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z" />
      <path d="M8 8.5h8" />
      <path d="M8 12h6" />
      <path d="M5 17h14" />
    </svg>
  );
}

function CriticalityIcon({ type }: { type: DocumentCriticality }) {
  if (type === "mandatory") {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 4 3 20h18L12 4Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 8v4" />
      <path d="M12 15h.01" />
    </svg>
  );
}

function RerunSummaryCard({ context, data }: { context: CustomsRerunContext; data: PedimentoXmlData }) {
  const supplierName = data.providers[0] || firstString(context.pedimentoData.providers);
  const pendingGaps = context.missingDocuments.length;
  const rows = [
    ["Expediente", data.operation_code],
    ["Grupo auditoría", context.auditGroupId],
    ["Versión actual", `v${context.currentAuditVersion}`],
    ["Siguiente versión", `v${context.nextAuditVersion}`],
    ["Pedimento", data.pedimento_number],
    ["Fecha pedimento", data.import_date || data.payment_date],
    ["Importador", data.importer_name],
    ["Agente aduanal", data.broker_name],
    ["Proveedor principal", supplierName],
    ["Riesgo anterior", context.previousRiskLevel],
    ["Brechas pendientes", pendingGaps > 0 ? String(pendingGaps) : ""],
  ].filter(([, value]) => Boolean(value));

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-emerald-950">Reauditoría de Expediente</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              v{context.currentAuditVersion} → v{context.nextAuditVersion}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-800">
            Está generando una nueva versión del expediente utilizando la información previamente cargada. Puede agregar documentos faltantes o reemplazar evidencias existentes.
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-emerald-200">
          <p className="text-xs font-semibold uppercase text-emerald-700">Cumplimiento anterior</p>
          <p className="mt-1 text-2xl font-bold text-emerald-950">{Math.round(context.previousCompliancePercent)}%</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-100" key={label}>
            <p className="text-xs font-semibold uppercase text-emerald-700">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-emerald-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewStep({
  auditProgressIndex,
  auditReadinessDebug,
  canRunAudit,
  customsAuditId,
  data,
  error,
  isGeneratingPdf,
  isRunning,
  loadedDocuments,
  missingRequiredDocuments,
  missingSupportDocuments,
  onGenerateReport,
  onRun,
  result,
  baseDocumentKind,
  baseFileName,
  rerunContext,
}: {
  auditProgressIndex: number;
  auditReadinessDebug: AuditReadinessDebug;
  canRunAudit: boolean;
  customsAuditId: string;
  data: PedimentoXmlData;
  error: string;
  isGeneratingPdf: boolean;
  isRunning: boolean;
  loadedDocuments: LoadedDocument[];
  missingRequiredDocuments: DocumentSlot[];
  missingSupportDocuments: DocumentSlot[];
  onGenerateReport: () => void | Promise<void>;
  onRun: () => void | Promise<void>;
  result: AuditResult | null;
  baseDocumentKind: BaseDocumentKind;
  baseFileName?: string;
  rerunContext?: CustomsRerunContext;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">Revisión y ejecutar auditoría</h3>
      {rerunContext ? (
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Esta auditoría generará la versión v{rerunContext.nextAuditVersion} del expediente.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-800">
            Se conservará el grupo de auditoría y se comparará la nueva ejecución contra la versión anterior.
          </p>
        </section>
      ) : null}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Resumen del pedimento base</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <ReviewRow label="Documento base" value={baseFileName ?? (rerunContext ? "Pedimento precargado de versión anterior" : "Pendiente")} />
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
                <span className="mt-1 block text-xs font-semibold">{document.files?.length ?? 0} archivo{document.files?.length === 1 ? "" : "s"}</span>
                <ul className="mt-1 space-y-1">
                {(document.files ?? []).map((file, index) => (
                  <li className="break-all text-xs" key={`${file.name}-${index}`}>{file.name}</li>
                ))}
                {document.reusedFromPrevious ? existingDocumentFileNames(document.existingDocument).map((fileName, index) => (
                  <li className="break-all text-xs" key={`${fileName}-${index}`}>
                    {fileName}
                  </li>
                )) : null}
              </ul>
              {document.reusedFromBase ? <span className="mt-1 block text-xs font-semibold text-emerald-700">Reutilizado desde Paso 1</span> : null}
              {document.reusedFromPrevious ? <span className="mt-1 block text-xs font-semibold text-emerald-700">Conservado desde versión anterior</span> : null}
            </div>
            ))}
          </div>
        </section>
      </div>
      {missingRequiredDocuments.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Evidencia mínima faltante</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">Para ejecutar auditoría se requiere como mínimo pedimento, factura comercial y cuenta de gastos.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingRequiredDocuments.map((document) => (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800" key={document.documentType}>
                {document.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {missingSupportDocuments.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-sky-900">Expediente parcial</p>
          <p className="mt-2 text-sm leading-6 text-sky-800">
            La auditoría se ejecutará con expediente parcial. Los documentos no cargados se reportarán como brechas documentales.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingSupportDocuments.map((document) => (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-800" key={document.documentType}>
                {document.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {isRunning ? <AuditProgressCard activeIndex={auditProgressIndex} /> : null}
      {result ? (
        <>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">{result.compliance_percent}% cumplimiento · Riesgo {result.risk_level}</p>
            <p className="mt-2 leading-6">{result.executive_dictamen}</p>
            {customsAuditId ? <p className="mt-2 text-xs font-medium text-emerald-800">Auditoría guardada: {customsAuditId}</p> : null}
          </div>
          <AuditFindingsCard findings={result.findings ?? []} />
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isGeneratingPdf}
            onClick={() => {
              void onGenerateReport();
            }}
            type="button"
          >
            <PdfButtonIcon />
            {isGeneratingPdf ? "Generando reporte..." : "Generar Reporte PDF"}
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          console.log("[customs.audit.button.click]", { isRunning });
          if (isRunning) return;
          void onRun();
        }}
        style={{
          backgroundColor: "#0f172a",
          color: "#ffffff",
          opacity: 1,
          cursor: isRunning ? "not-allowed" : "pointer",
          pointerEvents: "auto",
        }}
        className="mt-5 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg"
      >
        {isRunning ? "Ejecutando auditoría..." : "Ejecutar auditoría"}
      </button>
      {canRunAudit ? <p className="mt-3 text-sm font-medium text-emerald-700">Listo para ejecutar auditoría.</p> : null}
      {!canRunAudit && !isRunning ? (
        <p className="mt-3 text-sm font-medium text-amber-700">Para ejecutar auditoría se requiere como mínimo pedimento, factura comercial y cuenta de gastos.</p>
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

function AuditProgressCard({ activeIndex }: { activeIndex: number }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Ejecución en progreso</p>
        <span className="text-xs font-medium text-slate-500">{Math.min(activeIndex + 1, auditProgressSteps.length)} / {auditProgressSteps.length}</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-900 transition-all"
          style={{ width: `${((activeIndex + 1) / auditProgressSteps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-5">
        {auditProgressSteps.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <li
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              key={step}
            >
              {step}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AuditFindingsCard({ findings }: { findings: (AuditFinding | string)[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Hallazgos preliminares</p>
      {findings.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No se detectaron hallazgos preliminares.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((finding, index) => {
            const normalizedFinding = normalizeAuditFinding(finding, index);

            return (
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" key={`${normalizedFinding.title}-${index}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClass(normalizedFinding.severity)}`}>
                    {normalizedFinding.severity}
                  </span>
                  <span className="font-semibold text-slate-900">{normalizedFinding.title}</span>
                </div>
                <p className="mt-2 leading-6 text-slate-700">{normalizedFinding.description}</p>
                {normalizedFinding.variance.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {normalizedFinding.variance.map((item) => (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200" key={item.label}>
                        {item.label}: {item.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 leading-6 text-slate-600">
                  <span className="font-semibold text-slate-800">Recomendación: </span>
                  {normalizedFinding.recommendation}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PdfButtonIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 15h6" />
      <path d="M9 18h4" />
    </svg>
  );
}

function normalizeAuditFinding(finding: AuditFinding | string, index: number): Required<Omit<AuditFinding, "evidence">> & { evidence: Record<string, unknown>; variance: { label: string; value: string }[] } {
  if (typeof finding === "string") {
    return {
      description: finding,
      evidence: {},
      recommendation: "Revisar evidencia documental y registrar acción correctiva.",
      severity: "Medium",
      title: `Hallazgo ${index + 1}`,
      variance: [],
    };
  }

  const evidence = finding.evidence && typeof finding.evidence === "object" ? finding.evidence : {};

  return {
    description: finding.description || "Sin descripción disponible.",
    evidence,
    recommendation: finding.recommendation || "Sin recomendación disponible.",
    severity: finding.severity || "Medium",
    title: finding.title || `Hallazgo ${index + 1}`,
    variance: varianceItems(evidence),
  };
}

function varianceItems(evidence: Record<string, unknown>) {
  const varianceAmount = evidence.variance_amount ?? evidence.difference;
  return [
    ["Diferencia %", evidence.variance_percent],
    ["Diferencia", varianceAmount],
  ].flatMap(([label, value]) => (typeof value === "number" || typeof value === "string" ? [{ label: String(label), value: String(value) }] : []));
}

function severityClass(severity?: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    case "medium":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
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

function hasFiles(files?: File[]) {
  return Array.isArray(files) && files.length > 0;
}

function documentSummary(documents: (DocumentSlot & { existingDocument?: ExistingDocument; files?: File[]; reusedFromPrevious?: boolean })[]) {
  return documents.map((document) => ({
    criticality: document.criticality,
    description: document.description,
    document_type: document.documentType,
    evidence_type: document.evidenceType,
    examples: document.examples,
    file_name: document.files?.[0]?.name ?? document.existingDocument?.file_name ?? null,
    files: hasFiles(document.files)
      ? (document.files ?? []).map((file, index) => ({
          file_index: index,
          file_name: file.name,
        }))
      : (document.existingDocument?.files ?? []).map((file, index) => ({
          file_index: index,
          file_name: file.file_name ?? `Archivo ${index + 1}`,
        })),
    label: document.label,
    source: document.reusedFromPrevious ? "previous_version" : "current_upload",
  }));
}

function supportFileMetadata(files: Partial<Record<SupportDocumentType, File[]>>) {
  return Object.entries(files).flatMap(([documentType, documentFiles]) =>
    (documentFiles ?? []).map((file, index) => ({
      document_type: documentType,
      file_index: index,
      file_name: file.name,
    })),
  );
}

function reportFilename(expediente: string) {
  const safeExpediente = expediente.replace(/[^a-zA-Z0-9._-]+/g, "_") || "expediente";
  return `Reporte_Auditoria_${safeExpediente}.pdf`;
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

function firstString(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
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

function normalizePedimentoData(value?: Record<string, unknown>): PedimentoXmlData {
  if (!value) {
    return emptyXmlData;
  }

  return {
    ...emptyXmlData,
    broker_name: simpleString(value.broker_name),
    broker_person_name: simpleString(value.broker_person_name),
    broker_patent: simpleString(value.broker_patent),
    commercial_value_usd: nullableNumber(value.commercial_value_usd),
    paid_commercial_value_mxn: nullableNumber(value.paid_commercial_value_mxn),
    customs_office: simpleString(value.customs_office),
    customs_value_mxn: nullableNumber(value.customs_value_mxn),
    dta_mxn: nullableNumber(value.dta_mxn),
    exchange_rate: simpleString(value.exchange_rate) || nullableNumber(value.exchange_rate),
    igi_mxn: nullableNumber(value.igi_mxn),
    import_date: simpleString(value.import_date),
    importer_name: simpleString(value.importer_name),
    importer_rfc: simpleString(value.importer_rfc),
    iva_mxn: nullableNumber(value.iva_mxn),
    operation_code: simpleString(value.operation_code),
    payment_date: simpleString(value.payment_date),
    pedimento_full: simpleString(value.pedimento_full),
    pedimento_number: simpleString(value.pedimento_number),
    prv_mxn: nullableNumber(value.prv_mxn),
    coves: stringArray(value.coves),
    invoice_details: Array.isArray(value.invoice_details) ? (value.invoice_details as InvoiceDetail[]) : [],
    invoices: stringArray(value.invoices),
    providers: stringArray(value.providers),
    reference: simpleString(value.reference),
    tariff_items: stringArray(value.tariff_items),
    total_contributions_mxn: nullableNumber(value.total_contributions_mxn),
  };
}

function existingDocumentMap(documents?: unknown[]) {
  const map = new Map<SupportDocumentType, ExistingDocument>();

  for (const document of documents ?? []) {
    const row = document && typeof document === "object" && !Array.isArray(document) ? (document as ExistingDocument) : null;
    const documentType = row?.document_type;

    if (row && isSupportDocumentType(documentType)) {
      map.set(documentType, row);
    }
  }

  return map;
}

function existingDocumentFileNames(document?: ExistingDocument) {
  const fileNames = document?.files?.map((file) => file.file_name).filter((fileName): fileName is string => Boolean(fileName?.trim())) ?? [];
  const fallback = document?.file_name?.trim();

  if (fileNames.length > 0) {
    return fileNames;
  }

  return fallback ? [fallback] : ["Sin archivo registrado"];
}

function isSupportDocumentType(value: unknown): value is SupportDocumentType {
  return typeof value === "string" && [...requiredDocuments, ...optionalDocuments].some((document) => document.documentType === value);
}

function rerunBaseFile(data: PedimentoXmlData) {
  const expediente = data.operation_code || data.pedimento_number || "expediente";
  const body = `Reauditoria LDA Compliance\nExpediente: ${expediente}\nPedimento: ${data.pedimento_number}\n`;
  const pdf = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${body.length + 54} >>
stream
BT /F1 12 Tf 72 720 Td (${body.replace(/[()]/g, "")}) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

  return new File([pdf], `pedimento-base-${expediente}.pdf`, { type: "application/pdf" });
}

function simpleString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => simpleString(item)).filter(Boolean) : [];
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
