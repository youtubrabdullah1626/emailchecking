import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProspect } from "@/lib/db/prospects";
import { getProspectSequence } from "@/lib/db/sequences";
import SequenceBuilder from "@/components/SequenceBuilder";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProspect(id);
  if (!result.ok) return { title: "Sequence Builder" };
  return { title: `Sequence — ${result.data.name}` };
}

export const dynamic = "force-dynamic";

export default async function SequencePage({ params }: Props) {
  const { id } = await params;

  const prospectResult = await getProspect(id);
  if (!prospectResult.ok) {
    if (prospectResult.error === "NOT_FOUND") notFound();
    return (
      <div className="flex-1 p-8 pt-6">
        <div className="p-4 bg-destructive/10 text-destructive rounded-md font-medium" role="alert">
          {prospectResult.message}
        </div>
      </div>
    );
  }

  const prospect = prospectResult.data;

  // Load existing sequence if any (NOT_FOUND is a valid state — no sequence yet)
  const sequenceResult = await getProspectSequence(id);
  const existingSequence = sequenceResult.ok ? sequenceResult.data : null;

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader title="Outreach Sequence">
        <Button variant="outline" asChild>
          <Link href={`/prospects/${id}`}>Cancel</Link>
        </Button>
      </PageHeader>

      <div className="bg-card border border-border shadow-sm rounded-xl p-6">
        <SequenceBuilder
          prospect={prospect}
          existingSequence={existingSequence}
        />
      </div>
    </AnimatedPage>
  );
}
