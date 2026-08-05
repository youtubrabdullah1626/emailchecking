import { buildGmailMessage } from "./src/lib/gmail/message";
import { TrackingInjector } from "./src/lib/tracking/TrackingInjector";
import { DeliverabilityHealthEvaluator } from "./src/lib/reputation/DeliverabilityHealthModel";

async function runBenchmark() {
  console.log("--- Performance Benchmark ---");
  
  // 1. Deliverability Evaluation
  const t0 = performance.now();
  const health = await DeliverabilityHealthEvaluator.evaluateHealth("sender@example.com");
  const t1 = performance.now();
  console.log(`Deliverability Evaluation: ${(t1 - t0).toFixed(3)} ms`);

  // 2. Tracking Generation
  const t2 = performance.now();
  const pixel = TrackingInjector.generatePixel("test-id", "https://example.com");
  const t3 = performance.now();
  console.log(`Tracking Generation: ${(t3 - t2).toFixed(3)} ms`);

  // 3. MIME Generation (including Header generation)
  const t4 = performance.now();
  const payload = buildGmailMessage({
    from: "sender@example.com",
    to: "recipient@example.com",
    toName: "John Doe",
    subject: "Enterprise Proposal",
    body: "This is a strictly formatted RFC 5322 test email.",
    trackingPixel: pixel,
    enableListUnsubscribe: true
  });
  const t5 = performance.now();
  console.log(`MIME & Header Generation: ${(t5 - t4).toFixed(3)} ms`);
  console.log(`Total Time: ${(t5 - t0).toFixed(3)} ms`);
  console.log(`Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);

  console.log("\n--- Generated RFC 5322 MIME Payload (Base64url decoded) ---");
  const rawDecoded = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  console.log(rawDecoded);
}

runBenchmark().catch(console.error);
