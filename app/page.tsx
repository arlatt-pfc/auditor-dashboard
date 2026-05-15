import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";

export default async function HomePage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  redirect("/dashboard/customs-compliance");
}
