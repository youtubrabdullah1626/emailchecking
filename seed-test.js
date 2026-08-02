const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const envConfig = fs.readFileSync('.env.local', 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].replace(/^["']|["']$/g, '').replace(/\\\$/g, '$').trim();
    }
  });
}

const prisma = new PrismaClient();

async function main() {
  const email = "youtubrabdullah1626@gmail.com";
  
  // Cleanup existing test data if any
  const existing = await prisma.prospect.findUnique({ where: { email } });
  if (existing) {
    await prisma.prospect.delete({ where: { id: existing.id } });
  }

  // Create prospect
  const prospect = await prisma.prospect.create({
    data: {
      name: "Test User",
      company: "Test Co",
      email: email,
      timezone: "UTC",
      status: "ACTIVE"
    }
  });

  // Create sequence
  const sequence = await prisma.sequence.create({
    data: {
      prospect_id: prospect.id,
      status: "ACTIVE",
      started_at: new Date()
    }
  });

  // Create step scheduled in the past
  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago

  const step = await prisma.sequenceStep.create({
    data: {
      sequence_id: sequence.id,
      step_number: 1,
      subject: "Test Email from Phase 9 Authorization",
      body: "Hello! This is a controlled test email confirming your Gmail OAuth setup is fully functional.",
      scheduled_at_utc: pastDate,
      scheduled_time_local: "12:00",
      timezone: "UTC",
      status: "PENDING"
    }
  });

  console.log(`Created test prospect and PENDING sequence step (ID: ${step.id}) scheduled for ${pastDate.toISOString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
