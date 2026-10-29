import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContent, PageHeader } from "@injishi/ui";
import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";
import { PsfDecisions } from "@/pms/oversight/screens/psf-decisions";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.PsfDecisions.pageTitle };

/** Membership approve/decline log. */
export default async function PsfDecisionsPage() {
  await requirePersona("PsfDecisions");
  return (
    <PageContent>
      <PageHeader title="Decisions" description="Membership approvals and declines, newest first." />
      <OfficerBoundary requires="membership">
        <Suspense>
          <PsfDecisions embedded />
        </Suspense>
      </OfficerBoundary>
    </PageContent>
  );
}