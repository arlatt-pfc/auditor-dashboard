import { NextResponse } from "next/server";

import { executeDocumentAudit, persistUploadedPdf } from "@/lib/auditor/service";
import type { AuditUploadResponse } from "@/lib/auditor/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const queryEntry = formData.get("query");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json<AuditUploadResponse>(
        {
          ok: false,
          error: "Selecciona un archivo PDF antes de continuar.",
        },
        { status: 400 },
      );
    }

    const isPdf = fileEntry.type === "application/pdf" || fileEntry.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json<AuditUploadResponse>(
        {
          ok: false,
          error: "Solo se permiten archivos PDF.",
        },
        { status: 400 },
      );
    }

    const persistedUpload = await persistUploadedPdf({
      file: fileEntry,
      query: typeof queryEntry === "string" ? queryEntry : undefined,
    });

    const auditResult = await executeDocumentAudit(persistedUpload);

    return NextResponse.json<AuditUploadResponse>(auditResult);
  } catch (error) {
    return NextResponse.json<AuditUploadResponse>(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No fue posible cargar y auditar el documento.",
      },
      { status: 500 },
    );
  }
}
