import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function runRestore(targetFile?: string) {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('❌ Backup directory does not exist.');
    process.exit(1);
  }

  let fileToRestore = targetFile;

  if (!fileToRestore) {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz'));
    if (files.length === 0) {
      console.error('❌ No backup files found.');
      process.exit(1);
    }
    // Sort descending by name (timestamp)
    files.sort((a, b) => b.localeCompare(a));
    fileToRestore = files[0];
  }

  const filePath = path.join(BACKUP_DIR, fileToRestore);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Backup file not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Starting database restore from: ${fileToRestore}...`);

  try {
    const compressed = fs.readFileSync(filePath);
    const jsonString = zlib.gunzipSync(compressed).toString();
    const backupObj = JSON.parse(jsonString);
    const data = backupObj.data;

    // 1. Delete all existing data in reverse topological order
    console.log('Clearing existing database...');
    await prisma.$transaction([
      prisma.emailEvent.deleteMany(),
      prisma.sequenceStep.deleteMany(),
      prisma.replyClassification.deleteMany(),
      prisma.sequence.deleteMany(),
      prisma.prospect.deleteMany(),
      prisma.emailAccount.deleteMany(),
      prisma.systemError.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.gmailWatchState.deleteMany(),
    ]);

    console.log('Restoring tables...');
    // 2. Restore in topological order to satisfy foreign keys
    if (data.EmailAccount?.length) await prisma.emailAccount.createMany({ data: data.EmailAccount });
    if (data.Prospect?.length) await prisma.prospect.createMany({ data: data.Prospect });
    if (data.Sequence?.length) await prisma.sequence.createMany({ data: data.Sequence });
    if (data.SequenceStep?.length) await prisma.sequenceStep.createMany({ data: data.SequenceStep });
    if (data.EmailEvent?.length) await prisma.emailEvent.createMany({ data: data.EmailEvent });
    if (data.ReplyClassification?.length) await prisma.replyClassification.createMany({ data: data.ReplyClassification });
    if (data.SystemError?.length) await prisma.systemError.createMany({ data: data.SystemError });
    if (data.AuditLog?.length) await prisma.auditLog.createMany({ data: data.AuditLog });
    if (data.GmailWatchState?.length) await prisma.gmailWatchState.createMany({ data: data.GmailWatchState });

    console.log(`✅ Restore successful! Recovered from snapshot timestamp: ${backupObj.timestamp}`);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
runRestore(args[0]);
