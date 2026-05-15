import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Public routes such as /login, /api/auth/*, static assets and _next/* stay outside this matcher.
  matcher: ["/", "/dashboard/:path*", "/nueva-auditoria", "/auditorias/:path*", "/reportes/:path*", "/configuracion/:path*"],
};
