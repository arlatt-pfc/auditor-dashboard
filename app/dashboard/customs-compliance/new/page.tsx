import Link from "next/link";

import { CustomsExpedientWizard } from "@/components/dashboard/customs/CustomsExpedientWizard";
import { Header } from "@/components/dashboard/Header";
import { PageShell } from "@/components/dashboard/PageShell";
import { getAuthContext, userCanCreateEngine, userCanExecuteEngine, userCanReadEngine } from "@/lib/auth/session";

const currentPath = "/dashboard/customs-compliance";

export default async function NewCustomsExpedientPage() {
  const auth = await getAuthContext();
  const canRead = userCanReadEngine(auth, "CUSTOMS_COMPLIANCE");
  const canExecute = userCanCreateEngine(auth, "CUSTOMS_COMPLIANCE") && userCanExecuteEngine(auth, "CUSTOMS_COMPLIANCE");

  if (!canRead) {
    return (
      <PageShell currentPath={currentPath}>
        <Header
          eyebrow="CUSTOMS_COMPLIANCE"
          title="Acceso restringido"
          description="Tu usuario no tiene acceso asignado al motor CUSTOMS_COMPLIANCE para esta empresa."
        />
      </PageShell>
    );
  }

  return (
    <PageShell currentPath={currentPath}>
      <Header
        eyebrow="CUSTOMS_COMPLIANCE"
        title="Nuevo expediente aduanal"
        description="Carga los datos base y documentos del expediente antes de ejecutar la auditoría con el motor externo."
        actions={
          <Link
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            href="/dashboard/customs-compliance"
          >
            Volver a expedientes
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <CustomsExpedientWizard canExecute={canExecute} />
      </div>
    </PageShell>
  );
}
