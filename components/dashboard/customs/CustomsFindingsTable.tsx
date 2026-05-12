import { formatCurrency } from "@/components/dashboard/customs/mock-data";
import type { CustomsFinding, CustomsSeverity } from "@/lib/customs/types";

type CustomsFindingsTableProps = {
  findings: CustomsFinding[];
};

const severityClasses: Record<CustomsSeverity, string> = {
  Critical: "border-red-200 bg-red-100 text-red-700",
  High: "border-amber-200 bg-amber-100 text-amber-700",
  Medium: "border-blue-200 bg-blue-100 text-blue-700",
  Low: "border-slate-200 bg-slate-100 text-slate-700",
};

export function CustomsFindingsTable({ findings }: CustomsFindingsTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Tabla de hallazgos</h3>
          <p className="mt-1 text-sm text-slate-500">
            Hallazgos derivados de la revision integral del expediente aduanal.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {findings.length} hallazgos
        </span>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Severidad</th>
              <th className="pb-3 pr-4 font-medium">Regla</th>
              <th className="pb-3 pr-4 font-medium">Descripcion</th>
              <th className="pb-3 pr-4 font-medium">Recuperacion Potencial</th>
              <th className="pb-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr className="border-b border-slate-100 align-top last:border-b-0" key={finding.id}>
                <td className="py-4 pr-4">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClasses[finding.severity]}`}>
                    {finding.severity}
                  </span>
                </td>
                <td className="py-4 pr-4 font-medium text-slate-900">{finding.rule}</td>
                <td className="max-w-xl py-4 pr-4 text-slate-600">{finding.description}</td>
                <td className="py-4 pr-4 font-medium text-slate-900">{formatCurrency(finding.potentialRecovery)}</td>
                <td className="py-4 text-slate-600">{finding.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
