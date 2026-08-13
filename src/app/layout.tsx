import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";

export const metadata: Metadata = {
  title: {
    default: "Outreach — Personal Email Automation",
    template: "%s | Outreach",
  },
  description:
    "Personal outreach automation system. Build sequences once, send automatically, stop on replies.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let fallbackHeaderStats = null;
  try {
    const session = await getSession();
    if (session?.user) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const tenantPrisma = getTenantPrisma(session.user.id);
      const emailAcc = await tenantPrisma.emailAccount.findFirst({ 
        orderBy: { updated_at: "desc" },
        select: { email: true, connection_status: true }
      });
      fallbackHeaderStats = {
        connectedGmail: emailAcc?.email || null,
        connectionStatus: emailAcc?.connection_status || "DISCONNECTED"
      };
    }
  } catch (e) {
    console.error("RootLayout error", e);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextTopLoader color="#4F46E5" showSpinner={false} speed={200} />
        <AppShell fallbackHeaderStats={fallbackHeaderStats}>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
