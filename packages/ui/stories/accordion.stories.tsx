import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/components/accordion";
import { ACCOUNT, fill } from "./copy";

/**
 * Questions that open in place. One component with one axis, `marker`: a bare
 * `caret` (the default, the Services and How it works FAQs) or a `circle`, the
 * round button the host funnel and the waitlist page use.
 *
 * The API is Radix's and stays Radix's whatever renders it: `type="single"` or
 * `"multiple"`, `collapsible`, `value` / `defaultValue` / `onValueChange`, and a
 * `value` on every item. Every call site today is `type="single" collapsible`
 * with the first question open.
 */
const meta = {
  title: "Primitives/Accordion",
  component: Accordion,
  decorators: [(Story) => <div className="max-w-read"><Story /></div>],
} satisfies Meta;

// `Accordion`'s props are a union on `type` ("single" | "multiple"), which
// Storybook's arg inference cannot type, so these stories take no args.
export default meta;
type Story = StoryObj;

/** The host funnel's own questions (`apps/web/src/data/host.ts`). */
const HOST_FAQ = [
  {
    question: "I already list on another site. Can I list here too?",
    answer:
      "Yes. Nothing about Injishi is exclusive. Most of our hosts list in more than one place, and you keep control of your own calendar and rates.",
  },
  {
    question: "How long until my listing is live?",
    answer:
      "Usually under two weeks. The verification visit is the part that takes scheduling; photography and going live follow within a few days of it.",
  },
  {
    question: "Do I have to accept every booking?",
    answer:
      "No. You set your own availability, minimum stay and house rules, and you can close dates at any time without penalty.",
  },
  {
    question: "When am I paid?",
    answer:
      "The guest's payment is held in escrow and released to you after check-in. Funds reach your account within three working days of release.",
  },
];

/** The waitlist page's questions (`apps/web/src/data/waitlist-content.ts`). */
const WAITLIST_FAQ = [
  { question: "What is Injishi?", answer: "One place to find, book and run stays across Rwanda." },
  { question: "When does it open?", answer: "Soon. We will email you the day it does." },
  { question: "Is it free to join?", answer: "Yes. Just your name and email." },
  { question: "How do I leave the list?", answer: "Every email has a one-click unsubscribe." },
];

/**
 * `caret`, the default: a bare chevron in muted ink. How it works renders it
 * this way, single and collapsible, first question open.
 */
export const Caret: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue={HOST_FAQ[0].question}>
      {HOST_FAQ.map((entry) => (
        <AccordionItem key={entry.question} value={entry.question}>
          <AccordionTrigger>{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/**
 * `circle`: the chevron in a hairline circle that fills when its row is open.
 * Railed top and bottom the way the host funnel rails it, so the set reads as a
 * stack of bars.
 */
export const Circle: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="faq-0">
      {WAITLIST_FAQ.map((entry, index) => (
        <AccordionItem
          key={entry.question}
          value={`faq-${index}`}
          className="border-b first:border-t last:border-b"
        >
          <AccordionTrigger marker="circle">{entry.question}</AccordionTrigger>
          <AccordionContent className="pb-6 pr-14 text-base text-muted-foreground">
            {entry.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** Every row closed: what a screen reader user lands on when nothing is preset. */
export const AllClosed: Story = {
  render: () => (
    <Accordion type="single" collapsible>
      {WAITLIST_FAQ.map((entry) => (
        <AccordionItem key={entry.question} value={entry.question}>
          <AccordionTrigger marker="circle">{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** `type="multiple"`: rows open independently, and two start open. */
export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={[HOST_FAQ[0].question, HOST_FAQ[2].question]}>
      {HOST_FAQ.map((entry) => (
        <AccordionItem key={entry.question} value={entry.question}>
          <AccordionTrigger>{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/**
 * `type="single"` WITHOUT `collapsible`: one row is always open. Pressing the
 * open row does nothing; pressing another moves the opening there.
 */
export const AlwaysOneOpen: Story = {
  render: () => (
    <Accordion type="single" defaultValue={HOST_FAQ[1].question}>
      {HOST_FAQ.map((entry) => (
        <AccordionItem key={entry.question} value={entry.question}>
          <AccordionTrigger>{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** A row that cannot be opened, beside two that can. */
export const DisabledItem: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue={HOST_FAQ[0].question}>
      {HOST_FAQ.slice(0, 3).map((entry, index) => (
        <AccordionItem key={entry.question} value={entry.question} disabled={index === 1}>
          <AccordionTrigger>{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** `value` and `onValueChange`, with the open row lifted into the screen's state. */
export const Controlled: Story = {
  render: function Render() {
    const [open, setOpen] = useState("faq-1");
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Open: <span className="font-semibold text-foreground">{open || "none"}</span>
        </p>
        <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
          {WAITLIST_FAQ.map((entry, index) => (
            <AccordionItem key={entry.question} value={`faq-${index}`}>
              <AccordionTrigger>{entry.question}</AccordionTrigger>
              <AccordionContent>{entry.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  },
};

/**
 * Kinyarwanda in a `max-w-tile` column, both markers. A long question wraps
 * beside its marker, which keeps its size; nothing truncates.
 */
export const LongContent: Story = {
  render: () => {
    const rows = [
      {
        question: ACCOUNT.signOutTitle.rw,
        answer: fill(ACCOUNT.signOutScope.rw, { count: 3 }),
      },
      {
        question: fill(ACCOUNT.signOutSwitchInstead.rw, { name: "Amahoro Hospitality Group" }),
        answer: ACCOUNT.switchNote.rw,
      },
      { question: ACCOUNT.create.rw, answer: ACCOUNT.isolationNote.rw },
    ];
    return (
      <div className="flex max-w-tile flex-col gap-10">
        {(["caret", "circle"] as const).map((marker) => (
          <Accordion key={marker} type="single" collapsible defaultValue={rows[1].question}>
            {rows.map((row) => (
              <AccordionItem key={row.question} value={row.question}>
                <AccordionTrigger marker={marker}>{row.question}</AccordionTrigger>
                <AccordionContent>{row.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ))}
      </div>
    );
  },
};
