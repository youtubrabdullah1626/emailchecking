/**
 * Provider Routing Service — uses snake_case `provider_configs` Prisma model.
 */

import { provider_configs } from "@prisma/client";
import { ProviderConfigRepository, ProviderListParams } from "./provider-config.repository";
import { configValidationService } from "./config-validation.service";
import { auditService } from "@/lib/audit/audit.service";
import { configCache, CACHE_KEYS, DEFAULT_CACHE_TTL_MS } from "./cache.adapter";
import { requireSuperAdminOrOwner, requireAdminOrAbove, SessionUser } from "./platform.rbac";

export class ProviderRoutingService {
  private repo = new ProviderConfigRepository();

  getActiveProvider(key: string): string | undefined {
    return configCache.get<provider_configs>(CACHE_KEYS.PROVIDER(key))?.active_provider;
  }

  async getAllProviders(
    actor: SessionUser,
    params: Omit<ProviderListParams, "environment"> & { environment?: string } = {}
  ) {
    requireAdminOrAbove(actor);
    const { environment = "production", search, cursor, limit } = params;
    const isFiltered = !!(search || cursor);
    if (!isFiltered) {
      const cached = configCache.get<provider_configs[]>(CACHE_KEYS.ALL_PROVIDERS);
      if (cached) return { items: cached, nextCursor: null, total: cached.length };
    }
    return this.repo.findAll({ environment, search, cursor, limit });
  }

  async updateProvider(
    key: string,
    newProvider: string,
    actor: SessionUser,
    reason?: string,
    environment = "production"
  ): Promise<provider_configs> {
    requireSuperAdminOrOwner(actor);

    const provider = await this.repo.findByKey(key, environment);
    if (!provider) throw new Error(`ProviderConfig '${key}' not found`);

    const validation = configValidationService.validateProviderValue(provider.allowed_values, newProvider);
    if (!validation.valid) throw new Error(`Validation failed: ${validation.errors.join("; ")}`);

    const updated = await this.repo.updateProvider(key, newProvider, actor.id, reason, environment);

    configCache.delete(CACHE_KEYS.ALL_PROVIDERS);
    configCache.delete(CACHE_KEYS.PROVIDER(key));

    auditService.logAction(
      actor.id, actor.email, "Provider Configuration Updated", "SYSTEM",
      provider.name, "ProviderConfig", "SUCCESS",
      { resourceId: provider.id, oldValues: { active_provider: provider.active_provider }, newValues: { active_provider: newProvider }, metadata: { key, reason } }
    );

    return updated;
  }

  async rollbackProvider(historyId: string, actor: SessionUser): Promise<provider_configs> {
    requireSuperAdminOrOwner(actor);
    const updated = await this.repo.rollback(historyId, actor.id);
    configCache.delete(CACHE_KEYS.ALL_PROVIDERS);
    configCache.delete(CACHE_KEYS.PROVIDER(updated.key));
    return updated;
  }

  async getProviderHistory(key: string, actor: SessionUser, environment = "production") {
    requireAdminOrAbove(actor);
    return this.repo.getHistory(key, environment);
  }

  async refreshProviderCache(environment = "production"): Promise<provider_configs[]> {
    const { items: providers } = await this.repo.findAll({ environment, limit: 10000 });
    configCache.set(CACHE_KEYS.ALL_PROVIDERS, providers, DEFAULT_CACHE_TTL_MS);
    for (const p of providers) configCache.set(CACHE_KEYS.PROVIDER(p.key), p, DEFAULT_CACHE_TTL_MS);
    return providers;
  }
}

export const providerRoutingService = new ProviderRoutingService();
