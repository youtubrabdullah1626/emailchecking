/**
 * GET /api/auth/gmail/callback
 *
 * OAuth 2.0 callback handler — Production Multi-Account flow.
 * Google redirects here after the user grants consent.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForRefreshToken } from "@/lib/gmail/oauth";
import { getAppUrl } from "@/lib/env";
import { withObservability } from "@/lib/observability/middleware";
import { logger } from "@/lib/observability/logger";
import { auditService } from "@/lib/audit/audit.service";
import { getSession } from "@/lib/auth/session";

const CALLBACK_PATH = "/api/auth/gmail/callback";

export const GET = withObservability(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateUserId = searchParams.get("state"); // Contains the user.id we passed in route.ts
  
  const dashboardUrl = new URL("/dashboard", getAppUrl());

  const session = await getSession();
  if (!session?.user) {
    logger.error("OAuth callback: No active session found.");
    dashboardUrl.searchParams.set("error", "Unauthorized. Please log in first.");
    return NextResponse.redirect(dashboardUrl);
  }

  // Security Check: Ensure the user who initiated the flow is the one completing it
  if (stateUserId && stateUserId !== session.user.id) {
    logger.error("OAuth callback: Session mismatch. Possible CSRF attack.", { stateUserId, sessionId: session.user.id });
    dashboardUrl.searchParams.set("error", "Security error: Session mismatch.");
    return NextResponse.redirect(dashboardUrl);
  }

  // Handle user denying consent
  if (error) {
    logger.warn("OAuth access denied by user", { error });
    dashboardUrl.searchParams.set("error", `OAuth Access Denied: ${error}`);
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code) {
    logger.error("OAuth callback missing code");
    dashboardUrl.searchParams.set("error", "OAuth Error: Missing authorization code.");
    return NextResponse.redirect(dashboardUrl);
  }

  // Use the exact same deterministic URI that we sent in the auth request
  const redirectUri = `${getAppUrl()}${CALLBACK_PATH}`;

  let refreshToken: string;
  let email: string | null | undefined;

  try {
    ({ refreshToken, email } = await exchangeCodeForRefreshToken(code, redirectUri));

    if (email && refreshToken) {
      // 1. Multi-User SaaS Token Persistence (Strict User Scoping)
      const { saveAccountOAuthTokens } = await import("@/lib/gmail/oauth");
      await saveAccountOAuthTokens(email, refreshToken, session.user.id);

      // 1.5 Honest Metric: Track real authentication timestamp
      const prisma = (await import("@/lib/prisma")).default;
      await prisma.emailAccount.update({
        where: { email },
        data: { last_login_at: new Date() }
      });

      // 2. Automatic Watch Registration & Self-Healing Initialization
      const { autoRepairAccount } = await import("@/lib/reply-tracker/health-monitor");
      await autoRepairAccount(email);
      
      auditService.logAction(
        session.user.id,
        session.user.email,
        'GMAIL_CONNECTED',
        'AUTHENTICATION',
        `Gmail (${email})`,
        'Email Account',
        'SUCCESS',
        { metadata: { email } }
      );
      
      logger.info("Successfully connected Gmail account", { email });

      // Success
      dashboardUrl.searchParams.set("connected", "true");
      dashboardUrl.searchParams.set("email", email);
    } else {
      dashboardUrl.searchParams.set("error", "OAuth Error: Could not determine email address or missing refresh token.");
    }
  } catch (err) {
    logger.error("OAuth Token Exchange Failed", { error: err });
    const msg = err instanceof Error ? err.message : "Unknown error";
    dashboardUrl.searchParams.set("error", `Token Exchange Failed: ${msg}`);
  }

  // Multi-User Seamless Flow: Redirect back to dashboard
  return NextResponse.redirect(dashboardUrl);
});
