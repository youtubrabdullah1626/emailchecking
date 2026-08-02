import { redirect } from "next/navigation";

/**
 * Root page — redirects to /dashboard.
 * Phase 7+: /dashboard is the main operations portal.
 */
export default function HomePage() {
  redirect("/dashboard");
}
