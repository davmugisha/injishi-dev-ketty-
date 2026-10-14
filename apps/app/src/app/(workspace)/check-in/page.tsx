import { screens } from "@injishi/data";
import type { CheckInFile } from "@injishi/data/fixtures/frontdesk";
import { getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckInView } from "@/features/frontdesk/CheckInView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.CheckIn.pageTitle };

/** The desk's open check-in: the guest standing at the desk (Sarah Kimani, BK-20431). */
const AT_THE_DESK = "BK-20431";

export default async function CheckInPage() {
  const persona = await requirePersona("CheckIn");
  const file = await getDocument<CheckInFile>("frontdesk.checkIns", AT_THE_DESK);
  if (!file) notFound();
  return <CheckInView persona={persona} file={file} />;
}
