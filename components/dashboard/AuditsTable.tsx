import { statusClasses } from "@/components/dashboard/data";
import type { Audit } from "@/components/dashboard/types";

type AuditsTableProps = {
  audits: Audit[];
};

export function AuditsTable({ audits }: AuditsTableProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Auditorías recientes</h3>
          <p className="mt-1 text-sm text-slate-500">
            Ejemplo de historial de auditorías con scoring y nivel de cumplimiento.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Última actualización: hoy
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Documento</th>
              <th className="pb-3 pr-4 font-medium">Riesgo</th>
              <th className="pb-3 pr-4 font-medium">Score</th>
              <th className="pb-3 pr-4 font-medium">Nivel</th>
              <th className="pb-3 font-medium">Propietario</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit) => (
              <tr key={audit.doc} className="border-b border-slate-100 align-top last:border-b-0">
                <td className="py-4 pr-4 font-medium text-slate-900">{audit.doc}</td>
                <td className="py-4 pr-4 text-slate-600">{audit.risk}</td>
                <td className="py-4 pr-4 text-slate-900">{audit.score}</td>
                <td className="py-4 pr-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[audit.status]}`}>
                    {audit.status}
                  </span>
                </td>
                <td className="py-4 text-slate-600">{audit.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
