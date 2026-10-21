/**
 * The three service pillars and the FAQ, both from the services capture.
 *
 * Every sentence here is held to what the product does today (rewritten
 * 2026-10-21). The capture promised escrow released only after check-in (no
 * release runs yet), lockbox self check-in (F-B09 is unbuilt), a "compliant
 * receipt" with the tourism levy handled (EBM is not certified with the RRA),
 * bank cards (card is switched off at checkout) and "the most listings in
 * Kigali" on a catalogue that opened empty. Say what is true, and say "being
 * built" where it is; never put a promise back here without the feature.
 */

export interface ServicePillar {
  id: string;
  lead: string;
  emphasis: string;
  navLabel: string;
  body: string;
  image: { stem: string; alt: string };
}

export const SERVICE_PILLARS: ServicePillar[] = [
  {
    id: "escrow",
    lead: "Escrow-backed ",
    emphasis: "booking",
    navLabel: "Escrow-backed booking",
    body: "Your payment is held by Injishi in escrow, not sent straight to the host. Cancel within the policy and your refund comes back from it, and if the stay is not what was listed, our team steps in.",
    image: {
      stem: "injishi-escrow-backed-booking",
      alt: "Escrow-backed booking on Injishi",
    },
  },
  {
    // The id stays `self-check-in` although the pillar no longer promises it:
    // it is an anchor other pages and outside links already point at.
    id: "self-check-in",
    lead: "Easy ",
    emphasis: "check-in",
    navLabel: "Easy check-in",
    body: "Your stay is booked and paid before you travel, so arriving is a booking reference at the front desk, not a negotiation over the phone. Self check-in by code, for stays that run without a desk, is being built.",
    image: { stem: "injishi-self-check-in", alt: "Arriving at an Injishi stay" },
  },
  {
    id: "rra-compliance",
    lead: "RRA ",
    emphasis: "Compliance",
    navLabel: "RRA Compliance",
    body: "Every booking comes with a receipt, kept with your trips. Injishi is being connected to the RRA's electronic billing (EBM), so each sale is declared under the host's own TIN without paperwork on their side.",
    image: {
      stem: "injishi-rra-compliance",
      alt: "RRA compliance for an Injishi booking",
    },
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    question: "Is there a minimum length of stay?",
    answer:
      "It depends on the listing. Many stays accept a single night, while serviced apartments and long lets set their own minimum. You will see it clearly on each accommodation before you book.",
  },
  {
    question: "How does escrow protect my payment?",
    answer:
      "Your payment is held by Injishi rather than sent straight to the host. If you cancel within the stay's policy, your refund comes back from escrow, and if something is wrong with the stay, our team steps in.",
  },
  {
    question: "How are hosts verified?",
    answer:
      "Every host completes identity and ownership verification before a listing goes live. We also review accommodation photos and details, so what you see is what you get on arrival.",
  },
  {
    question: "How do I pay, and in what currency?",
    answer:
      "You pay in Rwandan francs (RWF) with mobile money: MTN MoMo or Airtel Money. Card payments are not offered yet. Your party's total, including Injishi's service fee, shows before you pay, with nothing added after.",
  },
  {
    question: "Can I book a long stay or lease?",
    answer:
      "Yes. Alongside nightly stays, Injishi is built for residences let on a lease. Filter Explore for apartments, and each listing shows its minimum stay before you book.",
  },
  {
    question: "Which areas of Rwanda do you cover?",
    answer:
      "Any accommodation anywhere in Rwanda can register. We are opening district by district, Kigali first, and Explore always shows exactly what is listed today.",
  },
];
