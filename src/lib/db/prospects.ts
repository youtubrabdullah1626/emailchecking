/**
 * Database access layer — Prospects
 *
 * Single authoritative source for all reads/writes to the `prospects` table.
 * API routes import from here. No other file may call prisma directly for prospects.
 *
 * All functions are server-side only. Never import this from a client component.
 */

import prisma from "@/lib/prisma";
import type { Prospect, ProspectStatus } from "@prisma/client";
import { errorTracker } from "@/lib/observability/errors";
import { getSessionUser } from "@/lib/audit/rbac";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateProspectData {
  name: string;
  company: string;
  email: string;
  timezone: string;
  notes?: string;
  user_id: string;
}

export interface UpdateProspectData {
  name?: string;
  company?: string;
  email?: string;
  timezone?: string;
  notes?: string;
  status?: ProspectStatus;
}

export type { Prospect };

// ── Database error classification ────────────────────────────────────────────

/**
 * Prisma's unique constraint violation error code.
 * Safely detect duplicate-email errors without exposing raw DB errors.
 */
function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Prisma's record-not-found error code.
 */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

// ── Typed result types ───────────────────────────────────────────────────────

export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "DUPLICATE_EMAIL" | "NOT_FOUND" | "DB_ERROR"; message: string };

// ── Operations ───────────────────────────────────────────────────────────────

/**
 * Create a new prospect.
 * Returns DUPLICATE_EMAIL if the email already exists.
 */
export async function createProspect(
  data: CreateProspectData
): Promise<DbResult<Prospect>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");
    const tenantPrisma = getTenantPrisma(user.id);

    const prospect = await tenantPrisma.prospect.create({
      data: {
        name: data.name,
        company: data.company,
        email: data.email,
        timezone: data.timezone,
        notes: data.notes ?? null,
        user_id: user.id, // Ensure explicit mapping
      },
    });
    return { ok: true, data: prospect };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        ok: false,
        error: "DUPLICATE_EMAIL",
        message: `A prospect with the email "${data.email}" already exists.`,
      };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[createProspect] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: "An unexpected database error occurred. Please try again.",
    };
  }
}

import { PaginationOptions, PaginatedResult } from "./pagination";

export type DbPaginatedResult<T> =
  | { ok: true; data: T[]; pagination: PaginatedResult<T>['pagination'] }
  | { ok: false; error: "DB_ERROR"; message: string };

/**
 * List all prospects, newest first, with pagination.
 */
export async function listProspects(options?: PaginationOptions): Promise<DbPaginatedResult<Prospect & { campaign?: { id: string, name: string } | null, sequences?: { id: string; status: string; steps: { id: string; step_number: number; status: string }[] }[] | null }>> {
  try {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");
    const tenantPrisma = getTenantPrisma(user.id);

    const [total, prospects] = await tenantPrisma.$transaction([
      tenantPrisma.prospect.count(),
      tenantPrisma.prospect.findMany({
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            }
          },
          sequences: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              steps: {
                select: {
                  id: true,
                  step_number: true,
                  status: true,
                },
              },
            },
          },
        },
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return { 
      ok: true, 
      data: prospects,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[listProspects] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Failed to load prospects. Please refresh the page.",
    };
  }
}

/**
 * Get a single prospect by ID.
 * Returns NOT_FOUND if the ID does not exist.
 */
export async function getProspect(id: string): Promise<DbResult<Prospect>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");
    const tenantPrisma = getTenantPrisma(user.id);

    const prospect = await tenantPrisma.prospect.findUnique({
      where: { id },
    });
    if (!prospect) {
      return { ok: false, error: "NOT_FOUND", message: "Prospect not found." };
    }
    return { ok: true, data: prospect };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[getProspect] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Failed to load the prospect. Please try again.",
    };
  }
}

/**
 * Update an existing prospect.
 * Returns DUPLICATE_EMAIL if the new email conflicts with another prospect.
 * Returns NOT_FOUND if the ID does not exist.
 */
export async function updateProspect(
  id: string,
  data: UpdateProspectData
): Promise<DbResult<Prospect>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");
    const tenantPrisma = getTenantPrisma(user.id);

    const prospect = await tenantPrisma.prospect.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.company !== undefined && { company: data.company }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
    return { ok: true, data: prospect };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        ok: false,
        error: "DUPLICATE_EMAIL",
        message: `Another prospect already uses that email address.`,
      };
    }
    if (isNotFoundError(error)) {
      return { ok: false, error: "NOT_FOUND", message: "Prospect not found." };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[updateProspect] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Failed to update the prospect. Please try again.",
    };
  }
}

/**
 * Delete a prospect by ID.
 * Cascade deletes will handle related sequences/steps/events (Phase 3+).
 * Returns NOT_FOUND if the ID does not exist.
 */
export async function deleteProspect(id: string): Promise<DbResult<void>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");
    const tenantPrisma = getTenantPrisma(user.id);

    await tenantPrisma.prospect.delete({ where: { id } });
    return { ok: true, data: undefined };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, error: "NOT_FOUND", message: "Prospect not found." };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[deleteProspect] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Failed to delete the prospect. Please try again.",
    };
  }
}
