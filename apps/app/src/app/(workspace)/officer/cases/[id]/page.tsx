import { screens } from "@injishi/data";
import type { CaseFile, RejectionReason } from "@injishi/data/fixtures/oversight";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfficerCaseView } from "@/features/oversight/OfficerCaseView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.OfficerCase.pageTitle };

/** A verification case in the officer's mandate (the registry's record is VC-0142). */
export default async function OfficerCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePersona("OfficerCase");
  const { id } = await params;
  const [file, reasons] = await Promise.all([
    getDocument<CaseFile>("oversight.caseFiles", decodeURIComponent(id)),
    getCollection<RejectionReason>("oversight.rejectionReasons"),
  ]);
  if (!file) notFound();
  return <OfficerCaseView key={file.id} file={file} reasons={reasons} />;
}
