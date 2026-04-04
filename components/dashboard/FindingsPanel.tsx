import { severityClasses } from "@/components/dashboard/data";
import type { Finding } from "@/components/dashboard/types";

type FindingsPanelProps = {
  findings: Finding[];
};

export function FindingsPanel({ findings }: FindingsPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold">Hallazgos críticos</h3>
      <p className="mt-1 text-sm text-slate-500">Seguimiento de brechas, criticidad y vencimientos.</p>

      <div className="mt-6 space-y-4">
        {findings.map((finding) => (
          <div key={finding.title} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{finding.title}</p>
                <p className="mt-1 text-sm text-slate-500">{finding.area}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClasses[finding.severity]}`}
              >
                {finding.severity}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Compromiso</span>
              <span className="font-medium text-slate-700">{finding.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
