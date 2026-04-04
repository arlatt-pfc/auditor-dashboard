export type Stat = {
  label: string;
  value: string;
  hint: string;
};

export type MenuSection = {
  title: string;
  items: string[];
};

export type AuditStatus = "Bajo" | "Parcial" | "Alto";

export type Audit = {
  doc: string;
  risk: string;
  score: string;
  status: AuditStatus;
  owner: string;
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
  desc: string;
};
