"use client";

/**
 * The demo guide: who you are signed in as, and what to show next.
 *
 * A presenter on the demo signs in as a persona and then has to remember, in
 * front of a room, what that persona is FOR. This answers it on every screen:
 * the persona's name and seat, the one-line headline of their story, and the
 * steps as links, with the step on screen marked.
 *
 * WHEN IT EXISTS. Only when `GET /api/v1/platform` says `demo`, and only for a
 * signed-in person who is on the demo roster AND has a story written. A roster
 * persona with no story gets nothing, not a bare "signed in as" line: the
 * sidebar and the console panel already name who is signed in, so a floating
 * card saying only that would be a second copy of the chrome with nothing to
 * do. The guide earns its corner of the screen by saying what to try.
 *
 * NON-BLOCKING. A floating card, not a dialog: the presenter clicks through the
 * app with it open, so there is no scrim and no focus trap. Minimised it is a
 * pill in the same corner, and which of the two it is is remembered per browser
 * (`localStorage`, read after mount, so the server render and the first client
 * render agree: both are nothing). A step link keeps it open, because the next
 * step is the reason it is there.
 *
 * It grants nothing. Every link leads somewhere the API still guards.
 */

import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { ChevronDown, Compass, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { DemoStoryStep } from "@injishi/contracts";

import { WEB_URL } from "../../lib/sign-in-url";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import {
  currentStepIndex,
  lastResetPhrase,
  seatInView,
  seatLine,
  stepLink,
  type GuideSurface,
} from "./guide-logic";
import { useDemoPersona } from "./use-demo-persona";

/** The one key, per browser: `open` or `closed`. */
const STORAGE_KEY = "injishi-demo-guide";

type Mode = "open" | "closed";

function readMode(): Mode | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "open" || v === "closed" ? v : null;
  } catch {
    // Private window, blocked storage: fall back to the default below.
    return null;
  }
}

function writeMode(mode: Mode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not remembered; the guide still works for this page.
  }
}

/**
 * The first visit: open on a desk-sized screen, where the card fits beside the
 * work; minimised on a phone, where it would cover the screen being presented.
 */
function defaultMode(): Mode {
  try {
    return window.matchMedia("(min-width: 1024px)").matches ? "open" : "closed";
  } catch {
    return "closed";
  }
}

export interface DemoGuideProps {
  /** The operator shell or the government console. */
  surface: "operator" | "oversight";
  /**
   * `raised` lifts the minimised pill above a bottom tab bar on a phone, for the
   * housekeeper's phone surface.
   */
  placement?: "corner" | "raised";
}

export function DemoGuide({ surface, placement = "corner" }: DemoGuideProps) {
  const { state } = usePms();
  const persona = useDemoPersona(state.platform);
  const pathname = usePathname();
  const grant = surface === "operator" ? currentGrant(state) : undefined;

  const view: GuideSurface = useMemo(
    () =>
      surface === "oversight"
        ? { kind: "oversight" }
        : { kind: "operator", workspaceLabel: grant?.label ?? null, roleKey: grant?.role ?? null },
    [surface, grant?.label, grant?.role],
  );

  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    setMode(readMode() ?? defaultMode());
  }, []);

  // Focus follows a person's own open or close, never the first render: a
  // guide that grabbed focus on page load would pull a keyboard user out of
  // the screen they came to use.
  const focusNext = useRef<"panel" | "pill" | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "panel") panelRef.current?.focus();
    if (target === "pill") pillRef.current?.querySelector("button")?.focus();
  }, [mode]);

  const change = useCallback((next: Mode) => {
    focusNext.current = next === "open" ? "panel" : "pill";
    setMode(next);
    writeMode(next);
  }, []);

  const ids = useId();
  const panelId = `${ids}-demo-guide`;
  const titleId = `${ids}-demo-guide-title`;

  const story = persona?.story ?? null;
  if (!persona || !story || story.tryThis.length === 0 || mode === null) return null;

  const seat = seatLine(seatInView(persona, view));
  const current = currentStepIndex(story, pathname);
  const reset = lastResetPhrase(state.platform?.seededAt);
  const total = story.tryThis.length;

  // Elevation is the app's own pop shadow (ink at alpha, deeper in dark), not
  // Tailwind's stock black one.
  const lift = placement === "raised" ? "bottom-24 sm:bottom-4" : "bottom-4";

  if (mode === "closed") {
    return (
      <div ref={pillRef} className={cn("fixed right-4 z-50", lift)} data-demo-guide="closed">
        <Button
          variant="primary"
          size="sm"
          className="shadow-(--shadow-pop)"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => change("open")}
        >
          <Compass aria-hidden className="size-4" />
          Demo guide
          {current >= 0 ? (
            <span className="text-xs font-normal">
              · step {current + 1} of {total}
            </span>
          ) : null}
        </Button>
      </div>
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      change("closed");
    }
  };

  return (
    <section
      id={panelId}
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      data-demo-guide="open"
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 flex max-h-[min(36rem,calc(100dvh-2rem))] flex-col",
        "sm:left-auto sm:w-full sm:max-w-tile",
        "animate-settle-in rounded-card border border-border bg-card text-card-foreground shadow-(--shadow-pop)",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <header className="flex items-start gap-3 border-b border-border px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            <Compass aria-hidden className="size-3.5" />
            Demo guide
          </p>
          <p className="mt-1 text-sm text-foreground">
            You&apos;re signed in as <span className="font-semibold">{persona.name}</span>
            {seat ? <span className="text-muted-foreground"> · {seat}</span> : null}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Minimise demo guide"
          aria-expanded
          aria-controls={panelId}
          title="Minimise (Esc)"
          onClick={() => change("closed")}
        >
          <ChevronDown aria-hidden className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {story.headline}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Try this, in order:</p>
        <ol className="mt-2 flex flex-col gap-1">
          {story.tryThis.map((step, i) => (
            <GuideStep key={`${i}-${step.title}`} step={step} index={i} current={i === current} />
          ))}
        </ol>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        {reset ? <span>Demo data last reset {reset}.</span> : null}
        <a
          href={new URL("/demo", WEB_URL).toString()}
          className="ml-auto font-medium text-accent-text underline-offset-4 hover:underline"
        >
          All personas
        </a>
      </footer>
    </section>
  );
}

function GuideStep({ step, index, current }: { step: DemoStoryStep; index: number; current: boolean }) {
  const link = stepLink(step);

  const marker = (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold",
        current ? "bg-accent text-accent-foreground" : "bg-field text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );

  const body = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
        {step.title}
        {link.kind === "external" ? (
          <>
            <ExternalLink aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">(opens in a new tab)</span>
          </>
        ) : null}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
      {current ? <span className="mt-1 block text-2xs font-bold uppercase tracking-widest text-accent-text">You are here</span> : null}
    </span>
  );

  const row = cn(
    "flex items-start gap-2.5 rounded px-2 py-2",
    current ? "bg-accent-soft" : "",
    link.kind !== "none" ? "transition-colors hover:bg-hover" : "",
  );

  return (
    <li aria-current={current ? "step" : undefined}>
      {link.kind === "app" ? (
        <Link href={link.href} className={row}>
          {marker}
          {body}
        </Link>
      ) : link.kind === "site" ? (
        <a href={link.href} className={row}>
          {marker}
          {body}
        </a>
      ) : link.kind === "external" ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className={row}>
          {marker}
          {body}
        </a>
      ) : (
        <div className={row}>
          {marker}
          {body}
        </div>
      )}
    </li>
  );
}
