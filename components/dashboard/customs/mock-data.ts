import type { CustomsOperation } from "@/lib/customs/types";

export const customsOperationMock: CustomsOperation = {
  operationId: "CUSTOMS-2026-000001",
  framework: "CUSTOMS_COMPLIANCE",
  pedimento: "4226-8231-A030215",
  commercialInvoice: "INV-2026-04872",
  certificateOfOrigin: "CO-2026-NL-004872",
  brokerExpenseAccount: "CG-2026-04872",
  importer: "ACME INDUSTRIAL DE MONTERREY S.A. DE C.V.",
  provider: "GLOBAL PARTS INC.",
  broker: "TRANSPORTES FRONTERA S.C.",
  metrics: {
    auditedOperations: 1,
    igiPaid: 36285.37,
    brokerAccountTotal: 151155.2,
    potentialRecovery: 36285.37,
    riskScore: 82,
    riskScoreAverage: 82,
    criticalFindings: 4,
    severity: "High",
  },
  documents: [
    {
      id: "doc-pedimento",
      documentType: "pedimento",
      label: "Pedimento",
      filename: "4226-8231-A030215.pdf",
      required: true,
      status: "Mock loaded",
    },
    {
      id: "doc-invoice",
      documentType: "commercial_invoice",
      label: "Factura Comercial",
      filename: "INV-2026-04872.pdf",
      required: true,
      status: "Mock loaded",
    },
    {
      id: "doc-certificate",
      documentType: "certificate_of_origin",
      label: "Certificado de Origen T-MEC",
      filename: "CO-2026-NL-004872.pdf",
      required: true,
      status: "Mock loaded",
    },
    {
      id: "doc-expense-account",
      documentType: "broker_expense_account",
      label: "Cuenta de Gastos",
      filename: "CG-2026-04872.pdf",
      required: true,
      status: "Mock loaded",
    },
    {
      id: "doc-sla",
      documentType: "broker_sla",
      label: "SLA del Agente Aduanal",
      filename: "SLA-TRANSPORTES-FRONTERA-2026.pdf",
      required: false,
      status: "Optional",
    },
  ],
  findings: [
    {
      id: "CUSTOMS_TMEC_IGI_001",
      severity: "High",
      rule: "T-MEC / IGI preferencial",
      description:
        "Posible sobrepago por no aplicar preferencia T-MEC; el pedimento declara origen USA y existe certificado CO-2026-NL-004872.",
      potentialRecovery: 36285.37,
      status: "Open",
      evidence: "Pedimento 4226-8231-A030215, factura INV-2026-04872 y certificado CO-2026-NL-004872.",
      recommendation: "Validar cobertura del certificado y preparar solicitud de rectificacion o recuperacion.",
    },
    {
      id: "CUSTOMS_SAT_DIFF_001",
      severity: "High",
      rule: "Conciliacion SAT",
      description: "Diferencia entre total SAT declarado en pedimento y total trasladado en cuenta de gastos.",
      potentialRecovery: 0,
      status: "In Review",
      evidence: "Cuenta de gastos CG-2026-04872 contra contribuciones del pedimento.",
      recommendation: "Solicitar desglose SAT al agente aduanal y conciliar linea por linea.",
    },
    {
      id: "CUSTOMS_SLA_FEES_001",
      severity: "Medium",
      rule: "Honorarios vs SLA",
      description: "Honorarios del agente aduanal por arriba de la tarifa pactada para operaciones de importacion.",
      potentialRecovery: 0,
      status: "Open",
      evidence: "Cuenta de gastos CG-2026-04872 y SLA de TRANSPORTES FRONTERA S.C.",
      recommendation: "Recalcular honorarios conforme al SLA vigente y solicitar nota de credito si procede.",
    },
    {
      id: "CUSTOMS_UNAUTHORIZED_CHARGES_001",
      severity: "Medium",
      rule: "Cargos autorizados",
      description: "Se detectan conceptos logisticos no contemplados en SLA ni soportados por comprobante asociado.",
      potentialRecovery: 0,
      status: "Open",
      evidence: "Conceptos varios incluidos en la cuenta de gastos del agente aduanal.",
      recommendation: "Clasificar cargos, pedir soporte documental y bloquear conceptos no autorizados en siguientes operaciones.",
    },
  ],
  dictamen:
    "La operacion CUSTOMS-2026-000001 presenta riesgo alto por posible recuperacion de IGI y diferencias documentales entre pedimento, cuenta de gastos y SLA. El principal caso de negocio es validar la aplicacion T-MEC para recuperar 36,285.37 MXN potenciales.",
  recommendations: [
    "Validar juridicamente la preferencia T-MEC antes de iniciar rectificacion.",
    "Solicitar al agente aduanal desglose de contribuciones SAT y soporte de cargos logisticos.",
    "Configurar un catalogo de cargos autorizados por SLA para prevenir reincidencias.",
  ],
  nextSteps: [
    "Aprobar revision documental de la operacion piloto.",
    "Normalizar extractos de pedimento, factura, certificado y cuenta de gastos.",
    "Preparar tablero comparativo para carga masiva de 10 operaciones.",
  ],
};

export const customsKpis = [
  {
    label: "Operaciones Auditadas",
    value: String(customsOperationMock.metrics.auditedOperations),
    hint: customsOperationMock.operationId,
  },
  {
    label: "Recuperacion Potencial",
    value: formatCurrency(customsOperationMock.metrics.potentialRecovery),
    hint: "IGI pagado",
  },
  {
    label: "Hallazgos Criticos",
    value: String(customsOperationMock.metrics.criticalFindings),
    hint: customsOperationMock.metrics.severity,
  },
  {
    label: "Risk Score Promedio",
    value: String(customsOperationMock.metrics.riskScoreAverage),
    hint: "Alto",
  },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
