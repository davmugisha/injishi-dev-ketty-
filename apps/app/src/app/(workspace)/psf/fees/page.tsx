import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfFeesView } from "@/features/oversight/PsfFeesView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfFees, readPsfScope } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfFees.pageTitle };

/** Membership band prices shown on the public PSF form, for the district or the nation. */
export default async function PsfFeesPage({ searchParams }: { searchParams: Promise<{ district?: string }> }) {
  await requirePersona("PsfFees");
  const { district: raw } = await searchParams;
  const district = Number(raw) > 0 ? Number(raw) : undefined;
  const ctx = await requestContext();
  const [scope, fees] = await Promise.all([readPsfScope(ctx), readPsfFees(ctx, district)]);
  // Keyed by the district, so picking another one starts the screen afresh rather than keeping the last one's prices.
  return <PsfFeesView key={fees.districtId ?? "national"} scope={scope} initial={fees} />;
}
