import { formatCurrency } from "@/components/dashboard/customs/mock-data";
import type { CustomsOperation } from "@/lib/customs/types";

type CustomsOperationsTableProps = {
  operations: CustomsOperation[];
  selectedOperationId: string;
};

export function CustomsOperationsTable({ operations, selectedOperationId }: CustomsOperationsTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Operaciones aduaneras</h3>
          <p className="mt-1 text-sm text-slate-500">Registros leidos desde customs_operations.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {operations.length} operaciones
        </span>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Operacion</th>
              <th className="pb-3 pr-4 font-medium">Pedimento</th>
              <th className="pb-3 pr-4 font-medium">Importador</th>
              <th className="pb-3 pr-4 font-medium">Agente</th>
              <th className="pb-3 pr-4 font-medium">Recuperacion</th>
              <th className="pb-3 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr className="border-b border-slate-100 align-top last:border-b-0" key={operation.operationId}>
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900">{operation.operationId}</div>
                  {operation.operationId === selectedOperationId ? (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      En detalle
                    </span>
                  ) : null}
                </td>
                <td className="py-4 pr-4 text-slate-600">{operation.pedimento}</td>
                <td className="max-w-xs py-4 pr-4 text-slate-600">{operation.importer}</td>
                <td className="max-w-xs py-4 pr-4 text-slate-600">{operation.broker}</td>
                <td className="py-4 pr-4 font-medium text-slate-900">{formatCurrency(operation.metrics.potentialRecovery)}</td>
                <td className="py-4 text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {operation.metrics.severity} {operation.metrics.riskScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
