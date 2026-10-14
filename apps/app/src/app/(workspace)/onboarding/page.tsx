import { screens } from "@injishi/data";
import type { GoLiveGate, SetupItem } from "@injishi/data/fixtures/shared";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { OnboardingView } from "@/features/shared/OnboardingView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Onboarding.pageTitle };

/** Owner setup checklist. The default view is every step, with the listing selected. */
export default async function OnboardingPage() {
  await requirePersona("Onboarding");
  const [items, gates] = await Promise.all([
    getCollection<SetupItem>("shared.setupItems"),
    getCollection<GoLiveGate>("shared.goLiveGates"),
  ]);
  return <OnboardingView items={items} gates={gates} />;
}
