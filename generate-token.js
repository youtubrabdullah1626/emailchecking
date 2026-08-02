const { google } = require("googleapis");
const readline = require("readline");

// Load environment variables from .env.local
const fs = require("fs");
if (fs.existsSync(".env.local")) {
  const envConfig = fs.readFileSync(".env.local", "utf8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2]
        .replace(/^["']|["']$/g, "")
        .replace(/\\\$/g, "$")
        .trim();
    }
  });
}

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/api/auth/callback/google"; // Common local redirect URI, or 'urn:ietf:wg:oauth:2.0:oob'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost:3000", // Ensure this matches authorized redirect URIs in GCP
);

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // Forces consent screen to ensure refresh token is returned
});

console.log("----------------------------------------------------");
console.log("Authorize this app by visiting this url:");
console.log(authUrl);
console.log("----------------------------------------------------");
console.log(
  "After authorizing, you will be redirected to localhost:3000?code=...",
);
console.log('Copy the "code" parameter from the URL and paste it here:');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from the URL: ", async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n--- SUCCESS ---");
    console.log("Your new Refresh Token is:\n");
    console.log(tokens.refresh_token);
    console.log(
      "\nPlease update GMAIL_REFRESH_TOKEN in your .env.local with this value.",
    );
  } catch (err) {
    console.error("Error retrieving access token", err);
  }
  rl.close();
});
