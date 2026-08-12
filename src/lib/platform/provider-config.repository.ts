/**
 * Provider Config Repository — cursor-based pagination + server-side search
 */

import prisma from "@/lib/prisma";
import { provider_configs, provider_history } from "@prisma/client";

export type ProviderConfigRow = provider_configs;
export type ProviderHistoryRow = provider_history;

export interface ProviderListParams {
  environment?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export class ProviderConfigRepository {
  async findAll(params: ProviderListParams = {}): Promise<PaginatedResult<ProviderConfigRow>> {
    const { environment = "production", search, cursor, limit = 50 } = params;

    const where: any = { environment };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { key: { contains: search, mode: "insensitive" } },
        { active_provider: { contains: search, mode: "insensitive" } },
      ];
    }

    const take = limit + 1;

    const items = await prisma.provider_configs.findMany({
      where,
      orderBy: { name: "asc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    } as any);

    const [_, total] = await Promise.all([
      Promise.resolve(),
      prisma.provider_configs.count({ where }),
    ]);

    const hasNextPage = items.length > limit;
    const rows = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? rows[rows.length - 1].id : null;

    return { items: rows, nextCursor, total };
  }

  async findByKey(key: string, environment = "production"): Promise<ProviderConfigRow | null> {
    return prisma.provider_configs.findFirst({ where: { key, environment } });
  }

  async updateProvider(
    key: string,
    newProvider: string,
    changedBy: string,
    reason?: string,
    environment = "production"
  ): Promise<ProviderConfigRow> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.provider_configs.findFirst({ where: { key, environment } });
      if (!existing) throw new Error(`ProviderConfig '${key}' not found`);

      const updated = await tx.provider_configs.update({
        where: { id: existing.id },
        data: { active_provider: newProvider, updated_by: changedBy },
      });

      await tx.provider_history.create({
        data: {
          provider_id: existing.id,
          old_value: { active_provider: existing.active_provider },
          new_value: { active_provider: newProvider },
          reason: reason ?? null,
          is_rollback: false,
          changed_by: changedBy,
        },
      });

      return updated;
    });
  }

  async rollback(historyId: string, changedBy: string): Promise<ProviderConfigRow> {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.provider_history.findUnique({ where: { id: historyId } });
      if (!entry) throw new Error(`ProviderHistory '${historyId}' not found`);

      const provider = await tx.provider_configs.findUnique({ where: { id: entry.provider_id } });
      if (!provider) throw new Error(`ProviderConfig not found`);

      const prev = entry.old_value as { active_provider: string };

      const updated = await tx.provider_configs.update({
        where: { id: provider.id },
        data: { active_provider: prev.active_provider, updated_by: changedBy },
      });

      await tx.provider_history.create({
        data: {
          provider_id: provider.id,
          old_value: { active_provider: provider.active_provider },
          new_value: { active_provider: prev.active_provider },
          reason: `Rollback from ${entry.changed_at.toISOString()}`,
          is_rollback: true,
          changed_by: changedBy,
        },
      });

      return updated;
    });
  }

  async getHistory(key: string, environment = "production", limit = 20): Promise<ProviderHistoryRow[]> {
    const provider = await this.findByKey(key, environment);
    if (!provider) return [];
    return prisma.provider_history.findMany({
      where: { provider_id: provider.id },
      orderBy: { changed_at: "desc" },
      take: limit,
    });
  }
}
