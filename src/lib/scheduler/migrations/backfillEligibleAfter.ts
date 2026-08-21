import prisma from '@/lib/prisma';

export async function runBackfill() {
  console.log('Starting backfill for eligible_after_utc...');
  try {
    const result = await prisma.$executeRaw`
      UPDATE sequence_steps
      SET eligible_after_utc = scheduled_at_utc
      WHERE status IN ('PENDING', 'PROCESSING')
        AND eligible_after_utc IS NULL
    `;
    console.log(`Successfully updated ${result} sequence steps.`);
  } catch (error) {
    console.error('Error during backfill:', error);
  }
}
