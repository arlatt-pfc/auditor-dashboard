import { inflateSync } from "node:zlib";

import { NextResponse } from "next/server";

import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";

// Legacy local parser. New wizard flow uses /api/customs/parse-pedimento,
// which proxies parsing to the audit API service on the VPS.
type PedimentoPdfData = {
  broker_name: string;
  broker_patent: string;
  commercial_value_usd: number | null;
  customs_office: string;
  customs_value_mxn: number | null;
  dta_mxn: number | null;
  exchange_rate: number | null;
  igi_mxn: number | null;
  import_date: string;
  importer_name: string;
  importer_rfc: string;
  iva_mxn: number | null;
  operation_code: string;
  payment_date: string;
  pedimento_full: string;
  pedimento_number: string;
  prv_mxn: number | null;
  coves: string[];
  invoices: string[];
  providers: string[];
  reference: string;
  tariff_items: string[];
  total_contributions_mxn: number | null;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthContext();

  if (!auth?.profile) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!userCanReadEngine(auth, "CUSTOMS_COMPLIANCE")) {
    return NextResponse.json({ error: "ENGINE_READ_FORBIDDEN" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return errorResponse("INVALID_MULTIPART_FORM_DATA", 400);
  }

  const file = formData.get("file");

  if (!(file instanceof File) || !isPdf(file)) {
    return errorResponse("PDF_FILE_REQUIRED", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!buffer.subarray(0, 8).toString("latin1").includes("%PDF")) {
    return errorResponse("PDF_INVALID", 400);
  }

  const text = extractPdfText(buffer);

  if (!text.trim()) {
    return errorResponse("PDF_TEXT_NOT_EXTRACTABLE", 422);
  }

  const data = parsePedimentoPdf(text);
  const detectedFields = Object.entries(data)
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null && String(value).trim().length > 0))
    .map(([key]) => key);
  const missingFields = Object.keys(data).filter((key) => !detectedFields.includes(key));

  return NextResponse.json({
    confidence: confidence(detectedFields.length, Object.keys(data).length),
    detected: data,
    detected_fields: detectedFields,
    missing_fields: missingFields,
  });
}

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code, error_code: code }, { status });
}

function parsePedimentoPdf(text: string): PedimentoPdfData {
  const normalized = normalizeText(text);
  const upper = normalized.toUpperCase();
  const pedimentoParts = normalized.match(/\b(\d{2})\s+(\d{2})\s+(\d{4})\s+(\d{7})\b/);
  const pedimentoNumber = cleanPedimentoNumber(labelValue(normalized, ["pedimento", "num. pedimento", "numero de pedimento"])) || pedimentoParts?.[4] || "";
  const pedimentoFull = pedimentoParts ? `${pedimentoParts[1]} ${pedimentoParts[2]} ${pedimentoParts[3]} ${pedimentoParts[4]}` : "";
  const brokerPatent = labelValue(normalized, ["patente", "patente aduanal"]) || pedimentoParts?.[3] || "";
  const importDate = dateValue(normalized, ["entrada", "fecha de entrada", "fecha importacion", "fecha de importacion"]);
  const paymentDate = dateValue(normalized, ["pago", "fecha de pago"]);
  const importYear = yearFromDate(importDate) || yearFromPedimento(pedimentoParts?.[1]) || new Date().getFullYear();
  const igi = contributionValue(upper, "IGI");
  const iva = contributionValue(upper, "IVA");
  const dta = contributionValue(upper, "DTA");
  const prv = contributionValue(upper, "PRV");
  const detectedTotal = money(labelValue(normalized, ["total contribuciones", "total efectivo", "total"]));

  return {
    broker_name: partyName(normalized, ["agente aduanal", "nombre agente", "apoderado aduanal"]),
    broker_patent: brokerPatent,
    commercial_value_usd: money(labelValue(normalized, ["valor comercial dolares", "valor comercial usd", "valor dolares"])),
    customs_office: customsOffice(normalized, pedimentoParts?.[2]),
    customs_value_mxn: money(labelValue(normalized, ["valor aduana", "valor en aduana", "valor aduana mxn"])),
    dta_mxn: dta,
    exchange_rate: money(labelValue(normalized, ["tipo cambio", "tipo de cambio"])),
    igi_mxn: igi,
    import_date: importDate,
    importer_name: partyName(normalized, ["importador", "nombre importador", "razon social"]),
    importer_rfc: rfcValue(normalized),
    iva_mxn: iva,
    operation_code: pedimentoNumber ? `IMP-${importYear}-${pedimentoNumber}` : "",
    payment_date: paymentDate,
    pedimento_full: pedimentoFull || labelValue(normalized, ["pedimento completo"]),
    pedimento_number: pedimentoNumber,
    prv_mxn: prv,
    coves: coveValues(upper),
    invoices: invoiceValues(normalized),
    providers: providerValues(normalized),
    reference: referenceValue(normalized),
    tariff_items: tariffItems(normalized),
    total_contributions_mxn: detectedTotal ?? sumNumbers([igi, iva, dta, prv]),
  };
}

function extractPdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const chunks: string[] = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match = streamPattern.exec(source);

  while (match) {
    const dictionary = match[1];
    const streamBytes = Buffer.from(match[2], "latin1");
    const decoded = /\/FlateDecode\b/.test(dictionary) ? inflateStream(streamBytes) : streamBytes;

    if (decoded) {
      chunks.push(textFromPdfContent(decoded.toString("latin1")));
    }

    match = streamPattern.exec(source);
  }

  return normalizeText(chunks.join(" "));
}

function inflateStream(value: Buffer) {
  const trimmed = trimStreamBoundary(value);

  try {
    return inflateSync(trimmed);
  } catch {
    return null;
  }
}

function trimStreamBoundary(value: Buffer) {
  let start = 0;
  let end = value.length;

  while (start < end && (value[start] === 0x0a || value[start] === 0x0d || value[start] === 0x20)) {
    start += 1;
  }

  while (end > start && (value[end - 1] === 0x0a || value[end - 1] === 0x0d || value[end - 1] === 0x20)) {
    end -= 1;
  }

  return value.subarray(start, end);
}

function textFromPdfContent(content: string) {
  const values: string[] = [];
  const textPattern = /(\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>)\s*(?:Tj|'|"|TJ)/g;
  const arrayPattern = /\[(.*?)\]\s*TJ/g;
  let match = textPattern.exec(content);

  while (match) {
    values.push(decodePdfString(match[1]));
    match = textPattern.exec(content);
  }

  match = arrayPattern.exec(content);

  while (match) {
    values.push(...pdfStringsInArray(match[1]).map(decodePdfString));
    match = arrayPattern.exec(content);
  }

  return values.join(" ");
}

function pdfStringsInArray(value: string) {
  const strings: string[] = [];
  const pattern = /\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>/g;
  let match = pattern.exec(value);

  while (match) {
    strings.push(match[0]);
    match = pattern.exec(value);
  }

  return strings;
}

function decodePdfString(value: string) {
  if (value.startsWith("<")) {
    const bytes = Buffer.from(value.replace(/[<>\s]/g, ""), "hex");
    return bytes[0] === 0xfe && bytes[1] === 0xff ? utf16be(bytes.subarray(2)) : bytes.toString("latin1");
  }

  return value
    .slice(1, -1)
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      const replacements: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "(": "(", ")": ")", "\\": "\\" };
      return replacements[escaped] ?? escaped;
    })
    .replace(/\\(\d{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function utf16be(bytes: Buffer) {
  const swapped = Buffer.alloc(bytes.length);

  for (let index = 0; index < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1] ?? 0;
    swapped[index + 1] = bytes[index];
  }

  return swapped.toString("utf16le");
}

function labelValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:.-]?\\s*([A-Z0-9ÁÉÍÓÚÜÑ&.,/#\\- ]{2,80}?)(?=\\s{2,}|\\s(?:RFC|CURP|DOMICILIO|PEDIMENTO|ADUANA|PATENTE|FECHA|VALOR|TIPO|TOTAL|IGI|IVA|DTA|PRV)\\b|$)`, "i");
    const match = text.match(pattern);
    const value = normalizeText(match?.[1] ?? "");

    if (value) {
      return value;
    }
  }

  return "";
}

function dateValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:.-]?\\s*(\\d{1,2}[/-]\\d{1,2}[/-](?:\\d{2}|\\d{4}))`, "i");
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

function partyName(text: string, labels: string[]) {
  return labelValue(text, labels).replace(/\bRFC\b.*$/i, "").trim();
}

function referenceValue(text: string) {
  const labeled = labelValue(text, ["referencia", "referencia aduanal", "ref"]);
  const match = labeled.match(/[A-Z]{1,4}[-/]?\d{3,}[-/]?\d{0,4}/i) ?? text.match(/\b[A-Z]{1,4}-\d{3,}-\d{2,4}\b/i);
  return match?.[0] ?? labeled;
}

function rfcValue(text: string) {
  const importadorBlock = text.match(/importador[\s\S]{0,220}?([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i);
  const firstRfc = text.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i);
  return (importadorBlock?.[1] ?? firstRfc?.[0] ?? "").toUpperCase();
}

function customsOffice(text: string, pedimentoOffice?: string) {
  const labeled = labelValue(text, ["aduana", "aduana despacho", "aduana seccion"]);
  const labeledDigits = labeled.match(/\b\d{2,3}\b/)?.[0];

  if (labeledDigits) {
    return labeledDigits;
  }

  return pedimentoOffice ? `${pedimentoOffice}0` : "";
}

function contributionValue(text: string, key: string) {
  const pattern = new RegExp(`\\b${key}\\b\\s*[:.-]?\\s*(?:\\d+\\s+){0,4}([$]?[\\d,]+(?:\\.\\d+)?)`, "i");
  return money(text.match(pattern)?.[1] ?? "");
}

function tariffItems(text: string) {
  const labeled = Array.from(text.matchAll(/fracci[oó]n(?:\s+arancelaria)?\s*[:.-]?\s*(\d{8})/gi)).map((match) => match[1]);
  const fallback = Array.from(text.matchAll(/\b\d{8}\b/g)).map((match) => match[0]);
  return uniqueValues([...labeled, ...fallback]).slice(0, 100);
}

function providerValues(text: string) {
  return uniqueValues(Array.from(text.matchAll(/proveedor\s*[:.-]?\s*([A-Z0-9ÁÉÍÓÚÜÑ&.,/#\- ]{3,80})/gi)).map((match) => match[1]));
}

function invoiceValues(text: string) {
  return uniqueValues(Array.from(text.matchAll(/factura\s*[:.-]?\s*([A-Z0-9\-/.]{3,40})/gi)).map((match) => match[1]));
}

function coveValues(text: string) {
  return uniqueValues(Array.from(text.matchAll(/\bCOVE\s*[:.-]?\s*([A-Z0-9]{6,30})\b/gi)).map((match) => match[1]));
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function money(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumNumbers(values: (number | null)[]) {
  const validValues = values.filter((value): value is number => typeof value === "number");
  return validValues.length > 0 ? validValues.reduce((total, value) => total + value, 0) : null;
}

function cleanPedimentoNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 7 ? digits.slice(-7) : digits;
}

function yearFromDate(value: string) {
  const match = value.match(/\b(20\d{2}|19\d{2})\b/);

  if (match) {
    return Number(match[1]);
  }

  const shortYear = value.match(/[/-](\d{2})$/);
  return shortYear ? 2000 + Number(shortYear[1]) : null;
}

function yearFromPedimento(value?: string) {
  return value ? 2000 + Number(value) : null;
}

function confidence(detected: number, total: number) {
  return total > 0 ? Math.round((detected / total) * 100) : 0;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).slice(0, 100);
}

function isPdf(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".pdf") || file.type === "application/pdf";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
