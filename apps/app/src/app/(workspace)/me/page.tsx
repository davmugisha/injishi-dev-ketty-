import { screens } from "@injishi/data";
import type { MyHr } from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeView } from "@/features/me/me-view";
import { ME_TABS, type MeTab } from "@/features/me/tabs";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { shiftChoices, swapAsks, swapColleagues } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.MyHr.pageTitle };

/** Me: every signed-in person's own HR (ADR-058, 058-self-service), from their own staff file. */
export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("MyHr");
  const [data] = await getCollection<MyHr>("shared.myHr");
  if (!data) notFound();
  const { tab } = await searchParams;
  const initialTab: MeTab = ME_TABS.find((t) => t === tab) ?? "overview";
  // Asking for a swap, a shift or a rotation needs a file of one's own; without one, Me still opens.
  const ctx = await requestContext();
  const [shiftAsks, off] = await Promise.all([
    data.readOnly
      ? null
      : Promise.all([swapAsks(ctx), swapColleagues(ctx), shiftChoices(ctx)])
          .then(([asks, colleagues, choices]) => ({ asks, colleagues, choices }))
          .catch(() => null),
    // The HR features Injishi switched off for the business, hidden on Me.
    hrFeaturesOff(),
  ]);
  return <MeView key={initialTab} data={data} initialTab={initialTab} shiftAsks={shiftAsks} off={off} />;
}
