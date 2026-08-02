/**
 * Investigate all sequence steps in the DB.
 * Shows all recent steps with their status, timing, and prospect info.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    val = val.replace(/\\\$/g, '$');
    if (!process.env[key]) process.env[key] = val;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`\nCurrent UTC time: ${now.toISOString()}\n`);

  // Get ALL prospects with their sequences and steps
  const prospects = await prisma.prospect.findMany({
    include: {
      sequence: {
        include: {
          steps: {
            orderBy: { step_number: 'asc' },
            include: { email_events: true }
          }
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  for (const p of prospects) {
    const seq = p.sequence;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`PROSPECT: ${p.name} <${p.email}>`);
    console.log(`  id: ${p.id}`);
    console.log(`  status: ${p.status}`);
    console.log(`  timezone: ${p.timezone}`);
    console.log(`  created_at: ${p.created_at}`);

    if (!seq) {
      console.log(`  SEQUENCE: none`);
      continue;
    }

    console.log(`\n  SEQUENCE: ${seq.id}`);
    console.log(`    status: ${seq.status}`);
    console.log(`    started_at: ${seq.started_at}`);

    for (const step of seq.steps) {
      const isDue = step.scheduled_at_utc <= now;
      const diffMs = step.scheduled_at_utc - now;
      const diffMin = Math.round(diffMs / 60000);
      console.log(`\n    STEP ${step.step_number}: ${step.id}`);
      console.log(`      status:               ${step.status}`);
      console.log(`      subject:              ${step.subject}`);
      console.log(`      scheduled_at_utc:     ${step.scheduled_at_utc ? step.scheduled_at_utc.toISOString() : 'NULL'}`);
      console.log(`      scheduled_time_local: ${step.scheduled_time_local}`);
      console.log(`      timezone:             ${step.timezone}`);
      console.log(`      sent_at:              ${step.sent_at || 'NULL'}`);
      console.log(`      gmail_message_id:     ${step.gmail_message_id || 'NULL'}`);
      console.log(`      IS DUE NOW?:          ${isDue ? 'YES' : 'NO — fires in ' + Math.abs(diffMin) + ' min'}`);
      console.log(`      email_events:         ${step.email_events.length}`);
      for (const ev of step.email_events) {
        console.log(`        -> ${ev.event_type} at ${ev.occurred_at}`);
      }

      if (step.status !== 'PENDING') {
        console.log(`      SCHEDULER SKIP REASON: status is '${step.status}' (not PENDING)`);
      } else if (!isDue) {
        console.log(`      SCHEDULER SKIP REASON: not due yet (fires in ${Math.abs(diffMin)} min)`);
      } else if (seq.status !== 'ACTIVE') {
        console.log(`      SCHEDULER SKIP REASON: sequence status is '${seq.status}' (not ACTIVE)`);
      } else if (p.status !== 'ACTIVE') {
        console.log(`      SCHEDULER SKIP REASON: prospect status is '${p.status}' (not ACTIVE)`);
      } else {
        console.log(`      ELIGIBLE FOR SCHEDULER: YES`);
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(err => { console.error('Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
