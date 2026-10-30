import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContent, PageHeader } from "@injishi/ui";
import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";
import { PsfFees } from "@/pms/oversight/screens/psf-fees";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.PsfFees.pageTitle };

/** Membership band prices shown on the public /psf applicant form. */
export default async function PsfFeesPage() {
  await requirePersona("PsfFees");
  return (
    <PageContent>
      <PageHeader title="Fees" description="What each membership band costs a year on the public PSF form." />
      <OfficerBoundary requires="membership">
        <Suspense>
          <PsfFees embedded />
        </Suspense>
      </OfficerBoundary>
    </PageContent>
  );
}
