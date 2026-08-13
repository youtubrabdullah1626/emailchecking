/**
 * Gmail OAuth2 Client — Server-Side Only
 *
 * Creates and configures a Google OAuth2 client from environment variables.
 * All OAuth credentials stay on the server — never sent to the browser.
 *
 * Required environment variables (add to .env.local):
 *
 *   GMAIL_CLIENT_ID       — OAuth 2.0 client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET   — OAuth 2.0 client secret (never exposed)
 *   GMAIL_REFRESH_TOKEN   — Long-lived refresh token obtained via /api/auth/gmail
 *   GMAIL_SENDER_EMAIL    — The Gmail address emails are sent FROM
 *
 * One-time setup:
 *   1. Create a project in Google Cloud Console
 *   2. Enable the Gmail API
 *   3. Create OAuth 2.0 credentials (Web Application type)
 *   4. Add http://localhost:3000/api/auth/gmail/callback as an authorised redirect URI
 *   5. Visit http://localhost:3000/api/auth/gmail to start the OAuth flow
 *   6. Copy the displayed refresh token into your .env.local as GMAIL_REFRESH_TOKEN
 *   7. Restart the dev server
 *
 * Security requirements:
 *   - Do NOT import this file from any client component
 *   - Do NOT log the return value of this function
 *   - Do NOT pass the OAuth2 client to the browser
 *   - Do NOT store credentials in source control
 */

import { google } from "googleapis";

// Scopes required by this application.
// gmail.send:     allows sending email as the authenticated user.
// gmail.readonly: allows reading threads for reply detection (Phase 6).
//
// ⚠ If you previously ran the OAuth setup flow with only gmail.send,
//   you must re-authorise at /api/auth/gmail to obtain the new scope.
//   Revoke the old access first: https://myaccount.google.com/permissions
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
}

/**
 * Validate that all required Gmail environment variables are present.
 * Returns the config if valid, null if any are missing.
 *
 * Call this before attempting any Gmail API operation.
 */
export function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, senderEmail };
}

/**
 * Create an authenticated OAuth2 client ready to use with googleapis.
 *
 * The refresh token is used to obtain fresh access tokens automatically.
 * Access tokens are short-lived (1 hour) and are never persisted.
 *
 * @param redirectUri — only needed during the initial setup flow
 */
export function createOAuth2Client(redirectUri?: string) {
  const config = getOAuthConfig();

  const client = new google.auth.OAuth2(
    config?.clientId ?? process.env.GMAIL_CLIENT_ID,
    config?.clientSecret ?? process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );

  if (config?.refreshToken) {
    client.setCredentials({
      refresh_token: config.refreshToken,
    });
  }

  return client;
}

/**
 * Multi-User SaaS: Create an authenticated OAuth2 client for a specific connected email account.
 *
 * Looks up the account's refresh_token from PostgreSQL (`EmailAccount` table).
 * If not found in DB or empty, falls back to environment variable `GMAIL_REFRESH_TOKEN`
 * for backwards compatibility.
 *
 * @param email - The connected Gmail address
 * @param redirectUri - Optional redirect URI
 */
export async function createOAuth2ClientForAccount(
  email?: string,
  redirectUri?: string
) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing from environment.");
  }

  let refreshToken: string | null = null;

  if (email) {
    try {
      // Dynamic import to prevent circular dependency
      const { default: prisma } = await import("@/lib/prisma");
      const account = await prisma.emailAccount.findUnique({
        where: { email },
        select: { refresh_token: true, connection_status: true },
      });

      if (account?.refresh_token && account.connection_status === "CONNECTED") {
        refreshToken = account.refresh_token;
      }
    } catch {
      // DB lookup error — fallback to env token
    }
  }

  // Fallback to env token if no account token stored
  if (!refreshToken) {
    refreshToken = process.env.GMAIL_REFRESH_TOKEN ?? null;
  }

  if (!refreshToken) {
    throw new Error(
      `No OAuth refresh token available for email "${email ?? "default"}". ` +
      "Ensure the user has completed the Gmail OAuth flow or set GMAIL_REFRESH_TOKEN."
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({ refresh_token: refreshToken });

  return client;
}

/**
 * Persist or update an OAuth account's credentials in PostgreSQL.
 * Multi-user SaaS token store.
 */
export async function saveAccountOAuthTokens(
  email: string,
  refreshToken: string,
  userId: string
): Promise<void> {
  const { default: prisma } = await import("@/lib/prisma");

  if (!userId) throw new Error("Strict Multi-Tenancy: userId is required to save an email account.");

  await prisma.emailAccount.upsert({
    where: { email },
    create: {
      email,
      user_id: userId,
      refresh_token: refreshToken,
      connection_status: "CONNECTED",
    },
    update: {
      user_id: userId,
      refresh_token: refreshToken,
      connection_status: "CONNECTED",
    },
  });
}

/**
 * Disconnect an email account securely.
 * Clears tokens and sets connection_status to DISCONNECTED.
 */
export async function disconnectAccount(email: string): Promise<void> {
  const { default: prisma } = await import("@/lib/prisma");

  await prisma.emailAccount.updateMany({
    where: { email },
    data: {
      access_token: null,
      token_expires_at: null,
      connection_status: "DISCONNECTED",
    },
  });
}

/**
 * Generate the Google OAuth consent URL for the one-time setup flow.
 * The user visits this URL in their browser to authorise the application.
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  // Create a temporary client with just client ID/secret for the auth URL
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );

  return client.generateAuthUrl({
    access_type: "offline",   // ensures a refresh token is returned
    prompt: "consent",        // forces consent screen to always return refresh_token
    scope: GMAIL_SCOPES,
    state,
  });
}

/**
 * Exchange an OAuth authorization code for tokens.
 * Used once during the setup flow.
 * Returns the refresh token — the caller stores it in .env.local.
 *
 * SECURITY: never log the returned tokens.
 */
export async function exchangeCodeForRefreshToken(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; email: string | null | undefined }> {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );

  const { tokens } = await client.getToken(code);

  // Get the sender email address from the tokeninfo
  client.setCredentials(tokens);
  let email: string | null | undefined = null;
  try {
    const tokenInfo = await client.getTokenInfo(tokens.access_token!);
    email = tokenInfo.email;
  } catch {
    // Non-fatal — email is just informational
  }

  let refreshToken = tokens.refresh_token;

  // If Google didn't return a refresh token (e.g., user already authorized the app),
  // try to recover it from our database using the email address.
  if (!refreshToken && email) {
    const { default: prisma } = await import("@/lib/prisma");
    const account = await prisma.emailAccount.findUnique({
      where: { email },
      select: { refresh_token: true }
    });
    if (account?.refresh_token) {
      refreshToken = account.refresh_token;
    }
  }

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. " +
      "Ensure the OAuth consent screen includes prompt=consent and access_type=offline. " +
      "If this account previously authorised the app, revoke access at " +
      "https://myaccount.google.com/permissions and try again."
    );
  }

  return { refreshToken, email };
}
