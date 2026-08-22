import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function normalizeString(str: string): string {
  if (!str) return "";
  return str.replace(/\s+/g, "").toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { sequences } = await req.json();

    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    const emailMap = new Map<string, any>();
    const emails: string[] = [];

    for (const seq of sequences) {
      const email = seq.recipientEmail?.toLowerCase()?.trim();
      if (email && !emailMap.has(email)) {
        emailMap.set(email, seq);
        emails.push(email);
      }
    }

    if (emails.length === 0) {
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    // 1. Fetch prospects and sequences using Prisma ORM
    const prospects = await prisma.prospect.findMany({
      where: {
        email: { in: emails, mode: "insensitive" }
      },
      include: {
        sequences: {
          include: {
            steps: {
              select: {
                subject: true,
                body: true,
                sent_at: true,
                scheduled_at_utc: true,
                status: true,
              }
            }
          }
        }
      }
    });

    // 2. Also check permanent contactDeliveryLedger table
    const ledgerDispatches = await prisma.contactDeliveryLedger.findMany({
      where: {
        recipient_email: { in: emails, mode: "insensitive" }
      },
      select: {
        recipient_email: true,
        subject: true,
        dispatched_at: true,
        body_snippet: true,
      },
      orderBy: { dispatched_at: "desc" }
    });

    // 3. Also check tracked_emails table
    const trackedEmails = await prisma.trackedEmail.findMany({
      where: {
        recipient_email: { in: emails, mode: "insensitive" }
      },
      select: {
        recipient_email: true,
        subject: true,
        created_at: true
      },
      orderBy: { created_at: "desc" }
    });

    // 4. Build fast lookup map: email -> array of past subjects & dates
    const historyByEmail = new Map<string, Array<{ subject: string; sentAt: string | null; bodySnippet: string }>>();
    
    for (const p of prospects) {
      const email = p.email.toLowerCase().trim();
      const list = historyByEmail.get(email) || [];
      for (const seq of p.sequences) {
        for (const step of seq.steps) {
          if (step.subject) {
            list.push({
              subject: step.subject,
              sentAt: step.sent_at?.toISOString() || step.scheduled_at_utc?.toISOString() || null,
              bodySnippet: normalizeString(step.body || ""),
            });
          }
        }
      }
      historyByEmail.set(email, list);
    }

    for (const l of ledgerDispatches) {
      const email = l.recipient_email.toLowerCase().trim();
      const list = historyByEmail.get(email) || [];
      list.push({
        subject: l.subject,
        sentAt: l.dispatched_at.toISOString(),
        bodySnippet: normalizeString(l.body_snippet || ""),
      });
      historyByEmail.set(email, list);
    }

    for (const t of trackedEmails) {
      const email = t.recipient_email.toLowerCase().trim();
      const list = historyByEmail.get(email) || [];
      if (t.subject) {
        list.push({
          subject: t.subject,
          sentAt: t.created_at ? new Date(t.created_at).toISOString() : null,
          bodySnippet: "",
        });
      }
      historyByEmail.set(email, list);
    }

    if (historyByEmail.size === 0) {
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    // 4. Smart duplicate detection
    const duplicates: { email: string; subject: string; lastSentAt: string | null }[] = [];
    const duplicateEmailsFound = new Set<string>();

    for (const [email, seq] of emailMap.entries()) {
      if (duplicateEmailsFound.has(email)) continue;

      const pastList = historyByEmail.get(email);
      if (!pastList || pastList.length === 0) continue;

      let bestSubject = pastList[0]?.subject || "Outreach Campaign";
      let bestDate = pastList[0]?.sentAt || null;

      for (const step of (seq.steps || [])) {
        const proposedSubjectNorm = normalizeString(step.subject || "");
        for (const past of pastList) {
          const pastSubjectNorm = normalizeString(past.subject || "");
          if (
            proposedSubjectNorm && pastSubjectNorm &&
            (pastSubjectNorm === proposedSubjectNorm || pastSubjectNorm.includes(proposedSubjectNorm) || proposedSubjectNorm.includes(pastSubjectNorm))
          ) {
            bestSubject = past.subject;
            bestDate = past.sentAt;
            break;
          }
        }
      }

      duplicates.push({
        email: seq.recipientEmail || email,
        subject: bestSubject,
        lastSentAt: bestDate,
      });
      duplicateEmailsFound.add(email);
    }

    return NextResponse.json({ duplicates, hasDuplicates: duplicates.length > 0 });
  } catch (error: any) {
    console.error("[POST /api/smart-import/check-duplicates] Error:", error);
    return NextResponse.json({ duplicates: [], hasDuplicates: false });
  }
}
