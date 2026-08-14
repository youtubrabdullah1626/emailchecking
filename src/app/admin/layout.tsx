import { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = session.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER" || user?.email === "youtubrabdullah1626@gmail.com";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
