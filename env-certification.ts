import * as fs from 'fs';
import * as path from 'path';

async function verifyEnvironment() {
  console.log("=== PRE-EXECUTION VALIDATION & ENVIRONMENT CERTIFICATION ===");
  
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
  const envData: Record<string, string> = {};

  for (const file of envFiles) {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
      console.log(`Found: ${file}`);
      const content = fs.readFileSync(p, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envData[match[1].trim()] = match[2].trim();
        }
      });
    }
  }

  console.log("\n--- CONFIGURATION AUDIT ---");
  const requiredKeys = [
    'NEXT_PUBLIC_APP_URL',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_SENDER_EMAIL',
    'DATABASE_URL'
  ];

  for (const key of requiredKeys) {
    const val = envData[key];
    if (val) {
      // Masking secrets
      const masked = key.includes('SECRET') || key.includes('TOKEN') || key.includes('URL') 
        ? val.substring(0, 4) + '...' + val.substring(val.length - 4) 
        : val;
      console.log(`[PASS] ${key} exists (Value: ${masked})`);
    } else {
      console.log(`[FAIL] ${key} is MISSING`);
    }
  }

  console.log("\n--- FEATURE VERIFICATION ---");
  const appUrl = envData['NEXT_PUBLIC_APP_URL'] || '';
  
  // Tracking Pixel Status
  let trackingStatus = "DISABLED (Misconfigured)";
  if (!appUrl) {
    trackingStatus = "DISABLED (Missing NEXT_PUBLIC_APP_URL)";
  } else if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    trackingStatus = "DISABLED (Localhost detected - intentionally disabled by code)";
  } else {
    trackingStatus = `ENABLED (Resolving to ${appUrl})`;
  }
  console.log(`Feature: Tracking Pixel -> ${trackingStatus}`);
  
  // Unsubscribe Header Status
  const unsubscribeStatus = envData['GMAIL_SENDER_EMAIL'] ? `ENABLED (mailto:${envData['GMAIL_SENDER_EMAIL']})` : "DISABLED (Missing Sender Email)";
  console.log(`Feature: List-Unsubscribe -> ${unsubscribeStatus}`);

  // HTML / MIME Status
  console.log(`Feature: HTML Generation -> ENABLED (Hardcoded in message.ts)`);
  console.log(`Feature: Plain Text Generation -> ENABLED (Hardcoded in message.ts)`);
  console.log(`Feature: OAuth Transport -> ${envData['GMAIL_REFRESH_TOKEN'] ? 'ENABLED' : 'DISABLED'}`);

  console.log("\n--- DEPLOYMENT VERIFICATION ---");
  // Check if there is a build output indicating a recent build
  const nextBuildPath = path.join(process.cwd(), '.next', 'BUILD_ID');
  if (fs.existsSync(nextBuildPath)) {
    const buildId = fs.readFileSync(nextBuildPath, 'utf-8');
    console.log(`[INFO] Local build detected. Build ID: ${buildId.trim()}`);
  } else {
    console.log(`[WARN] No local .next build output found.`);
  }

  // Check vercel config or git status if possible
  const vercelPath = path.join(process.cwd(), '.vercel');
  console.log(`Deployment Config: ${fs.existsSync(vercelPath) ? 'Vercel detected' : 'No Vercel dir found'}`);

  console.log("=== END VALIDATION ===");
}

verifyEnvironment().catch(console.error);
