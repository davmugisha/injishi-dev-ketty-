import { screens } from "@injishi/data";
import type { GoLiveGate, SetupItem } from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingView } from "@/features/shared/OnboardingView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { realSetupRedirect } from "@/server/real-setup";

export const metadata: Metadata = { title: screens.Onboarding.pageTitle };

/** Owner setup checklist. The default view is every step, with the listing selected. */
export default async function OnboardingPage() {
  await requirePersona("Onboarding");
  const real = await realSetupRedirect();
  if (real) redirect(real);
  const [items, gates] = await Promise.all([
    getCollection<SetupItem>("shared.setupItems"),
    getCollection<GoLiveGate>("shared.goLiveGates"),
  ]);
  return <OnboardingView items={items} gates={gates} />;
}
