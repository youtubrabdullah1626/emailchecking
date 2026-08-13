import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { auditService } from "@/lib/audit/audit.service";
import { getNetworkContext } from "@/lib/audit/network";

export async function POST(request: NextRequest) {
  // ── Auth Guard: removed mock_admin_123 / findFirst() bypass ───────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const activeUserId = session.user.id;

  try {
    const body = await request.json();
    const { campaignName, validatedRecords, sequences, executionQueue } = body;

    if (!sequences || !executionQueue) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    // ── Enforce Sequence Limits ────────────────────────────────────────────────
    const [activeSequencesCount, sequenceLimitConfig] = await Promise.all([
      prisma.sequence.count({ where: { status: "ACTIVE", user_id: activeUserId } }),
      prisma.platform_configs.findFirst({ where: { key: "MAX_ACTIVE_SEQUENCES" } })
    ]);

    const sequenceLimit = sequenceLimitConfig?.value ? parseInt(String(sequenceLimitConfig.value), 10) : 5;
    const incomingSequences = sequences.length;

    if (activeSequencesCount + incomingSequences > sequenceLimit) {
      return NextResponse.json({ 
        error: `Sequence limit exceeded. You currently have ${activeSequencesCount} active sequences, and are trying to add ${incomingSequences} more. Your maximum limit is ${sequenceLimit}. Please pause or stop existing campaigns first.` 
      }, { status: 429 });
    }

    // 1. Create the Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        status: "ACTIVE",
        user_id: activeUserId,
      }
    });

    // 2. Map ExecutionQueue to determine scheduled times for steps
    const stepSchedules: Record<string, string> = {};
    for (const item of executionQueue) {
      const key = `${item.recordId}_${item.sequenceStep.stepNumber}`;
      stepSchedules[key] = item.scheduledDate; // YYYY-MM-DD
    }

    // 3. Process each prospect/sequence
    let prospectsCreated = 0;
    
    for (const seq of sequences) {
      const emailLower = seq.recipientEmail.toLowerCase();
      
      // Upsert prospect
      let prospect = await prisma.prospect.findFirst({
        where: { email: emailLower, user_id: activeUserId }
      });
      
      if (!prospect) {
        prospect = await prisma.prospect.create({
          data: {
            email: emailLower,
            name: seq.recipientName || emailLower.split("@")[0],
            company: seq.company || "Unknown",
            timezone: "UTC",
            user_id: activeUserId,
            campaign_id: campaign.id,
            source: "SMART_IMPORT"
          }
        });
      } else {
        // Update existing prospect to link to new campaign and reset their status
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { 
            campaign_id: campaign.id,
            source: "SMART_IMPORT",
            status: "ACTIVE"
          }
        });
      }
      
      prospectsCreated++;

      // Stop old sequences
      await prisma.sequence.updateMany({
        where: { prospect_id: prospect.id, status: { in: ["ACTIVE", "DRAFT"] } },
        data: { status: "STOPPED", stopped_at: new Date() }
      });

      // Create new sequence
      const dbSequence = await prisma.sequence.create({
        data: {
          id: seq.recordId, // Preserve the recordId so threading works
          prospect_id: prospect.id,
          status: "ACTIVE",
          started_at: new Date(),
          user_id: activeUserId
        }
      });

      // Create sequence steps
      for (const step of seq.steps) {
        const key = `${seq.recordId}_${step.stepNumber}`;
        const scheduledDateStr = stepSchedules[key] || new Date().toISOString().split('T')[0];
        
        // Parse the YYYY-MM-DD into a UTC date at 9am
        const scheduledAt = new Date(`${scheduledDateStr}T09:00:00Z`);

        await prisma.sequenceStep.create({
          data: {
            sequence_id: dbSequence.id,
            step_number: step.stepNumber,
            subject: step.subject || "Important Outreach",
            body: step.content,
            scheduled_at_utc: scheduledAt,
            scheduled_time_local: "09:00:00",
            timezone: "UTC",
            status: "PENDING"
          }
        });
      }
    }

    const network = getNetworkContext(request);
    
    auditService.logAction(
      activeUserId,
      session.user.email,
      "Smart Import Completed",
      "SYSTEM",
      campaign.name,
      "Campaign",
      "SUCCESS",
      {
        resourceId: campaign.id,
        ipAddress: network.ipAddress,
        deviceInfo: network.deviceInfo,
        metadata: { 
          prospectsProcessed: prospectsCreated,
          country: network.country,
          browser: network.browser,
          os: network.os
        }
      }
    );

    return NextResponse.json({ 
      ok: true, 
      campaignId: campaign.id,
      prospectsProcessed: prospectsCreated 
    });

  } catch (error: any) {
    console.error("Handoff failed:", error);
    return NextResponse.json({ error: error.message || "Failed to process handoff" }, { status: 500 });
  }
}
