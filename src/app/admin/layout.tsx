import { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasRole, isOwnerEmail } from "@/lib/auth/roles";
import { UserRole } from "@/types/next-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/login");
  }

  const isOwner = isOwnerEmail(session.user.email);
  const canViewAdmin = isOwner || hasRole(session.user.role as UserRole, "HELPER", session.user.email);

  if (!canViewAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
