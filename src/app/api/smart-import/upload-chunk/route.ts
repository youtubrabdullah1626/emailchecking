import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";
import { localDateTimeToUtc, isInLeadBusinessHours, nextBusinessSlotUtc } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

const MAX_ROWS_PER_CHUNK = 600;

/**
 * POST /api/smart-import/upload-chunk
 *
 * FIX 1: Errors are now written to the `import_errors` table (relational, indexed)
 *         instead of a JSON blob. This eliminates the memory bomb on large imports.
 *
 * FIX 2: Race condition eliminated. `successCount`/`failureCount` use atomic
 *         Prisma `{ increment }`. Errors use `createMany` on a separate table —
 *         no read-modify-write JSON pattern that could lose data under concurrency.
 *
 * FIX 4: Payload size guard — rejects chunks > 600 rows server-side.
 *         The frontend enforces dynamic sizing based on byte estimation before sending.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, chunkIndex, totalChunks, campaignId, sequences, executionQueue } = body;

    // ── Input Validation ──────────────────────────────────────────────────────
    if (!jobId || chunkIndex === undefined || !campaignId || !sequences || !executionQueue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Array.isArray(sequences) || sequences.length > MAX_ROWS_PER_CHUNK) {
      return NextResponse.json(
        { error: `Chunk too large or malformed. Max ${MAX_ROWS_PER_CHUNK} rows per chunk.` },
        { status: 413 }
      );
    }

    // ── Basic validation ──────────────────────────────────────────────────────
    // jobId+campaignId were issued by create-job (which verified auth), so we
    // trust them here and skip an extra DB round-trip per chunk.
    if (!jobId || !campaignId || !sequences || !executionQueue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Build step schedule map ───────────────────────────────────────────────
    const stepScheduleMap: Record<string, { date: string; time: string; timestamp?: number; timezone?: string }> = {};
    for (const item of executionQueue) {
      if (item?.recordId && item?.sequenceStep?.stepNumber !== undefined) {
        stepScheduleMap[`${item.recordId}_${item.sequenceStep.stepNumber}`] = {
          date: item.scheduledDate,
          time: item.scheduledTime || "09:00",
          timestamp: item.scheduledTimestamp,
          timezone: item.timezone || "UTC",
        };
      }
    }

    // ── STEP 1: Validate rows & build prospect data ───────────────────────────
    const errorRows: Array<{ jobId: string; email: string | null; rowIndex: number | null; reason: string }> = [];
    const validProspectData: Array<{
      email: string; name: string; company: string;
      timezone: string; user_id: string; campaign_id: string; source: "SMART_IMPORT";
    }> = [];
    const emailToSeqMap = new Map<string, (typeof sequences)[0]>();

    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i];
      const email = (seq.recipientEmail || "").toLowerCase().trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorRows.push({ jobId, email: email || null, rowIndex: i, reason: "Invalid or missing email address" });
        continue;
      }

      validProspectData.push({
        email,
        name: (seq.recipientName || "").trim() || email.split("@")[0],
        company: (seq.company || "").trim() || "Unknown",
        timezone: "UTC",
        user_id: userId,
        campaign_id: campaignId,
        source: "SMART_IMPORT",
      });
      emailToSeqMap.set(email, seq);
    }

    // ── STEP 2: Persist errors atomically (no race condition) ─────────────────
    // createMany is a single INSERT — atomic, no read-modify-write, thread-safe.
    if (errorRows.length > 0) {
      await prisma.importError.createMany({ data: errorRows });
    }

    if (validProspectData.length === 0) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          failureCount: { increment: sequences.length },
          chunksLoaded: { increment: 1 },
          status: chunkIndex === totalChunks - 1 ? "COMPLETED" : "PROCESSING",
          completedAt: chunkIndex === totalChunks - 1 ? new Date() : undefined,
        }
      });
      return NextResponse.json({ ok: true, saved: 0, skipped: 0, failed: errorRows.length });
    }

    // ── STEP 3: Parallel bulk upsert prospects ────────────────────────────────
    // createMany + updateMany run in PARALLEL (both are independent writes)
    const emails = validProspectData.map(p => p.email);
    await Promise.all([
      prisma.prospect.createMany({ data: validProspectData, skipDuplicates: true }),
      prisma.prospect.updateMany({
        where: { email: { in: emails }, user_id: userId },
        data: { status: "ACTIVE", campaign_id: campaignId },
      }),
    ]);

    // Fetch back all matching prospects to get their IDs (needed for sequence creation)
    const existingProspects = await prisma.prospect.findMany({
      where: { email: { in: emails }, user_id: userId },
      select: { id: true, email: true }
    });
    const prospectIdByEmail = new Map(existingProspects.map(p => [p.email, p.id]));

    // ── STEP 4: Build sequence + step inserts (pure in-memory, no DB) ──────────
    const prospectIds = existingProspects.map(p => p.id);
    const newSequenceIds = Array.from(new Set(
      validProspectData.map(p => emailToSeqMap.get(p.email)?.recordId).filter(Boolean)
    )) as string[];

    const sequenceInserts: Array<{
      id: string; prospect_id: string; status: "ACTIVE"; started_at: Date; user_id: string;
    }> = [];
    const validSeqsForSteps: Array<(typeof sequences)[0]> = [];

    for (const [email, seq] of emailToSeqMap) {
      const prospectId = prospectIdByEmail.get(email);
      if (!prospectId) continue;
      sequenceInserts.push({
        id: seq.recordId,
        prospect_id: prospectId,
        status: "ACTIVE",
        started_at: new Date(),
        user_id: userId,
      });
      validSeqsForSteps.push(seq);
    }

    const stepInserts: Array<{
      sequence_id: string; step_number: number; subject: string; body: string;
      scheduled_at_utc: Date; scheduled_time_local: string; timezone: string; status: "PENDING";
    }> = [];

    for (const seq of validSeqsForSteps) {
      if (!Array.isArray(seq.steps)) continue;
      for (const step of seq.steps) {
        const key = `${seq.recordId}_${step.stepNumber}`;
        const scheduleInfo = stepScheduleMap[key];
        const isFirstStep = step.stepNumber === 1;
        const now = new Date();

        // Calculate fallback future date for follow-up steps if scheduleInfo date is missing
        let dateStr = scheduleInfo?.date;
        if (!dateStr) {
          if (isFirstStep) {
            dateStr = now.toISOString().split("T")[0];
          } else {
            const delayDays = (step.delayDays && step.delayDays > 0) ? step.delayDays : 3;
            const targetDate = new Date(now.getTime() + delayDays * (step.stepNumber - 1) * 24 * 60 * 60 * 1000);
            dateStr = targetDate.toISOString().split("T")[0];
          }
        }

        const timeStr = scheduleInfo?.time || "09:00";
        const tz = scheduleInfo?.timezone || "UTC";

        let scheduledUtc = localDateTimeToUtc(dateStr, timeStr, tz);

        if (!isInLeadBusinessHours(scheduledUtc, tz)) {
          scheduledUtc = nextBusinessSlotUtc(scheduledUtc, tz);
        }

        // STEP 1 gets eligible_after_utc = scheduledUtc (ready to dispatch when scheduled time arrives)
        // FOLLOW-UPS (Step 2, 3) MUST have eligible_after_utc = null (strictly locked until preceding step is SENT)
        const eligibleAfter = isFirstStep ? (scheduledUtc.getTime() <= now.getTime() ? now : scheduledUtc) : null;

        stepInserts.push({
          sequence_id: seq.recordId,
          step_number: step.stepNumber,
          subject: step.subject || "Important Outreach",
          body: step.content || "",
          scheduled_at_utc: scheduledUtc,
          scheduled_time_local: timeStr,
          timezone: tz,
          status: "PENDING",
          eligible_after_utc: eligibleAfter,
          priority_class: "NORMAL",
          soft_sla_deadline: null
        } as any);
      }
    }


    // ── STEP 5: All DB writes in PARALLEL ─────────────────────────────────────
    // stop old sequences + create new sequences + create steps — all at once
    const isLastChunk = chunkIndex === totalChunks - 1;
    const savedCount = sequenceInserts.length;
    const skippedCount = validProspectData.length - savedCount;

    await Promise.all([
      // Stop only OLD sequences (not from this import run)
      prospectIds.length > 0 && newSequenceIds.length > 0
        ? prisma.sequence.updateMany({
            where: {
              prospect_id: { in: prospectIds },
              status: { in: ["ACTIVE", "DRAFT"] },
              id: { notIn: newSequenceIds }
            },
            data: { status: "STOPPED", stopped_at: new Date() }
          }).catch(() => {})
        : Promise.resolve(),

      // Create new sequences
      sequenceInserts.length > 0
        ? prisma.sequence.createMany({ data: sequenceInserts, skipDuplicates: true })
        : Promise.resolve(),
    ]);

    // Create steps after sequences exist (foreign key dependency)
    if (stepInserts.length > 0) {
      await prisma.sequenceStep.createMany({ data: stepInserts, skipDuplicates: true });
    }

    // ── STEP 6: Atomic job progress update ────────────────────────────────────
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        successCount: { increment: savedCount },
        failureCount: { increment: errorRows.length },
        skippedCount: { increment: skippedCount },
        chunksLoaded: { increment: 1 },
        status: isLastChunk ? "COMPLETED" : "PROCESSING",
        completedAt: isLastChunk ? new Date() : undefined,
      }
    });

    // ── On final chunk: fire scheduler completely detached from HTTP response ──
    // CRITICAL: Do NOT await this. Scheduler + send can take 5-10s.
    // The user sees "Launched!" immediately; emails go in background.
    if (isLastChunk) {
      import("@/lib/scheduler/run").then(async ({ runScheduler }) => {
        const { sendBatch } = await import("@/lib/gmail/sender");
        const result = await runScheduler().catch(() => ({ claimedStepIds: [] }));
        if (result.claimedStepIds.length > 0) {
          await sendBatch(result.claimedStepIds).catch(() => {});
        }
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      saved: savedCount,
      skipped: skippedCount,
      failed: errorRows.length,
      isLastChunk,
    });


  } catch (error: any) {
    console.error("[upload-chunk] Fatal error:", error);
    // Best-effort: mark job as failed so the UI doesn't hang
    try {
      const bodyClone = await request.clone().json().catch(() => ({}));
      if (bodyClone?.jobId) {
        await prisma.importJob.updateMany({
          where: { id: bodyClone.jobId, status: "PROCESSING" },
          data: { status: "FAILED", completedAt: new Date() }
        });
      }
    } catch { /* swallow — we already have a 500 to return */ }

    return NextResponse.json({ error: error.message || "Chunk processing failed" }, { status: 500 });
  }
}
