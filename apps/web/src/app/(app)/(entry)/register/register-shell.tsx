"use client";

import type { ReactNode } from "react";
import { Badge, Button } from "@injishi/ui";

/**
 * The frame every registration screen sits in (RegisterIA board).
 *
 * One header for the whole walk: the mark, "Register your business", the kind
 * being registered as a chip with its Change control, and the way out. The kind
 * is shown HERE, once, rather than as a sentence on each step: it is asked once
 * (the `/host` tile) and read back once, on every screen, in the same place.
 *
 * Below it, a rail on the left (when the walk has more than one step) and the
 * step itself on the right. On a phone the two stack, rail first.
 */
export function RegisterShell({
  kindLabel,
  onChangeKind,
  changeKindHref,
  exit,
  rail,
  children,
}: {
  /** The kind being registered, or null before one is chosen. */
  kindLabel: string | null;
  /** Opens the kind tiles in place, for a signed in registrant. */
  onChangeKind?: () => void;
  /** Where Change goes for someone not signed in yet: the `/host` chooser. */
  changeKindHref?: string;
  /** The way out, as a link or as a press (Save & exit saves first). */
  exit: { label: string; href?: string; onPress?: () => void; busy?: boolean } | null;
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-7">
          <a href="/" aria-label="Injishi, home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shared/img/injishi-extended.svg"
              alt="Injishi"
              className="h-6 w-auto dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shared/img/injishi-extended-white.svg"
              alt="Injishi"
              className="hidden h-6 w-auto dark:block"
            />
          </a>
          <span className="hidden text-sm text-muted-foreground sm:inline">Register your business</span>
          <span className="grow" />
          {kindLabel ? (
            <span className="flex items-center gap-2">
              <Badge variant="accent" size="sm">
                {kindLabel}
              </Badge>
              {onChangeKind ? (
                <button
                  type="button"
                  onClick={onChangeKind}
                  className="rounded text-sm font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Change<span className="sr-only"> what you are registering</span>
                </button>
              ) : changeKindHref ? (
                <a
                  href={changeKindHref}
                  className="rounded text-sm font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Change<span className="sr-only"> what you are registering</span>
                </a>
              ) : null}
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

      <main className="mx-auto max-w-page px-4 pb-24 pt-6 sm:px-7 sm:pt-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          {rail ? <div className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">{rail}</div> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
        </div>
      </main>
    </>
  );
}

/** The card a step is drawn in: a title, a lead, the fields, and a footer. */
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
