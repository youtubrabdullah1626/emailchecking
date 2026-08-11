import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from 'nextjs-toploader';
export const metadata: Metadata = {
  title: {
    default: "Outreach — Personal Email Automation",
    template: "%s | Outreach",
  },
  description:
    "Personal outreach automation system. Build sequences once, send automatically, stop on replies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextTopLoader color="#4F46E5" showSpinner={false} speed={200} />
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
