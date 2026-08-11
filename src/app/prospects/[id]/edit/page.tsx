import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProspect } from "@/lib/db/prospects";
import ProspectForm from "@/components/ProspectForm";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProspect(id);
  if (!result.ok) return { title: "Edit Prospect" };
  return { title: `Edit — ${result.data.name}` };
}

export const dynamic = "force-dynamic";

export default async function EditProspectPage({ params }: Props) {
  const { id } = await params;
  const result = await getProspect(id);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") notFound();
    return (
      <div className="flex-1 p-8 pt-6">
        <div className="p-4 bg-destructive/10 text-destructive rounded-md font-medium" role="alert">
          {result.message}
        </div>
      </div>
    );
  }

  const prospect = result.data;

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader title="Edit Prospect">
        <Button variant="outline" asChild>
          <Link prefetch={true} href={`/prospects/${id}`}>Cancel</Link>
        </Button>
      </PageHeader>

      <div className="p-12 text-center border rounded-xl border-dashed border-border bg-card/50 flex justify-center">
        <ProspectForm
          mode="edit"
          prospectId={id}
          initialData={{
            name: prospect.name,
            company: prospect.company,
            email: prospect.email,
            timezone: prospect.timezone,
            notes: prospect.notes ?? "",
          }}
        />
      </div>
    </AnimatedPage>
  );
}
