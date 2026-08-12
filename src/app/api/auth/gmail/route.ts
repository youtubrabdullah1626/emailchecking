/**
 * GET /api/auth/gmail
 *
 * Multi-Account Gmail OAuth setup route.
 * Redirects the user's browser to Google's OAuth consent screen.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail/oauth";
import { getAppUrl, validateOAuthConfig } from "@/lib/env";
import { withObservability } from "@/lib/observability/middleware";
import { getSession } from "@/lib/auth/session";

const CALLBACK_PATH = "/api/auth/gmail/callback";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    validateOAuthConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Gmail OAuth is not configured.",
        instructions: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  // Use the deterministic APP_URL instead of request.url
  const redirectUri = `${getAppUrl()}${CALLBACK_PATH}`;
  // We pass the user ID as state to ensure the callback links it to the right user
  const authUrl = getAuthUrl(redirectUri, session.user.id);

  // Redirect the browser to Google's OAuth consent screen
  return NextResponse.redirect(authUrl);
});
