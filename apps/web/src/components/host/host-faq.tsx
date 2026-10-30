import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@injishi/web-ui";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_FAQ } from "@/data/host";
import { CONTACT } from "@/data/navigation";
import { supportHref } from "@/lib/support-intent";

/**
 * The host FAQ: a centred opener, a row of three tabs, and one accordion
 * beneath that swaps with the tab.
 *
 * Both primitives are the shared ones. The accordion's round marker is not a
 * local re-implementation — `packages/ui/src/components/accordion.tsx` grew a
 * `marker` variant for it, so the Services FAQ keeps its bare caret and this
 * one takes the circular button the reference uses.
 *
 * The tabs are the shared `TabsTrigger` with its inactive state quietened. The
 * primitive outlines an inactive tab in Slate Line, which is right where tabs
 * are a segmented control; here the reference sets the inactive tabs as plain
 * text beside one filled pill, so the border is dropped and the label steps
 * down to `muted-foreground` instead — Legible Teal on white, which is the step
 * the Audited Step Rule names for muted text there.
 *
 * The active fill is `bg-primary`, not `bg-ink`. `--color-ink` is a fixed
 * value, and in dark theme it is also the page ground — a `bg-ink` pill would
 * vanish into the background it sits on. `primary` inverts with the theme, so
 * the pill stays a filled contrast block in both.
 *
 * One deliberate departure from the reference: it centres both the heading and
 * the tab row. Ours are left-aligned, because every section opener on this site
 * is — including the two directly above this one on the same page — and
 * DESIGN.md is explicit that peer sections only read as peers when their
 * openers match. Centring this one would make it the only centred opener in the
 * codebase.
 *
 * No `"use client"` here: `Tabs` and `Accordion` are already client modules and
 * nothing crosses the boundary but strings, so this stays a server component.
 *
 * Radix unmounts an inactive `TabsContent`, so only the open group's questions
 * are in the server-rendered HTML. `forceMount` would fix that for crawlers but
 * the shared `TabsContent` does not carry the `hidden` handling that goes with
 * it, and that primitive is not in this piece's scope to change.
 */
export function HostFaq() {
  return (
    <section className="section-y container">
      <SectionHeading lead="Questions before you " emphasis="list" />

      <Tabs
        defaultValue={HOST_FAQ[0]?.id}
        className="mt-8 flex flex-col items-start lg:mt-10"
      >
        <TabsList className="mb-8 flex flex-wrap justify-start gap-2 lg:mb-10">
          {HOST_FAQ.map((group) => (
            <TabsTrigger
              key={group.id}
              value={group.id}
              className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:border-transparent data-[state=inactive]:hover:text-foreground"
            >
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {HOST_FAQ.map((group) => (
          <TabsContent key={group.id} value={group.id} className="w-full">
            <Accordion
              type="single"
              collapsible
              defaultValue={group.entries[0]?.question}
            >
              {group.entries.map((entry) => (
                <AccordionItem
                  key={entry.question}
                  value={entry.question}
                  /* The reference rails every row, top edge included, so the
                     set reads as a stack of bars rather than as a list that
                     happens to have dividers. */
                  className="border-b first:border-t last:border-b"
                >
                  <AccordionTrigger marker="circle" className="text-page-fg">
                    {entry.question}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-read pb-6 pr-14 text-base text-page-fg-70">
                    {entry.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        ))}
      </Tabs>

      {/* The way out for someone not ready to register. It sat on
          `/host/start` ("Not ready? Talk to our team"), which is a redirect
          now, and it belongs after the questions rather than before them. */}
      {/* Two ways in, because the owner this page is for runs their place on
          WhatsApp and a phone, and a form is the third choice for them, not
          the first. The call request opens the support form already on
          "Listing my accommodation" (`lib/support-intent.ts`). */}
      <p className="mt-8 text-base text-page-fg-70">
        Still have a question?{" "}
        <a
          href={CONTACT.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-page-fg underline underline-offset-2"
        >
          Message us on WhatsApp
        </a>{" "}
        or{" "}
        <Link href={supportHref("hosting")} className="font-medium text-page-fg underline underline-offset-2">
          ask us to call you
        </Link>
        .
      </p>
    </section>
  );
}
