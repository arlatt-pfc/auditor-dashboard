import { NextResponse } from "next/server";

import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";

const CUSTOMS_PARSE_PATH = "/customs/parse-pedimento";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthContext();

  if (!auth?.profile) {
    return NextResponse.json({ error: "AUTH_REQUIRED", error_code: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!userCanReadEngine(auth, "CUSTOMS_COMPLIANCE")) {
    return NextResponse.json({ error: "ENGINE_READ_FORBIDDEN", error_code: "ENGINE_READ_FORBIDDEN" }, { status: 403 });
  }

  const apiUrl = customsParseUrl();
  const apiKey = process.env.AUDIT_API_KEY?.trim();

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "AUDIT_API_NOT_CONFIGURED", error_code: "AUDIT_API_NOT_CONFIGURED" }, { status: 500 });
  }

  const incomingFormData = await request.formData().catch(() => null);

  if (!incomingFormData) {
    return NextResponse.json({ error: "INVALID_MULTIPART_FORM_DATA", error_code: "INVALID_MULTIPART_FORM_DATA" }, { status: 400 });
  }

  const file = incomingFormData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PEDIMENTO_FILE_REQUIRED", error_code: "PEDIMENTO_FILE_REQUIRED" }, { status: 400 });
  }

  if (!isPdf(file) && !isXml(file)) {
    return NextResponse.json({ error: "PEDIMENTO_FILE_MUST_BE_PDF_OR_XML", error_code: "PEDIMENTO_FILE_MUST_BE_PDF_OR_XML" }, { status: 400 });
  }

  const outboundFormData = new FormData();
  outboundFormData.append("file", file, file.name);

  const response = await fetch(apiUrl, {
    body: outboundFormData,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "AUDIT_API_UNREACHABLE", error_code: "AUDIT_API_UNREACHABLE" }, { status: 502 });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(normalizeErrorPayload(payload), { status: response.status });
  }

  return NextResponse.json(payload);
}

function customsParseUrl() {
  const explicitBaseUrl = process.env.AUDIT_API_BASE_URL?.trim().replace(/\/+$/, "");

  if (explicitBaseUrl) {
    return `${explicitBaseUrl}${CUSTOMS_PARSE_PATH}`;
  }

  const auditApiUrl = process.env.AUDIT_API_URL?.trim();

  if (!auditApiUrl) {
    return "";
  }

  try {
    const url = new URL(auditApiUrl);
    return `${url.origin}${CUSTOMS_PARSE_PATH}`;
  } catch {
    return "";
  }
}

function normalizeErrorPayload(payload: unknown) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const code = text(record.error_code) || text(record.error) || text(record.detail) || "AUDIT_API_FAILED";

    return {
      ...record,
      error: text(record.error) || code,
      error_code: code,
    };
  }

  return {
    error: "AUDIT_API_FAILED",
    error_code: "AUDIT_API_FAILED",
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isPdf(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".pdf") || file.type === "application/pdf";
}

function isXml(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".xml") || file.type === "application/xml" || file.type === "text/xml";
}
