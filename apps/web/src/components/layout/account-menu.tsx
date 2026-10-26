"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { takeSignedOutFlag, useSignOutAndLeave } from "@/components/auth/sign-out";
import { displayNameFrom, initialsFrom } from "@/lib/avatar";
import { HOME, NAV } from "@/lib/app-nav";
import { useSessionUser } from "@/lib/session";

/**
 * The identity control in the site header: a Sign In button, or the person.
 *
 * The bar carried a hardcoded `<Link href="/sign-in">Sign In</Link>`, which is
 * the correct control for exactly one of the four states `useSessionUser`
 * reports — and the marketplace header is the one surface every signed-in
 * person sees first. Signing in changed nothing visible up here, so a working
 * sign-in read as a broken one.
 *
 * ALL FOUR STATES ARE RENDERED, and the two that are not "signed in" are not
 * the same thing:
 *
 *  - `loading` gets a dim circle, not the Sign In button. Rendering the
 *    signed-out branch while the answer is still in flight makes the bar tell
 *    every returning visitor they are signed out, then swap it a moment later.
 *    A placeholder that resolves is honest; a wrong answer that corrects itself
 *    is not, and it is the one flicker every visitor sees on every page.
 *  - `unreachable` gets the Sign In button, because it is the only control that
 *    can help. It is deliberately NOT treated as a session — the API being down
 *    says nothing either way, and claiming an identity we cannot prove is the
 *    worse of the two errors here (see `lib/session.ts`).
 *
 * THE LINKS COME FROM `NAV`, not from a list typed out here. That module is
 * already the one definition of what the signed-in shell contains, and a second
 * copy in the header is how a menu ends up offering a route that moved.
 */
/**
 * "You're signed out", said once, where they land.
 *
 * A sign-out that leaves a page identical to the one before it is
 * indistinguishable from a sign-out that failed, and this is the surface every
 * one of the four controls lands on (`SIGNED_OUT_LANDING`).
 *
 * Portalled to `document.body` on purpose: this component's own slot in the bar
 * is display-none below `lg`, and the acknowledgement is for everybody.
 */
function SignedOutNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (takeSignedOutFlag()) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), 4_000);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      className="animate-arrive fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-card-foreground shadow-lg"
    >
      <Check className="size-4 shrink-0" aria-hidden />
      You&rsquo;re signed out. See you soon.
    </div>,
    document.body,
  );
}

export function AccountMenu({
  className,
  onPhoto = false,
}: {
  className?: string;
  /** White pill while the bar sits on a photograph. Ghost ink disappears there. */
  onPhoto?: boolean;
}) {
  const { status, user, signOut } = useSessionUser();
  const { signingOut, signOutAndLeave } = useSignOutAndLeave(signOut);

  if (status === "loading") {
    return (
      <>
        <SignedOutNotice />
        <div
          aria-hidden
          className={cn(
            "size-9 shrink-0 animate-pulse rounded-full bg-current opacity-20",
            className,
          )}
        />
      </>
    );
  }

  if (status !== "authenticated") {
    return (
      <>
        {/* The one place a just-signed-out person reliably lands. */}
        <SignedOutNotice />
        <Button
          asChild
          variant={onPhoto ? "inverse" : "ghost"}
          size="md"
          className={className}
        >
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </>
    );
  }

  const name = displayNameFrom(user?.name, user?.email);
  const initials = initialsFrom(user?.name, user?.email);
  const email = user?.email?.trim() ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // The label names the PERSON, not the action. "Account menu" on its
          // own gives a screen reader no way to tell a signed-in bar from a
          // signed-out one, which is the single fact this control exists to
          // carry.
          aria-label={`Account menu for ${name}`}
          className={cn(
            "shrink-0 rounded-full ring-offset-background transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <Avatar className="size-9">
            {/* `AvatarImage` unmounts itself when the src fails to load, so the
                fallback below is the initials path AND the broken-photo path
                without a second branch here. */}
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 border border-border">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {NAV.map((section) => (
          <div key={section.label}>
            {section.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}

        <DropdownMenuSeparator />
        {/* `preventDefault` keeps the menu open so the row can say what it is
            doing. Closing it and navigating a second later left a person
            looking at an unchanged page, wondering whether the press landed. */}
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            signOutAndLeave();
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The same fact, for the mobile panel.
 *
 * It is a second rendering rather than the same one at another width because
 * the container differs in kind: `MobileNav` is a Radix dialog, and hanging a
 * dropdown off a control inside it stacks a second layer over a panel that is
 * already the whole screen. The panel has room to simply SHOW the account rows,
 * so it does.
 *
 * What it must not do is answer the session question differently — a header
 * that says "Sign In" and a menu that shows an avatar is worse than either
 * alone. Both read `useSessionUser`, and the three branches below are the same
 * three as above, in the same order.
 */
export function AccountMenuMobile({ onNavigate }: { onNavigate?: () => void }) {
  const { status, user, signOut } = useSessionUser();
  const { signingOut, signOutAndLeave } = useSignOutAndLeave(signOut);

  if (status === "loading") {
    return (
      <div
        aria-hidden
        className="h-10 w-full animate-pulse rounded-full bg-current opacity-10"
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <Button asChild variant="outline" fullWidth>
        <Link href="/sign-in" onClick={onNavigate}>
          Sign In
        </Link>
      </Button>
    );
  }

  const name = displayNameFrom(user?.name, user?.email);
  const initials = initialsFrom(user?.name, user?.email);
  const email = user?.email?.trim() ?? "";

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={HOME}
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-card border border-border p-3 transition-colors duration-200 hover:bg-field"
      >
        <Avatar className="size-10">
          {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
          ) : null}
        </span>
      </Link>

      {/* The panel deliberately stays open: closing it first unmounted this
          button, so the pending state had nowhere to show. A full page load
          follows anyway. */}
      <Button variant="ghost" fullWidth pending={signingOut} onClick={signOutAndLeave}>
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
