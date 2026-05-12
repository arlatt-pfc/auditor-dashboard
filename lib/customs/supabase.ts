import { supabaseInsert, supabaseSelect } from "@/lib/supabase/client";
import type {
  CreateCustomsDocumentPayload,
  CreateCustomsOperationPayload,
  CustomsDocumentType,
  CustomsFinding,
  CustomsFindingStatus,
  CustomsMetrics,
  CustomsOperation,
  CustomsOperationDocument,
  CustomsSeverity,
} from "@/lib/customs/types";

type CustomsRow = Record<string, unknown>;

const documentLabels: Record<CustomsDocumentType, string> = {
  broker_expense_account: "Cuenta de Gastos",
  broker_sla: "SLA del Agente Aduanal",
  certificate_of_origin: "Certificado de Origen T-MEC",
  commercial_invoice: "Factura Comercial",
  pedimento: "Pedimento",
};

export async function getCustomsOperations() {
  const rows = await supabaseSelect<CustomsRow>("customs_operations");

  return rows.map(mapOperation);
}

export async function getCustomsOperationById(id: string) {
  const rows = await supabaseSelect<CustomsRow>("customs_operations", {
    limit: 1,
    params: {
      or: `(id.eq.${id},operation_id.eq.${id})`,
    },
  });

  return rows[0] ? mapOperation(rows[0]) : null;
}

export async function getCustomsFindings(operationId: string) {
  const rows = await supabaseSelect<CustomsRow>("customs_findings", {
    eq: {
      operation_id: operationId,
    },
  });

  return rows.map(mapFinding);
}

export async function createCustomsOperation(payload: CreateCustomsOperationPayload) {
  const row = await supabaseInsert<CustomsRow>("customs_operations", payload);
  return row ? mapOperation(row) : null;
}

export async function createCustomsDocument(payload: CreateCustomsDocumentPayload) {
  return supabaseInsert<CustomsRow>("customs_documents", payload);
}

function mapOperation(row: CustomsRow): CustomsOperation {
  const operationId = text(row.operation_id, row.operationId, row.id, "CUSTOMS-SUPABASE");
  const metrics = mapMetrics(row);
  const pedimento = text(row.pedimento, row.pedimento_number, row.pedimentoNumber, "Sin pedimento");
  const commercialInvoice = text(row.commercial_invoice, row.commercialInvoice, row.invoice_number, row.invoiceNumber, "Sin factura");
  const certificateOfOrigin = text(row.certificate_of_origin, row.certificateOfOrigin, row.certificate_number, "");
  const brokerExpenseAccount = text(row.broker_expense_account, row.brokerExpenseAccount, row.expense_account, "");

  return {
    broker: text(row.broker, row.customs_broker, row.customsBroker, "Sin agente aduanal"),
    brokerExpenseAccount,
    certificateOfOrigin,
    commercialInvoice,
    dictamen: text(
      row.dictamen,
      row.executive_summary,
      row.summary,
      `Operacion ${operationId} cargada desde Supabase para revision de cumplimiento aduanero.`,
    ),
    documents: mapDocuments(row),
    findings: arrayFrom(row.findings).map((finding) => mapFinding(asRow(finding))),
    framework: "CUSTOMS_COMPLIANCE",
    importer: text(row.importer, row.importer_name, row.importerName, "Sin importador"),
    metrics,
    nextSteps: stringArray(row.next_steps, row.nextSteps, [
      "Registrar paquete documental de la operacion.",
      "Validar hallazgos contra evidencia fuente.",
      "Preparar acciones de recuperacion o rectificacion.",
    ]),
    operationId,
    pedimento,
    provider: text(row.provider, row.supplier, row.supplier_name, row.provider_name, "Sin proveedor"),
    recommendations: stringArray(row.recommendations, row.recomendaciones, [
      "Validar expediente aduanero y conciliar importes contra la cuenta de gastos.",
    ]),
  };
}

function mapMetrics(row: CustomsRow): CustomsMetrics {
  const metrics = asRow(row.metrics);
  const riskScore = number(row.risk_score, row.riskScore, metrics.risk_score, metrics.riskScore, 0);
  const riskScoreAverage = number(row.risk_score_average, row.riskScoreAverage, metrics.risk_score_average, metrics.riskScoreAverage, riskScore);

  return {
    auditedOperations: number(row.audited_operations, row.auditedOperations, metrics.audited_operations, metrics.auditedOperations, 1),
    brokerAccountTotal: number(
      row.broker_account_total,
      row.brokerAccountTotal,
      row.broker_expense_total,
      metrics.broker_account_total,
      metrics.brokerAccountTotal,
      0,
    ),
    criticalFindings: number(row.critical_findings, row.criticalFindings, metrics.critical_findings, metrics.criticalFindings, 0),
    igiPaid: number(row.igi_paid, row.igiPaid, metrics.igi_paid, metrics.igiPaid, 0),
    potentialRecovery: number(row.potential_recovery, row.potentialRecovery, metrics.potential_recovery, metrics.potentialRecovery, 0),
    riskScore,
    riskScoreAverage,
    severity: severity(row.severity, metrics.severity, riskScore),
  };
}

function mapDocuments(row: CustomsRow): CustomsOperationDocument[] {
  const documents = arrayFrom(row.documents);

  if (documents.length > 0) {
    return documents.map((document, index) => mapDocument(asRow(document), index));
  }

  return ["pedimento", "commercial_invoice", "certificate_of_origin", "broker_expense_account", "broker_sla"].map((documentType, index) =>
    mapDocument(
      {
        document_type: documentType,
        filename: "",
        required: documentType !== "broker_sla",
      },
      index,
    ),
  );
}

function mapDocument(row: CustomsRow, index: number): CustomsOperationDocument {
  const documentType = documentTypeValue(row.document_type, row.documentType);

  return {
    documentType,
    filename: text(row.filename, row.file_name, row.fileName, "Pendiente"),
    id: text(row.id, row.document_id, row.documentId, `${documentType}-${index}`),
    label: text(row.label, documentLabels[documentType]),
    required: boolean(row.required, documentType !== "broker_sla"),
    status: boolean(row.required, documentType !== "broker_sla") ? "Pending" : "Optional",
  };
}

function mapFinding(row: CustomsRow): CustomsFinding {
  const potentialRecovery = number(row.potential_recovery, row.potentialRecovery, row.recovery_amount, 0);

  return {
    description: text(row.description, row.finding, row.title, "Hallazgo sin descripcion"),
    evidence: text(row.evidence, row.evidencia, ""),
    id: text(row.id, row.finding_id, row.findingId, row.rule, "customs-finding"),
    potentialRecovery,
    recommendation: text(row.recommendation, row.recomendacion, ""),
    rule: text(row.rule, row.regla, row.category, "Regla aduanera"),
    severity: severity(row.severity, row.severidad),
    status: findingStatus(row.status, row.estado),
  };
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function number(...values: unknown[]) {
  const fallback = values.at(-1);

  for (const value of values.slice(0, -1)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return typeof fallback === "number" ? fallback : 0;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(...values: unknown[]) {
  const fallback = values.at(-1);

  for (const value of values.slice(0, -1)) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }

    if (typeof value === "string" && value.trim()) {
      return [value];
    }
  }

  return Array.isArray(fallback) ? fallback.filter((item): item is string => typeof item === "string") : [];
}

function arrayFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRow(value: unknown): CustomsRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CustomsRow) : {};
}

function severity(...values: unknown[]): CustomsSeverity {
  for (const value of values) {
    if (value === "Critical" || value === "High" || value === "Medium" || value === "Low") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.toLowerCase();

      if (normalized === "critical" || normalized === "critico" || normalized === "crítico") {
        return "Critical";
      }

      if (normalized === "high" || normalized === "alto" || normalized === "alta") {
        return "High";
      }

      if (normalized === "medium" || normalized === "medio" || normalized === "media") {
        return "Medium";
      }

      if (normalized === "low" || normalized === "bajo" || normalized === "baja") {
        return "Low";
      }
    }

    if (typeof value === "number") {
      if (value >= 90) return "Critical";
      if (value >= 70) return "High";
      if (value >= 40) return "Medium";
      return "Low";
    }
  }

  return "Low";
}

function findingStatus(...values: unknown[]): CustomsFindingStatus {
  for (const value of values) {
    if (value === "Open" || value === "In Review" || value === "Validated" || value === "Recovered") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.toLowerCase();

      if (normalized === "open" || normalized === "abierto") {
        return "Open";
      }

      if (normalized === "in review" || normalized === "en revision" || normalized === "en revisión") {
        return "In Review";
      }

      if (normalized === "validated" || normalized === "validado") {
        return "Validated";
      }

      if (normalized === "recovered" || normalized === "recuperado") {
        return "Recovered";
      }
    }
  }

  return "Open";
}

function documentTypeValue(...values: unknown[]): CustomsDocumentType {
  for (const value of values) {
    if (
      value === "pedimento" ||
      value === "commercial_invoice" ||
      value === "certificate_of_origin" ||
      value === "broker_expense_account" ||
      value === "broker_sla"
    ) {
      return value;
    }
  }

  return "pedimento";
}
