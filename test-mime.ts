import { buildGmailMessage } from "./src/lib/gmail/message";

const options = {
  from: "sender@example.com",
  to: "recipient@example.com",
  toName: "John Doe",
  subject: "Testing Deliverability",
  body: "Hello John,\n\nThis is a test email.\n\nBest,\nSender",
  trackingPixel: '<img src="https://example.com/api/track/123" width="1" height="1" alt="" style="display:none; visibility:hidden; width:1px; height:1px;" />'
};

const payload = buildGmailMessage(options);

// Decode base64url back to raw RFC 2822 to see exactly what we are sending
const rawString = Buffer.from(
  payload.raw.replace(/-/g, "+").replace(/_/g, "/"),
  "base64"
).toString("utf-8");

console.log("=== APP GENERATED RAW MIME ===");
console.log(rawString);
console.log("==============================");
