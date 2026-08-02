import prisma from "../src/lib/prisma";

async function debugReply() {
  const email = "abdullahhanjra153@gmail.com";
  
  console.log("--- PROSPECT ---");
  const prospect = await prisma.prospect.findUnique({ where: { email } });
  console.log(prospect);

  if (!prospect) return;

  console.log("\n--- SEQUENCE ---");
  const sequence = await prisma.sequence.findFirst({ where: { prospect_id: prospect.id }, orderBy: { created_at: "desc" }, include: { steps: true } });
  console.log(JSON.stringify(sequence, null, 2));

  console.log("\n--- REPLY CLASSIFICATIONS ---");
  const classifications = await prisma.replyClassification.findMany({ where: { prospect_id: prospect.id } });
  console.log(classifications);

  console.log("\n--- TRACKED EMAILS ---");
  const trackedEmails = await prisma.trackedEmail.findMany({ where: { recipient_email: email }, include: { events: true } });
  console.log(JSON.stringify(trackedEmails, null, 2));
}

debugReply().catch(console.error).finally(() => process.exit(0));
