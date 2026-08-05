import { buildGmailMessage } from "../lib/gmail/message";

describe("Deliverability Pipeline V2 - Security & Penetration Tests", () => {
  it("prevents CRLF header injection in the To and Subject fields", () => {
    const maliciousSubject = "Urgent\r\nBcc: hacker@evil.com";
    const maliciousTo = "John\nBcc: hacker@evil.com <john@example.com>";
    
    const payload = buildGmailMessage({
      from: "sender@example.com",
      to: maliciousTo,
      toName: "John\r\nBcc: hacker@evil.com",
      subject: maliciousSubject,
      body: "Test body"
    });

    const rawStr = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    
    // The Bcc injection attempt should be neutralized (newlines stripped)
    expect(rawStr).not.toContain("\r\nBcc: hacker@evil.com");
    expect(rawStr).not.toContain("\nBcc:");
    expect(rawStr).toContain("UrgentBcc: hacker@evil.com");
  });

  it("safely generates a unique entropy-based Message-ID without collisions", () => {
    const payloads = Array.from({ length: 1000 }).map(() => buildGmailMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      toName: "",
      subject: "Subject",
      body: "Body"
    }));

    const messageIds = payloads.map(p => {
      const rawStr = Buffer.from(p.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
      const match = rawStr.match(/Message-ID: <(.+?)>/);
      return match ? match[1] : null;
    });

    // Ensure all 1000 Message-IDs are valid and unique
    const uniqueIds = new Set(messageIds);
    expect(uniqueIds.size).toBe(1000);
    expect(messageIds[0]).toMatch(/^[0-9]+\.[a-f0-9]{32}@example\.com$/);
  });

  it("prevents duplicate List-Unsubscribe headers from being injected", () => {
    // Attempting to pass custom List-Unsubscribe via headers while enableListUnsubscribe=true
    const payload = buildGmailMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      toName: "Name",
      subject: "Sub",
      body: "Body",
      enableListUnsubscribe: true,
      headers: {
        "List-Unsubscribe": "<mailto:other@example.com>"
      }
    });

    const rawStr = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const unsubscribeMatches = rawStr.match(/List-Unsubscribe:/g);
    
    // Due to the strict implementation in message.ts, if we enableListUnsubscribe, 
    // it shouldn't duplicate if passed via custom headers because we only append the auto-generated one.
    // Actually, in our current `message.ts`, we don't pass custom `List-Unsubscribe` from `headers` block at all (only Message-ID is explicitly extracted from `customHeaders`).
    // So there is explicitly exactly ONE List-Unsubscribe header injected.
    expect(unsubscribeMatches?.length).toBe(1);
  });

  it("neutralizes hidden spam signatures in the HTML payload", () => {
    // The tracking injector no longer uses `display:none` or `visibility:hidden`.
    // It's checked during generation. We verify the payload doesn't contain hidden spam tricks.
    const pixelHtml = '<img src="https://example.com/api/track/123" width="1" height="1" alt="" />';
    
    const payload = buildGmailMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      toName: "Name",
      subject: "Sub",
      body: "Body",
      trackingPixel: pixelHtml
    });

    const rawStr = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    expect(rawStr).not.toContain("display:none");
    expect(rawStr).not.toContain("visibility:hidden");
  });

  it("handles empty or malformed sender domains safely (fallback to localhost)", () => {
    const payload = buildGmailMessage({
      from: "invalidemailformat", // No @ symbol
      to: "recipient@example.com",
      toName: "Name",
      subject: "Sub",
      body: "Body"
    });

    const rawStr = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    expect(rawStr).toContain("Message-ID: <");
    expect(rawStr).toContain("@localhost>"); // Fallback domain
  });
});
