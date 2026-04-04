import type {
  Audit,
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
    title: "Normas de Gobierno",
    items: ["STPS", "ASEA", "SAT / CFF", "Aduanal", "Protección Civil"],
  },
  {
    title: "Normas de Empresas Contratistas",
    items: ["PEMEX", "Mexichem", "Políticas internas", "Anexos SSPA", "Requisitos por cliente"],
  },
  {
    title: "Módulo de Auditoría",
    items: ["Nueva auditoría", "Matriz de cumplimiento", "Reportes PDF", "CSV / Exportaciones", "Hallazgos"],
  },
  {
    title: "Bitácora",
    items: ["Actividad reciente", "Versionado documental", "Eventos de usuario", "Descargas", "Trazabilidad"],
  },
  {
    title: "Usuarios y RBAC",
    items: ["Super Admin", "Compliance Manager", "Auditor", "Operación", "Director"],
  },
  {
    title: "Configuración",
    items: ["Catálogos", "Riesgos soportados", "Clientes", "Branding", "Integraciones"],
  },
];

export const audits: Audit[] = [
  {
    doc: "Procedimiento Trabajo en Altura - Plataforma A",
    risk: "Trabajos en altura",
    score: "40%",
    status: "Bajo",
    owner: "Contratista Delta",
  },
  {
    doc: "Ingreso a Espacio Confinado - Planta B",
    risk: "Espacios confinados",
    score: "68%",
    status: "Parcial",
    owner: "Contratista Sigma",
  },
  {
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
