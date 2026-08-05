import { buildGmailMessage } from "../src/lib/gmail/message";
import { TrackingInjector } from "../src/lib/tracking/TrackingInjector";
import { DeliverabilityHealthEvaluator } from "../src/lib/reputation/DeliverabilityHealthModel";
import { performance } from "perf_hooks";

const CONCURRENCY = 2000;
const TOTAL_REQUESTS = 10000;

async function executePipeline(id: number) {
  const t0 = performance.now();
  await DeliverabilityHealthEvaluator.evaluateHealth(`sender${id}@example.com`);
  const pixel = TrackingInjector.generatePixel(`track-${id}`, "https://example.com");
  buildGmailMessage({
    from: `sender${id}@example.com`,
    to: `recipient${id}@example.com`,
    toName: `John Doe ${id}`,
    subject: `Enterprise Proposal ${id}`,
    body: "This is a strictly formatted RFC 5322 test email under massive load.",
    trackingPixel: pixel,
    enableListUnsubscribe: true
  });
  return performance.now() - t0;
}

async function runStressTest() {
  console.log(`\n--- Production Load & Stress Validation ---`);
  console.log(`Target: ${TOTAL_REQUESTS} total requests`);
  console.log(`Concurrency Limit: ${CONCURRENCY} parallel operations`);
  
  const latencies: number[] = [];
  const startMemory = process.memoryUsage();
  const globalStart = performance.now();

  let active = 0;
  let completed = 0;
  let index = 0;

  return new Promise<void>((resolve) => {
    function spawn() {
      while (active < CONCURRENCY && index < TOTAL_REQUESTS) {
        active++;
        const currentIndex = index++;
        executePipeline(currentIndex)
          .then((latency) => {
            latencies.push(latency);
            active--;
            completed++;
            if (completed % 2500 === 0) {
              console.log(`[Progress] Completed ${completed} / ${TOTAL_REQUESTS}`);
            }
            if (completed === TOTAL_REQUESTS) {
              finish();
            } else {
              spawn();
            }
          })
          .catch(console.error);
      }
    }

    function finish() {
      const globalEnd = performance.now();
      const endMemory = process.memoryUsage();
      
      const sorted = latencies.sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const throughput = (TOTAL_REQUESTS / ((globalEnd - globalStart) / 1000)).toFixed(2);

      const memSpikeMB = ((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2);

      console.log(`\n[RESULTS]`);
      console.log(`Total Time: ${((globalEnd - globalStart) / 1000).toFixed(2)} seconds`);
      console.log(`Throughput: ${throughput} req/sec`);
      console.log(`Memory Spike: ${memSpikeMB} MB (Heap Used)`);
      console.log(`Latency (ms) -> Avg: ${avg.toFixed(2)} | p95: ${p95.toFixed(2)} | p99: ${p99.toFixed(2)}`);
      
      if (Number(memSpikeMB) > 500) {
         console.error(`[FAIL] Memory spike exceeded 500MB. Risk of Out-Of-Memory (OOM) under load.`);
         process.exit(1);
      }
      
      if (p99 > 150) {
         console.error(`[FAIL] p99 Latency exceeded 150ms. Throughput degraded.`);
         process.exit(1);
      }

      console.log(`[PASS] Stress test completed successfully within acceptable enterprise margins.`);
      resolve();
    }

    spawn();
  });
}

runStressTest();
