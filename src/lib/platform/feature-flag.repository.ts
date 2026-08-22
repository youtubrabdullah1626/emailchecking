/**
 * Feature Flag Repository — cursor-based pagination + server-side search/filter
 */

import prisma from "@/lib/prisma";
import { feature_flags, flag_history } from "@prisma/client";

export type FeatureFlagRow = feature_flags;
export type FlagHistoryRow = flag_history;

export interface FlagListParams {
  environment?: string;
  search?: string;
  category?: string;
  status?: "enabled" | "disabled";
  risk_level?: string;
  cursor?: string;   // ID of the last row from the previous page
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export class FeatureFlagRepository {
  async findAll(params: FlagListParams = {}): Promise<PaginatedResult<FeatureFlagRow>> {
    const {
      environment = "production",
      search,
      category,
      status,
      risk_level,
      cursor,
      limit = 50,
    } = params;

    const where: any = { environment };
    if (category) where.category = category;
    if (risk_level) where.risk_level = risk_level;
    if (status === "enabled") where.enabled = true;
    if (status === "disabled") where.enabled = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { key: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Cursor pagination: fetch limit+1 to determine if there's a next page
    const take = limit + 1;

    const items = await prisma.feature_flags.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    } as any);

    const [_, total] = await Promise.all([
      Promise.resolve(),
      prisma.feature_flags.count({ where }),
    ]);

    const hasNextPage = items.length > limit;
    const rows = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? rows[rows.length - 1].id : null;

    return { items: rows, nextCursor, total };
  }

  async findByKey(key: string, environment = "production"): Promise<FeatureFlagRow | null> {
    return prisma.feature_flags.findFirst({ where: { key, environment } });
  }

  async getDistinctCategories(environment = "production"): Promise<string[]> {
    const result = await prisma.feature_flags.findMany({
      where: { environment },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return result.map((r) => r.category);
  }

  async updateEnabled(
    key: string,
    enabled: boolean,
    changedBy: string,
    reason?: string,
    environment = "production"
  ): Promise<FeatureFlagRow> {
    const updated = await prisma.feature_flags.update({
      where: { key },
      data: { enabled, updated_by: changedBy },
    });

    // Write audit history safely in background
    (async () => {
      try {
        await prisma.flag_history.create({
          data: {
            flag_id: updated.id,
            old_value: { enabled: !enabled },
            new_value: { enabled },
            reason: reason ?? null,
            is_rollback: false,
            changed_by: changedBy,
          },
        });
      } catch (historyErr) {
        console.error("[FeatureFlagRepository] Failed to write flag history:", historyErr);
      }
    })();

    return updated;
  }

  async rollback(historyId: string, changedBy: string, environment = "production"): Promise<FeatureFlagRow> {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.flag_history.findUnique({ where: { id: historyId } });
      if (!entry) throw new Error(`FlagHistory '${historyId}' not found`);

      const flag = await tx.feature_flags.findUnique({ where: { id: entry.flag_id } });
      if (!flag) throw new Error(`Feature flag not found`);

      const prev = entry.old_value as { enabled: boolean };

      const updated = await tx.feature_flags.update({
        where: { id: flag.id },
        data: { enabled: prev.enabled, updated_by: changedBy },
      });

      await tx.flag_history.create({
        data: {
          flag_id: flag.id,
          old_value: { enabled: flag.enabled },
          new_value: { enabled: prev.enabled },
          reason: `Rollback from ${entry.changed_at.toISOString()}`,
          is_rollback: true,
          changed_by: changedBy,
        },
      });

      return updated;
    });
  }

  async getHistory(key: string, environment = "production", limit = 20): Promise<FlagHistoryRow[]> {
    const flag = await this.findByKey(key, environment);
    if (!flag) return [];
    return prisma.flag_history.findMany({
      where: { flag_id: flag.id },
      orderBy: { changed_at: "desc" },
      take: limit,
    });
  }
}
