/**
 * Seed file for Platform Configuration (Phase 17)
 * Uses snake_case Prisma model names matching the schema.
 * Run: npx tsx prisma/seed-platform.ts
 */

import prisma from "../src/lib/prisma";

const ENV = process.env.NODE_ENV === "production" ? "production" : "production";

async function seedPlatformConfig() {
  console.log("[Seed] Seeding Platform Configuration...");

  // ── Feature Flags ────────────────────────────────────────────────────────────
  const featureFlags = [
    {
      key: "SCHEDULER_ENABLED", name: "Scheduler",
      description: "Allow campaign jobs to execute. Disabling pauses all outgoing emails.",
      category: "SCHEDULER" as const, enabled: true, risk_level: "RESTRICTED" as const,
      is_safe_runtime: true, requires_reason: true,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "SMART_IMPORT_ENABLED", name: "Smart Import",
      description: "Allow users to upload CSV files for prospect importing.",
      category: "DATA" as const, enabled: true, risk_level: "SAFE" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "EMAIL_TRACKING_ENABLED", name: "Email Tracking",
      description: "Inject open and click tracking pixels in outgoing campaigns.",
      category: "OUTREACH" as const, enabled: true, risk_level: "SAFE" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "WARMUP_ENABLED", name: "Email Warmup",
      description: "Run automated background email warmup sequences.",
      category: "OUTREACH" as const, enabled: true, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: ["SCHEDULER_ENABLED"], environment: ENV,
    },
    {
      key: "REPLY_SCANNER_ENABLED", name: "Reply Scanner",
      description: "Listen for incoming Gmail reply webhooks.",
      category: "INTEGRATION" as const, enabled: true, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: ["SCHEDULER_ENABLED"], environment: ENV,
    },
    {
      key: "MAINTENANCE_MODE", name: "Maintenance Mode",
      description: "Take the entire platform offline for scheduled maintenance.",
      category: "INFRASTRUCTURE" as const, enabled: false, risk_level: "RESTRICTED" as const,
      is_safe_runtime: true, requires_reason: true,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_SEQUENCES", name: "Lock Sequences Page",
      description: "Lock sequence management and campaign builders for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_SMART_IMPORT", name: "Lock Smart Import Page",
      description: "Lock CSV/Excel spreadsheet upload and mapping tools for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_PROSPECTS", name: "Lock Prospects Page",
      description: "Lock direct prospect view, editing, and ad-hoc composer for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_TIMELINE", name: "Lock Timeline Inspector",
      description: "Lock visual campaign timeline and live scheduling visualizer for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_REPLIES", name: "Lock Replies Inbox",
      description: "Lock prospect reply inbox and AI intent categorization for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "PAGE_LOCK_ANALYTICS", name: "Lock Analytics Page",
      description: "Lock platform analytics and delivery metric charts for regular users.",
      category: "SECURITY" as const, enabled: false, risk_level: "WARNING" as const,
      is_safe_runtime: true, requires_reason: false,
      rollout_strategy: "GLOBAL" as const, depends_on: [] as string[], environment: ENV,
    },
    {
      key: "campaign_pause_resume",
      name: "Campaign Pause / Resume",
      description: "When enabled, users can pause and resume active campaigns from the Live Execution Dashboard. When disabled, campaigns run straight through — the only way to stop a campaign is to delete it.",
      category: "OUTREACH" as const,
      enabled: true,
      risk_level: "SAFE" as const,
      is_safe_runtime: true,
      requires_reason: false,
      rollout_strategy: "GLOBAL" as const,
      depends_on: [] as string[],
      environment: ENV,
    },


  ];


  for (const flag of featureFlags) {
    await prisma.feature_flags.upsert({
      where: { key: flag.key },
      update: { ...flag },
      create: { ...flag },
    });
  }
  console.log(`[Seed] ✓ Seeded ${featureFlags.length} feature flags`);

  // ── Platform Configs ──────────────────────────────────────────────────────────
  const platformConfigs = [
    {
      key: "MAX_DAILY_EMAILS", name: "Daily Email Limit",
      description: "Global maximum daily send cap per connected account.",
      category: "OUTREACH" as const, data_type: "NUMBER" as const,
      value: 500 as any, default_value: 500 as any,
      validation_rules: { min: 1, max: 10000 } as any,
      risk_level: "WARNING" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "HOURLY_EMAIL_LIMIT", name: "Hourly Email Limit",
      description: "Maximum emails that can be sent in a rolling 1-hour window to protect domain reputation.",
      category: "OUTREACH" as const, data_type: "NUMBER" as const,
      value: 50 as any, default_value: 50 as any,
      validation_rules: { min: 1, max: 500 } as any,
      risk_level: "WARNING" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "MAX_ACTIVE_SEQUENCES", name: "Max Active Sequences",
      description: "Maximum number of concurrently running outreach sequences.",
      category: "OUTREACH" as const, data_type: "NUMBER" as const,
      value: 5 as any, default_value: 5 as any,
      validation_rules: { min: 1, max: 50 } as any,
      risk_level: "SAFE" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "SCHEDULER_INTERVAL_MINUTES", name: "Scheduler Interval",
      description: "Frequency of background campaign processing ticks in minutes.",
      category: "SCHEDULER" as const, data_type: "NUMBER" as const,
      value: 5 as any, default_value: 5 as any,
      validation_rules: { min: 1, max: 60 } as any,
      risk_level: "WARNING" as const, is_safe_runtime: false, environment: ENV,
    },
    {
      key: "SCHEDULER_BATCH_SIZE", name: "Scheduler Batch Size",
      description: "Maximum emails processed per single scheduler tick.",
      category: "SCHEDULER" as const, data_type: "NUMBER" as const,
      value: 50 as any, default_value: 50 as any,
      validation_rules: { min: 1, max: 500 } as any,
      risk_level: "SAFE" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "MAX_IMPORT_ROWS", name: "Maximum Import Size",
      description: "Maximum CSV rows allowed in a single prospect upload.",
      category: "DATA" as const, data_type: "NUMBER" as const,
      value: 10000 as any, default_value: 10000 as any,
      validation_rules: { min: 100, max: 100000 } as any,
      risk_level: "SAFE" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "BANNER_THEME", name: "Dashboard Banner Theme",
      description: "Dynamically change the color theme of the executive banner.",
      category: "DATA" as const, data_type: "ENUM" as const,
      value: "DEFAULT" as any, default_value: "DEFAULT" as any,
      validation_rules: { options: ["DEFAULT", "GREEN", "RED", "BLUE", "ORANGE", "PURPLE"] } as any,
      risk_level: "SAFE" as const, is_safe_runtime: true, environment: ENV,
    },
    {
      key: "GMAIL_RETRY_LIMIT", name: "Retry Attempts",
      description: "Maximum retry attempts when Gmail API returns a rate limit error.",
      category: "INTEGRATION" as const, data_type: "NUMBER" as const,
      value: 3 as any, default_value: 3 as any,
      validation_rules: { min: 1, max: 10 } as any,
      risk_level: "SAFE" as const, is_safe_runtime: true, environment: ENV,
    },
  ];

  for (const config of platformConfigs) {
    await prisma.platform_configs.upsert({
      where: { key: config.key },
      update: { ...config },
      create: { ...config },
    });
  }
  console.log(`[Seed] ✓ Seeded ${platformConfigs.length} platform configs`);

  // ── Provider Configs ──────────────────────────────────────────────────────────
  const providerConfigs = [
    {
      key: "EMAIL_PROVIDER", name: "Email Delivery Provider",
      description: "Primary outbound email delivery mechanism.",
      active_provider: "Gmail API",
      allowed_values: ["Gmail API", "SMTP", "SendGrid"],
      environment: ENV,
    },
  ];

  for (const provider of providerConfigs) {
    await prisma.provider_configs.upsert({
      where: { key: provider.key },
      update: { ...provider },
      create: { ...provider },
    });
  }
  console.log(`[Seed] ✓ Seeded ${providerConfigs.length} provider configs`);

  console.log("[Seed] ✅ Platform Configuration seeded successfully.");
}

// ── Entrypoint ───────────────────────────────────────────────────────────────
seedPlatformConfig()
  .catch((e) => {
    console.error("[Seed] ❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
