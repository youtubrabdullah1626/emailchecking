/**
 * Phase 4 — Enterprise Multi-Tenancy Certification Tests
 *
 * These tests are the absolute proof that the isolation works.
 * They simulate two separate users and verify that User A can NEVER
 * read, modify, or delete data belonging to User B.
 *
 * Run: npx jest src/__tests__/multi-tenancy.test.ts
 */

import { getTenantPrisma } from "@/lib/db/tenant-prisma";
import prisma from "@/lib/prisma";

// ── Global timeout — required because Supabase is a remote DB ────────────────
jest.setTimeout(60_000);

// ── Test constants ────────────────────────────────────────────────────────────

const USER_A_ID = "test_user_a_isolation";
const USER_B_ID = "test_user_b_isolation";
const USER_A_EMAIL = "tenant-test-a@isolation.test";
const USER_B_EMAIL = "tenant-test-b@isolation.test";
const ACCOUNT_A_EMAIL = "account-a@gmail.test";
const ACCOUNT_B_EMAIL = "account-b@gmail.test";

// ── Seed & Cleanup ────────────────────────────────────────────────────────────

/**
 * Seed minimal test data for User A and User B.
 * Uses direct prisma (not tenant-aware) so we can set up both sides.
 * Users must be created BEFORE email accounts (FK constraint).
 */
async function seedTestData() {
  // Step 1 — ensure both users exist (users table first for FK integrity)
  await prisma.users.upsert({
    where: { id: USER_A_ID },
    update: { email: USER_A_EMAIL },
    create: {
      id: USER_A_ID,
      email: USER_A_EMAIL,
      name: "Tenant Test User A",
      updatedAt: new Date(),
    },
  });

  await prisma.users.upsert({
    where: { id: USER_B_ID },
    update: { email: USER_B_EMAIL },
    create: {
      id: USER_B_ID,
      email: USER_B_EMAIL,
      name: "Tenant Test User B",
      updatedAt: new Date(),
    },
  });

  // Step 2 — connect one email account per user (FK: user must already exist)
  await prisma.emailAccount.upsert({
    where: { email: ACCOUNT_A_EMAIL },
    update: { user_id: USER_A_ID, connection_status: "CONNECTED" },
    create: {
      email: ACCOUNT_A_EMAIL,
      user_id: USER_A_ID,
      connection_status: "CONNECTED",
    },
  });

  await prisma.emailAccount.upsert({
    where: { email: ACCOUNT_B_EMAIL },
    update: { user_id: USER_B_ID, connection_status: "CONNECTED" },
    create: {
      email: ACCOUNT_B_EMAIL,
      user_id: USER_B_ID,
      connection_status: "CONNECTED",
    },
  });
}

/**
 * Remove all test data in FK-safe order (children before parents).
 */
async function cleanupTestData() {
  await prisma.emailAccount.deleteMany({
    where: { email: { in: [ACCOUNT_A_EMAIL, ACCOUNT_B_EMAIL] } },
  });
  await prisma.users.deleteMany({
    where: { id: { in: [USER_A_ID, USER_B_ID] } },
  });
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("Phase 4: Cross-Tenant Data Isolation Certification", () => {
  beforeAll(async () => {
    await seedTestData();
  }, 30_000); // 30s timeout for remote DB seed

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  }, 30_000);

  // ── EmailAccount Isolation ─────────────────────────────────────────────────
  describe("EmailAccount Isolation", () => {
    test("User A can see their own email account", async () => {
      const tenantPrisma = getTenantPrisma(USER_A_ID);
      const accounts = await tenantPrisma.emailAccount.findMany();
      const emails = accounts.map((a) => a.email);

      expect(emails).toContain(ACCOUNT_A_EMAIL);
    });

    test("CRITICAL: User A cannot see User B's email account", async () => {
      const tenantPrisma = getTenantPrisma(USER_A_ID);
      const accounts = await tenantPrisma.emailAccount.findMany();
      const emails = accounts.map((a) => a.email);

      expect(emails).not.toContain(ACCOUNT_B_EMAIL);
    });

    test("CRITICAL: User B cannot see User A's email account", async () => {
      const tenantPrisma = getTenantPrisma(USER_B_ID);
      const accounts = await tenantPrisma.emailAccount.findMany();
      const emails = accounts.map((a) => a.email);

      expect(emails).not.toContain(ACCOUNT_A_EMAIL);
    });

    test("CRITICAL: User B's deleteMany on User A's account affects 0 rows", async () => {
      const tenantPrisma = getTenantPrisma(USER_B_ID);

      // Tenant filter injects user_id: USER_B_ID → no match → 0 rows deleted
      const result = await tenantPrisma.emailAccount.deleteMany({
        where: { email: ACCOUNT_A_EMAIL },
      });

      expect(result.count).toBe(0);

      // Verify User A's account is still intact
      const stillExists = await prisma.emailAccount.findUnique({
        where: { email: ACCOUNT_A_EMAIL },
      });
      expect(stillExists).not.toBeNull();
    });

    test("CRITICAL: User B's updateMany on User A's account affects 0 rows", async () => {
      const tenantPrisma = getTenantPrisma(USER_B_ID);

      const result = await tenantPrisma.emailAccount.updateMany({
        where: { email: ACCOUNT_A_EMAIL },
        data: { connection_status: "DISCONNECTED" },
      });

      expect(result.count).toBe(0);

      // Verify User A's account is still CONNECTED
      const account = await prisma.emailAccount.findUnique({
        where: { email: ACCOUNT_A_EMAIL },
      });
      expect(account?.connection_status).toBe("CONNECTED");
    });
  });

  // ── getTenantPrisma Safety Guards ──────────────────────────────────────────
  describe("getTenantPrisma Safety Guards", () => {
    test("getTenantPrisma throws if userId is empty string", () => {
      expect(() => getTenantPrisma("")).toThrow(
        "getTenantPrisma requires a valid userId"
      );
    });

    test("Two separate tenant instances are completely siloed", async () => {
      const tenantA = getTenantPrisma(USER_A_ID);
      const tenantB = getTenantPrisma(USER_B_ID);

      const [accountsA, accountsB] = await Promise.all([
        tenantA.emailAccount.findMany(),
        tenantB.emailAccount.findMany(),
      ]);

      const emailsA = accountsA.map((a) => a.email);
      const emailsB = accountsB.map((a) => a.email);

      // Each tenant sees only their own data
      expect(emailsA).toContain(ACCOUNT_A_EMAIL);
      expect(emailsA).not.toContain(ACCOUNT_B_EMAIL);

      expect(emailsB).toContain(ACCOUNT_B_EMAIL);
      expect(emailsB).not.toContain(ACCOUNT_A_EMAIL);
    });
  });
});
