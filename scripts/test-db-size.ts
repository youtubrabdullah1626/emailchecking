import prisma from "../src/lib/prisma";

async function main() {
  try {
    const dbSize: any = await prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`;
    console.log("DB Size (bytes):", dbSize[0].size);

    const logSize: any = await prisma.$queryRaw`SELECT pg_total_relation_size('audit_logs') as size`;
    console.log("Log Size (bytes):", logSize[0].size);

    const mailSize: any = await prisma.$queryRaw`SELECT pg_total_relation_size('tracked_emails') as size`;
    console.log("Mail Size (bytes):", mailSize[0].size);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
