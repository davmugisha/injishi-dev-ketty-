"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button } from "@injishi/ui";
import { cn } from "@injishi/utils";

import { AssistantWidget } from "@/components/assistant/assistant-widget";

import { SAVE_STATE_TEXT, type SaveState } from "./register-draft";

/**
 * The frame every registration screen sits in (Register.dc.html, 2026-10-19).
 *
 * ONE HEADER FOR THE WHOLE WALK: the mark, whether the answers are saved
 * (ADR-075 S9, AC-10: "Saving…", "✓ Saved", "Offline, saved on this phone",
 * "Not saved, Retry", always true), and Save and exit. Below it one h1 that names the type ("Register your coffee
 * shop", ADR-075 AC-2) with a small Change beside it, and at most one line
 * under it: the business's name once RRA has returned it, never replacing the
 * h1.
 *
 * Then the five step progress row above the step (S10). Below a tablet's width
 * the row goes, and the step says "Step 2 of 5 · You" over a thin bar instead,
 * with its Back and Continue fixed to the bottom of the screen where a thumb
 * reaches them.
 *
 * The support assistant's launcher rides along (ADR-061): the artboard's "Ask
 * Injishi". It draws nothing when the API has the assistant off.
 */
export function RegisterShell({
  kindLabel,
  demo = false,
  onChangeKind,
  changeKindHref,
  carried = false,
  heading = null,
  save = null,
  exit,
  rail,
  children,
}: {
  /** The kind being registered, or null before one is chosen. */
  kindLabel: string | null;
  /** The API confirmed this is sample data. */
  demo?: boolean;
  /** Opens Business type in place, for a signed in registrant. */
  onChangeKind?: () => void;
  /** Where Change goes for someone not signed in yet: the `/host` chooser. */
  changeKindHref?: string;
  /** Whether Change is offered beside the heading: the kind is known and nothing is locked yet. */
  carried?: boolean;
  /** The h1, and at most one short line under it. */
  heading?: { title: string; sub: string | null } | null;
  /** What the last save did, or null while there is nothing to say (nothing typed, nothing saved). */
  save?: { state: Exclude<SaveState, "idle">; savedAt: string | null; onRetry: () => void } | null;
  /** The way out, as a link or as a press (Save and exit saves first). */
  exit: { label: string; href?: string; onPress?: () => void; busy?: boolean } | null;
  rail?: ReactNode;
  children: ReactNode;
}) {
  const change = onChangeKind ? (
    <Button variant="ghost" size="sm" onClick={onChangeKind}>
      Change<span className="sr-only"> the business type</span>
    </Button>
  ) : changeKindHref ? (
    <Button asChild variant="ghost" size="sm">
      <a href={changeKindHref}>
        Change<span className="sr-only"> the business type</span>
      </a>
    </Button>
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8">
          <a href="/" aria-label="Injishi, home" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shared/img/injishi-extended.svg" alt="Injishi" className="h-6 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shared/img/injishi-extended-white.svg" alt="Injishi" className="hidden h-6 w-auto dark:block" />
          </a>
          {demo ? <Badge variant="subtle" size="sm">Demo data</Badge> : null}
          <span className="grow" />
          {save ? <SaveStatus {...save} /> : null}
          {!heading && kindLabel ? (
            <span className="flex items-center gap-1">
              <Badge variant="accent" size="sm">
                {kindLabel}
              </Badge>
              {change}
            </span>
          ) : null}
          {exit ? (
            exit.href ? (
              <Button asChild variant="ghost" size="sm">
                <a href={exit.href}>{exit.label}</a>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={exit.onPress} pending={exit.busy}>
                {exit.label}
              </Button>
            )
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-page flex-col gap-6 px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-8">
        {heading ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading.title}</h1>
              {carried ? change : null}
            </div>
            {heading.sub ? <p className="text-sm text-muted-foreground sm:text-base">{heading.sub}</p> : null}
          </div>
        ) : null}

        {rail ? <div className="hidden md:block">{rail}</div> : null}
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </main>

      <AssistantWidget />
    </>
  );
}

const KIGALI_CLOCK: Intl.DateTimeFormatOptions = { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" };

/**
 * The header's save status: what the last save did, in the four words ADR-075
 * gives it, never ahead of the truth. "Not saved" carries its Retry.
 */
function SaveStatus({
  state,
  savedAt,
  onRetry,
}: {
  state: Exclude<SaveState, "idle">;
  savedAt: string | null;
  onRetry: () => void;
}) {
  const at = savedAt ? new Date(savedAt) : null;
  const when = at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString("en-GB", KIGALI_CLOCK) : null;
  return (
    <span
      id="register-save-status"
      role="status"
      title={state === "saved" && when ? `Saved at ${when}` : undefined}
      className={cn(
        "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        state === "failed" ? "bg-destructive/10 text-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {SAVE_STATE_TEXT[state]}
      {state === "failed" ? (
        // At least 24 px tall: the pill is small, and its one control still has to be easy to hit.
        <Button variant="link" size="sm" onClick={onRetry} className="min-h-6">
          Retry
        </Button>
      ) : null}
    </span>
  );
}

/** The primary action of a step, and why it cannot be pressed yet when it cannot. */
export interface StepPrimary {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  /** Said beside the button: what it does, or what it is waiting for. */
  why?: string;
}

/**
 * One of the five steps: the step's title and lead, its body, then Back and the
 * primary action. On a phone the card's chrome falls away, "Step 2 of 5 · You"
 * sits over a thin bar of five segments (S10), and the actions are fixed to the
 * bottom of the screen.
 */
export function StepFrame({
  position,
  title,
  lead,
  onBack,
  primary,
  children,
}: {
  position: { n: number; of: number };
  title: string;
  lead: string;
  onBack: (() => void) | null;
  primary: StepPrimary | null;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="register-step-title"
      className="flex flex-col gap-6 md:rounded-card md:border md:border-border md:bg-card md:p-7"
    >
      <div className="flex flex-col gap-1.5">
        <span id="register-step-position" className="text-sm font-semibold md:hidden">
          Step {position.n} of {position.of} · {title}
        </span>
        <span aria-hidden className="grid gap-1 md:hidden" style={{ gridTemplateColumns: `repeat(${position.of}, minmax(0, 1fr))` }}>
          {Array.from({ length: position.of }, (_, i) => (
            <span key={i} className={cn("h-1 rounded-full", i < position.n ? "bg-accent-brand" : "bg-secondary")} />
          ))}
        </span>
        <h2 id="register-step-title" className="sr-only text-xl font-semibold tracking-tight md:not-sr-only">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>

      {children}

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 md:static md:z-auto md:bg-transparent md:px-0 md:pb-0 md:pt-5">
        <Button variant="ghost" onClick={onBack ?? undefined} disabled={onBack === null}>
          <ArrowLeft size={16} aria-hidden />
          Back
        </Button>
        {primary ? (
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            {primary.why ? (
              <span id="register-step-why" className="sr-only text-xs text-muted-foreground md:not-sr-only md:text-right">
                {primary.why}
              </span>
            ) : null}
            <Button
              onClick={primary.onPress}
              disabled={primary.disabled}
              pending={primary.pending}
              aria-describedby={primary.why ? "register-step-why" : undefined}
              className="grow md:grow-0"
            >
              {primary.label}
              {primary.icon}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** A message with a title, in the tone of what it says. */
export function Callout({
  tone,
  title,
  icon,
  children,
  role,
}: {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  /** `alert` for something that went wrong; a status otherwise. */
  role?: "alert" | "status";
}) {
  const toneClass = {
    info: "border-border bg-secondary text-secondary-foreground",
    warning: "border-warning/40 bg-warning/10 text-foreground",
    danger: "border-destructive/40 bg-destructive/10 text-foreground",
    success: "border-success/40 bg-success/10 text-foreground",
  }[tone];
  const iconClass = {
    info: "text-muted-foreground",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  }[tone];
  return (
    <div
      className={`flex gap-3 rounded-card border p-4 text-sm ${toneClass}`}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      {icon ? <span className={`mt-0.5 shrink-0 ${iconClass}`}>{icon}</span> : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

/** The card the screens outside the six steps are drawn in: a title, a lead, the body, a footer. */
export function StepCard({
  id,
  title,
  lead,
  chip,
  children,
  footer,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  chip?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-5 sm:p-7"
    >
      <div className="flex flex-col gap-2">
        {chip ? <div className="flex">{chip}</div> : null}
        <h1 id={id} className="text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {lead ? <p className="text-sm text-muted-foreground sm:text-base">{lead}</p> : null}
      </div>
      {children ? <div className="flex flex-col gap-5">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** A quiet placeholder while the account or the registration is read. */
export function StepSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your registration"
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-5 sm:p-7"
    >
      <span className="h-7 w-1/2 animate-pulse rounded bg-secondary" />
      <span className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
      <span className="h-10 w-full animate-pulse rounded bg-secondary" />
      <span className="h-10 w-2/3 animate-pulse rounded bg-secondary" />
    </div>
  );
}
