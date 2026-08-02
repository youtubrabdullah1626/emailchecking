import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.sequenceStep.deleteMany({
    where: { status: 'FAILED' }
  });
  console.log(`Deleted ${count.count} failed steps.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
