import prisma from "../src/lib/prisma";

async function run() {
  const prospectId = 'cmsbt63qy000kcujfuor9x9zq';
  
  const seqs = await prisma.sequence.findMany({
    where: { prospect_id: prospectId },
    include: { steps: true }
  });
  console.log("Sequences for prospect:");
  console.dir(seqs, { depth: null });

  const classifications = await prisma.replyClassification.findMany({
    where: { prospect_id: prospectId }
  });
  console.log("Classifications for prospect:");
  console.dir(classifications, { depth: null });

  const allSteps = await prisma.sequenceStep.findMany({
    where: { gmail_thread_id: "19fc1fa98f62933a" }
  });
  console.log("Steps with thread 19fc1fa98f62933a globally:");
  console.dir(allSteps, { depth: null });
}

run().catch(console.error).finally(() => process.exit(0));
