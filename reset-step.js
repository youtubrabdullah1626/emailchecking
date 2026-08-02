/**
 * Reset the test step back to PENDING so the scheduler can claim it.
 * Reads DATABASE_URL from .env.local.
 */
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\\$/g, '$');
    if (!process.env[key]) process.env[key] = val;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STEP_ID = 'cms4djri2000430nklfp1pnkt';

async function main() {
  // Delete the FAILED EmailEvent so we get a clean audit trail on re-send
  const deleted = await prisma.emailEvent.deleteMany({
    where: { sequence_step_id: STEP_ID },
  });
  console.log(`Deleted ${deleted.count} EmailEvent record(s)`);

  // Reset the step to PENDING
  const updated = await prisma.sequenceStep.update({
    where: { id: STEP_ID },
    data: {
      status: 'PENDING',
      sent_at: null,
      gmail_message_id: null,
      gmail_thread_id: null,
    },
  });
  console.log('Step reset to PENDING:', updated.id, '→', updated.status);
}

main()
  .catch(err => { console.error('Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
