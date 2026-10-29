import { screens } from "@injishi/data";
import type { CheckInFile } from "@injishi/data/fixtures/frontdesk";
import { CheckInView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.CheckIn.pageTitle };

/**
 * The desk's open check-in: `?booking=BK-…` names the arrival (Today's Check in buttons send it);
 * without it, the next guest expected today.
 */
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const persona = await requirePersona("CheckIn");
  const { booking } = await searchParams;
  const file = booking
    ? await getDocument<CheckInFile>("frontdesk.checkIns", booking)
    : (await getCollection<CheckInFile>("frontdesk.checkIns"))[0];
  if (!file) notFound();
  // The property is the desk's own read (the same board the check-in file came from).
  const property = await deskPropertyName(await requestContext());
  return (
    <PmsMount>
      <CheckInView key={file.id} persona={persona} file={file} property={property} />
    </PmsMount>
  );
}
