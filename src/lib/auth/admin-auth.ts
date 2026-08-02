import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { logger } from "@/lib/observability/logger";

export interface AuthResult {
  authorized: boolean;
  reason: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function verifyAdminSecret(request: NextRequest): AuthResult {
  const secret = process.env.ADMIN_SECRET;
  const isDevelopment = process.env.NODE_ENV === "development";
  const endpoint = request.nextUrl.pathname;

  if (!secret) {
    if (isDevelopment) {
      logger.warn("ADMIN_SECRET not set in development mode — request allowed", { endpoint });
      return { authorized: true, reason: "Development passthrough (no secret configured)" };
    }

    logger.error("ADMIN_SECRET is not set in production environment", { endpoint });
    return {
      authorized: false,
      reason: "Server configuration error: authentication is not configured.",
    };
  }

  const authHeader = request.headers.get("authorization");
  const xAdminSecret = request.headers.get("x-admin-secret");

  let providedSecret: string | null = null;

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      providedSecret = parts[1];
    }
  } else if (xAdminSecret) {
    providedSecret = xAdminSecret;
  }

  if (!providedSecret) {
    logger.warn("auth_missing_credentials", { endpoint, reason: "No admin secret provided." });
    return {
      authorized: false,
      reason: "Missing credentials. Provide 'Authorization: Bearer <secret>' header.",
    };
  }

  const valid = constantTimeEqual(providedSecret, secret);

  if (!valid) {
    logger.warn("auth_invalid_secret", { endpoint, reason: "Provided secret did not match ADMIN_SECRET." });
    return { authorized: false, reason: "Invalid credentials." };
  }

  return { authorized: true, reason: "Authorized." };
}

export function unauthorizedResponse(reason: string): NextResponse {
  return NextResponse.json(
    {
      error: "UNAUTHORIZED",
      detail: reason,
    },
    { status: 401 }
  );
}
