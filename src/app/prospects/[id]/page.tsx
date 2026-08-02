import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProspect } from "@/lib/db/prospects";
import { getProspectSequence } from "@/lib/db/sequences";
import ProspectDetailClient from "@/components/ProspectDetailClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProspect(id);
  if (!result.ok) return { title: "Prospect Not Found" };
  return { title: result.data.name };
}

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({ params }: Props) {
  const { id } = await params;

  const [prospectResult, sequenceResult] = await Promise.all([
    getProspect(id),
    getProspectSequence(id),
  ]);

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
  const sequence = sequenceResult.ok ? sequenceResult.data : null;

  return (
    <ProspectDetailClient prospect={prospect} sequence={sequence} />
  );
}
