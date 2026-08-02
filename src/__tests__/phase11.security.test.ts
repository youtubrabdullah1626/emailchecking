/**
 * Phase 11 — Security Tests
 *
 * Tests for the scheduler authentication module and protected API endpoints.
 *
 * Coverage:
 *   1. verifySchedulerSecret — correct token authorized
 *   2. verifySchedulerSecret — wrong token rejected
 *   3. verifySchedulerSecret — missing Authorization header rejected
 *   4. verifySchedulerSecret — missing x-scheduler-secret header rejected
 *   5. verifySchedulerSecret — malformed Authorization header rejected
 *   6. verifySchedulerSecret — x-scheduler-secret alternative header works
 *   7. Dev passthrough when no secret is configured (NODE_ENV=development)
 *   8. Production config error when no secret is configured (NODE_ENV=production)
 *   9. unauthorizedResponse returns 401 with structured JSON
 */

import { NextRequest } from "next/server";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const url = "http://localhost:3000/api/scheduler/run";
  return new NextRequest(url, { method: "POST", headers });
}

// ── Environment setup ──────────────────────────────────────────────────────────
// process.env.NODE_ENV is declared readonly in TypeScript's lib.
// Use Object.defineProperty (standard Jest pattern) to override it in tests.

const ORIGINAL_ENV = process.env;

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      Object.defineProperty(process.env, key, {
        value,
        configurable: true,
        writable: true,
      });
    }
  }
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("verifySchedulerSecret — correct credentials", () => {
  it("authorizes a request with a valid Bearer token", () => {
    setEnv({ SCHEDULER_SECRET: "test-secret-abc123", NODE_ENV: "production" });

    const request = makeRequest({ authorization: "Bearer test-secret-abc123" });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(true);
  });

  it("authorizes a request using the x-scheduler-secret header", () => {
    setEnv({ SCHEDULER_SECRET: "test-secret-abc123", NODE_ENV: "production" });

    const request = makeRequest({ "x-scheduler-secret": "test-secret-abc123" });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(true);
  });
});

describe("verifySchedulerSecret — wrong credentials", () => {
  it("rejects a request with the wrong secret", () => {
    setEnv({ SCHEDULER_SECRET: "correct-secret", NODE_ENV: "production" });

    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBeTruthy();
    // Never expose the correct secret in the error message
    expect(result.reason).not.toContain("correct-secret");
  });

  it("rejects a request with an empty Bearer token", () => {
    setEnv({ SCHEDULER_SECRET: "correct-secret", NODE_ENV: "production" });

    const request = makeRequest({ authorization: "Bearer " });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(false);
  });

  it("rejects a request with a malformed Authorization header (no Bearer prefix)", () => {
    setEnv({ SCHEDULER_SECRET: "correct-secret", NODE_ENV: "production" });

    const request = makeRequest({ authorization: "correct-secret" });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(false);
  });
});

describe("verifySchedulerSecret — missing credentials", () => {
  it("rejects a request with no auth headers", () => {
    setEnv({ SCHEDULER_SECRET: "correct-secret", NODE_ENV: "production" });

    const request = makeRequest();
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("Missing credentials");
  });
});

describe("verifySchedulerSecret — development mode", () => {
  it("allows through in development when no secret is configured", () => {
    setEnv({ SCHEDULER_SECRET: undefined, NODE_ENV: "development" });

    const request = makeRequest();
    const result = verifySchedulerSecret(request);

    // Dev passthrough — no secret required in development
    expect(result.authorized).toBe(true);
    expect(result.reason).toContain("Development");
  });

  it("still validates correctly in development when a secret is configured", () => {
    setEnv({ SCHEDULER_SECRET: "dev-secret", NODE_ENV: "development" });

    const request = makeRequest({ authorization: "Bearer wrong" });
    const result = verifySchedulerSecret(request);

    // Secret is configured, so it must be correct even in development
    expect(result.authorized).toBe(false);
  });
});

describe("verifySchedulerSecret — production misconfiguration", () => {
  it("rejects in production when SCHEDULER_SECRET is not set", () => {
    setEnv({ SCHEDULER_SECRET: undefined, NODE_ENV: "production" });

    const request = makeRequest({ authorization: "Bearer anything" });
    const result = verifySchedulerSecret(request);

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("configuration error");
  });
});

describe("unauthorizedResponse", () => {
  it("returns a NextResponse with status 401", async () => {
    const response = unauthorizedResponse("Invalid credentials.");
    expect(response.status).toBe(401);
  });

  it("returns a JSON body with error and detail fields", async () => {
    const response = unauthorizedResponse("Missing credentials.");
    const body = await response.json();

    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.detail).toBe("Missing credentials.");
  });
});
