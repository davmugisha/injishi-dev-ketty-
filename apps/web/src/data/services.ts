/** The three service pillars and the FAQ, both from the services capture. */

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
    body: "Your payment is held by Injishi and released to the host only after you have checked in. If the stay is not what was listed, our team handles the dispute before any money moves.",
    image: {
      stem: "injishi-escrow-backed-booking",
      alt: "Escrow-backed booking on Injishi",
    },
  },
  {
    id: "self-check-in",
    lead: "Self ",
    emphasis: "Check-in",
    navLabel: "Self Check-in",
    body: "Most stays open with a smart lockbox or a code sent the morning of arrival, so a late flight does not mean a locked door. No phone calls, no waiting on a caretaker.",
    image: { stem: "injishi-self-check-in", alt: "Self check-in at an Injishi stay" },
  },
  {
    id: "rra-compliance",
    lead: "RRA ",
    emphasis: "Compliance",
    navLabel: "RRA Compliance",
    body: "Every booking issues a compliant receipt and the tourism levy is handled for you. Hosts stay on the right side of the Rwanda Revenue Authority without doing the paperwork themselves.",
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
      "Your payment is held securely by Injishi and only released to the host after you check in successfully. If something is wrong, our team steps in and handles the dispute fairly.",
  },
  {
    question: "How are hosts verified?",
    answer:
      "Every host completes identity and ownership verification before a listing goes live. We also review accommodation photos and details, so what you see is what you get on arrival.",
  },
  {
    question: "How do I pay, and in what currency?",
    answer:
      "You pay in Rwandan francs (RWF) with mobile money (MTN MoMo) or a bank card. The price you see is the price you pay, with no hidden fees.",
  },
  {
    question: "Can I book a long stay or lease?",
    answer:
      "Yes. Alongside nightly stays, many landlords list longer lets and leases. Filter for long stays and message the host to agree terms directly through Injishi.",
  },
  {
    question: "Which areas of Rwanda do you cover?",
    answer:
      "We cover all of Rwanda, with the most listings in Kigali (Gasabo, Kicukiro, Nyarugenge) and growing supply in Musanze, Rubavu, Huye, and Nyagatare.",
  },
];
