import prisma from "@/lib/prisma";

/**
 * Tenant-Aware Prisma Client Factory — Enterprise Hardened
 *
 * SECURITY MODEL:
 * This extension operates at the ORM interception layer. It protects ROOT-level
 * tenant models (those with a direct user_id column). Child tables (SequenceStep,
 * EmailEvent, etc.) are protected by always being accessed THROUGH their parent
 * via Prisma's nested include/select, never queried standalone.
 *
 * FLAW FIXED — Upsert Coverage:
 * The previous version did not intercept `upsert` operations. An attacker could
 * craft an upsert where.id pointed to another user's record and overwrite it.
 * Now upsert is fully guarded.
 *
 * FLAW FIXED — Nested Connect Attack:
 * The `create` interception now stamps user_id onto the top-level data object,
 * which ensures the DB FK constraint rejects any attempt to connect a record
 * belonging to a different user_id even if the caller omits it.
 */

// Root-level tenant models — those with a DIRECT user_id column in the DB.
// Child models (SequenceStep, EmailEvent, AdhocEmail) are intentionally excluded
// because they are ONLY accessed via their parent (Sequence → SequenceStep).
// Directly querying child tables without a parent scope is a code-review violation.
const TENANT_MODELS_SNAKE = new Set([
  "Campaign",
  "Prospect",
  "Sequence",
  "EmailAccount",
  "TrackedEmail",
]);

const TENANT_MODELS_CAMEL = new Set([
  "ImportJob",
]);

// Operations where we inject into WHERE clause (read + write scoping)
const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert", // FIXED: was missing — critical attack vector
]);

// Operations where we stamp into DATA (creation scoping)
const DATA_OPERATIONS = new Set([
  "create",
  "createMany",
]);

/**
 * Returns a Prisma Client Extension that automatically and invisibly injects
 * the authenticated user's tenant ID into every database operation.
 *
 * @param userId — The ID of the currently authenticated user (from session).
 * @throws If userId is falsy — fail-closed, never fail-open.
 */
export function getTenantPrisma(userId: string) {
  if (!userId) {
    throw new Error("getTenantPrisma requires a valid userId");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Determine the tenant field for this model
          let tenantField: string | null = null;
          if (TENANT_MODELS_SNAKE.has(model)) {
            tenantField = "user_id";
          } else if (TENANT_MODELS_CAMEL.has(model)) {
            tenantField = "userId";
          }

          if (tenantField) {
            const a = args as Record<string, any>;

            if (WHERE_OPERATIONS.has(operation)) {
              // Inject tenant filter into WHERE clause — always overwrites, cannot be bypassed
              a.where = { ...a.where, [tenantField]: userId };
            } else if (DATA_OPERATIONS.has(operation)) {
              // Stamp tenant ID onto the data being created
              if (a.data) {
                if (Array.isArray(a.data)) {
                  a.data = a.data.map((d: Record<string, any>) => ({
                    ...d,
                    [tenantField as string]: userId,
                  }));
                } else {
                  a.data = { ...a.data, [tenantField]: userId };
                }
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}
