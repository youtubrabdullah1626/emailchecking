import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from 'nextjs-toploader';
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

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
      
      const emailAcc = await prisma.emailAccount.findFirst({ 
        where: { user_id: session.user.id, is_primary: true } 
      });
      fallbackHeaderStats = {
        connectedGmail: emailAcc?.email_address || null,
        connectionStatus: emailAcc?.status || "DISCONNECTED"
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
