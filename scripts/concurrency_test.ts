import prisma from "../src/lib/prisma";
import { emailTrackingService } from "../src/lib/tracking/EmailTrackingService";

async function runTest() {
  console.log("Setting up Tracking ID...");
  const trackingId = await emailTrackingService.registerEmail({
    provider: "TEST",
    senderEmail: "test@test.com",
    recipientEmail: "recipient@test.com",
    sourceType: "MANUAL"
  });

  console.log(`Tracking ID: ${trackingId}`);
  console.log("Firing 50 concurrent OPENED events...");

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(
      emailTrackingService.ingestEvent(trackingId, "OPENED", undefined, { ip: "127.0.0.1" })
    );
  }

  await Promise.allSettled(promises);

  const finalState = await prisma.trackedEmail.findUnique({
    where: { id: trackingId }
  });

  console.log("Final State:");
  console.log(`Status: ${finalState?.status}`);
  console.log(`Open Count: ${finalState?.open_count}`);
  
  if (finalState?.open_count === 50) {
    console.log("✅ Concurrency Test Passed! No lost updates.");
  } else {
    console.error(`❌ Concurrency Test Failed! Expected 50, got ${finalState?.open_count}`);
    process.exit(1);
  }
}

runTest().catch(console.error).finally(() => process.exit(0));
