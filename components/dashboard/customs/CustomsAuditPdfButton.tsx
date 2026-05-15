"use client";

type CustomsAuditPdfButtonProps = {
  auditResult: Record<string, unknown>;
  className?: string;
  expediente: string;
  loadedDocuments: unknown[];
  missingDocuments: unknown[];
  pedimentoData: Record<string, unknown>;
};

export function CustomsAuditPdfButton({ auditResult, className, expediente, loadedDocuments, missingDocuments, pedimentoData }: CustomsAuditPdfButtonProps) {
  async function downloadPdf() {
    const response = await fetch("/api/reports/customs-pdf", {
      body: JSON.stringify({
        auditResult,
        loadedDocuments,
        missingDocuments,
        pedimentoData,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    if (!response?.ok) {
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Auditoria_${safeFilename(expediente)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      className={className ?? "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"}
      onClick={() => {
        void downloadPdf();
      }}
      type="button"
    >
      <PdfIcon />
      PDF
    </button>
  );
}

function PdfIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 15h6" />
      <path d="M9 18h4" />
    </svg>
  );
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_") || "expediente";
}
