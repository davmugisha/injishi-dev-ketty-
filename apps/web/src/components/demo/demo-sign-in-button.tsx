"use client";

import { useState } from "react";
import { Button } from "@injishi/ui";

import { InlineError, InlineNote, useSlow } from "@/components/auth/auth-feedback";
import { fetchAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { DEMO_OTP_CODE, sendOtp, verifyOtp } from "@/lib/otp";
import { safeRedirect } from "@/lib/redirect";

/**
 * "Sign in as Denise": one press on the demo, and the visitor is her.
 *
 * RENDERED ONLY WHERE `GET /api/v1/platform` SAID DEMO. The callers (the sign
 * in picker and the `/demo` guide) decide that on the server; this component
 * never asks, and on its own it proves nothing about the platform.
 *
 * IT IS NOT A SECOND WAY IN. It walks the one sign in path a person walks by
 * hand, through the one module that owns it: `sendOtp` asks the API to issue a
 * code, `verifyOtp` presents the demo's published code, and the navigation goes
 * through `/start` exactly as `/verify-otp` does. Off the demo the API issues a
 * random code, so the same presses end in "that code isn't right" rather than a
 * session: the fixed code is a property of the API process (ADR-043), never of
 * this button.
 *
 * The operator step-up is done here too, because on the demo its code is the
 * same published one and a second screen asking for 123456 is a press that
 * demonstrates nothing. When that step fails for any reason the visitor is
 * simply taken on through `/start`, which sends them to the step-up screen as
 * it would anyone.
 *
 * WHY THE CALLER SPELLS THE LAYOUT CLASSES. Both web stylesheets list the
 * directories Tailwind scans (`source(none)` plus `@source` lines), and
 * `components/demo` is on neither list, so a class written only in this file
 * compiles to nothing. The two callers live in scanned directories, one per
 * stylesheet (`components/auth` for the app sheet, `app/(marketplace)` for the
 * public one), so they pass the classes in `classes` and each sheet generates
 * them from its own caller. Adding `components/demo` to both `@source` lists
 * would let these move back in here.
 */

type Phase = "idle" | "sending" | "verifying" | "stepping-up" | "opening";

/** One sign in at a time across every button on the page: two would race for the cookie. */
let inFlight = false;

/**
 * Where to go once signed in. An explicit destination when the caller has one,
 * else the `?redirect=` this page was opened with, through the same allowlist
 * the sign in screen uses. `/start` runs it through `safeRedirect` again.
 */
function destination(explicit: string | undefined): string {
  if (explicit) return safeRedirect(explicit);
  const raw = new URLSearchParams(window.location.search).get("redirect");
  return safeRedirect(raw);
}

export interface DemoSignInClasses {
  /** The wrapper holding the button and its messages (a column). */
  root: string;
  /** The button itself. */
  button?: string;
  /** The live progress line: visually hidden (`sr-only`), announced. */
  status: string;
  /** Added to the "still working" note. */
  note: string;
  /** Added to the refusal line; must carry its own ink on the public sheet. */
  error: string;
}

export function DemoSignInButton({
  email,
  firstName,
  redirectTo,
  variant = "primary",
  size = "md",
  classes,
}: {
  email: string;
  firstName: string;
  /** Overrides the page's own `?redirect=`. */
  redirectTo?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
  classes: DemoSignInClasses;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const slow = useSlow(phase !== "idle" && phase !== "opening");

  function fail(message: string) {
    inFlight = false;
    setPhase("idle");
    setError(message);
    setAttempt((n) => n + 1);
  }

  async function signIn() {
    if (phase !== "idle" || inFlight) return;
    inFlight = true;
    setError(null);

    setPhase("sending");
    const sent = await sendOtp(email);
    if (!sent.ok) return fail(sent.message);
    if (sent.mode !== "live") {
      // `offline` means the send never reached the API. The offline code opens
      // nothing, so saying "signed in" here would be the one false sentence.
      return fail(
        `We couldn't reach the demo's sign-in just now, so you are not signed in as ${firstName}. Try again in a moment.`,
      );
    }

    setPhase("verifying");
    const verified = await verifyOtp(email, DEMO_OTP_CODE, "live");
    if (!verified.ok) return fail(verified.message);

    setPhase("stepping-up");
    const access = await fetchAccess();
    if (
      access.status === "resolved" &&
      access.twoFactor.required &&
      !access.twoFactor.verified
    ) {
      const code = await apiFetch<{ sentTo: string }>("/api/v1/me/two-factor/send", {
        method: "POST",
        body: {},
      });
      if (code.status === "ok") {
        await apiFetch<{ verified: true }>("/api/v1/me/two-factor/verify", {
          method: "POST",
          body: { code: DEMO_OTP_CODE },
        });
      }
    }

    setPhase("opening");
    // A full document load, as `/verify-otp` does: a session cookie has just
    // been set on the API origin and everything downstream has to re-read it.
    window.location.assign(
      `/start?redirect=${encodeURIComponent(destination(redirectTo))}`,
    );
  }

  const label: Record<Phase, string> = {
    idle: `Sign in as ${firstName}`,
    sending: `Signing in as ${firstName}…`,
    verifying: "Entering the demo code…",
    "stepping-up": "Confirming the second check…",
    opening: `Opening ${firstName}'s view…`,
  };

  return (
    <div className={classes.root}>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={classes.button}
        pending={phase !== "idle"}
        onClick={() => void signIn()}
        data-cy="demo-sign-in"
        data-email={email}
      >
        {label[phase]}
      </Button>
      <p role="status" className={classes.status}>
        {phase === "idle" ? "" : label[phase]}
      </p>
      {slow ? (
        <InlineNote className={classes.note}>
          Still working — the first sign-in can take a few seconds.
        </InlineNote>
      ) : null}
      {error ? (
        <InlineError key={attempt} className={classes.error}>
          {error}
        </InlineError>
      ) : null}
    </div>
  );
}
