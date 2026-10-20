import { screens } from "@injishi/data";
import type { HostFeature, HostFee, HostPlan, HostStep, ReadinessItem } from "@injishi/data/fixtures/public";
import type { Metadata } from "next";
import { demoLinks, visitorOf } from "@/features/public/links";
import { PublicHostView } from "@/features/public/PublicHostView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.PublicHost.pageTitle };

export default async function PublicHostPage() {
  const persona = await requireScreen("PublicHost");
  const [steps, features, readiness, plans, fees] = await Promise.all([
    getCollection<HostStep>("public.hostSteps"),
    getCollection<HostFeature>("public.hostFeatures"),
    getCollection<ReadinessItem>("public.readiness"),
    getCollection<HostPlan>("public.hostPlans"),
    getCollection<HostFee>("public.hostFees"),
  ]);
  return (
    <PublicHostView
      visitor={visitorOf(persona)}
      links={demoLinks(persona, ["OwnerHome", ...features.map((f) => f.board)])}
      data={{ steps, features, readiness, plans, fees }}
    />
  );
}
