import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContent, PageHeader } from "@injishi/ui";
import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";
import { PsfSubtypes } from "@/pms/oversight/screens/psf-subtypes";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.PsfSubtypes.pageTitle };

/** Catalogue subtypes/associations offered on the public /psf applicant form. */
export default async function PsfSubtypesPage() {
  await requirePersona("PsfSubtypes");
  return (
    <PageContent>
      <PageHeader
        title="Subtypes"
        description="Kinds of business and associations the public PSF form offers applicants."
      />
      <OfficerBoundary requires="membership">
        <Suspense>
          <PsfSubtypes embedded />
        </Suspense>
      </OfficerBoundary>
    </PageContent>
  );
}
