export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { GlobalResilienceProvider } from "@/components/providers/GlobalResilienceProvider";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from 'nextjs-toploader';
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";

export const metadata: Metadata = {
  title: {
    default: "Silaer — Personal Email Automation",
    template: "%s | Silaer",
  },
  description:
    "Personal outreach automation system. Build sequences once, send automatically, stop on replies.",
  icons: {
    icon: "/silaer-logo.png",
    shortcut: "/silaer-logo.png",
    apple: "/silaer-logo.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let fallbackHeaderStats = null;
  let bannerTheme = "DEFAULT";
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
    const bannerThemeConfig = await prisma.platform_configs.findFirst({ where: { key: "BANNER_THEME" } });
    if (bannerThemeConfig?.value) {
      bannerTheme = String(bannerThemeConfig.value);
    }
  } catch (e) {
    console.error("RootLayout error", e);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning data-theme={bannerTheme}>
        <NextTopLoader color="#4F46E5" showSpinner={false} speed={200} />
        <GlobalResilienceProvider>
          <AppShell fallbackHeaderStats={fallbackHeaderStats}>{children}</AppShell>
        </GlobalResilienceProvider>
        <Toaster />
      </body>
    </html>
  );
}
