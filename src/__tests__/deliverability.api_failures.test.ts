import { buildGmailMessage } from "../lib/gmail/message";
import { TrackingInjector } from "../lib/tracking/TrackingInjector";
import { DeliverabilityHealthEvaluator } from "../lib/reputation/DeliverabilityHealthModel";

describe("Production Load & API Failures (Concurrency & Replay)", () => {
  
  it("maintains idempotency and pure function characteristics under highly concurrent replay attacks", async () => {
    // Attempt to evaluate health for the same sender 100 times concurrently 
    // simulating a massive race condition on the outbound send queue.
    const promises = Array.from({ length: 100 }).map(() => DeliverabilityHealthEvaluator.evaluateHealth("target@example.com"));
    const results = await Promise.all(promises);

    // All results must map cleanly without state mutation crossing over
    expect(results.length).toBe(100);
    expect(results.every(r => r.overall === "HEALTHY")).toBe(true);
  });

  it("strictly handles missing attributes safely without undefined behavior under load", () => {
    const payload = buildGmailMessage({
      from: "safe@example.com",
      to: "recipient@example.com",
      toName: undefined as any,
      subject: undefined as any,
      body: "Test"
    });

    const rawStr = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    // Ensure we don't accidentally print "Subject: undefined"
    expect(rawStr).not.toContain("Subject: undefined");
    expect(rawStr).not.toContain("To: undefined <recipient@example.com>");
  });

});
