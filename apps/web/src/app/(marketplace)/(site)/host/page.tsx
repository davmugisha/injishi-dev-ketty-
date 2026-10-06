import type { Metadata } from "next";
import { HostBenefits } from "@/components/host/host-benefits";
import { HostCta } from "@/components/host/host-cta";
import { HostFaq } from "@/components/host/host-faq";
import { HostHero } from "@/components/host/host-hero";
import { HostCharges } from "@/components/host/host-charges";
import { HostSteps } from "@/components/host/host-steps";

export const metadata: Metadata = {
  title: "List your accommodation",
  description:
    "Register your business, and we verify your place, photograph it and get it live. A one time registration fee, a monthly plan once you are live, and no commission on a booking.",
};

/**
 * "List your accommodation".
 *
 * The order follows the reference funnel at
 * apps.expediapartnercentral.com/en_US/list, which is worth stating because it
 * is not the obvious order: the page opens on a chooser rather than a pitch,
 * asking what kind of place you have before it argues that you should list at
 * all. Everything after it answers a question that choice raises — will anyone
 * come, what actually happens next, what does it cost me, and what am I still
 * worried about.
 *
 * A tile goes straight into registration (`hostKindHref`). There used to be a
 * page in between, `/host/start`, and what it said that was worth keeping is
 * here now: the step overview in `HostSteps`, and the charges beside the
 * chooser and in full in `HostCharges`.
 *
 * `overflow-x-hidden` because the hero's scrim and the steps' connector rules
 * both run past the content column by design.
 */
export default function HostPage() {
  return (
    <div className="flex flex-col overflow-x-hidden">
      <HostHero />
      <HostBenefits />
      <HostSteps />
      <HostCharges />
      <HostFaq />
      <HostCta />
    </div>
  );
}
