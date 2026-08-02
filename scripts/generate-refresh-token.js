/**
 * Gmail OAuth2 Refresh Token Generator
 * =====================================
 * 
 * PURPOSE
 * -------
 * Generates a valid Gmail OAuth2 refresh token for use in .env.local.
 * This token is required for the Gmail send pipeline to authenticate with
 * Google's API without user interaction on every send.
 *
 * WHEN TO USE
 * -----------
 * - First-time setup
 * - Token expired (Google expires tokens after 7 days for apps in "Testing" mode)
 * - Token revoked by the user at myaccount.google.com/permissions
 * - unauthorized_client / invalid_grant errors from the Gmail sender
 *
 * HOW IT WORKS
 * ------------
 * 1. Starts a temporary local HTTP server on port 3456
 * 2. Opens your browser to Google's consent screen
 * 3. Catches the OAuth callback automatically (no manual copy/paste)
 * 4. Exchanges the authorization code for tokens
 * 5. Writes GMAIL_REFRESH_TOKEN to .env.local automatically
 * 6. Exits cleanly
 *
 * PREREQUISITES (Google Cloud Console — one-time setup)
 * -----------------------------------------------------
 * 1. Create a project at https://console.cloud.google.com
 * 2. Enable the Gmail API
 *    → APIs & Services > Library > Gmail API > Enable
 * 3. Create OAuth 2.0 credentials (type: "Web Application")
 *    → APIs & Services > Credentials > Create Credentials > OAuth client ID
 * 4. Add EXACTLY this redirect URI to "Authorized redirect URIs":
 *    http://localhost:3456/oauth2callback
 * 5. Download the client secret JSON or copy the Client ID + Secret
 * 6. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env.local
 *
 * OAUTH CONSENT SCREEN — IMPORTANT
 * ----------------------------------
 * If your consent screen is in "Testing" mode, refresh tokens expire after 7 days.
 * To get permanent tokens, EITHER:
 *   A) Publish the app to "Production" (recommended for personal tools)
 *      → APIs & Services > OAuth consent screen > PUBLISH APP
 *      This does NOT require Google verification for personal use.
 *   OR
 *   B) Add your Gmail address as a "Test user"
 *      → APIs & Services > OAuth consent screen > Test users > Add users
 *      Tokens will still expire every 7 days.
 *
 * USAGE
 * -----
 *   node scripts/generate-refresh-token.js
 *
 * The script requires no arguments. It reads GMAIL_CLIENT_ID and 
 * GMAIL_CLIENT_SECRET from .env.local automatically.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ── Load .env.local ─────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env.local');

function loadEnvLocal() {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Unescape \$ (common in DATABASE_URL passwords with special chars)
    val = val.replace(/\\\$/g, '$');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ── Validate credentials ─────────────────────────────────────────────────────

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  Missing required environment variables in .env.local:\n');
  if (!CLIENT_ID)     console.error('   GMAIL_CLIENT_ID is not set');
  if (!CLIENT_SECRET) console.error('   GMAIL_CLIENT_SECRET is not set');
  console.error('\nAdd these from your Google Cloud Console OAuth 2.0 credentials.\n');
  process.exit(1);
}

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

// Scopes required by the application.
// Must match what the Gmail sender uses (sender.ts + oauth.ts).
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

// ── Build the authorization URL manually (no googleapis dependency needed) ───
// We use the googleapis library since it's already in package.json.

let google;
try {
  google = require('googleapis').google;
} catch {
  console.error('\n❌  googleapis package not found. Run: npm install googleapis\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',  // Always force consent to ensure refresh_token is returned
});

// ── Start local HTTP server to catch the callback ────────────────────────────

let server;

async function exchangeCode(code) {
  console.log('\n⏳  Exchanging authorization code for tokens...');

  // Create a fresh client with the exact redirect URI used in the auth URL
  const exchangeClient = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const { tokens } = await exchangeClient.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token.\n\n' +
      'This usually means the account already authorized this app and Google\n' +
      'only issues a refresh_token on first authorization.\n\n' +
      'To fix:\n' +
      '  1. Visit https://myaccount.google.com/permissions\n' +
      '  2. Find and REVOKE access for your app\n' +
      '  3. Run this script again'
    );
  }

  // Get the email address from the tokeninfo
  exchangeClient.setCredentials(tokens);
  let email = null;
  try {
    const info = await exchangeClient.getTokenInfo(tokens.access_token);
    email = info.email;
  } catch {
    // Non-fatal — email is just informational
  }

  return { refreshToken: tokens.refresh_token, email };
}

function updateEnvLocal(refreshToken) {
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  // Replace existing GMAIL_REFRESH_TOKEN line or append
  const tokenLine = `GMAIL_REFRESH_TOKEN=${refreshToken}`;
  if (/^GMAIL_REFRESH_TOKEN=.*/m.test(content)) {
    content = content.replace(/^GMAIL_REFRESH_TOKEN=.*/m, tokenLine);
  } else {
    // Append after GMAIL_CLIENT_SECRET or at the end
    if (/^GMAIL_CLIENT_SECRET=.*/m.test(content)) {
      content = content.replace(
        /^(GMAIL_CLIENT_SECRET=.*)$/m,
        `$1\n${tokenLine}`
      );
    } else {
      content = content.trimEnd() + '\n' + tokenLine + '\n';
    }
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log('\n⚠️   Could not open browser automatically. Please open this URL manually:\n');
      console.log(`  ${url}\n`);
    }
  });
}

function sendHtmlResponse(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/oauth2callback') {
    sendHtmlResponse(res, 404, '<h1>Not found</h1>');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    sendHtmlResponse(res, 400, `
      <!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;">
      <h1>⛔ Authorization Denied</h1>
      <p>Error: <code>${error}</code></p>
      <p>Please close this window and try again.</p>
      </body></html>
    `);
    console.error('\n❌  Authorization was denied:', error, '\n');
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    sendHtmlResponse(res, 400, '<h1>Missing authorization code</h1>');
    server.close();
    process.exit(1);
    return;
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);

    // Write to .env.local BEFORE sending the response
    updateEnvLocal(refreshToken);

    sendHtmlResponse(res, 200, `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Gmail OAuth — Setup Complete</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; line-height: 1.6; color: #1a1a2e; }
          .success { background: #f0fff4; border: 2px solid #48bb78; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .token-box { background: #f4f4f4; border-radius: 6px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 0.8em; }
          h1 { color: #2d8a4e; }
        </style>
      </head>
      <body>
        <h1>✅ Gmail OAuth — Setup Complete</h1>
        <div class="success">
          <p><strong>Authorized as:</strong> ${email || 'unknown'}</p>
          <p><strong>GMAIL_REFRESH_TOKEN has been written to .env.local automatically.</strong></p>
          <p>You can close this window.</p>
        </div>
        <h2>What was saved</h2>
        <p>The following line was written to your <code>.env.local</code>:</p>
        <div class="token-box">GMAIL_REFRESH_TOKEN=${refreshToken.slice(0, 20)}...${refreshToken.slice(-6)}</div>
        <h2>Next steps</h2>
        <ol>
          <li>Close this browser window</li>
          <li>Restart your Next.js dev server (<code>npm run dev</code>)</li>
          <li>Trigger the Gmail send pipeline</li>
        </ol>
        <hr>
        <p style="color:#888;font-size:0.85em;">
          ⚠ Keep this token secret. Revoke at
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
          if compromised.
        </p>
      </body>
      </html>
    `);

    console.log('\n✅  SUCCESS!');
    console.log(`   Authorized as: ${email || 'unknown'}`);
    console.log('   GMAIL_REFRESH_TOKEN has been written to .env.local');
    console.log('\n📋  Next steps:');
    console.log('   1. Close the browser window');
    console.log('   2. Restart your dev server: npm run dev');
    console.log('   3. Trigger the send pipeline\n');

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendHtmlResponse(res, 500, `
      <!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;">
      <h1>⛔ Token Exchange Failed</h1>
      <pre style="background:#fff0f0;padding:16px;border-radius:6px;white-space:pre-wrap;">${msg}</pre>
      <p><a href="javascript:window.close()">Close this window</a> and check the terminal for details.</p>
      </body></html>
    `);
    console.error('\n❌  Token exchange failed:', msg, '\n');
    server.close();
    process.exit(1);
  }

  // Close server after a short delay so browser can render the success page
  setTimeout(() => {
    server.close();
    process.exit(0);
  }, 3000);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Gmail OAuth2 Refresh Token Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Local server: http://localhost:${PORT}`);
  console.log(`  Client ID:    ${CLIENT_ID.slice(0, 20)}...`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️   IMPORTANT — Google Cloud Console prerequisite:');
  console.log('   The following redirect URI MUST be in your OAuth 2.0 credentials:');
  console.log(`\n   → ${REDIRECT_URI}\n`);
  console.log('   If it is not, add it at:');
  console.log('   https://console.cloud.google.com/apis/credentials');
  console.log('   (APIs & Services > Credentials > your OAuth client > Authorized redirect URIs)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🌐  Opening browser for Google authorization...\n');
  openBrowser(authUrl);
  console.log('   (If browser does not open, visit this URL manually:)');
  console.log(`   ${authUrl}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Waiting for authorization callback...');
  console.log('   (Press Ctrl+C to cancel)\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error('   Please close whatever is using that port and try again.\n');
  } else {
    console.error('\n❌  Server error:', err.message, '\n');
  }
  process.exit(1);
});
