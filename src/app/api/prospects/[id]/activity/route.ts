import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const prospect = await (prisma as any).prospect.findUnique({
      where: { id, user_id: session.user.id },
      include: {
        sequences: {
          orderBy: { created_at: "desc" },
          include: {
            steps: {
              where: {
                status: { in: ["SENT", "FAILED"] }
              },
              orderBy: { step_number: "asc" }
            }
          }
        },
        reply_classifications: {
          orderBy: { classified_at: "desc" }
        },
        adhoc_emails: true
      }
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const activity: any[] = [];
    const seenReplyTimes = new Set<string>();

    // 1. Replies (Deduplicated & Cleaned)
    if (prospect.reply_classifications && Array.isArray(prospect.reply_classifications)) {
      for (const reply of prospect.reply_classifications) {
        // Deduplicate replies that occurred in the same 5-minute bucket
        const timeBucket = reply.classified_at ? new Date(reply.classified_at).toISOString().slice(0, 16) : "";
        if (timeBucket && seenReplyTimes.has(timeBucket)) {
          continue;
        }
        if (timeBucket) seenReplyTimes.add(timeBucket);

        let replyLabel = "Prospect Replied";
        if (reply.reply_type === "OUT_OF_OFFICE") replyLabel = "Out of Office Reply";
        else if (reply.reply_type === "AUTO_REPLY") replyLabel = "Automated Auto-Reply";
        else if (reply.reply_type === "BOUNCE") replyLabel = "Bounced Email";

        const replyContent = reply.raw_snippet || reply.reason || "Received a reply from the prospect.";

        activity.push({
          id: `reply-${reply.id}`,
          type: "REPLY",
          title: replyLabel,
          description: replyContent,
          bodyPreview: reply.raw_snippet || null,
          createdAt: reply.classified_at || new Date()
        });
      }
    }

    // 2. Sent Sequence Steps (Clean & Professional)
    const seenStepIds = new Set<string>();
    if (prospect.sequences && prospect.sequences.length > 0) {
      prospect.sequences.forEach((sequence: any) => {
        sequence.steps.forEach((step: any) => {
          if (step.status === "SENT" && step.sent_at && !seenStepIds.has(step.id)) {
            seenStepIds.add(step.id);
            const stepLabel = step.step_number === 1 ? "Initial Outreach Email" : `Follow-up #${step.step_number - 1}`;
            
            activity.push({
              id: `step-${step.id}`,
              type: "EMAIL_SENT",
              title: step.subject || "Outreach Email",
              subtitle: stepLabel,
              description: step.subject,
              bodyPreview: step.body,
              isManual: false,
              createdAt: step.sent_at
            });
          }
        });
      });
    }

    // 3. Adhoc (Manual) Emails
    if (prospect.adhoc_emails && Array.isArray(prospect.adhoc_emails)) {
      prospect.adhoc_emails.forEach((email: any) => {
        activity.push({
          id: `adhoc-${email.id}`,
          type: email.status === "PENDING" ? "SCHEDULED_EMAIL" : "EMAIL_SENT",
          title: email.subject || "Direct Email",
          subtitle: "Direct Message",
          description: email.subject,
          bodyPreview: email.body,
          isManual: true,
          status: email.status,
          createdAt: email.status === "PENDING" && email.scheduled_at ? email.scheduled_at : (email.sent_at || email.scheduled_at || new Date())
        });
      });
    }

    // 4. Sequence Started (Show only 1 clean enrollment per unique campaign run, avoid duplicate spam)
    const seenStartMinutes = new Set<string>();
    if (prospect.sequences && prospect.sequences.length > 0) {
      prospect.sequences.forEach((sequence: any) => {
        if (sequence.started_at) {
          const startMinute = new Date(sequence.started_at).toISOString().slice(0, 16);
          if (!seenStartMinutes.has(startMinute)) {
            seenStartMinutes.add(startMinute);
            activity.push({
              id: `seq-${sequence.id}-started`,
              type: "SEQUENCE_STARTED",
              title: "Sequence Started",
              description: "Enrolled in automated outreach campaign",
              createdAt: sequence.started_at
            });
          }
        }
      });
    }

    // 5. Prospect Created (Earliest origin event)
    if (prospect.created_at) {
      activity.push({
        id: `created-${prospect.id}`,
        type: "ADDED",
        title: "Lead Created",
        description: "Prospect added to directory",
        createdAt: prospect.created_at
      });
    }

    // Sort descending by date (most recent activity at the top)
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
