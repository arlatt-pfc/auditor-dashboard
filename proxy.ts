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
  // /login and /api/auth/* stay public. Only dashboard routes require a session cookie.
  matcher: ["/dashboard/:path*"],
};
