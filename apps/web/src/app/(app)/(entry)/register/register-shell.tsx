"use client";

import type { ReactNode } from "react";
import { ArrowLeft, CloudCheck, Lock } from "lucide-react";
import { Badge, Button, Progress } from "@injishi/ui";

import { AssistantWidget } from "@/components/assistant/assistant-widget";

/**
 * The frame every registration screen sits in (Register.dc.html, 2026-10-19).
 *
 * ONE HEADER FOR THE WHOLE WALK: the mark, "Register a business", whether the
 * answers are saved, and Save and exit. Below it the heading the artboard
 * draws: an eyebrow, the business's name once RRA has named it, one line on
 * what the walk is, and the kind carried in from `/host` with its Change.
 *
 * Then the rail on the left and the step on the right. Below a tablet's width
 * the rail goes, and the step carries a progress bar instead, with its Back and
 * Continue fixed to the bottom of the screen where a thumb reaches them.
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
  saved = null,
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
  /** The kind is the one `/host` sent, so it is shown as chosen on the page before. */
  carried?: boolean;
  heading?: { eyebrow: string; title: string; sub: string } | null;
  /** "Saved 10:41", or null before anything is saved. */
  saved?: string | null;
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
          <span className="hidden text-muted-foreground md:inline" aria-hidden="true">
            /
          </span>
          <span className="hidden text-sm font-semibold md:inline">Register a business</span>
          {demo ? <Badge variant="subtle" size="sm">Demo data</Badge> : null}
          <span className="grow" />
          {saved ? (
            <span role="status" className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <CloudCheck size={14} aria-hidden />
              {saved}
            </span>
          ) : null}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading.eyebrow}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading.title}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">{heading.sub}</p>
            {kindLabel && carried ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="subtle" size="sm">
                  {kindLabel}, chosen on the page before
                </Badge>
                {change}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          {rail ? <div className="hidden shrink-0 md:block md:w-48 lg:w-56">{rail}</div> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
        </div>
      </main>

      <AssistantWidget />
    </>
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
 * One of the six steps, drawn as the artboard's card: "Step 2 of 6", the step's
 * title and lead, its body, then Back and the primary action. On a phone the
 * card's chrome falls away, a progress bar says how far along this is, and the
 * actions are fixed to the bottom of the screen.
 */
export function StepFrame({
  position,
  title,
  lead,
  lockedBanner = false,
  onBack,
  primary,
  children,
}: {
  position: { n: number; of: number };
  title: string;
  lead: string;
  /** The registration exists: these details went to Injishi when it was signed. */
  lockedBanner?: boolean;
  onBack: (() => void) | null;
  primary: StepPrimary | null;
  children: ReactNode;
}) {
  const pct = Math.round((position.n / position.of) * 100);
  return (
    <section
      aria-labelledby="register-step-title"
      className="flex flex-col gap-6 md:rounded-card md:border md:border-border md:bg-card md:p-7"
    >
      <div className="flex flex-col gap-1.5">
        <span id="register-step-position" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {position.n} of {position.of}
        </span>
        <Progress
          aria-labelledby="register-step-position"
          value={pct}
          className="h-1.5 bg-secondary md:hidden"
          indicatorClassName="bg-accent-brand"
        />
        <h2 id="register-step-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>

      {lockedBanner ? (
        <Callout tone="info" icon={<Lock size={16} aria-hidden />} title="Signed and locked">
          These details went to Injishi when you signed. If something needs fixing, an officer sends the
          registration back to you.
        </Callout>
      ) : null}

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
