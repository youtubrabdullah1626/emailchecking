import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get("count") || "100", 10);

    console.log(`Clearing DB...`);
    await prisma.sequenceStep.deleteMany({});
    await prisma.sequence.deleteMany({});
    await prisma.prospect.deleteMany({});

    console.log(`Seeding ${count} prospects...`);
    const prospectsData = Array.from({ length: count }).map((_, i) => ({
      email: `prospect${i}@example.com`,
      name: `Prospect ${i}`,
      company: `Company ${i % 100}`,
      timezone: 'America/New_York',
    }));

    const chunkSize = 1000;
    for (let i = 0; i < prospectsData.length; i += chunkSize) {
      const chunk = prospectsData.slice(i, i + chunkSize);
      await prisma.prospect.createMany({ data: chunk });
    }

    const prospects = await prisma.prospect.findMany({ select: { id: true } });

    console.log(`Seeding sequences for ${count} prospects...`);
    const sequencesData = prospects.map((p) => ({
      prospect_id: p.id,
      status: 'ACTIVE' as const,
    }));

    for (let i = 0; i < sequencesData.length; i += chunkSize) {
      const chunk = sequencesData.slice(i, i + chunkSize);
      await prisma.sequence.createMany({ data: chunk });
    }

    const sequences = await prisma.sequence.findMany({ select: { id: true } });

    console.log(`Seeding steps for ${count} sequences...`);
    const stepsData = sequences.flatMap((s) => [
      { sequence_id: s.id, step_number: 1, subject: 'Step 1', body: 'Body 1', status: 'PENDING' as const, scheduled_at_utc: new Date(), scheduled_time_local: '09:00', timezone: 'UTC' },
      { sequence_id: s.id, step_number: 2, subject: 'Step 2', body: 'Body 2', status: 'PENDING' as const, scheduled_at_utc: new Date(), scheduled_time_local: '09:00', timezone: 'UTC' },
    ]);

    for (let i = 0; i < stepsData.length; i += chunkSize) {
      const chunk = stepsData.slice(i, i + chunkSize);
      await prisma.sequenceStep.createMany({ data: chunk });
    }

    return NextResponse.json({ message: `Seeded ${count} prospects, ${count} sequences, and ${count * 2} steps.` });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
