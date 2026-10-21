import type { Metadata } from "next";
import { HostBenefits } from "@/components/host/host-benefits";
import { HostFaq } from "@/components/host/host-faq";
import { HostHero } from "@/components/host/host-hero";
import { HostCharges } from "@/components/host/host-charges";
import { HostSteps } from "@/components/host/host-steps";
import { JsonLd } from "@/components/shared/json-ld";
import { HOST_FAQ } from "@/data/host";
import { shareMetadata } from "@/lib/share-metadata";
import { faqPageJsonLd } from "@/lib/structured-data";

import { HostBrokerLine, HostClosing } from "./host-entry-lines";

const DESCRIPTION =
  "Register your business, and we verify your place, photograph it and get it live. A one time registration fee, a monthly plan once you are live, and no commission on a booking.";

export const metadata: Metadata = {
  title: "List your accommodation",
  description: DESCRIPTION,
  alternates: { canonical: "/host" },
  // The page an owner forwards to another owner on WhatsApp, so its card
  // speaks to them rather than to a guest.
  ...shareMetadata({
    title: "List your accommodation on Injishi",
    description: DESCRIPTION,
    path: "/host",
  }),
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
 * `overflow-x-clip` because the hero's scrim and the steps' connector rules
 * both run past the content column by design. `hidden` would compute the
 * other axis to `auto` and can swallow the window scroll the header's pill
 * listens for.
 */
export default function HostPage() {
  return (
    <div className="flex flex-col overflow-x-clip">
      <JsonLd data={faqPageJsonLd(HOST_FAQ.flatMap((group) => group.entries))} />
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
