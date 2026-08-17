import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Proactively dispatch any due scheduled adhoc emails in background
    import("@/lib/gmail/adhoc-sender").then(({ sendDueAdhocEmails }) => {
      sendDueAdhocEmails(10).catch(() => {});
    }).catch(() => {});

    const prospect = await (prisma as any).prospect.findUnique({
      where: { id: params.id, user_id: session.user.id },
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
        reply_classifications: true,
        adhoc_emails: true
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
            const stepName = step.step_number === 1 
              ? "1st message" 
              : `Follow-up ${step.step_number - 1}`;
              
            activity.push({
              id: `step-${step.id}`,
              type: "EMAIL_SENT",
              description: `${stepName}: ${step.subject}`,
              bodyPreview: step.body,
              isManual: false,
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

    // 5. Adhoc (Manual) Emails
    if (prospect.adhoc_emails && Array.isArray(prospect.adhoc_emails)) {
      prospect.adhoc_emails.forEach((email: any) => {
        activity.push({
          id: `adhoc-${email.id}`,
          type: email.status === "PENDING" ? "SCHEDULED_EMAIL" : "EMAIL_SENT",
          description: email.subject,
          bodyPreview: email.body,
          isManual: true,
          status: email.status,
          createdAt: email.status === "PENDING" && email.scheduled_at ? email.scheduled_at : (email.sent_at || email.scheduled_at || new Date())
        });
      });
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
