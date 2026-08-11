import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.auditLog.count();
  console.log("Total audit logs in DB:", count);
  const latest = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log("Latest logs:", latest);
}
main().catch(console.error).finally(() => prisma.$disconnect());
