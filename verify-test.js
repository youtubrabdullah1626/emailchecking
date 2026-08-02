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
  const step = await prisma.sequenceStep.findUnique({
    where: { id: 'cms4djri2000430nklfp1pnkt' },
    include: { email_events: true }
  });
  console.dir(step, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
