import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getAuthContext } from "@/lib/auth/session";

export default async function LoginPage() {
  const auth = await getAuthContext();

  if (auth) {
    redirect("/dashboard/customs-compliance");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">LOGISTICA DE DATOS</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">LDA Compliance Platform</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Acceso seguro para auditorias empresariales por rol y motor autorizado.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
