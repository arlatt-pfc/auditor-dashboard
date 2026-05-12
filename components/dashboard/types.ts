export type MenuItem = {
  description?: string;
  engine?: AuditEngineCode;
  label: string;
  href?: string;
};

export type Stat = {
  label: string;
  value: string;
  hint: string;
};

export type MenuSection = {
  title: string;
  items: MenuItem[];
};

export type AuditStatus = "Bajo" | "Parcial" | "Alto";

export type Audit = {
  id: string;
  client?: string;
  contractor?: string;
  doc: string;
  risk: string;
  score: string;
  status: AuditStatus;
  owner: string;
};

export type AuditDetail = {
  actions: string[];
  client: string;
  contractor: string;
  criteria: {
    criterion: string;
    result: string;
    note: string;
  }[];
  dictamen: string;
  document: string;
  evidence: string[];
  findings: {
    title: string;
    impact: string;
    severity: "Crítico" | "Alto" | "Medio";
  }[];
  id: string;
  level: AuditStatus;
  risk: string;
  score: string;
  timeline: {
    event: string;
    meta: string;
    when: string;
  }[];
};

export type FindingSeverity = "Crítico" | "Alto" | "Medio";

export type Finding = {
  title: string;
  severity: FindingSeverity;
  area: string;
  due: string;
};

export type ModuleCard = {
  title: string;
  desc?: string;
  items?: {
    label: string;
    description: string;
  }[];
};

export type AuditEngineCode = "CUSTOMS_COMPLIANCE" | "STPS_PEMEX_COMPLIANCE" | "CONTRACTOR_COMPLIANCE";

export type UserRole = "admin" | "auditor" | "lector";
