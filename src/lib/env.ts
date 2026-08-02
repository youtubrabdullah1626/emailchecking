/**
 * Centralized Environment Configuration
 *
 * Single source of truth for critical environment variables.
 * Ensures the application fails fast during startup if misconfigured.
 */

import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID is required"),
  GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET is required"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid URL").optional(),
  CRON_SECRET: z.string().optional(),
  SCHEDULER_SECRET: z.string().optional(),
  ADMIN_SECRET: z.string().optional(),
});

// Cache the result
let parsedEnv: z.infer<typeof envSchema>;

export function getEnv() {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration. Check your .env file.");
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}

export function getAppUrl(): string {
  const env = getEnv();
  const url = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Ensure no trailing slash for deterministic OAuth redirect URIs
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function validateOAuthConfig(): void {
  // getEnv() already validates GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET
  getEnv();
}
