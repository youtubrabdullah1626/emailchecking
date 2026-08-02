/**
 * Quick Gmail verification for a specific message ID.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    val = val.replace(/\\\$/g, '$');
    if (!process.env[key]) process.env[key] = val;
  }
}

const { google } = require('googleapis');
const MESSAGE_ID = process.argv[2] || '19fa87099062d27e';

async function main() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`\nVerifying Gmail message: ${MESSAGE_ID}`);

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: MESSAGE_ID,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  });

  const d = msg.data;
  const headers = {};
  for (const h of (d.payload.headers || [])) headers[h.name] = h.value;

  console.log(`  From:    ${headers['From']}`);
  console.log(`  To:      ${headers['To']}`);
  console.log(`  Subject: ${headers['Subject']}`);
  console.log(`  Date:    ${headers['Date']}`);
  console.log(`  Labels:  ${(d.labelIds || []).join(', ')}`);
  console.log(`  SENT label: ${(d.labelIds || []).includes('SENT') ? 'YES ✅' : 'NO ❌'}`);

  // Also check SENT folder list
  const sentList = await gmail.users.messages.list({ userId: 'me', labelIds: ['SENT'], maxResults: 5 });
  const inSent = (sentList.data.messages || []).some(m => m.id === MESSAGE_ID);
  console.log(`  In Sent folder list: ${inSent ? 'YES ✅' : 'NO ❌'}`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
