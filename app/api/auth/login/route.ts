import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getSupabaseHost,
  getTokenDebugState,
  signInWithPasswordDetailed,
} from "@/lib/auth/session";

type LoginErrorCode =
  | "ENV_MISSING"
  | "SUPABASE_AUTH_FAILED"
  | "SUPABASE_AUTH_UNREACHABLE"
  | "SESSION_TOKEN_MISSING"
  | "COOKIE_WRITE_FAILED"
  | "PROFILE_NOT_FOUND"
  | "ENGINE_ACCESS_NOT_FOUND"
  | "VALIDATION_ERROR";

type LoginStage = "request_validation" | "environment" | "supabase_auth" | "session_tokens" | "cookie_write" | "profile_rbac";

export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return loginError("VALIDATION_ERROR", "Email y password son requeridos.", "request_validation", 400);
  }

  const envState = {
    supabaseAnonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseHost: getSupabaseHost(),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };

  console.info("[auth.login] environment", envState);

  if (!envState.supabaseUrlConfigured || !envState.supabaseAnonKeyConfigured || !envState.supabaseHost) {
    console.warn("[auth.login] missing_or_invalid_environment", envState);
    return loginError("ENV_MISSING", "Supabase URL o anon key no estan configuradas correctamente.", "environment", 500);
  }

  const authResult = await signInWithPasswordDetailed(email, password);

  console.info("[auth.login] supabase_auth_response", {
    errorCode: authResult.errorCode,
    errorMessage: authResult.errorMessage,
    host: authResult.host,
    receivedAccessToken: Boolean(authResult.data?.access_token),
    receivedRefreshToken: Boolean(authResult.data?.refresh_token),
    status: authResult.status,
  });

  if (!authResult.ok) {
    return loginError(
      normalizeSupabaseAuthError(authResult.errorCode),
      authResult.errorMessage ?? "Supabase Auth rechazo el inicio de sesion.",
      "supabase_auth",
      authResult.status === 400 ? 401 : authResult.status ?? 502,
    );
  }

  const session = authResult.data;

  if (!session?.access_token || !session.refresh_token) {
    console.warn("[auth.login] session_token_missing", {
      receivedAccessToken: Boolean(session?.access_token),
      receivedRefreshToken: Boolean(session?.refresh_token),
      status: authResult.status,
    });
    return loginError("SESSION_TOKEN_MISSING", "Supabase Auth no devolvio una sesion completa.", "session_tokens", 502);
  }

  const tokenDebug = await getTokenDebugState(session.access_token);

  console.info("[auth.login] profile_rbac_check", tokenDebug);

  if (!tokenDebug.profileFound) {
    return loginError("PROFILE_NOT_FOUND", "Login correcto, pero no se encontro user_profiles para este usuario o RLS bloqueo la lectura.", "profile_rbac", 403);
  }

  if (tokenDebug.enginesCount === 0) {
    return loginError("ENGINE_ACCESS_NOT_FOUND", "Login correcto, pero el usuario no tiene engines asignados o RLS bloqueo user_engine_access.", "profile_rbac", 403);
  }

  const response = NextResponse.json({ redirectTo: "/dashboard" });
  const secure = process.env.NODE_ENV === "production";
  const maxAge = session.expires_in ?? 3600;

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure,
  });

  const cookiesWritten = Boolean(response.cookies.get(ACCESS_TOKEN_COOKIE)) && Boolean(response.cookies.get(REFRESH_TOKEN_COOKIE));

  console.info("[auth.login] cookie_write", {
    accessCookieWritten: Boolean(response.cookies.get(ACCESS_TOKEN_COOKIE)),
    refreshCookieWritten: Boolean(response.cookies.get(REFRESH_TOKEN_COOKIE)),
    secure,
  });

  if (!cookiesWritten) {
    return loginError("COOKIE_WRITE_FAILED", "La sesion fue creada, pero no se pudieron preparar las cookies httpOnly.", "cookie_write", 500);
  }

  return response;
}

function loginError(errorCode: LoginErrorCode, errorMessage: string, stage: LoginStage, status: number) {
  return NextResponse.json(
    {
      error_code: errorCode,
      error_message: errorMessage,
      message: errorMessage,
      stage,
    },
    { status },
  );
}

function normalizeSupabaseAuthError(errorCode?: string): LoginErrorCode {
  if (errorCode === "ENV_MISSING") {
    return "ENV_MISSING";
  }

  if (errorCode === "SUPABASE_AUTH_UNREACHABLE") {
    return "SUPABASE_AUTH_UNREACHABLE";
  }

  return "SUPABASE_AUTH_FAILED";
}
