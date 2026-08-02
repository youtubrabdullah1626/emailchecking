import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUP_AGE_DAYS = 7;

async function runBackup() {
  console.log('Starting automated database backup...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      data: {
        EmailAccount: await prisma.emailAccount.findMany(),
        Prospect: await prisma.prospect.findMany(),
        Sequence: await prisma.sequence.findMany(),
        SequenceStep: await prisma.sequenceStep.findMany(),
        EmailEvent: await prisma.emailEvent.findMany(),
        ReplyClassification: await prisma.replyClassification.findMany(),
        SystemError: await prisma.systemError.findMany(),
        AuditLog: await prisma.auditLog.findMany(),
        GmailWatchState: await prisma.gmailWatchState.findMany(),
      }
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.json.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    const jsonString = JSON.stringify(backupData);
    const compressed = zlib.gzipSync(jsonString);

    fs.writeFileSync(filePath, compressed);
    console.log(`✅ Backup successful: ${filePath}`);

    // Cleanup old backups
    cleanupOldBackups();

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  let deletedCount = 0;

  files.forEach((file) => {
    if (!file.endsWith('.json.gz')) return;

    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageInDays > MAX_BACKUP_AGE_DAYS) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} old backup(s).`);
  }
}

runBackup();
