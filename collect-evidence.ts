import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildGmailMessage } from './src/lib/gmail/message';

async function run() {
  console.log("=== PRE-TEST EVIDENCE COLLECTION (EXP-1A Baseline) ===");

  // 1. Configuration Validation
  const envPath = path.join(process.cwd(), '.env.local');
  let envExists = false;
  let hasAppUrl = false;
  let appUrl = '';
  if (fs.existsSync(envPath)) {
    envExists = true;
    const content = fs.readFileSync(envPath, 'utf8');
    const urlMatch = content.match(/NEXT_PUBLIC_APP_URL=(.*)/);
    if (urlMatch) {
      hasAppUrl = true;
      appUrl = urlMatch[1].trim();
    }
  }
  console.log(`Config: .env.local exists: ${envExists}`);
  console.log(`Config: NEXT_PUBLIC_APP_URL: ${hasAppUrl ? appUrl : 'Not set (defaults to localhost)'}`);

  // 2. Generate Payload for EXP-1A
  const testId = "EXP-1A";
  const baseUrl = hasAppUrl ? appUrl : "http://localhost:3000";
  const trackingId = "test-tracking-id-123";
  
  // Note: generatePixel automatically returns "" if baseUrl is localhost, so for a true baseline test
  // if they test locally, it will lack the pixel. We log this.
  let trackingPixel = "";
  if (!baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
     trackingPixel = `<img src="${baseUrl}/api/track/${trackingId}" width="1" height="1" alt="" style="display:none; visibility:hidden; width:1px; height:1px;" />`;
  }
  
  const options = {
    from: "sender@example.com",
    to: "test.recipient@example.com",
    toName: "Test Recipient",
    subject: "Deliverability Test A",
    body: "Hello, this is a standard test email. We are verifying deliverability metrics.",
    trackingPixel
  };

  const payload = buildGmailMessage(options);

  // 3. Collect Payload Artifacts
  const rawMime = Buffer.from(payload.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  const mimeHash = crypto.createHash('sha256').update(rawMime).digest('hex');

  // Extract generated boundary to prove structural variation
  const boundaryMatch = rawMime.match(/boundary="(.*?)"/);
  const boundary = boundaryMatch ? boundaryMatch[1] : 'Unknown';

  console.log(`MIME Boundary: ${boundary}`);
  console.log(`MIME SHA-256 Hash: ${mimeHash}`);
  console.log(`Tracking Pixel Injected: ${trackingPixel ? 'Yes' : 'No'}`);
  console.log(`Raw Payload Size: ${payload.raw.length} bytes`);
  
  console.log("\n=== END EVIDENCE ===");
}

run().catch(console.error);
