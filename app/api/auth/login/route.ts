import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, signInWithPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ message: "Email y password son requeridos." }, { status: 400 });
  }

  const session = await signInWithPassword(email, password);

  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json({ message: "Credenciales invalidas o Supabase no disponible." }, { status: 401 });
  }

  const response = NextResponse.json({ redirectTo: "/dashboard/customs-compliance" });
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

  return response;
}
