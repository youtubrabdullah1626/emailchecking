import prisma from "../src/lib/prisma";

async function query() {
  const steps = await prisma.sequenceStep.findMany({
    where: { gmail_thread_id: "19fc1fa98f62933a" },
    include: { sequence: { include: { prospect: true } } }
  });
  console.log("Steps with thread 19fc1fa98f62933a:");
  console.dir(steps, { depth: null });
}

query().catch(console.error).finally(() => process.exit(0));
