const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE sequences DROP CONSTRAINT IF EXISTS sequences_prospect_id_key;');
    console.log('Constraint dropped successfully');
  } catch (e) {
    console.error('Error dropping constraint:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
