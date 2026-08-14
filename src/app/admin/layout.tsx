import { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/roles";
import { UserRole } from "@/types/next-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // ADMIN_VIEWER is the minimum role required to view the admin panel.
  // USER and HELPER will be blocked and redirected to the dashboard.
  const canViewAdmin = hasRole(session.user.role as UserRole, "ADMIN_VIEWER") || session.user.email === "youtubrabdullah1626@gmail.com";

  if (!canViewAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
