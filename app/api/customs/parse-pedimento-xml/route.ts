import { NextResponse } from "next/server";

import { getAuthContext, userCanReadEngine } from "@/lib/auth/session";

type PedimentoXmlData = {
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

const fieldAliases: Record<keyof Omit<PedimentoXmlData, "operation_code" | "tariff_items" | "coves" | "invoices" | "providers">, string[]> = {
  broker_name: ["broker_name", "agente_aduanal", "agenteAduanal", "nombreAgente", "nombreAgenteAduanal", "razonSocialAgente"],
  broker_patent: ["broker_patent", "patente", "patenteAduanal", "patenteAgente", "patenteAgenteAduanal"],
  commercial_value_usd: ["commercial_value_usd", "valorComercialUsd", "valorComercialDolares", "valorDolares", "valorComercial"],
  customs_office: ["customs_office", "aduana", "aduanaDespacho", "seccionAduanera", "claveAduana", "customsOffice"],
  customs_value_mxn: ["customs_value_mxn", "valorAduana", "valorAduanaMxn", "valorEnAduana", "valorComercialMxn"],
  dta_mxn: ["dta_mxn", "dta", "derechoTramiteAduanero", "importeDta"],
  exchange_rate: ["exchange_rate", "tipoCambio", "tipo_cambio", "tc", "exchangeRate"],
  igi_mxn: ["igi_mxn", "igi", "importeIgi", "impuestoGeneralImportacion"],
  import_date: ["import_date", "fechaEntrada", "fechaImportacion", "fechaOperacion", "importDate"],
  importer_name: ["importer_name", "importador", "nombreImportador", "razonSocialImportador", "destinatario"],
  importer_rfc: ["importer_rfc", "rfcImportador", "rfc", "rfcDestinatario", "taxId"],
  iva_mxn: ["iva_mxn", "iva", "importeIva"],
  payment_date: ["payment_date", "fechaPago", "fechaPagoReal", "paymentDate"],
  pedimento_full: ["pedimento_full", "pedimentoCompleto", "numeroPedimentoCompleto", "pedimento"],
  pedimento_number: ["pedimento_number", "numeroPedimento", "numPedimento", "pedimentoNumero", "pedimento"],
  prv_mxn: ["prv_mxn", "prv", "prevalidacion", "importePrv"],
  reference: ["reference", "referencia", "referenciaAduanal", "customsReference"],
  total_contributions_mxn: ["total_contributions_mxn", "totalContribuciones", "totalContribucionesMxn", "totalImpuestos", "totalEfectivo"],
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
    return NextResponse.json({ error: "INVALID_MULTIPART_FORM_DATA" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File) || !isXml(file)) {
    return NextResponse.json({ error: "XML_FILE_REQUIRED" }, { status: 400 });
  }

  const xml = await file.text().catch(() => "");

  if (!xml.trim()) {
    return NextResponse.json({ error: "XML_EMPTY" }, { status: 400 });
  }

  const data = parsePedimentoXml(xml);
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

function parsePedimentoXml(xml: string): PedimentoXmlData {
  const pedimentoNumber = cleanPedimentoNumber(firstXmlValue(xml, fieldAliases.pedimento_number));
  const importYear = yearFromDate(firstXmlValue(xml, fieldAliases.import_date)) || new Date().getFullYear();
  const igi = money(firstXmlValue(xml, fieldAliases.igi_mxn));
  const iva = money(firstXmlValue(xml, fieldAliases.iva_mxn));
  const dta = money(firstXmlValue(xml, fieldAliases.dta_mxn));
  const prv = money(firstXmlValue(xml, fieldAliases.prv_mxn));
  const detectedTotal = money(firstXmlValue(xml, fieldAliases.total_contributions_mxn));

  return {
    broker_name: firstXmlValue(xml, fieldAliases.broker_name),
    broker_patent: firstXmlValue(xml, fieldAliases.broker_patent),
    commercial_value_usd: money(firstXmlValue(xml, fieldAliases.commercial_value_usd)),
    customs_office: firstXmlValue(xml, fieldAliases.customs_office),
    customs_value_mxn: money(firstXmlValue(xml, fieldAliases.customs_value_mxn)),
    dta_mxn: dta,
    exchange_rate: money(firstXmlValue(xml, fieldAliases.exchange_rate)),
    igi_mxn: igi,
    import_date: firstXmlValue(xml, fieldAliases.import_date),
    importer_name: firstXmlValue(xml, fieldAliases.importer_name),
    importer_rfc: firstXmlValue(xml, fieldAliases.importer_rfc),
    iva_mxn: iva,
    operation_code: pedimentoNumber ? `IMP-${importYear}-${pedimentoNumber}` : "",
    payment_date: firstXmlValue(xml, fieldAliases.payment_date),
    pedimento_full: firstXmlValue(xml, fieldAliases.pedimento_full),
    pedimento_number: pedimentoNumber,
    prv_mxn: prv,
    coves: uniqueValues(["cove", "coves", "numeroCove", "numero_cove"].flatMap((alias) => allTagOrAttributeValues(xml, alias))),
    invoices: uniqueValues(["factura", "facturas", "invoice", "invoiceNumber", "numeroFactura"].flatMap((alias) => allTagOrAttributeValues(xml, alias))),
    providers: uniqueValues(["proveedor", "proveedores", "provider", "supplier", "nombreProveedor"].flatMap((alias) => allTagOrAttributeValues(xml, alias))),
    reference: firstXmlValue(xml, fieldAliases.reference),
    tariff_items: tariffItems(xml),
    total_contributions_mxn: detectedTotal ?? sumNumbers([igi, iva, dta, prv]),
  };
}

function firstXmlValue(xml: string, aliases: string[]) {
  for (const alias of aliases) {
    const tagValue = tagText(xml, alias);

    if (tagValue) {
      return tagValue;
    }

    const attributeValue = attributeText(xml, alias);

    if (attributeValue) {
      return attributeValue;
    }
  }

  return "";
}

function tagText(xml: string, localName: string) {
  const escaped = escapeRegExp(localName);
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`, "i");
  const match = xml.match(pattern);
  return normalizeText(match?.[1] ?? "");
}

function attributeText(xml: string, localName: string) {
  const escaped = escapeRegExp(localName);
  const pattern = new RegExp(`\\b(?:[\\w.-]+:)?${escaped}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = xml.match(pattern);
  return normalizeText(match?.[1] ?? "");
}

function tariffItems(xml: string) {
  const aliases = ["fraccion", "fraccionArancelaria", "fraccion_arancelaria", "tariffItem", "tariff_item"];
  const values = aliases.flatMap((alias) => allTagOrAttributeValues(xml, alias));
  return uniqueValues(values.map((value) => value.replace(/\D/g, "") || value)).slice(0, 100);
}

function allTagOrAttributeValues(xml: string, localName: string) {
  const escaped = escapeRegExp(localName);
  const values: string[] = [];
  const tagPattern = new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`, "gi");
  const attributePattern = new RegExp(`\\b(?:[\\w.-]+:)?${escaped}\\s*=\\s*["']([^"']+)["']`, "gi");
  let match = tagPattern.exec(xml);

  while (match) {
    const value = normalizeText(match[1]);

    if (value) {
      values.push(value);
    }

    match = tagPattern.exec(xml);
  }

  match = attributePattern.exec(xml);

  while (match) {
    const value = normalizeText(match[1]);

    if (value) {
      values.push(value);
    }

    match = attributePattern.exec(xml);
  }

  return values;
}

function normalizeText(value: string) {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).slice(0, 100);
}

function cleanPedimentoNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 7 ? digits.slice(-7) : digits;
}

function yearFromDate(value: string) {
  const match = value.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function confidence(detected: number, total: number) {
  return total > 0 ? Math.round((detected / total) * 100) : 0;
}

function isXml(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".xml") || file.type === "application/xml" || file.type === "text/xml";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
