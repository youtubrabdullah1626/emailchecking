/**
 * Platform Config Service — typed accessors, cache-first, validated writes.
 * Uses snake_case Prisma types from `platform_configs` model.
 */

import { platform_configs } from "@prisma/client";
import { PlatformConfigRepository, ConfigListParams } from "./platform-config.repository";
import { configValidationService } from "./config-validation.service";
import { auditService } from "@/lib/audit/audit.service";
import { configCache, CACHE_KEYS, DEFAULT_CACHE_TTL_MS } from "./cache.adapter";
import { requireSuperAdminOrOwner, requireAdminOrAbove, SessionUser } from "./platform.rbac";

export class PlatformConfigService {
  private repo = new PlatformConfigRepository();

  // ── Typed Accessors (Cache-First, ~0ms) ────────────────────────────────────

  getNumber(key: string, fallback = 0): number {
    const config = configCache.get<platform_configs>(CACHE_KEYS.CONFIG(key));
    if (!config) { console.warn(`[PlatformConfigService] '${key}' not in cache. Using fallback: ${fallback}`); return fallback; }
    const num = Number(config.value);
    if (isNaN(num)) { console.error(`[PlatformConfigService] Type mismatch on '${key}'`); return Number(config.default_value) ?? fallback; }
    return num;
  }

  getBoolean(key: string, fallback = false): boolean {
    const config = configCache.get<platform_configs>(CACHE_KEYS.CONFIG(key));
    if (!config) return fallback;
    if (typeof config.value === "boolean") return config.value;
    return Boolean(config.default_value) ?? fallback;
  }

  getString(key: string, fallback = ""): string {
    const config = configCache.get<platform_configs>(CACHE_KEYS.CONFIG(key));
    if (!config) return fallback;
    return String(config.value);
  }

  getJson<T>(key: string, fallback?: T): T | undefined {
    const config = configCache.get<platform_configs>(CACHE_KEYS.CONFIG(key));
    if (!config) return fallback;
    if (typeof config.value === "object") return config.value as T;
    return fallback;
  }

  // ── Admin Reads ────────────────────────────────────────────────────────────

  async getAllConfigs(
    actor: SessionUser,
    params: Omit<ConfigListParams, "environment"> & { environment?: string } = {}
  ) {
    requireAdminOrAbove(actor);
    const { environment = "production", search, category, risk_level, cursor, limit } = params;
    const isFiltered = !!(search || category || risk_level || cursor);
    if (!isFiltered) {
      const cached = configCache.get<platform_configs[]>(CACHE_KEYS.ALL_CONFIGS);
      if (cached) return { items: cached, nextCursor: null, total: cached.length };
    }
    return this.repo.findAll({ environment, search, category, risk_level, cursor, limit });
  }

  // ── Admin Mutations ────────────────────────────────────────────────────────

  async updateConfig(
    key: string,
    newValue: any,
    actor: SessionUser,
    reason?: string,
    environment = "production"
  ): Promise<platform_configs> {
    requireSuperAdminOrOwner(actor);

    const config = await this.repo.findByKey(key, environment);
    if (!config) throw new Error(`PlatformConfig '${key}' not found`);

    // Validate type and bounds using the stored validation_rules
    const adaptedConfig = {
      dataType: config.data_type,
      validationRules: config.validation_rules,
    };

    const errors: string[] = [];
    switch (config.data_type) {
      case "NUMBER": {
        const num = Number(newValue);
        if (isNaN(num)) { errors.push(`Value must be a number`); break; }
        const rules = config.validation_rules as { min?: number; max?: number } | null;
        if (rules?.min !== undefined && num < rules.min) errors.push(`Value ${num} below minimum ${rules.min}`);
        if (rules?.max !== undefined && num > rules.max) errors.push(`Value ${num} exceeds maximum ${rules.max}`);
        break;
      }
      case "BOOLEAN":
        if (typeof newValue !== "boolean") errors.push(`Value must be a boolean`);
        break;
      case "STRING":
        if (typeof newValue !== "string" || !newValue.trim()) errors.push(`Value must be a non-empty string`);
        break;
      case "ENUM": {
        const rules = config.validation_rules as { options?: string[] } | null;
        if (rules?.options && !rules.options.includes(String(newValue))) errors.push(`Value '${newValue}' not allowed`);
        break;
      }
      case "JSON":
        if (typeof newValue !== "object" || newValue === null) errors.push(`Value must be a JSON object`);
        break;
    }
    if (errors.length > 0) throw new Error(`Validation failed: ${errors.join("; ")}`);

    const updated = await this.repo.updateValue(key, newValue, actor.id, reason, environment);

    configCache.delete(CACHE_KEYS.ALL_CONFIGS);
    configCache.delete(CACHE_KEYS.CONFIG(key));

    auditService.logAction(
      actor.id, actor.email, "Platform Configuration Updated", "SYSTEM",
      config.name, "PlatformConfig", "SUCCESS",
      { resourceId: config.id, oldValues: { value: config.value }, newValues: { value: newValue }, metadata: { key, reason } }
    );

    return updated;
  }

  async rollbackConfig(historyId: string, actor: SessionUser): Promise<platform_configs> {
    requireSuperAdminOrOwner(actor);
    const updated = await this.repo.rollback(historyId, actor.id);
    configCache.delete(CACHE_KEYS.ALL_CONFIGS);
    configCache.delete(CACHE_KEYS.CONFIG(updated.key));
    auditService.logAction(actor.id, actor.email, "Platform Configuration Rolled Back", "SYSTEM", updated.name, "PlatformConfig", "SUCCESS", { resourceId: updated.id, metadata: { historyId } });
    return updated;
  }

  async getConfigHistory(key: string, actor: SessionUser, environment = "production") {
    requireAdminOrAbove(actor);
    return this.repo.getHistory(key, environment);
  }

  // ── Cache Management ───────────────────────────────────────────────────────

  async refreshConfigCache(environment = "production"): Promise<platform_configs[]> {
    const { items: configs } = await this.repo.findAll({ environment, limit: 10000 });
    configCache.set(CACHE_KEYS.ALL_CONFIGS, configs, DEFAULT_CACHE_TTL_MS);
    for (const c of configs) configCache.set(CACHE_KEYS.CONFIG(c.key), c, DEFAULT_CACHE_TTL_MS);
    return configs;
  }
}

export const platformConfigService = new PlatformConfigService();
