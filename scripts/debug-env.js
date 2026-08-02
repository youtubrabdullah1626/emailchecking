const fs = require('fs');
const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
for (const line of lines) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  let val = match[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  val = val.replace(/\\\$/g, '$');
  process.env[key] = val;
}
console.log('GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID ? 'FOUND' : 'MISSING');
console.log('GMAIL_CLIENT_SECRET:', process.env.GMAIL_CLIENT_SECRET ? 'FOUND' : 'MISSING');
console.log('GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? process.env.GMAIL_REFRESH_TOKEN.slice(0,20)+'...' : 'MISSING');
console.log('GMAIL_SENDER_EMAIL:', process.env.GMAIL_SENDER_EMAIL || 'MISSING');
