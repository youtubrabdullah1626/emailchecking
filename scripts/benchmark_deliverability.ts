import { buildGmailMessage } from "../src/lib/gmail/message";
import { TrackingInjector } from "../src/lib/tracking/TrackingInjector";
import { DeliverabilityHealthEvaluator } from "../src/lib/reputation/DeliverabilityHealthModel";
import { performance } from "perf_hooks";

const ITERATIONS = 10000;

function calculatePercentile(latencies: number[], percentile: number): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

async function runBenchmark() {
  console.log(`--- Delivering Deliverability Pipeline Performance Benchmark (${ITERATIONS} iterations) ---`);
  
  const healthLatencies: number[] = [];
  const trackingLatencies: number[] = [];
  const mimeLatencies: number[] = [];
  const totalLatencies: number[] = [];

  const initialMemory = process.memoryUsage();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    
    // 1. Health Evaluator
    const h0 = performance.now();
    await DeliverabilityHealthEvaluator.evaluateHealth("sender@example.com");
    healthLatencies.push(performance.now() - h0);

    // 2. Tracking
    const tr0 = performance.now();
    const pixel = TrackingInjector.generatePixel("test-id-" + i, "https://example.com");
    trackingLatencies.push(performance.now() - tr0);

    // 3. MIME Builder
    const m0 = performance.now();
    buildGmailMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      toName: "John Doe",
      subject: "Enterprise Proposal",
      body: "This is a strictly formatted RFC 5322 test email.",
      trackingPixel: pixel,
      enableListUnsubscribe: true
    });
    mimeLatencies.push(performance.now() - m0);
    
    totalLatencies.push(performance.now() - t0);
  }

  const finalMemory = process.memoryUsage();
  
  const report = {
    iterations: ITERATIONS,
    memoryDiffMB: {
      rss: ((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2),
      heapTotal: ((finalMemory.heapTotal - initialMemory.heapTotal) / 1024 / 1024).toFixed(2),
      heapUsed: ((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)
    },
    metrics: {
      health: {
        avg: (healthLatencies.reduce((a, b) => a + b) / ITERATIONS).toFixed(3),
        p50: calculatePercentile(healthLatencies, 50).toFixed(3),
        p95: calculatePercentile(healthLatencies, 95).toFixed(3),
        p99: calculatePercentile(healthLatencies, 99).toFixed(3)
      },
      tracking: {
        avg: (trackingLatencies.reduce((a, b) => a + b) / ITERATIONS).toFixed(3),
        p50: calculatePercentile(trackingLatencies, 50).toFixed(3),
        p95: calculatePercentile(trackingLatencies, 95).toFixed(3),
        p99: calculatePercentile(trackingLatencies, 99).toFixed(3)
      },
      mime: {
        avg: (mimeLatencies.reduce((a, b) => a + b) / ITERATIONS).toFixed(3),
        p50: calculatePercentile(mimeLatencies, 50).toFixed(3),
        p95: calculatePercentile(mimeLatencies, 95).toFixed(3),
        p99: calculatePercentile(mimeLatencies, 99).toFixed(3)
      },
      pipelineTotal: {
        avg: (totalLatencies.reduce((a, b) => a + b) / ITERATIONS).toFixed(3),
        p50: calculatePercentile(totalLatencies, 50).toFixed(3),
        p95: calculatePercentile(totalLatencies, 95).toFixed(3),
        p99: calculatePercentile(totalLatencies, 99).toFixed(3)
      }
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

runBenchmark().catch(console.error);
