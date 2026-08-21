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

    // 1. Direct indexed lookup using Prisma.join for optimal Postgres query plan
    const historicalSteps: Array<{
      email: string;
      subject: string | null;
      scheduled_at_utc: Date | null;
      sent_at: Date | null;
      status: string;
      body_snippet: string | null;
    }> = await prisma.$queryRaw`
      SELECT 
        p.email,
        ss.subject,
        ss.scheduled_at_utc,
        ss.sent_at,
        ss.status,
        LEFT(ss.body, 120) as body_snippet
      FROM prospects p
      JOIN sequences s ON s.prospect_id = p.id
      JOIN sequence_steps ss ON ss.sequence_id = s.id
      WHERE p.email IN (${Prisma.join(emails)})
        AND (ss.status = 'SENT' OR ss.gmail_message_id IS NOT NULL OR s.status = 'ACTIVE')
      ORDER BY COALESCE(ss.sent_at, ss.scheduled_at_utc) DESC
      LIMIT 1000;
    `;

    if (!historicalSteps || historicalSteps.length === 0) {
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    // 2. Build fast lookup map: email -> array of past subjects
    const historyByEmail = new Map<string, Array<{ subject: string; sentAt: string | null; bodySnippet: string }>>();
    for (const row of historicalSteps) {
      const email = row.email?.toLowerCase();
      if (!email || !row.subject) continue;
      const list = historyByEmail.get(email) || [];
      list.push({
        subject: row.subject,
        sentAt: row.sent_at?.toISOString() || row.scheduled_at_utc?.toISOString() || null,
        bodySnippet: normalizeString(row.body_snippet || ""),
      });
      historyByEmail.set(email, list);
    }

    // 3. Fast duplicate check
    const duplicates: { email: string; subject: string; lastSentAt: string | null }[] = [];
    const duplicateEmailsFound = new Set<string>();

    for (const [email, seq] of emailMap.entries()) {
      if (duplicateEmailsFound.has(email)) continue;

      const pastList = historyByEmail.get(email);
      if (!pastList || pastList.length === 0) continue;

      let isDuplicate = false;
      let duplicateDate: string | null = null;
      let duplicateSubject = "";

      for (const step of (seq.steps || [])) {
        if (isDuplicate) break;

        const proposedSubjectNorm = normalizeString(step.subject || "");
        const proposedSnippet = normalizeString((step.content || "").slice(0, 120));

        for (const past of pastList) {
          const pastSubjectNorm = normalizeString(past.subject);
          
          if (
            (proposedSubjectNorm.length > 3 && pastSubjectNorm === proposedSubjectNorm) ||
            (proposedSnippet.length > 15 && past.bodySnippet.includes(proposedSnippet.slice(0, 40)))
          ) {
            isDuplicate = true;
            duplicateSubject = past.subject;
            duplicateDate = past.sentAt;
            break;
          }
        }
      }

      if (isDuplicate) {
        duplicates.push({
          email: seq.recipientEmail,
          subject: duplicateSubject,
          lastSentAt: duplicateDate,
        });
        duplicateEmailsFound.add(email);
      }
    }

    return NextResponse.json({ duplicates, hasDuplicates: duplicates.length > 0 });
  } catch (error: any) {
    console.error("[POST /api/smart-import/check-duplicates] Error:", error);
    return NextResponse.json({ duplicates: [], hasDuplicates: false });
  }
}
