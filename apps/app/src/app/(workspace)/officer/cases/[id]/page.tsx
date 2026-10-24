import { screenHref, screens } from "@injishi/data";
import type { CaseFile, RejectionReason } from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  // Not in this officer's queue: decided already, outside their mandate, or the sidebar's "Cases" entry, which
  // names the registry's sample case. Each is answered by the queue they can work from, not a 404.
  if (!file) redirect(screenHref("OfficerHome"));
  return <OfficerCaseView key={file.id} file={file} reasons={reasons} />;
}
