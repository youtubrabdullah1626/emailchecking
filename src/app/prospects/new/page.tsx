import type { Metadata } from "next";
import Link from "next/link";
import ProspectForm from "@/components/ProspectForm";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Add Prospect",
};

export default function NewProspectPage() {
  return (
    <AnimatedPage className="space-y-6">
      <PageHeader title="Add Prospect">
        <Button variant="outline" asChild>
          <Link prefetch={true} href="/prospects">Cancel</Link>
        </Button>
      </PageHeader>
      
      <div className="p-12 text-center border rounded-xl border-dashed border-border bg-card/50 flex justify-center">
        <ProspectForm mode="create" />
      </div>
    </AnimatedPage>
  );
}
