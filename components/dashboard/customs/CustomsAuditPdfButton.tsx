"use client";

type CustomsAuditPdfButtonProps = {
  auditResult: Record<string, unknown>;
  expediente: string;
  loadedDocuments: unknown[];
  missingDocuments: unknown[];
  pedimentoData: Record<string, unknown>;
};

export function CustomsAuditPdfButton({ auditResult, expediente, loadedDocuments, missingDocuments, pedimentoData }: CustomsAuditPdfButtonProps) {
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
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      onClick={() => {
        void downloadPdf();
      }}
      type="button"
    >
      PDF
    </button>
  );
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_") || "expediente";
}
