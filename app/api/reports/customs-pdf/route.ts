import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

import { formatMexicoDateTime } from "@/lib/date-format";

type PdfRequest = {
  auditResult?: AuditResult;
  loadedDocuments?: DocumentSummary[];
  missingDocuments?: DocumentSummary[];
  pedimentoData?: PedimentoData;
};

type AuditResult = {
  compliance_percent?: number | string;
  executive_dictamen?: string;
  findings?: (AuditFinding | string)[];
  risk_level?: string;
  top_critical_gaps?: string[];
};

type AuditFinding = {
  description?: string;
  recommendation?: string;
  severity?: string;
  title?: string;
};

type PedimentoData = {
  broker_name?: string;
  importer_name?: string;
  operation_code?: string;
  pedimento_full?: string;
  pedimento_number?: string;
  reference?: string;
};

type DocumentSummary = {
  document_type?: string;
  file_name?: string | null;
  files?: { file_index?: number; file_name?: string | null }[];
  label?: string;
};

type PdfContext = {
  boldFont: PDFFont;
  font: PDFFont;
  page: PDFPage;
  pdf: PDFDocument;
  y: number;
};

const pageSize: [number, number] = [612, 792];
const margin = 48;
const brandBlue = rgb(0.05, 0.13, 0.26);
const slate = rgb(0.2, 0.25, 0.33);
const muted = rgb(0.43, 0.48, 0.56);

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PdfRequest | null;

  if (!payload?.auditResult || !payload.pedimentoData) {
    return Response.json({ error: "INVALID_REPORT_PAYLOAD" }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readFile(path.join(process.cwd(), "public", "lda-logo-header-96.png")).catch(() => null);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;
  const firstPage = pdf.addPage(pageSize);
  const context: PdfContext = { boldFont, font, page: firstPage, pdf, y: 700 };
  const pedimento = payload.pedimentoData;
  const audit = payload.auditResult;
  const expediente = clean(pedimento.operation_code) || clean(pedimento.pedimento_number) || "sin-expediente";
  const issuedAt = formatMexicoDateTime(new Date());

  drawCover(context, {
    expediente,
    importerName: clean(pedimento.importer_name) || "Pendiente",
    issuedAt,
    logo,
  });

  addPage(context);
  sectionTitle(context, "Resumen Ejecutivo");
  keyValue(context, "Expediente", pedimento.operation_code);
  keyValue(context, "Pedimento", pedimento.pedimento_full || pedimento.pedimento_number);
  keyValue(context, "Referencia", pedimento.reference);
  keyValue(context, "Importador", pedimento.importer_name);
  keyValue(context, "Agente aduanal", pedimento.broker_name);
  keyValue(context, "Cumplimiento estimado", `${clean(audit.compliance_percent) || "0"}%`);
  keyValue(context, "Nivel de riesgo", audit.risk_level);
  paragraph(context, clean(audit.executive_dictamen) || "Sin dictamen ejecutivo disponible.");

  sectionTitle(context, "Documentos recibidos");
  bulletList(context, documentLines(payload.loadedDocuments), "No se registraron documentos recibidos.");

  sectionTitle(context, "Brechas documentales");
  bulletList(context, documentLines(payload.missingDocuments), "No se registraron brechas documentales.");

  sectionTitle(context, "Hallazgos preliminares");
  const findings = normalizeFindings(audit.findings);
  if (findings.length === 0) {
    paragraph(context, "No se detectaron hallazgos preliminares.");
  } else {
    for (const finding of findings) {
      ensureSpace(context, 92);
      drawText(context, `${finding.severity} - ${finding.title}`, { font: context.boldFont, size: 10, color: severityColor(finding.severity) });
      paragraph(context, finding.description, { size: 9, indent: 12 });
      paragraph(context, `Recomendación: ${finding.recommendation}`, { size: 9, indent: 12 });
      context.y -= 5;
    }
  }

  sectionTitle(context, "Recomendaciones correctivas");
  const recommendations = findings.map((finding) => finding.recommendation).filter(Boolean);
  bulletList(context, unique(recommendations), "Validar expediente y documentar acciones correctivas con personal especializado.");

  sectionTitle(context, "Dictamen ejecutivo final");
  paragraph(context, clean(audit.executive_dictamen) || "El expediente fue procesado por LDA Compliance para revisión preliminar.");

  sectionTitle(context, "Disclaimer");
  paragraph(
    context,
    "Este reporte constituye un análisis preliminar automatizado generado por LDA Compliance y debe ser validado por personal especializado en comercio exterior y cumplimiento regulatorio.",
    { size: 9 },
  );

  addFooter(context);

  const pdfBytes = await pdf.save();
  const filename = `Reporte_Auditoria_${safeFilename(expediente)}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}

function drawCover(
  context: PdfContext,
  {
    expediente,
    importerName,
    issuedAt,
    logo,
  }: {
    expediente: string;
    importerName: string;
    issuedAt: string;
    logo: PDFImage | null;
  },
) {
  context.page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: rgb(0.97, 0.98, 1) });
  context.page.drawRectangle({ x: 0, y: 610, width: pageSize[0], height: 182, color: brandBlue });

  if (logo) {
    const dimensions = logo.scale(0.36);
    context.page.drawImage(logo, { x: margin, y: 700, width: dimensions.width, height: dimensions.height });
  } else {
    drawText(context, "LOGÍSTICA DE DATOS", { x: margin, y: 720, color: rgb(1, 1, 1), font: context.boldFont, size: 18 });
  }

  drawText(context, "LDA Compliance", { x: margin, y: 575, color: brandBlue, font: context.boldFont, size: 14 });
  drawText(context, "Reporte Ejecutivo de Auditoría Aduanal", { x: margin, y: 520, color: brandBlue, font: context.boldFont, size: 28 });
  drawText(context, `Fecha de emisión: ${issuedAt}`, { x: margin, y: 455, color: slate, size: 11 });
  drawText(context, `Folio de auditoría: ${expediente}`, { x: margin, y: 430, color: slate, size: 11 });
  drawText(context, `Importador: ${importerName}`, { x: margin, y: 405, color: slate, size: 11 });
  drawText(context, "Documento confidencial de uso ejecutivo", { x: margin, y: 85, color: muted, size: 9 });
}

function addPage(context: PdfContext) {
  context.page = context.pdf.addPage(pageSize);
  context.y = 720;
}

function addFooter(context: PdfContext) {
  const pageCount = context.pdf.getPageCount();
  for (const [index, page] of context.pdf.getPages().entries()) {
    page.drawText(`LDA Compliance · Página ${index + 1} de ${pageCount}`, {
      x: margin,
      y: 30,
      size: 8,
      font: context.font,
      color: muted,
    });
  }
}

function sectionTitle(context: PdfContext, title: string) {
  ensureSpace(context, 48);
  context.y -= 14;
  drawText(context, title, { color: brandBlue, font: context.boldFont, size: 15 });
  context.page.drawLine({ start: { x: margin, y: context.y - 6 }, end: { x: pageSize[0] - margin, y: context.y - 6 }, thickness: 1, color: rgb(0.84, 0.88, 0.94) });
  context.y -= 22;
}

function keyValue(context: PdfContext, label: string, value: unknown) {
  ensureSpace(context, 24);
  const rowY = context.y;
  drawText(context, `${label}:`, { font: context.boldFont, size: 9, color: slate, y: rowY });
  const lines = wrapText(clean(value) || "Pendiente", context.font, 9, pageSize[0] - 175 - margin);
  for (const [index, line] of lines.entries()) {
    drawText(context, line, { x: 175, y: rowY - index * 13, size: 9, color: slate });
  }
  context.y = rowY - Math.max(1, lines.length) * 14;
}

function bulletList(context: PdfContext, items: string[], emptyText: string) {
  const lines = items.length > 0 ? items : [emptyText];
  for (const item of lines) {
    ensureSpace(context, 30);
    drawText(context, "•", { x: margin, font: context.boldFont, size: 10 });
    paragraph(context, item, { indent: 18, size: 9 });
  }
}

function paragraph(context: PdfContext, text: string, options: { indent?: number; size?: number; x?: number; y?: number } = {}) {
  const size = options.size ?? 10;
  const x = options.x ?? margin + (options.indent ?? 0);
  const maxWidth = pageSize[0] - margin - x;
  const lines = wrapText(clean(text), context.font, size, maxWidth);

  if (options.y !== undefined) {
    for (const line of lines) {
      drawText(context, line, { x, y: options.y, size, color: slate });
    }
    return;
  }

  for (const line of lines) {
    ensureSpace(context, 18);
    drawText(context, line, { x, size, color: slate });
  }
  context.y -= 4;
}

function drawText(
  context: PdfContext,
  text: string,
  options: { color?: ReturnType<typeof rgb>; font?: PDFFont; size?: number; x?: number; y?: number } = {},
) {
  const size = options.size ?? 10;
  context.page.drawText(text, {
    x: options.x ?? margin,
    y: options.y ?? context.y,
    size,
    font: options.font ?? context.font,
    color: options.color ?? slate,
  });
  if (options.y === undefined) {
    context.y -= size + 5;
  }
}

function ensureSpace(context: PdfContext, needed: number) {
  if (context.y - needed > 64) {
    return;
  }

  addPage(context);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function normalizeFindings(findings: AuditResult["findings"]) {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings.map((finding, index) => {
    if (typeof finding === "string") {
      return {
        description: finding,
        recommendation: "Revisar evidencia documental y registrar acción correctiva.",
        severity: "Medium",
        title: `Hallazgo ${index + 1}`,
      };
    }

    return {
      description: clean(finding.description) || "Sin descripción disponible.",
      recommendation: clean(finding.recommendation) || "Sin recomendación disponible.",
      severity: clean(finding.severity) || "Medium",
      title: clean(finding.title) || `Hallazgo ${index + 1}`,
    };
  });
}

function documentLines(documents: DocumentSummary[] | undefined) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.flatMap((document) => {
    const label = clean(document.label) || clean(document.document_type) || "Documento";
    const files = Array.isArray(document.files) ? document.files : [];

    if (files.length > 0) {
      return files.map((file) => `${label} - ${clean(file.file_name) || "Sin archivo"}`);
    }

    return [`${label}${document.file_name ? ` - ${document.file_name}` : ""}`];
  });
}

function severityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return rgb(0.7, 0.08, 0.08);
    case "high":
      return rgb(0.76, 0.28, 0.04);
    case "low":
      return rgb(0.08, 0.28, 0.64);
    case "medium":
    default:
      return rgb(0.67, 0.45, 0.05);
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_") || "expediente";
}
