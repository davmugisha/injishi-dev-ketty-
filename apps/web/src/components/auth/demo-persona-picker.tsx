"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { DemoPersona, DemoStory } from "@injishi/contracts";
import { Badge } from "@injishi/ui";
import { formatMarketDateTime } from "@injishi/utils";

import { Icon } from "@/components/app/icon";
import {
  DemoSignInButton,
  type DemoSignInClasses,
} from "@/components/demo/demo-sign-in-button";
import {
  SECTION_BADGE,
  firstName,
  groupPersonas,
  orderedSeats,
  sectionOf,
} from "@/components/demo/persona-groups";
import { DEMO_OTP_CODE } from "@/lib/otp";

/**
 * The one-press button, painted for this column. Spelled HERE because this
 * file is in `components/auth`, which the app stylesheet scans and
 * `components/demo` is not (see `demo-sign-in-button.tsx`).
 */
const SIGN_IN_CLASSES: DemoSignInClasses = {
  root: "flex min-w-0 flex-1 flex-col gap-1",
  button: "w-full",
  status: "sr-only",
  note: "text-left text-xs",
  error: "text-left text-xs",
};

/** Below this a summary fits in two lines of the picker and needs no toggle. */
const SHORT_SUMMARY = 120;

/**
 * A persona's story as the picker reads it: the headline, then the summary
 * held to two lines until the visitor asks for the rest, and with it the steps
 * the guide suggests. Collapsed by default because fifteen people sit in a
 * column beside a form, and a stakeholder scans headlines first. Nothing
 * renders for a persona the guide does not narrate.
 */
function PersonaStorySummary({ story }: { story: DemoStory | null | undefined }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  if (!story) return null;

  const expandable = story.summary.length > SHORT_SUMMARY || story.tryThis.length > 0;

  return (
    <div className="flex flex-col gap-1" data-cy="demo-persona-story">
      <p className="text-sm font-medium text-foreground" data-cy="demo-persona-headline">
        {story.headline}
      </p>
      <div id={panel}>
        <p
          className={`text-xs text-muted-foreground ${open ? "" : "line-clamp-2"}`}
          data-cy="demo-persona-summary"
        >
          {story.summary}
        </p>
        {open && story.tryThis.length > 0 ? (
          <div className="mt-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              What to try
            </p>
            <ol className="mt-1 flex list-decimal flex-col gap-1 pl-4 text-xs text-muted-foreground">
              {story.tryThis.map((step, i) => (
                <li key={`${i}-${step.title}`}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  {step.detail ? ` — ${step.detail}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      {expandable ? (
        <button
          type="button"
          className="self-start rounded text-xs font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((v) => !v)}
          data-cy="demo-persona-more"
        >
          {open ? "Show less" : "More about this role"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The demo's sign in shortcut (ADR-043, AC-18 and AC-19).
 *
 * Rendered only where `GET /api/v1/platform` said demo, so production and
 * staging never show it.
 *
 * Each persona reads as WHO they are before what they hold: the story headline
 * and summary from the API (`DemoPersona.story`, absent for a persona the guide
 * does not narrate), then every seat with the ROLE in it, because the demo is
 * where access control is presented: "Beatha, Amahoro" tells a room nothing,
 * "Housekeeper at Amahoro" tells it what signing in as her will prove.
 *
 * Two ways in, and both are the one sign in path:
 *  - "Sign in as Denise" (`DemoSignInButton`) sends the code, presents the
 *    demo's published code and continues through `/start`, all through
 *    `lib/otp.ts`. One press, for a presenter on stage.
 *  - "Use this email" fills the field and nothing more, so the visitor who
 *    wants to see the ordinary screens still presses Continue and types the code.
 *
 * The roster comes from `GET /api/v1/demo/personas`, never from a list in this
 * app, and the grouping from `components/demo/persona-groups.ts`, which the
 * `/demo` guide reads too.
 */
export default function DemoPersonaPicker({
  personas,
  seededAt,
  selected,
  onPick,
}: {
  personas: DemoPersona[];
  /** When the demo data was last reset, an ISO instant, or null if unknown. */
  seededAt: string | null;
  selected: string;
  onPick: (email: string) => void;
}) {
  const sections = groupPersonas(personas);

  return (
    <section
      aria-labelledby="demo-personas-title"
      className="rounded-card border border-border bg-field p-4"
      data-cy="demo-personas"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="demo-personas-title" className="text-sm font-semibold text-foreground">
          Explore the demo
        </h2>
        <Link
          href="/demo"
          className="text-xs font-medium text-foreground underline underline-offset-4 hover:no-underline"
          data-cy="demo-guide-link"
        >
          How this demo works
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Choose someone and sign in as them in one step. Typing an email by hand
        works too: every code is{" "}
        <span className="font-semibold tracking-wider text-foreground">{DEMO_OTP_CODE}</span>.
      </p>
      {seededAt ? (
        <p className="mt-1 text-xs text-muted-foreground" data-cy="demo-reset">
          Demo data last reset {formatMarketDateTime(new Date(seededAt))}
        </p>
      ) : null}

      {sections.length > 0 ? (
        <div className="scrollbar mt-3 max-h-[70vh] overflow-y-auto sm:max-h-[36rem]">
          {sections.map((section) => (
            <div
              key={section.key}
              role="group"
              aria-labelledby={`demo-personas-${section.key}`}
              className="mt-4 first:mt-0"
              data-cy="demo-persona-section"
              data-section={section.key}
            >
              <h3
                id={`demo-personas-${section.key}`}
                className="sticky top-0 z-10 bg-field px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {section.title}
              </h3>
              <ul className="mt-1 flex flex-col gap-2">
                {section.personas.map((persona) => {
                  const picked = persona.email === selected;
                  const seats = orderedSeats(persona);
                  const first = firstName(persona);
                  return (
                    <li
                      key={persona.email}
                      className={`flex flex-col gap-2 rounded border p-3 ${
                        picked ? "border-ring bg-surface-secondary" : "border-border bg-card text-card-foreground"
                      }`}
                      data-cy="demo-persona"
                      data-email={persona.email}
                      data-narrated={persona.story ? "true" : "false"}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-sm font-semibold text-foreground">{persona.name}</span>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {persona.email}
                        </span>
                      </div>

                      <PersonaStorySummary story={persona.story} />

                      <ul
                        className="flex flex-col gap-1"
                        aria-label={`${persona.name}'s roles`}
                      >
                        {seats.map((seat, i) => (
                          <li
                            key={`${seat.roleKey}-${seat.label}-${i}`}
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                            data-cy="demo-persona-seat"
                          >
                            <Badge
                              size="sm"
                              variant={SECTION_BADGE[sectionOf(seat)]}
                              data-cy="demo-persona-role"
                              data-role={seat.roleKey}
                            >
                              {seat.role}
                            </Badge>
                            <span className="min-w-0 text-xs text-muted-foreground">
                              {seat.label}
                              {seat.detail ? ` · ${seat.detail}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                        <DemoSignInButton
                          email={persona.email}
                          firstName={first}
                          size="sm"
                          classes={SIGN_IN_CLASSES}
                        />
                        <button
                          type="button"
                          onClick={() => onPick(persona.email)}
                          aria-pressed={picked}
                          aria-label={`Use ${persona.email} in the email field`}
                          className="rounded px-1 py-1.5 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-cy="demo-persona-fill"
                          data-email={persona.email}
                        >
                          {picked ? "Email filled" : "Use this email"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
