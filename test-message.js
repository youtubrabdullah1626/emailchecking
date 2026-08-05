require('ts-node').register(); 
const { buildGmailMessage } = require('./src/lib/gmail/message.ts'); 
const res = buildGmailMessage({ 
  from: 'youtubrabdullah1626@gmail.com', 
  to: 'test@example.com', 
  toName: 'Test', 
  subject: 'Hello', 
  body: 'This is a test body.' 
}); 
console.log(Buffer.from(res.raw, 'base64').toString('utf-8'));
