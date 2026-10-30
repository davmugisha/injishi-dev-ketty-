"use client";

import { useState } from "react";

import { Button } from "@injishi/web-ui";
import { Icon } from "@/components/app/icon";
import { useSignOutAndLeave } from "@/components/auth/sign-out";
import { displayNameFrom, initialsFrom } from "@/lib/avatar";
import { useSessionUser } from "@/lib/session";

/**
 * ONE account screen, not one per workspace (ADR-018, D-g, AC-11). An account is a property of the
 * PERSON, and a person has one.
 *
 * IT READS THE SESSION AND ONLY THE SESSION. `lib/session.ts` is the one caller of `getSession()` in this
 * app, which is why the name here and the name beside the avatar can never disagree.
 *
 * 2026-10-30 redesign: a profile header, the places a guest comes back for, and how they sign in. The
 * list of lenses still to come ("identity and documents, security, notifications") is gone from the
 * screen: a page that advertises what it does not do reads as unfinished.
 */

/** What a guest who has booked comes to their account FOR. */
const ACCOUNT_LINKS = [
  { href: "/trips", icon: "map-pin", label: "Trips", detail: "Dates, directions, receipts and cancelling" },
  { href: "/inbox", icon: "message-square", label: "Messages", detail: "Talk to the property and its departments" },
  { href: "/saved", icon: "heart", label: "Saved", detail: "Stays you kept for later" },
  { href: "/account/refunds", icon: "banknote", label: "Refunds", detail: "Money on its way back to you" },
] as const;

export default function Page() {
  const { status, user, signOut, refresh } = useSessionUser();
  const { signingOut, signOutAndLeave } = useSignOutAndLeave(signOut);
  const [retrying, setRetrying] = useState(false);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-read px-4 py-8 sm:px-6">
        <div className="h-36 animate-pulse rounded-card bg-secondary" />
        <span className="sr-only" role="status">
          Getting your details
        </span>
      </div>
    );
  }

  if (status === "unreachable") {
    // NOT "signed out": a network failure says nothing about a session, and telling somebody to sign
    // in again sends them to fix something that is not broken.
    return (
      <div className="mx-auto max-w-read px-4 py-8 sm:px-6">
        <section className="rounded-card border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t reach Injishi just now, so we can&rsquo;t show your details. Your account is fine.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            pending={retrying}
            onClick={() => {
              setRetrying(true);
              void refresh().finally(() => setRetrying(false));
            }}
          >
            <Icon name="refresh-cw" className="h-4 w-4" />
            {retrying ? "Trying again…" : "Try again"}
          </Button>
        </section>
      </div>
    );
  }

  if (status === "anonymous" || !user) {
    return (
      <div className="mx-auto max-w-read px-4 py-8 sm:px-6">
        <section className="rounded-card border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            You are not signed in.{" "}
            <a href="/sign-in?redirect=%2Faccount" className="font-semibold underline">
              Sign in
            </a>
          </p>
        </section>
      </div>
    );
  }

  // The name the sidebar shows, so the two never disagree.
  const name = displayNameFrom(user.name, user.email);

  return (
    <div className="mx-auto flex max-w-read animate-arrive flex-col gap-5 px-4 py-8 sm:px-6">
      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="h-20 bg-gradient-to-r from-primary/80 to-accent/70" aria-hidden />
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-6 pb-6">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary font-display text-2xl font-bold text-primary-foreground">
            {initialsFrom(user.name, user.email)}
          </span>
          <div className="min-w-0 grow pt-12 pb-1">
            <h2 className="truncate font-display text-2xl font-bold tracking-tight">{name}</h2>
            <p className="money truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </section>

      <nav aria-label="Your stays" className="grid gap-3 sm:grid-cols-2">
        {ACCOUNT_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group flex items-center gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:bg-secondary"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-secondary text-foreground transition-colors group-hover:bg-card">
              <Icon name={link.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-sm font-semibold">{link.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{link.detail}</span>
            </span>
            <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </nav>

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-secondary">
            <Icon name="shield-check" className="h-5 w-5" />
          </span>
          <div className="min-w-0 grow">
            <h3 className="text-sm font-semibold">Signing in</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              There is no password to remember: each time you sign in, Injishi sends a one-time code to{" "}
              <span className="money text-foreground">{user.email}</span>.
            </p>
          </div>
        </div>
        {/* It leaves, like the header menu and the sidebar, and lands somewhere that says so. */}
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="outline" pending={signingOut} onClick={signOutAndLeave}>
            <Icon name="log-out" className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Need a hand? <a href="/support" className="font-semibold underline">Visit Support</a>
      </p>
    </div>
  );
}
