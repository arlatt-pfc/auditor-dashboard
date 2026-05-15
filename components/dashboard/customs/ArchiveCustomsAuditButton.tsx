"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArchiveCustomsAuditButtonProps = {
  auditId: string;
};

export function ArchiveCustomsAuditButton({ auditId }: ArchiveCustomsAuditButtonProps) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);

  async function archiveAudit() {
    const confirmed = window.confirm("La auditoría se archivará y dejará de aparecer en el histórico.");

    if (!confirmed) {
      return;
    }

    setIsArchiving(true);

    const response = await fetch(`/api/customs/audits/${encodeURIComponent(auditId)}`, {
      body: JSON.stringify({
        delete_reason: "Archivada desde histórico Customs Compliance.",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "DELETE",
    }).catch(() => null);

    setIsArchiving(false);

    if (!response?.ok) {
      window.alert("No se pudo archivar la auditoría.");
      return;
    }

    router.refresh();
  }

  return (
    <button
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isArchiving}
      onClick={() => {
        void archiveAudit();
      }}
      type="button"
    >
      {isArchiving ? "Archivando..." : "Archivar"}
    </button>
  );
}
