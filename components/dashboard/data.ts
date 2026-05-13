import type {
  Audit,
  AuditDetail,
  AuditStatus,
  Finding,
  FindingSeverity,
  MenuSection,
  ModuleCard,
  Stat,
} from "@/components/dashboard/types";

export const stats: Stat[] = [
  { label: "Normas activas", value: "128", hint: "+12 este mes" },
  { label: "Auditorías ejecutadas", value: "46", hint: "8 pendientes" },
  { label: "Hallazgos críticos", value: "14", hint: "3 vencidos" },
  { label: "Usuarios activos", value: "22", hint: "RBAC habilitado" },
];

export const menuSections: MenuSection[] = [
  {
    title: "Plataforma",
    items: [
      { label: "Inicio", href: "/dashboard" },
      {
        label: "Customs Compliance",
        href: "/dashboard/customs-compliance",
        description: "Expedientes aduanales",
        engine: "CUSTOMS_COMPLIANCE",
      },
      {
        label: "STPS / PEMEX Compliance",
        href: "/dashboard/stps-pemex-compliance",
        description: "Auditoría documental HSE",
        engine: "STPS_PEMEX_COMPLIANCE",
      },
      { label: "Executive Dashboard", href: "/" },
    ],
  },
  {
    title: "Operación",
    items: [
      { label: "Reportes" },
      { label: "Configuración" },
    ],
  },
];

export const newAuditOptions = {
  clients: ["Cliente Interno", "Refinería Costa Norte", "Terminal Logística Delta", "Operación Marina Sur"],
  contractors: ["Contratista Delta", "Contratista Sigma", "Servicios Atlas", "Ingeniería Boreal"],
  risks: [
    "Trabajos en altura",
    "Espacios confinados",
    "Equipo de protección personal",
    "Izaje y maniobras",
    "Seguridad eléctrica",
  ],
};

export const uploadedDocuments = [
  {
    name: "Procedimiento de trabajo seguro.pdf",
    meta: "PDF · 2.8 MB · versión 04",
    status: "Clasificado",
  },
  {
    name: "Listado de personal y DC-3.xlsx",
    meta: "Excel · 780 KB · actualizado hoy",
    status: "Pendiente de revisión",
  },
  {
    name: "Plan de rescate y emergencias.docx",
    meta: "Word · 1.2 MB · cliente validó formato",
    status: "Listo para scoring",
  },
];

export const newAuditNotes = [
  "La auditoría consolida evidencias por contratante, contratista y riesgo declarado.",
  "Los documentos cargados se usan como insumo para scoring, trazabilidad y matriz de cumplimiento.",
  "El dictamen final puede requerir observaciones del auditor antes de su exportación.",
];

export const audits: Audit[] = [
  {
    id: "trabajos-altura-plataforma-a",
    client: "Refinería Costa Norte",
    contractor: "Contratista Delta",
    doc: "Procedimiento Trabajo en Altura - Plataforma A",
    risk: "Trabajos en altura",
    score: "40%",
    status: "Bajo",
    owner: "Contratista Delta",
  },
  {
    id: "espacio-confinado-planta-b",
    client: "Terminal Logística Delta",
    contractor: "Contratista Sigma",
    doc: "Ingreso a Espacio Confinado - Planta B",
    risk: "Espacios confinados",
    score: "68%",
    status: "Parcial",
    owner: "Contratista Sigma",
  },
  {
    id: "politica-epp-operacion-marina",
    client: "Operación Marina Sur",
    contractor: "Cliente Interno",
    doc: "Política EPP - Operación Marina",
    risk: "Equipo de protección personal",
    score: "82%",
    status: "Alto",
    owner: "Cliente Interno",
  },
];

export const findings: Finding[] = [
  {
    title: "Autorización formal no evidenciada",
    severity: "Crítico",
    area: "Trabajos en altura",
    due: "04 Abr 2026",
  },
  {
    title: "Capacitación DC-3 no adjunta",
    severity: "Alto",
    area: "Competencia del personal",
    due: "06 Abr 2026",
  },
  {
    title: "Plan de rescate incompleto",
    severity: "Medio",
    area: "Emergencias",
    due: "09 Abr 2026",
  },
];

export const modules: ModuleCard[] = [
  {
    title: "Definición operativa",
    items: [
      {
        label: "Contratista",
        description:
          "Empresa que ejecuta el servicio o actividad bajo contrato, responsable de cumplir con la normativa aplicable.",
      },
      {
        label: "Contratante (Cliente)",
        description:
          "Empresa que solicita el servicio, define requisitos de cumplimiento y valida evidencias.",
      },
    ],
  },
  {
    title: "Repositorio documental",
    desc: "Carga de procedimientos, normas, evidencias, versionado y clasificación por cliente, industria y riesgo.",
  },
  {
    title: "Motor de auditoría",
    desc: "Scoring, dictamen, matrices de cumplimiento, PDF, CSV y análisis contra normas gubernamentales o del contratante.",
  },
  {
    title: "RBAC y usuarios",
    desc: "Super Admin, Compliance, Auditor, Operación y Director con permisos diferenciados y trazabilidad de eventos.",
  },
  {
    title: "Bitácora y activity log",
    desc: "Registro completo de quién subió, auditó, descargó o cerró hallazgos, útil para compliance y auditoría interna.",
  },
  {
    title: "Integraciones",
    desc: "Telegram, correo, APIs, exportaciones y acoplamiento futuro con agentes de IA como OpenClaw para clasificación y Q&A.",
  },
  {
    title: "Dashboard ejecutivo",
    desc: "KPIs, hallazgos críticos, cumplimiento promedio, avance por cliente, riesgos abiertos y tendencias históricas.",
  },
];

export const auditFlowSteps: string[] = [
  "Cargar documento y clasificar riesgo.",
  "Seleccionar normativa aplicable o usar detección automática.",
  "Ejecutar scoring y dictamen.",
  "Visualizar brechas, evidencia y matriz de cumplimiento.",
  "Asignar responsables y fechas compromiso.",
  "Exportar PDF / CSV y registrar en bitácora.",
];

export const severityClasses: Record<FindingSeverity, string> = {
  Crítico: "bg-red-100 text-red-700 border-red-200",
  Alto: "bg-amber-100 text-amber-700 border-amber-200",
  Medio: "bg-blue-100 text-blue-700 border-blue-200",
};

export const statusClasses: Record<AuditStatus, string> = {
  Bajo: "bg-red-100 text-red-700",
  Parcial: "bg-amber-100 text-amber-700",
  Alto: "bg-emerald-100 text-emerald-700",
};

export const auditDetails: Record<string, AuditDetail> = {
  "trabajos-altura-plataforma-a": {
    id: "trabajos-altura-plataforma-a",
    document: "Procedimiento Trabajo en Altura - Plataforma A",
    client: "Refinería Costa Norte",
    contractor: "Contratista Delta",
    risk: "Trabajos en altura",
    score: "40%",
    level: "Bajo",
    dictamen:
      "Cumplimiento insuficiente para trabajos en altura. La evidencia presentada no demuestra control operativo ni autorización formal conforme a los requisitos del cliente y la normativa aplicable.",
    findings: [
      {
        title: "Permiso de trabajo en altura no evidenciado",
        impact: "Impide validar autorización formal antes de la ejecución de la actividad crítica.",
        severity: "Crítico",
      },
      {
        title: "Plan de rescate sin roles ni tiempos definidos",
        impact: "Debilita la respuesta a emergencias y compromete la continuidad segura del frente operativo.",
        severity: "Alto",
      },
      {
        title: "Inspección de líneas de vida sin registro vigente",
        impact: "No asegura trazabilidad sobre la condición del equipo de protección contra caídas.",
        severity: "Medio",
      },
    ],
    evidence: [
      "Procedimiento de trabajo seguro versión 04 con alcance operativo limitado.",
      "Relación parcial de personal autorizado con DC-3 de dos cuadrillas.",
      "Formato de inspección de arnés sin firma del supervisor del contratante.",
      "Anexo fotográfico de plataforma y punto de anclaje sin fecha verificable.",
    ],
    criteria: [
      {
        criterion: "Autorización y permiso previo",
        result: "No cumple",
        note: "No se adjunta permiso vigente ni liberación documentada del área.",
      },
      {
        criterion: "Competencia del personal",
        result: "Parcial",
        note: "Existen constancias DC-3, pero no cubren la totalidad del personal listado.",
      },
      {
        criterion: "Equipo y protección contra caídas",
        result: "Parcial",
        note: "La evidencia del equipo es incompleta y sin trazabilidad de inspección.",
      },
      {
        criterion: "Rescate y respuesta a emergencias",
        result: "No cumple",
        note: "El plan no define responsables, tiempos de reacción ni comunicación con brigadas.",
      },
    ],
    actions: [
      "Solicitar permiso de trabajo vigente con firma de liberación del contratante.",
      "Completar expediente DC-3 del personal involucrado y vincularlo al frente de trabajo.",
      "Actualizar plan de rescate con responsables, equipos asignados y simulacro documentado.",
      "Reemitir formato de inspección de líneas de vida, arneses y puntos de anclaje con fecha y responsable.",
    ],
    timeline: [
      {
        event: "Carga inicial del expediente",
        meta: "Contratista Delta subió 6 documentos base",
        when: "04 Abr 2026 · 08:40",
      },
      {
        event: "Clasificación automática de riesgo",
        meta: "El sistema marcó criticidad alta por actividad en altura",
        when: "04 Abr 2026 · 08:46",
      },
      {
        event: "Revisión documental preliminar",
        meta: "Auditor detectó ausencia de permiso vigente y plan de rescate incompleto",
        when: "04 Abr 2026 · 09:12",
      },
      {
        event: "Scoring emitido",
        meta: "Resultado preliminar 40% con nivel Bajo",
        when: "04 Abr 2026 · 09:25",
      },
    ],
  },
};
