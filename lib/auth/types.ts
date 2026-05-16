import type { AuditEngineCode, UserRole } from "@/components/dashboard/types";

export type AuthUser = {
  email?: string;
  id: string;
};

export type UserProfile = {
  companyId: string;
  companyName: string;
  fullName: string | null;
  role: UserRole;
  userId: string;
};

export type EnginePermission = {
  canCreate: boolean;
  canExecute: boolean;
  canExport: boolean;
  canRead: boolean;
  code: AuditEngineCode;
};

export type AuthContext = {
  accessToken: string;
  engines: EnginePermission[];
  profile: UserProfile | null;
  user: AuthUser;
};
