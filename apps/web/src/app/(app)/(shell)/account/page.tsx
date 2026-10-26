"use client";

import { useState } from "react";

import { Button } from "@injishi/web-ui";
import { Icon } from "@/components/app/icon";
import { useSignOutAndLeave } from "@/components/auth/sign-out";
import { sessionDisplayName, useSessionUser } from "@/lib/session";

/**
 * ONE account screen, not one per workspace (ADR-018, D-g, AC-11).
 *
 * A person used to carry `personal/account` and `broker/account` here and an
 * account screen per operator workspace there. An account is a property of the
 * PERSON, and a person has one, so it collapses to one per app.
 *
 * IT READS THE SESSION AND ONLY THE SESSION. `lib/session.ts` is the one caller
 * of `getSession()` in this app; every surface that needs identity goes through
 * it. The shell's own identity comes from the same place, which is why the name
 * here and the name beside the avatar can never disagree.
 *
 * The lenses this screen will grow — identity and documents, security, notification
 * preferences, claiming a walk in stay — are named below rather than stubbed as
 * empty tabs, because a tab that does nothing reads as broken and a sentence does
 * not.
 */

/**
 * What a guest who has booked comes to their account FOR.
 *
 * The screen said what it would grow into and offered nothing that worked, so
 * the only live control on it was "Sign out". These three all exist, and the
 * sidebar is not always in view — it is a drawer below `lg`.
 */
const ACCOUNT_LINKS = [
  { href: "/trips", icon: "map-pin", label: "Trips", detail: "Dates, receipts and cancelling" },
  { href: "/inbox", icon: "inbox", label: "Messages", detail: "The property and its departments" },
  { href: "/saved", icon: "heart", label: "Saved", detail: "Stays kept for later" },
] as const;

export default function Page() {
  const { status, user, signOut, refresh } = useSessionUser();
  const { signingOut, signOutAndLeave } = useSignOutAndLeave(signOut);
  const [retrying, setRetrying] = useState(false);

  return (
    <div className="mx-auto max-w-read px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Account</h1>

      <section className="mt-5 rounded-card border border-border bg-card p-5">
        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">Getting your details…</p>
        ) : status === "unreachable" ? (
          // NOT "signed out". A network failure says nothing either way about a
          // session, and telling somebody to sign in again sends them to fix
          // something that is not broken. What it DID lack was a way out: the
          // sentence said "try again" and offered nothing to try again with, so
          // the only move left was a browser reload.
          <div>
            <p className="text-sm text-muted-foreground">
              We couldn&rsquo;t reach Injishi just now, so we can&rsquo;t show your
              details. Your account is fine.
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
          </div>
        ) : status === "anonymous" || !user ? (
          <p className="text-sm text-muted-foreground">
            You are not signed in.{" "}
            <a href="/sign-in" className="font-semibold underline">
              Sign in
            </a>
          </p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Name
              </dt>
              <dd className="mt-1 text-sm">{sessionDisplayName(user)}</dd>
            </div>
            <div>
              <dt className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Email
              </dt>
              <dd className="money mt-1 text-sm">{user.email}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Offered only to somebody signed in: every one of these screens asks
          for a session, so an anonymous reader would be sent to three dead
          ends from a panel that already told them to sign in. */}
      {status === "authenticated" ? (
        <nav aria-label="Your stays" className="mt-4 grid gap-3 sm:grid-cols-3">
          {ACCOUNT_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-card border border-border bg-card p-4 hover:bg-secondary"
            >
              <Icon name={link.icon} className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-semibold">{link.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{link.detail}</span>
              </span>
            </a>
          ))}
        </nav>
      ) : null}

      <section className="mt-4 rounded-card border border-dashed border-border p-5">
        <h2 className="text-sm font-semibold">Coming to this screen</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>Identity and documents, the KYC you complete once</li>
          <li>Security, including which devices hold a session</li>
          <li>Which notifications reach you, and how</li>
          <li>Claiming a stay you booked at the desk without an account</li>
        </ul>
      </section>

      {/* It used to sign out in place: this panel flipped to "You are not signed
          in" while the shell around it went on showing the person's name and
          initials, so the screen disagreed with itself. It leaves now, like the
          header menu and the sidebar, and lands somewhere that says so. */}
      {status === "authenticated" ? (
        <Button
          variant="ghost"
          className="mt-5"
          pending={signingOut}
          onClick={signOutAndLeave}
        >
          <Icon name="log-out" className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      ) : null}
    </div>
  );
}
