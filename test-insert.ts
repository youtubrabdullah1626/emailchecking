import { google } from 'googleapis';
import { createOAuth2Client } from './src/lib/gmail/oauth';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testInsert() {
  const auth = createOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });
  
  const rawMessage = [
    `From: test_prospect@example.com`,
    `To: ${process.env.GMAIL_SENDER_EMAIL}`,
    `Subject: Re: Test Insert`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    `This is a test inserted message.`
  ].join('\n');
  
  const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  try {
    const res = await gmail.users.messages.insert({
      userId: 'me',
      internalDateSource: 'dateHeader',
      requestBody: {
        raw: encodedMessage,
        labelIds: ['INBOX', 'UNREAD']
      }
    });
    console.log("INSERT SUCCESS:", res.data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("INSERT FAILED:", msg);
  }
}

testInsert();
