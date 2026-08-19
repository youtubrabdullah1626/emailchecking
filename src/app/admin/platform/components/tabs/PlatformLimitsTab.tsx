"use client";

import { usePlatformConfigs } from "../../hooks/usePlatformConfigs";
import { ApiPlatformConfig, formatAllowedRange } from "../../hooks/types";
import { ConfigurationRow } from "../shared/ConfigurationRow";
import { RiskBadge } from "../shared/RiskBadge";

interface PlatformLimitsTabProps {
  onSelect: (item: ApiPlatformConfig) => void;
}

function getInfoText(key: string): string | undefined {
  switch (key) {
    case "MAX_DAILY_EMAILS":
      return "Example: If set to 500, a user cannot send more than 500 emails in a single 24-hour period across all their campaigns. Useful for global domain protection.";
    case "HOURLY_EMAIL_LIMIT":
      return "Example: If set to 50, the platform guarantees no more than 50 emails are sent per hour. Sending 500 emails at once triggers spam filters; spreading them out mimics human behavior.";
    case "MAX_ACTIVE_SEQUENCES":
      return "Example: If set to 5, users can only have 5 campaigns running simultaneously. Trying to import a 6th will be blocked until an old campaign is paused or completed.";
    case "MAX_IMPORT_ROWS":
      return "Example: If set to 10000, uploading a CSV with 15,000 rows will instantly reject the file, preventing the server from running out of memory and crashing.";
    case "SCHEDULER_INTERVAL_MINUTES":
      return "Example: If set to 15, the background cron job processes pending emails and active sequences every 15 minutes. Lowering this makes sending faster but uses more server resources.";
    case "SCHEDULER_BATCH_SIZE":
      return "Example: If set to 50, the scheduler will process exactly 50 pending emails per cron tick. Increasing this speeds up sending but increases API load on Google servers.";
    case "GMAIL_RETRY_LIMIT":
      return "Example: If set to 3, and Gmail's API is temporarily down, the system will try sending the email 3 times before finally marking it as 'FAILED'.";
    case "RETRY_ATTEMPTS":
      return "Example: If set to 3, and Gmail's API is temporarily down, the system will try sending the email 3 times before finally marking it as 'FAILED'.";
    case "EMAIL_PROVIDER":
      return "Example: If set to 'GMAIL', the system routes all outgoing sequence emails through the native Gmail API rather than SMTP.";
    case "BANNER_THEME":
      return "Example: Change this to GREEN on Independence Day or RED on Diwali to dynamically tint the background of the executive banner across all users' dashboards.";
    case "PAGE_LOCK_HEADING":
      return "Customize the big headline text displayed on all locked pages (e.g. 'We will launch this page shortly with a boom! 💥').";
    case "PAGE_LOCK_SUBTEXT":
      return "Customize the subtitle message displayed below the headline on locked pages.";
    default:
      return undefined;
  }
}

export function PlatformLimitsTab({ onSelect }: PlatformLimitsTabProps) {
  const { configs, isLoading, error } = usePlatformConfigs();

  const categories = Array.from(new Set(configs.map((c) => c.category))).sort();

  if (isLoading) {
    return (
      <div className="space-y-8 pb-10 animate-pulse">
        {[1, 2].map((g) => (
          <div key={g} className="space-y-3">
            <div className="h-3 bg-slate-100 rounded w-24" />
            <div className="border border-border rounded-lg overflow-hidden bg-background divide-y divide-border">
              {[1, 2].map((r) => (
                <div key={r} className="px-5 py-4 flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-40" />
                    <div className="h-3 bg-slate-100 rounded w-56" />
                  </div>
                  <div className="h-6 bg-slate-100 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Failed to load platform limits</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">No platform limits configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {categories.map((category) => {
        const categoryConfigs = configs.filter((c) => c.category === category);
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {category}
            </h3>
            <div className="border border-border rounded-lg overflow-hidden bg-background divide-y divide-border">
              {categoryConfigs.map((config) => {
                const range = formatAllowedRange(config);
                return (
                  <ConfigurationRow
                    key={config.id}
                    title={config.name}
                    description={config.description ?? ""}
                    infoText={getInfoText(config.key)}
                    onClick={() => onSelect(config)}
                    statusNode={
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[12px] font-mono font-medium border border-slate-200">
                        {String(config.value)}
                      </span>
                    }
                    metadataNode={
                      <div className="flex items-center gap-4">
                        {range && (
                          <span className="text-xs text-slate-400">{range}</span>
                        )}
                        <RiskBadge level={config.risk_level} />
                      </div>
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
