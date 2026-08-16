export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isOwnerEmail, hasRole } from "@/lib/auth/roles";
import { UserRole } from "@/types/next-auth";

export default async function LegacySchedulerRedirect() {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/login");
  }

  const isOwner = isOwnerEmail(session.user.email);
  const isAdmin = isOwner || hasRole(session.user.role as UserRole, "ADMIN", session.user.email);

  if (isAdmin) {
    redirect("/admin/scheduler");
  }

  redirect("/dashboard");
}
