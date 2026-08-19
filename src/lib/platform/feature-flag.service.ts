/**
 * Feature Flag Service — cache-first, dependency-validated, audit-logged.
 * Uses snake_case Prisma types from `feature_flags` model.
 */

import { feature_flags } from "@prisma/client";
import { FeatureFlagRepository, FlagListParams } from "./feature-flag.repository";
import { configValidationService } from "./config-validation.service";
import { auditService } from "@/lib/audit/audit.service";
import { configCache, CACHE_KEYS, DEFAULT_CACHE_TTL_MS } from "./cache.adapter";
import { requireSuperAdminOrOwner, requireAdminOrAbove, SessionUser } from "./platform.rbac";

export class FeatureFlagService {
  private repo = new FeatureFlagRepository();

  // ── Cache-First Reads (~0ms) ──────────────────────────────────────────────

  isEnabled(key: string): boolean {
    const flags = configCache.get<feature_flags[]>(CACHE_KEYS.ALL_FLAGS) ?? [];
    const flag = flags.find((f) => f.key === key);
    if (!flag) {
      console.warn(`[FeatureFlagService] Flag '${key}' not in cache. Defaulting to false.`);
      return false;
    }
    return flag.enabled;
  }

  isEnabledForUser(key: string, userId: string): boolean {
    if (!this.isEnabled(key)) return false;
    const flags = configCache.get<feature_flags[]>(CACHE_KEYS.ALL_FLAGS) ?? [];
    const flag = flags.find((f) => f.key === key);
    if (!flag) return false;
    if (flag.rollout_strategy === "GLOBAL") return true;
    if (flag.rollout_strategy === "PERCENTAGE" && flag.rollout_percent !== null) {
      const hash = this.deterministicHash(`${userId}:${key}`);
      return hash <= (flag.rollout_percent ?? 100);
    }
    return flag.enabled;
  }

  // ── Admin Reads ────────────────────────────────────────────────────────────

  async getAllFlags(
    actor: SessionUser,
    params: Omit<FlagListParams, "environment"> & { environment?: string } = {}
  ) {
    requireAdminOrAbove(actor);
    const { environment = "production", search, category, status, risk_level, cursor, limit } = params;
    // Only use cache for unfiltered full-list requests
    const isFiltered = !!(search || category || status || risk_level || cursor);
    if (!isFiltered) {
      const cached = configCache.get<feature_flags[]>(CACHE_KEYS.ALL_FLAGS);
      if (cached) return { items: cached, nextCursor: null, total: cached.length };
    }
    return this.repo.findAll({ environment, search, category, status, risk_level, cursor, limit });
  }

  // ── Admin Mutations ────────────────────────────────────────────────────────

  async toggleFlag(
    key: string,
    enabled: boolean,
    actor: SessionUser,
    reason?: string,
    environment = "production"
  ): Promise<feature_flags> {
    requireSuperAdminOrOwner(actor);

    const allFlags = await this.refreshFlagsCache(environment);
    const flag = allFlags.find((f) => f.key === key);
    if (!flag) throw new Error(`Feature flag '${key}' not found`);

    // Dependency validation (only enforced when enabling)
    if (enabled) {
      const depErrors: string[] = [];
      const dependsOn = Array.isArray(flag.depends_on) ? flag.depends_on : [];
      for (const depKey of dependsOn) {
        const dep = allFlags.find((f) => f.key === depKey);
        if (!dep) { depErrors.push(`Dependency '${depKey}' does not exist`); continue; }
        if (!dep.enabled) depErrors.push(`Cannot enable '${flag.name}'. Required dependency '${dep.name}' is disabled.`);
      }
      if (depErrors.length > 0) throw new Error(depErrors.join("; "));
    }

    const updated = await this.repo.updateEnabled(key, enabled, actor.id || "admin", reason, environment);

    configCache.delete(CACHE_KEYS.ALL_FLAGS);
    configCache.delete(CACHE_KEYS.FLAG(key));

    try {
      auditService.logAction(
        actor.id || "admin", actor.email || "admin",
        enabled ? "Feature Flag Enabled" : "Feature Flag Disabled",
        "SYSTEM", flag.name, "FeatureFlag", "SUCCESS",
        { resourceId: flag.id, oldValues: { enabled: flag.enabled }, newValues: { enabled }, metadata: { key, reason } }
      );
    } catch {}

    return updated;
  }

  async rollbackFlag(historyId: string, actor: SessionUser, environment = "production"): Promise<feature_flags> {
    requireSuperAdminOrOwner(actor);
    const updated = await this.repo.rollback(historyId, actor.id, environment);
    configCache.delete(CACHE_KEYS.ALL_FLAGS);
    configCache.delete(CACHE_KEYS.FLAG(updated.key));
    auditService.logAction(actor.id, actor.email, "Feature Flag Rolled Back", "SYSTEM", updated.name, "FeatureFlag", "SUCCESS", { resourceId: updated.id, metadata: { historyId } });
    return updated;
  }

  async getFlagHistory(key: string, actor: SessionUser, environment = "production") {
    requireAdminOrAbove(actor);
    return this.repo.getHistory(key, environment);
  }

  // ── Cache Management ───────────────────────────────────────────────────────

  async refreshFlagsCache(environment = "production"): Promise<feature_flags[]> {
    const { items: flags } = await this.repo.findAll({ environment, limit: 10000 });
    configCache.set(CACHE_KEYS.ALL_FLAGS, flags, DEFAULT_CACHE_TTL_MS);
    for (const f of flags) configCache.set(CACHE_KEYS.FLAG(f.key), f, DEFAULT_CACHE_TTL_MS);
    return flags;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private deterministicHash(input: string): number {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
    return Math.abs(hash) % 101;
  }
}

export const featureFlagService = new FeatureFlagService();
