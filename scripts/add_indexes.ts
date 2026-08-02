import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS prospects_created_at_idx ON prospects(created_at);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects(status);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS sequences_created_at_idx ON sequences(created_at);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS sequences_status_idx ON sequences(status);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS email_events_occurred_at_idx ON email_events(occurred_at);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS system_errors_last_seen_idx ON system_errors(last_seen);`;
  await prisma.$queryRaw`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);`;
  console.log('Indexes created successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
