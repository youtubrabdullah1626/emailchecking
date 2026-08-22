/**
 * Platform Config Repository — cursor-based pagination + server-side search/filter
 */

import prisma, { Prisma } from "@/lib/prisma";
import { platform_configs, config_history } from "@prisma/client";

export type PlatformConfigRow = platform_configs;
export type ConfigHistoryRow = config_history;

export interface ConfigListParams {
  environment?: string;
  search?: string;
  category?: string;
  risk_level?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export class PlatformConfigRepository {
  async findAll(params: ConfigListParams = {}): Promise<PaginatedResult<PlatformConfigRow>> {
    const {
      environment = "production",
      search,
      category,
      risk_level,
      cursor,
      limit = 50,
    } = params;

    const where: any = { environment };
    if (category) where.category = category;
    if (risk_level) where.risk_level = risk_level;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { key: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const take = limit + 1;

    const items = await prisma.platform_configs.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    } as any);

    const [_, total] = await Promise.all([
      Promise.resolve(),
      prisma.platform_configs.count({ where }),
    ]);

    const hasNextPage = items.length > limit;
    const rows = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? rows[rows.length - 1].id : null;

    return { items: rows, nextCursor, total };
  }

  async findByKey(key: string, environment = "production"): Promise<PlatformConfigRow | null> {
    return prisma.platform_configs.findFirst({ where: { key, environment } });
  }

  async getDistinctCategories(environment = "production"): Promise<string[]> {
    const result = await prisma.platform_configs.findMany({
      where: { environment },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return result.map((r) => r.category);
  }

  async updateValue(
    key: string,
    newValue: any,
    changedBy: string,
    reason?: string,
    environment = "production"
  ): Promise<PlatformConfigRow> {
    const existing = await prisma.platform_configs.findFirst({ where: { key, environment } });
    if (!existing) throw new Error(`PlatformConfig '${key}' not found`);

    const updated = await prisma.platform_configs.update({
      where: { id: existing.id },
      data: { value: newValue, updated_by: changedBy },
    });

    // Write audit history safely without blocking primary update
    try {
      await prisma.config_history.create({
        data: {
          config_id: existing.id,
          old_value: existing.value as Prisma.InputJsonValue,
          new_value: newValue as Prisma.InputJsonValue,
          reason: reason ?? null,
          is_rollback: false,
          changed_by: changedBy,
        },
      });
    } catch (historyErr) {
      console.error("[PlatformConfigRepository] Failed to write config history:", historyErr);
    }

    return updated;
  }

  async rollback(historyId: string, changedBy: string): Promise<PlatformConfigRow> {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.config_history.findUnique({ where: { id: historyId } });
      if (!entry) throw new Error(`ConfigHistory '${historyId}' not found`);

      const config = await tx.platform_configs.findUnique({ where: { id: entry.config_id } });
      if (!config) throw new Error(`PlatformConfig not found`);

      const updated = await tx.platform_configs.update({
        where: { id: config.id },
        data: { value: entry.old_value as Prisma.InputJsonValue, updated_by: changedBy },
      });

      await tx.config_history.create({
        data: {
          config_id: config.id,
          old_value: config.value as Prisma.InputJsonValue,
          new_value: entry.old_value as Prisma.InputJsonValue,
          reason: `Rollback from ${entry.changed_at.toISOString()}`,
          is_rollback: true,
          changed_by: changedBy,
        },
      });

      return updated;
    });
  }

  async getHistory(key: string, environment = "production", limit = 20): Promise<ConfigHistoryRow[]> {
    const config = await this.findByKey(key, environment);
    if (!config) return [];
    return prisma.config_history.findMany({
      where: { config_id: config.id },
      orderBy: { changed_at: "desc" },
      take: limit,
    });
  }
}
