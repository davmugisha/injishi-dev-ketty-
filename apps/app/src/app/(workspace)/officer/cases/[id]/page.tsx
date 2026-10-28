import { screenHref, screens } from "@injishi/data";
import type { CaseFile, RejectionReason } from "@injishi/data/fixtures/oversight";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { OfficerCaseView } from "@/features/oversight/OfficerCaseView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.OfficerCase.pageTitle };

/** A verification case in the officer's mandate (the registry's record is VC-0142). */
export default async function OfficerCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePersona("OfficerCase");
  const { id } = await params;
  const [file, reasons] = await Promise.all([
    getDocument<CaseFile>("oversight.caseFiles", decodeURIComponent(id)),
    getCollection<RejectionReason>("oversight.rejectionReasons"),
  ]);
  // Decided by this officer, or never theirs: it is not in their queues any more.
  if (!file) {
    return (
      <PageContent>
        <PageHeader title="Case" />
        <EmptyBlock
          icon="FileText"
          title="This case is not in your queues"
          description="It was decided, or it belongs to another officer."
          action={
            <ActionLink href={screenHref("OfficerHome")} icon="ArrowLeft">
              Back to queues
            </ActionLink>
          }
        />
      </PageContent>
    );
  }
  return <OfficerCaseView key={file.id} file={file} reasons={reasons} />;
}
