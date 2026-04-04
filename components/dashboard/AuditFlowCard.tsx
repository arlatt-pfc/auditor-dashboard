type AuditFlowCardProps = {
  steps: string[];
};

export function AuditFlowCard({ steps }: AuditFlowCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold">Flujo de auditoría</h3>
      <p className="mt-1 text-sm text-slate-500">Ejemplo del journey operativo dentro del producto.</p>

      <ol className="mt-6 space-y-4">
        {steps.map((step, idx) => (
          <li key={step} className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {idx + 1}
            </div>
            <p className="pt-1 text-sm leading-6 text-slate-600">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
