const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { google } = require('googleapis');

console.log("=== OAUTH DIAGNOSTIC REPORT ===");

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const redirectUri = (APP_URL.endsWith("/") ? APP_URL.slice(0, -1) : APP_URL) + "/api/auth/gmail/callback";

console.log("1. APP_URL from env:", process.env.APP_URL);
console.log("2. NEXT_PUBLIC_APP_URL from env:", process.env.NEXT_PUBLIC_APP_URL);
console.log("3. Computed APP_URL:", APP_URL);
console.log("4. EXACT redirect_uri being sent:", redirectUri);
console.log("5. GOOGLE_CLIENT_ID:", process.env.GMAIL_CLIENT_ID);
console.log("6. Which callback route is being used:", "/api/auth/gmail/callback");

const client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  redirectUri
);

const authUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly"
  ],
});

console.log("\n7. EXACT OAuth URL generated before redirect:\n" + authUrl);
