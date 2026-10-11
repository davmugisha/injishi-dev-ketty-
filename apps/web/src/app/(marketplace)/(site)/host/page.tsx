import type { Metadata } from "next";
import { HostBenefits } from "@/components/host/host-benefits";
import { HostFaq } from "@/components/host/host-faq";
import { HostHero } from "@/components/host/host-hero";
import { HostCharges } from "@/components/host/host-charges";
import { HostSteps } from "@/components/host/host-steps";

import { HostBrokerLine, HostClosing } from "./host-entry-lines";

export const metadata: Metadata = {
  title: "List your accommodation",
  description:
    "Register your business, and we verify your place, photograph it and get it live. A one time registration fee, a monthly plan once you are live, and no commission on a booking.",
};

/**
 * "List your accommodation", in the order the Journey and RegisterIA boards
 * give it.
 *
 * The page opens on the chooser, not a pitch: what kind of place do you have.
 * A tile press IS the answer and goes straight into registration
 * (`hostKindHref`), with no Continue and no page in between, and registration
 * opens on the first question it does not yet know. Under the chooser, the one
 * other answer (a broker), then How it works, told once, here: the registration
 * itself does not tell it again until In review, where it is told live. After
 * that the reasons, the costs and the questions, unchanged.
 *
 * The closing card sends people back up to the chooser rather than into a
 * registration with no kind, which asked the kind a second time.
 *
 * `overflow-x-hidden` because the hero's scrim and the steps' connector rules
 * both run past the content column by design.
 */
export default function HostPage() {
  return (
    <div className="flex flex-col overflow-x-hidden">
      <HostHero />
      <HostBrokerLine />
      <HostSteps />
      <HostBenefits />
      <HostCharges />
      <HostFaq />
      <HostClosing />
    </div>
  );
}
