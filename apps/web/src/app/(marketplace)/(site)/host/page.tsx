import type { Metadata } from "next";
import { HostBenefits } from "@/components/host/host-benefits";
import { HostCta } from "@/components/host/host-cta";
import { HostFaq } from "@/components/host/host-faq";
import { HostHero } from "@/components/host/host-hero";
import { HostProof } from "@/components/host/host-proof";
import { HostSteps } from "@/components/host/host-steps";

export const metadata: Metadata = {
  title: "List your accommodation",
  description:
    "Tell us about your place and we will verify it, photograph it, and get it live. Payouts are made in full, and Injishi takes no commission from the host.",
};

/**
 * "List your accommodation".
 *
 * The order follows the reference funnel at
 * apps.expediapartnercentral.com/en_US/list, which is worth stating because it
 * is not the obvious order: the page opens on a chooser rather than a pitch,
 * asking what kind of place you have before it argues that you should list at
 * all. Everything after it answers a question that choice raises — will anyone
 * come, what does it cost me, what actually happens next, who else has done it,
 * and what am I still worried about.
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
      <HostProof />
      <HostFaq />
      <HostCta />
    </div>
  );
}
