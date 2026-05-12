import type { AuditFramework } from "@/lib/auditor/types";

export type CustomsDocumentType =
  | "pedimento"
  | "bill_of_lading"
  | "commercial_invoice"
  | "certificate_of_origin"
  | "broker_expense_account"
  | "broker_sla"
  | "cfdi_pdf"
  | "cfdi_xml"
  | "data_sheet"
  | "annex"
  | "cove";

export type CustomsSeverity = "Critical" | "High" | "Medium" | "Low";

export type CustomsFindingStatus = "Open" | "In Review" | "Validated" | "Recovered";

export type CustomsFinding = {
  description: string;
  evidence: string;
  id: string;
  potentialRecovery: number;
  recommendation: string;
  rule: string;
  severity: CustomsSeverity;
  status: CustomsFindingStatus;
};

export type CustomsMetrics = {
  auditedOperations: number;
  brokerAccountTotal: number;
  criticalFindings: number;
  igiPaid: number;
  potentialRecovery: number;
  riskScore: number;
  riskScoreAverage: number;
  severity: CustomsSeverity;
};

export type CustomsOperationDocument = {
  documentType: CustomsDocumentType;
  filename: string;
  id: string;
  label: string;
  required: boolean;
  status: "Mock loaded" | "Optional" | "Pending";
};

/**
 * CustomsOperation represents the full customs operation file, not only the
 * pedimento. The pedimento remains one document/attribute inside the file.
 */
export type CustomsOperation = {
  broker: string;
  brokerExpenseAccount: string;
  certificateOfOrigin: string;
  commercialInvoice: string;
  customsReference: string;
  dictamen: string;
  documents: CustomsOperationDocument[];
  findings: CustomsFinding[];
  framework: Extract<AuditFramework, "CUSTOMS_COMPLIANCE">;
  importer: string;
  metrics: CustomsMetrics;
  nextSteps: string[];
  operationId: string;
  operationRecordId?: string;
  pedimento: string;
  provider: string;
  recommendations: string[];
};

export type CreateCustomsOperationPayload = Record<string, unknown>;

export type CreateCustomsDocumentPayload = Record<string, unknown>;
