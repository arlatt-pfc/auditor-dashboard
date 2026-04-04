import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AuditUploadResponse, StoredAuditDocument } from "@/lib/auditor/types";

const DEFAULT_AUDIT_QUERY = process.env.AUDITOR_DEFAULT_QUERY?.trim() || "trabajos en altura";
const TEMP_UPLOAD_ROOT = process.env.AUDITOR_UPLOAD_TMP_DIR || path.join(os.tmpdir(), "auditor-ai-uploads");

type PersistedUploadInput = {
  file: File;
  query?: string;
};

type PersistedUploadResult = {
  documentId: string;
  originalFilename: string;
  originalFilePath: string;
  query: string;
  workingDirectory: string;
};

export function getDefaultAuditQuery() {
  return DEFAULT_AUDIT_QUERY;
}

export async function persistUploadedPdf({ file, query }: PersistedUploadInput): Promise<PersistedUploadResult> {
  const documentId = crypto.randomUUID();
  const normalizedFilename = sanitizeFilename(file.name || `document-${documentId}.pdf`);
  const normalizedQuery = query?.trim() || DEFAULT_AUDIT_QUERY;
  const workingDirectory = path.join(TEMP_UPLOAD_ROOT, documentId);
  const originalFilePath = path.join(workingDirectory, normalizedFilename);
  const metaFilePath = path.join(workingDirectory, "meta.json");

  await mkdir(workingDirectory, { recursive: true });
  await writeFile(originalFilePath, Buffer.from(await file.arrayBuffer()));

  const metadata: StoredAuditDocument = {
    createdAt: new Date().toISOString(),
    documentId,
    originalFilename: normalizedFilename,
    query: normalizedQuery,
    storedFilename: normalizedFilename,
  };

  await writeFile(metaFilePath, JSON.stringify(metadata, null, 2), "utf8");

  return {
    documentId,
    originalFilename: normalizedFilename,
    originalFilePath,
    query: normalizedQuery,
    workingDirectory,
  };
}

type ExecuteAuditInput = {
  documentId: string;
  originalFilename: string;
  originalFilePath: string;
  query: string;
};

export async function executeDocumentAudit({
  documentId,
  originalFilename,
  originalFilePath,
  query,
}: ExecuteAuditInput): Promise<AuditUploadResponse> {
  const remoteUrl = process.env.AUDITOR_PIPELINE_URL?.trim();

  if (remoteUrl) {
    return executeRemoteAudit({
      documentId,
      originalFilename,
      originalFilePath,
      query,
      remoteUrl,
    });
  }

  return executeLocalFallbackAudit({
    documentId,
    originalFilename,
    originalFilePath,
    query,
  });
}

async function executeRemoteAudit({
  documentId,
  originalFilename,
  originalFilePath,
  query,
  remoteUrl,
}: ExecuteAuditInput & { remoteUrl: string }): Promise<AuditUploadResponse> {
  const formData = new FormData();
  const fileBuffer = await readFile(originalFilePath);
  const apiKey = process.env.AUDITOR_PIPELINE_API_KEY?.trim();

  formData.append("file", new Blob([fileBuffer], { type: "application/pdf" }), originalFilename);
  formData.append("query", query);
  formData.append("documentId", documentId);

  // Punto de integración con el backend operativo del VPS.
  // Ajusta AUDITOR_PIPELINE_URL para apuntar al servicio que hoy encapsula run_pipeline(...).
  const response = await fetch(remoteUrl, {
    method: "POST",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    body: formData,
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "El backend de auditoría rechazó la solicitud.";

    throw new Error(message);
  }

  const remotePayload = payload as Partial<AuditUploadResponse> & {
    outputPdfUrl?: string;
    summary?: string;
  };

  if (remotePayload.ok === false) {
    throw new Error(remotePayload.error || "El backend remoto respondió con un error de negocio.");
  }

  return {
    ok: true,
    documentId,
    mode: "remote",
    originalFilename,
    outputPdfUrl: remotePayload.outputPdfUrl,
    query,
    status: "completed",
    summary: remotePayload.summary || "La auditoría se ejecutó en el backend remoto y devolvió una respuesta válida.",
  };
}

async function executeLocalFallbackAudit({
  documentId,
  originalFilename,
  originalFilePath,
  query,
}: ExecuteAuditInput): Promise<AuditUploadResponse> {
  const fileStats = await stat(originalFilePath);
  const fileSizeInMb = (fileStats.size / (1024 * 1024)).toFixed(2);

  return {
    ok: true,
    documentId,
    mode: "local-fallback",
    originalFilename,
    query,
    status: "completed",
    summary:
      `El PDF se cargó correctamente (${fileSizeInMb} MB) y quedó almacenado para auditoría con el contexto ` +
      `"${query}". Esta instancia aún no tiene configurado AUDITOR_PIPELINE_URL, por lo que se dejó preparado el ` +
      `punto de integración para delegar la ejecución real al servicio que hoy encapsula run_pipeline(...).`,
  };
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
