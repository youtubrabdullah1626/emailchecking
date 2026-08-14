import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function normalizeString(str: string): string {
  if (!str) return "";
  // Strip all whitespace, newlines, and convert to lowercase for fuzzy matching
  return str.replace(/\s+/g, "").toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { sequences } = await req.json();

    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    const emails = sequences.map((seq: any) => seq.recipientEmail?.toLowerCase()).filter(Boolean);

    if (emails.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    // 1. Fetch historical sequence steps for these emails
    const historicalSteps = await prisma.sequenceStep.findMany({
      where: {
        sequence: {
          prospect: {
            email: { in: emails, mode: "insensitive" }
          }
        }
      },
      select: {
        subject: true,
        body: true,
        scheduled_at_utc: true,
        status: true,
        sequence: {
          select: {
            prospect: {
              select: { email: true }
            }
          }
        }
      },
      orderBy: {
        scheduled_at_utc: 'desc'
      }
    });

    // 2. Build an efficient lookup map of historical emails
    // Map key: email + "|" + normalizedSubject
    // Map value: array of historical steps
    const historyMap = new Map<string, any[]>();
    for (const step of historicalSteps) {
      const email = step.sequence?.prospect?.email?.toLowerCase();
      if (!email || !step.subject) continue;
      
      const key = `${email}|${normalizeString(step.subject)}`;
      const existing = historyMap.get(key) || [];
      existing.push(step);
      historyMap.set(key, existing);
    }

    // 3. Check for duplicates
    const duplicates: { email: string; subject: string; lastSentAt: string | null }[] = [];
    const duplicateEmailsFound = new Set<string>();

    for (const seq of sequences) {
      const email = seq.recipientEmail?.toLowerCase();
      if (!email || duplicateEmailsFound.has(email)) continue;

      let isDuplicate = false;
      let duplicateDate: string | null = null;
      let duplicateSubject = "";

      for (const step of seq.steps) {
        if (isDuplicate) break;
        
        const proposedSubject = step.subject || "Important Outreach";
        const proposedBody = normalizeString(step.content);
        const key = `${email}|${normalizeString(proposedSubject)}`;

        const pastSteps = historyMap.get(key);
        if (pastSteps) {
          // Subject matched, now check body using fuzzy matching
          for (const past of pastSteps) {
            const pastBody = normalizeString(past.body);
            // If the normalized bodies match (or are extremely similar, we do exact normalized match here)
            if (pastBody === proposedBody) {
              isDuplicate = true;
              duplicateSubject = past.subject;
              duplicateDate = past.scheduled_at_utc?.toISOString() || null;
              break;
            }
          }
        }
      }

      if (isDuplicate) {
        duplicates.push({
          email: seq.recipientEmail, // Preserve original casing
          subject: duplicateSubject,
          lastSentAt: duplicateDate
        });
        duplicateEmailsFound.add(email);
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error("[POST /api/smart-import/check-duplicates] Error:", error);
    return NextResponse.json({ error: "Failed to check duplicates" }, { status: 500 });
  }
}
