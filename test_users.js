const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.users.findMany({ select: { id: true, email: true } }));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
