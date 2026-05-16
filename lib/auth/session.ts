import { cookies } from "next/headers";
import { cache } from "react";

import type { AuditEngineCode, UserRole } from "@/components/dashboard/types";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { supabaseSelect } from "@/lib/supabase/client";
import type { AuthContext, AuthUser, EnginePermission, UserProfile } from "@/lib/auth/types";

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };

type SupabaseAuthResponse = {
  access_token?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
  expires_in?: number;
  msg?: string;
  refresh_token?: string;
  user?: {
    email?: string;
    id?: string;
  };
};

export type SupabasePasswordSignInResult = {
  data: SupabaseAuthResponse | null;
  errorCode?: string;
  errorMessage?: string;
  host?: string | null;
  ok: boolean;
  status?: number;
};

export type AuthDebugState = {
  companyFound: boolean;
  currentUserDetected: boolean;
  enginesCount: number;
  hasAuthCookie: boolean;
  nodeEnv: string;
  profileFound: boolean;
  rbacQueriesUsedAuthenticatedJwt: boolean;
  supabaseAnonKeyConfigured: boolean;
  supabaseHost: string | null;
  supabaseUrlConfigured: boolean;
};

type UserProfileRow = {
  company_id?: string;
  full_name?: string;
  role?: string;
  user_id?: string;
};

type CompanyRow = {
  id?: string;
  name?: string;
};

type EngineRow = {
  code?: string;
  id?: string;
};

type EngineAccessRow = {
  can_create?: boolean;
  can_execute?: boolean;
  can_export?: boolean;
  can_read?: boolean;
  engine_id?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const knownEngineCodes: AuditEngineCode[] = ["CUSTOMS_COMPLIANCE", "STPS_PEMEX_COMPLIANCE", "CONTRACTOR_COMPLIANCE"];

export async function signInWithPassword(email: string, password: string) {
  const result = await signInWithPasswordDetailed(email, password);
  return result.ok ? result.data : null;
}

export async function signInWithPasswordDetailed(email: string, password: string): Promise<SupabasePasswordSignInResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      data: null,
      errorCode: "ENV_MISSING",
      errorMessage: "Supabase URL or anon key is not configured.",
      host: getSupabaseHost(),
      ok: false,
    };
  }

  const response = await fetch(`${baseSupabaseUrl()}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      data: null,
      errorCode: "SUPABASE_AUTH_UNREACHABLE",
      errorMessage: "Supabase Auth request failed before receiving a response.",
      host: getSupabaseHost(),
      ok: false,
    };
  }

  const data = (await response.json().catch(() => null)) as SupabaseAuthResponse | null;

  return {
    data,
    errorCode: data?.error_code ?? data?.error ?? (response.ok ? undefined : "SUPABASE_AUTH_FAILED"),
    errorMessage: data?.error_description ?? data?.msg ?? data?.error,
    host: getSupabaseHost(),
    ok: response.ok,
    status: response.status,
  };
}

const getAuthContextCached = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const user = await getUserFromToken(accessToken);

  if (!user) {
    return null;
  }

  const profile = await getUserProfile(accessToken, user.id);
  const engines = profile ? await getEnginePermissions(accessToken, user.id, profile.companyId) : [];

  return {
    accessToken,
    engines,
    profile,
    user,
  };
});

export async function getAuthContext(): Promise<AuthContext | null> {
  return getAuthContextCached();
}

export function userCanReadEngine(context: AuthContext | null, engineCode: AuditEngineCode) {
  return Boolean(context?.engines.some((engine) => engine.code === engineCode && engine.canRead));
}

export function userCanExecuteEngine(context: AuthContext | null, engineCode: AuditEngineCode) {
  const role = context?.profile?.role;

  if (role !== "admin" && role !== "auditor") {
    return false;
  }

  return Boolean(context?.engines.some((engine) => engine.code === engineCode && engine.canExecute));
}

export function userCanCreateEngine(context: AuthContext | null, engineCode: AuditEngineCode) {
  const role = context?.profile?.role;

  if (role !== "admin" && role !== "auditor") {
    return false;
  }

  return Boolean(context?.engines.some((engine) => engine.code === engineCode && engine.canCreate));
}

export async function getAuthDebugState(): Promise<AuthDebugState> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const tokenDebug = accessToken ? await getTokenDebugState(accessToken) : null;

  return {
    companyFound: tokenDebug?.companyFound ?? false,
    currentUserDetected: tokenDebug?.currentUserDetected ?? false,
    enginesCount: tokenDebug?.enginesCount ?? 0,
    hasAuthCookie: Boolean(accessToken),
    nodeEnv: process.env.NODE_ENV,
    profileFound: tokenDebug?.profileFound ?? false,
    rbacQueriesUsedAuthenticatedJwt: tokenDebug?.rbacQueriesUsedAuthenticatedJwt ?? false,
    supabaseAnonKeyConfigured: Boolean(SUPABASE_ANON_KEY),
    supabaseHost: getSupabaseHost(),
    supabaseUrlConfigured: Boolean(SUPABASE_URL),
  };
}

export async function getTokenDebugState(accessToken: string) {
  const user = await getUserFromToken(accessToken);
  const rbacQueriesUsedAuthenticatedJwt = Boolean(accessToken.trim());

  if (!user) {
    return {
      companyFound: false,
      currentUserDetected: false,
      enginesCount: 0,
      profileFound: false,
      rbacQueriesUsedAuthenticatedJwt,
    };
  }

  const profile = await getUserProfile(accessToken, user.id);

  if (!profile) {
    return {
      companyFound: false,
      currentUserDetected: true,
      enginesCount: 0,
      profileFound: false,
      rbacQueriesUsedAuthenticatedJwt,
    };
  }

  const engines = await getEnginePermissions(accessToken, user.id, profile.companyId);
  const companyRows = await supabaseSelect<CompanyRow>("companies", {
    accessToken,
    eq: {
      id: profile.companyId,
    },
    limit: 1,
    requireAccessToken: true,
    select: "id,name",
  });

  return {
    companyFound: companyRows.length > 0,
    currentUserDetected: true,
    enginesCount: engines.length,
    profileFound: true,
    rbacQueriesUsedAuthenticatedJwt,
  };
}

async function getUserFromToken(accessToken: string): Promise<AuthUser | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const response = await fetch(`${baseSupabaseUrl()}/auth/v1/user`, {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const user = (await response.json()) as { email?: string; id?: string };

  return user.id
    ? {
        email: user.email,
        id: user.id,
      }
    : null;
}

async function getUserProfile(accessToken: string, userId: string): Promise<UserProfile | null> {
  const rows = await supabaseSelect<UserProfileRow>("user_profiles", {
    accessToken,
    eq: {
      user_id: userId,
    },
    limit: 1,
    requireAccessToken: true,
    select: "*",
  });
  const row = rows[0];

  if (!row?.company_id || !row.user_id || !isUserRole(row.role)) {
    return null;
  }

  const companyRows = await supabaseSelect<CompanyRow>("companies", {
    accessToken,
    eq: {
      id: row.company_id,
    },
    limit: 1,
    requireAccessToken: true,
    select: "id,name",
  });

  return {
    companyId: row.company_id,
    companyName: companyRows[0]?.name ?? "Empresa sin nombre",
    fullName: row.full_name?.trim() || null,
    role: row.role,
    userId: row.user_id,
  };
}

async function getEnginePermissions(accessToken: string, userId: string, companyId: string): Promise<EnginePermission[]> {
  const [accessRows, engineRows] = await Promise.all([
    supabaseSelect<EngineAccessRow>("user_engine_access", {
      accessToken,
      eq: {
        company_id: companyId,
        user_id: userId,
      },
      requireAccessToken: true,
      select: "engine_id,can_read,can_create,can_execute,can_export",
    }),
    supabaseSelect<EngineRow>("audit_engines", {
      accessToken,
      requireAccessToken: true,
      select: "id,code",
    }),
  ]);
  const engineCodeById = new Map(engineRows.map((engine) => [engine.id, engine.code]));

  return accessRows.flatMap((access) => {
    const code = engineCodeById.get(access.engine_id);

    if (!isAuditEngineCode(code)) {
      return [];
    }

    return [
      {
        canCreate: access.can_create ?? false,
        canExecute: access.can_execute ?? false,
        canExport: access.can_export ?? false,
        canRead: access.can_read ?? true,
        code,
      },
    ];
  });
}

function baseSupabaseUrl() {
  if (!SUPABASE_URL) {
    return "";
  }

  return SUPABASE_URL.endsWith("/") ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
}

export function getSupabaseHost() {
  if (!SUPABASE_URL) {
    return null;
  }

  try {
    return new URL(baseSupabaseUrl()).host;
  } catch {
    return null;
  }
}

function isAuditEngineCode(value: unknown): value is AuditEngineCode {
  return typeof value === "string" && knownEngineCodes.includes(value as AuditEngineCode);
}

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "auditor" || value === "lector";
}
