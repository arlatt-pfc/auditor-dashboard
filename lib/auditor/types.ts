export type AuditFramework = "STPS" | "PEMEX" | "CUSTOMS_COMPLIANCE";

export type AuditUploadResponse =
  | {
      ok: true;
      documentId: string;
      mode: "remote" | "local-fallback";
      originalFilename: string;
      outputPdfUrl?: string;
      query: string;
      status: "completed";
      summary: string;
    }
  | {
      ok: false;
      error: string;
    };

export type DocumentAuditUiStatus = "idle" | "uploading" | "processing" | "success" | "error";

export type StoredAuditDocument = {
  createdAt: string;
  documentId: string;
  originalFilename: string;
  query: string;
  storedFilename: string;
};
