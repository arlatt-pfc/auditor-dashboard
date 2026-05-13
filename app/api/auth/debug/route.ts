import { NextResponse } from "next/server";

import { getAuthDebugState } from "@/lib/auth/session";

export async function GET() {
  const debugState = await getAuthDebugState();

  return NextResponse.json(debugState, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
