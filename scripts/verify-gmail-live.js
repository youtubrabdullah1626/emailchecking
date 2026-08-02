/**
 * Gmail API Live Verification Script
 * ====================================
 * Directly interrogates the Gmail API to verify:
 * 1. Which account is authenticated (tokeninfo)
 * 2. The sender's profile email
 * 3. Whether message 19fa807862656b6a exists in Gmail
 * 4. The full message headers (From, To, Subject, Date)
 * 5. Whether the message is in the Sent folder (SENT label)
 * 6. What labels are attached to the message
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\\$/g, '$');
    if (!process.env[key]) process.env[key] = val;
  }
}

const { google } = require('googleapis');
const GMAIL_MESSAGE_ID = '19fa807862656b6a';

async function main() {
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
  const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Gmail API Live Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  CLIENT_ID:     ${CLIENT_ID ? CLIENT_ID.slice(0, 30) + '...' : 'MISSING'}`);
  console.log(`  CLIENT_SECRET: ${CLIENT_SECRET ? 'SET (not shown)' : 'MISSING'}`);
  console.log(`  REFRESH_TOKEN: ${REFRESH_TOKEN ? REFRESH_TOKEN.slice(0, 20) + '...' : 'MISSING'}`);
  console.log(`  SENDER_EMAIL:  ${SENDER_EMAIL || 'MISSING'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('ERROR: Missing OAuth credentials. Aborting.');
    process.exit(1);
  }

  // Build auth client
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });

  // Step 1: Exchange refresh token for access token
  console.log('Step 1: Refreshing access token...');
  let accessToken;
  try {
    const result = await auth.getAccessToken();
    accessToken = result.token;
    console.log(`  OK  Access token obtained (prefix: ${accessToken.slice(0, 15)}...)`);
  } catch (err) {
    console.error(`  FAIL  Token refresh FAILED: ${err.message}`);
    if (err.response) console.error('       Google response:', JSON.stringify(err.response.data));
    process.exit(1);
  }

  // Step 2: Get token identity
  console.log('\nStep 2: Checking token identity (tokeninfo)...');
  try {
    const tokenInfo = await auth.getTokenInfo(accessToken);
    console.log(`  OK  Token belongs to: ${tokenInfo.email}`);
    console.log(`      Scopes: ${tokenInfo.scopes ? tokenInfo.scopes.join(', ') : 'n/a'}`);
    if (tokenInfo.email !== SENDER_EMAIL) {
      console.log(`  WARN  MISMATCH! Token email (${tokenInfo.email}) != GMAIL_SENDER_EMAIL (${SENDER_EMAIL})`);
    } else {
      console.log(`  OK  Token email matches GMAIL_SENDER_EMAIL`);
    }
  } catch (err) {
    console.error(`  FAIL  tokeninfo FAILED: ${err.message}`);
  }

  // Step 3: Get the Gmail profile
  const gmail = google.gmail({ version: 'v1', auth });
  console.log('\nStep 3: Gmail API - get authenticated user profile...');
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`  OK  Gmail profile email: ${profile.data.emailAddress}`);
    console.log(`      Total messages: ${profile.data.messagesTotal}`);
    console.log(`      Threads total:  ${profile.data.threadsTotal}`);
    if (profile.data.emailAddress !== SENDER_EMAIL) {
      console.log(`  WARN  MISMATCH! Gmail profile (${profile.data.emailAddress}) != GMAIL_SENDER_EMAIL (${SENDER_EMAIL})`);
    } else {
      console.log(`  OK  Gmail profile matches GMAIL_SENDER_EMAIL`);
    }
  } catch (err) {
    console.error(`  FAIL  getProfile FAILED: ${err.message}`);
  }

  // Step 4: Fetch the specific message by ID
  console.log(`\nStep 4: Fetching Gmail message ID: ${GMAIL_MESSAGE_ID}...`);
  try {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: GMAIL_MESSAGE_ID,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    });

    const data = msg.data;
    const headers = {};
    for (const h of (data.payload.headers || [])) {
      headers[h.name] = h.value;
    }

    console.log(`  OK  Message EXISTS in Gmail`);
    console.log(`      From:    ${headers['From'] || 'n/a'}`);
    console.log(`      To:      ${headers['To'] || 'n/a'}`);
    console.log(`      Subject: ${headers['Subject'] || 'n/a'}`);
    console.log(`      Date:    ${headers['Date'] || 'n/a'}`);
    console.log(`      Labels:  ${(data.labelIds || []).join(', ')}`);
    console.log(`      Thread:  ${data.threadId}`);

    const hasSentLabel = (data.labelIds || []).includes('SENT');
    if (hasSentLabel) {
      console.log(`  OK  Message has SENT label - appears in Sent folder`);
    } else {
      console.log(`  WARN  Message does NOT have SENT label!`);
      console.log(`        Labels present: ${(data.labelIds || []).join(', ')}`);
      console.log(`        This explains why the email is not in the Sent folder.`);
    }
  } catch (err) {
    if (err.code === 404 || (err.response && err.response.status === 404)) {
      console.log(`  FAIL  Message ${GMAIL_MESSAGE_ID} NOT FOUND in Gmail.`);
      console.log(`        The send may have succeeded at the API level but the message`);
      console.log(`        is not accessible in this Gmail account.`);
    } else {
      console.error(`  FAIL  messages.get FAILED: ${err.message}`);
      if (err.response) console.error('       Google response:', JSON.stringify(err.response.data));
    }
  }

  // Step 5: Search Sent folder
  console.log('\nStep 5: Searching Sent folder for recent messages...');
  try {
    const sentList = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: 10,
    });
    const messages = sentList.data.messages || [];
    if (messages.length === 0) {
      console.log('  WARN  Sent folder appears empty or API cannot access it');
    } else {
      console.log(`  OK  Found ${messages.length} recent message(s) in SENT:`);
      for (const m of messages) {
        const tag = m.id === GMAIL_MESSAGE_ID ? '  <-- TEST EMAIL' : '';
        console.log(`      ${m.id}${tag}`);
      }
      const testEmailInSent = messages.some(m => m.id === GMAIL_MESSAGE_ID);
      if (!testEmailInSent) {
        console.log(`  WARN  Test email (${GMAIL_MESSAGE_ID}) is NOT in recent SENT messages`);
      } else {
        console.log(`  OK  Test email IS in SENT folder`);
      }
    }
  } catch (err) {
    console.error(`  FAIL  SENT folder search FAILED: ${err.message}`);
  }

  // Step 6: Check the DB record
  console.log('\nStep 6: Verifying Prisma DB record...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const step = await prisma.sequenceStep.findUnique({
      where: { id: 'cms4djri2000430nklfp1pnkt' },
      include: { email_events: true },
    });
    if (!step) {
      console.log('  FAIL  Step record not found in DB');
    } else {
      console.log(`  OK  DB Record:`);
      console.log(`      status:           ${step.status}`);
      console.log(`      sent_at:          ${step.sent_at}`);
      console.log(`      gmail_message_id: ${step.gmail_message_id}`);
      console.log(`      gmail_thread_id:  ${step.gmail_thread_id}`);
      console.log(`      EmailEvents:      ${step.email_events.length}`);
      step.email_events.forEach(ev => {
        console.log(`        -> ${ev.event_type} at ${ev.occurred_at}`);
        console.log(`           metadata: ${JSON.stringify(ev.metadata)}`);
      });
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error(`  FAIL  DB query FAILED: ${err.message}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Verification complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
