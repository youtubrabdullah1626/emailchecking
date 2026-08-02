import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const prospect = await (prisma as any).prospect.findUnique({
      where: { id: params.id },
      include: {
        sequences: {
          include: {
            steps: {
              where: {
                status: { in: ["SENT", "FAILED"] }
              }
            }
          }
        },
        reply_classifications: true
      }
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const activity = [];

    // 1. Added to system event
    if (prospect.created_at) {
      activity.push({
        id: `created-${prospect.id}`,
        type: "ADDED",
        description: "Prospect was added to the system",
        createdAt: prospect.created_at
      });
    }

    // 2. Sequence started & Steps events
    if (prospect.sequences && prospect.sequences.length > 0) {
      prospect.sequences.forEach((sequence: any) => {
        if (sequence.started_at) {
          activity.push({
            id: `seq-${sequence.id}-started`,
            type: "SEQUENCE_STARTED",
            description: "Prospect was enrolled in an outreach sequence",
            createdAt: sequence.started_at
          });
        }
        
        sequence.steps.forEach((step: any) => {
          if (step.status === "SENT" && step.sent_at) {
            activity.push({
              id: `step-${step.id}`,
              type: "EMAIL_SENT",
              description: `Sent Email ${step.step_number}: ${step.subject}`,
              createdAt: step.sent_at
            });
          }
        });
      });
    }

    // 4. Replies
    if (prospect.reply_classifications && Array.isArray(prospect.reply_classifications)) {
      for (const reply of prospect.reply_classifications) {
        activity.push({
          id: `reply-${reply.id}`,
          type: "REPLY",
          description: `Received a reply (${reply.reply_type})${reply.reason ? ` - ${reply.reason}` : ''}`,
          createdAt: reply.classified_at
        });
      }
    }

    // Sort descending by date
    activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("[PROSPECT_ACTIVITY_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch prospect activity" },
      { status: 500 }
    );
  }
}
