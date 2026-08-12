/**
 * Platform API Types — single source of truth derived from backend snake_case models.
 * These replace all mockData.ts types. No mock values live here.
 */

// ── Raw API types (mirror the Prisma snake_case models) ─────────────────────

export interface ApiFeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  risk_level: "SAFE" | "WARNING" | "RESTRICTED";
  is_safe_runtime: boolean;
  requires_reason: boolean;
  rollout_strategy: "GLOBAL" | "PERCENTAGE" | "USER_LIST" | "ROLE" | "PLAN" | "COUNTRY";
  rollout_percent: number | null;
  rollout_rules: Record<string, unknown> | null;
  depends_on: string[];
  environment: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ApiPlatformConfig {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  data_type: "NUMBER" | "BOOLEAN" | "STRING" | "ENUM" | "JSON" | "PERCENTAGE";
  value: unknown;
  default_value: unknown;
  validation_rules: { min?: number; max?: number; options?: string[] } | null;
  is_safe_runtime: boolean;
  requires_reason: boolean;
  risk_level: "SAFE" | "WARNING" | "RESTRICTED";
  environment: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ApiProviderConfig {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active_provider: string;
  allowed_values: string[];
  environment: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ApiFlagHistory {
  id: string;
  flag_id: string;
  old_value: { enabled: boolean };
  new_value: { enabled: boolean };
  reason: string | null;
  is_rollback: boolean;
  changed_by: string;
  changed_at: string;
}

export interface ApiConfigHistory {
  id: string;
  config_id: string;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  is_rollback: boolean;
  changed_by: string;
  changed_at: string;
}

export interface ApiProviderHistory {
  id: string;
  provider_id: string;
  old_value: { active_provider: string };
  new_value: { active_provider: string };
  reason: string | null;
  is_rollback: boolean;
  changed_by: string;
  changed_at: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResponse {
  valid: boolean;
  errors: string[];
}

// ── API Response wrapper ──────────────────────────────────────────────────────

export interface PaginatedData<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

export interface ApiErrorResponse {
  error: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export type RiskLevel = ApiFeatureFlag["risk_level"];
export type RolloutStrategy = ApiFeatureFlag["rollout_strategy"];
export type DataType = ApiPlatformConfig["data_type"];

/** Display-friendly risk level label */
export const RISK_LABELS: Record<RiskLevel, string> = {
  SAFE: "Safe",
  WARNING: "Warning",
  RESTRICTED: "Restricted",
};

/** Display-friendly rollout label */
export function formatRollout(flag: ApiFeatureFlag): string {
  if (flag.rollout_strategy === "GLOBAL") return "Global";
  if (flag.rollout_strategy === "PERCENTAGE" && flag.rollout_percent !== null) {
    return `${flag.rollout_percent}% Rollout`;
  }
  return flag.rollout_strategy.replace(/_/g, " ");
}

/** Format allowed range from validation_rules */
export function formatAllowedRange(config: ApiPlatformConfig): string {
  const rules = config.validation_rules;
  if (!rules) return "";
  if (rules.min !== undefined && rules.max !== undefined) {
    return `${rules.min.toLocaleString()} – ${rules.max.toLocaleString()}`;
  }
  if (rules.options) return rules.options.join(", ");
  return "";
}
