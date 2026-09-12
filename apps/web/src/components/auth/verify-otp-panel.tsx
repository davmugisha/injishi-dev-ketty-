"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import {
  ACKNOWLEDGE_MS,
  DoneMark,
  InlineError,
  InlineNote,
  RECOVERY_MS,
  useLater,
  useSlow,
} from "@/components/auth/auth-feedback";
import {
  DEMO_OTP_CODE,
  OTP_LENGTH,
  OTP_MESSAGES,
  needsNewCode,
  sanitizeOtp,
  sendOtp,
  verifyOtp,
  type OtpMode,
} from "@/lib/otp";

/**
 * /verify-otp, on React state (ADR-017 slice 2, AC-16).
 *
 * The screen this replaces was frozen markup driven by `<OtpController/>`,
 * which found six inputs and two buttons by id, attached listeners, and wrote
 * the countdown, the disabled state and the error text straight into the DOM.
 * It worked because the page held no state and therefore never re-rendered —
 * which is another way of saying it worked as long as nobody made the page
 * React. Everything it did is state here, and the only refs are for moving
 * focus between the digit boxes, which is what a ref is for.
 *
 * VERIFICATION IS A BROWSER CALL AND STAYS ONE. `lib/otp.ts` is the one owner
 * of it. The Better Auth session cookie belongs to the API origin, so the call
 * that ends in a session has to be made from here, carrying credentials. The
 * sign-in screen's Server Action only SENDS a code, which sets no cookie.
 *
 * `mode` arrives as a query param from that send, and is honoured rather than
 * re-derived: asking the API again just to find out whether it was reachable a
 * moment ago would be a second answer to a settled question.
 */

/** How long a code is good for, and how long before Resend re-arms (F-S01). */
const CODE_TTL_S = 600;
const RESEND_COOLDOWN_S = 30;

function clock(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function VerifyOtpPanel({
  email,
  redirectTo,
  mode: issuedMode,
  demo,
}: {
  email: string;
  redirectTo: string;
  mode: OtpMode;
  /** The API says this is the demo (`GET /api/v1/platform`), so the code is fixed. */
  demo: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  /** `done` is the half-second where the screen says "that worked" before it goes. */
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [resending, setResending] = useState(false);
  /**
   * The server has said this code is finished — aged out, or burnt by too many
   * guesses. The countdown cannot know that on its own, and a screen that keeps
   * offering "Verify" for a code the server has already thrown away is a screen
   * that will refuse the next five presses for a reason it already knows.
   */
  const [spent, setSpent] = useState(false);
  /**
   * Honoured from the send, but not frozen: a resend that reaches the API when
   * the first send could not switches this to `live`, and the fixed offline
   * code stops being the right thing to type.
   */
  const [mode, setMode] = useState<OtpMode>(issuedMode);
  const [ttl, setTtl] = useState(CODE_TTL_S);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const resendButton = useRef<HTMLButtonElement>(null);
  const later = useLater();

  const code = digits.join("");
  const complete = code.length === OTP_LENGTH;
  const busy = phase !== "idle" || resending;
  /** Offline codes do not age: nothing on the API is counting them down. */
  const expired = mode === "live" && (spent || ttl <= 0);
  const slowCheck = useSlow(phase === "checking");
  const slowSend = useSlow(resending);

  function refuse(message: string) {
    setError(message);
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    const t = setInterval(() => setTtl((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  function write(index: number, raw: string) {
    const only = sanitizeOtp(raw);
    setError(null);
    setInfo(null);
    if (only.length > 1) {
      // A pasted code fills the whole row from wherever it landed.
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < only.length && index + i < OTP_LENGTH; i++) {
          next[index + i] = only[i]!;
        }
        return next;
      });
      boxes.current[Math.min(index + only.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = only.slice(-1);
      return next;
    });
    if (only && index < OTP_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && complete && !busy) void submit();
  }

  async function submit() {
    if (!complete || busy) return;
    setPhase("checking");
    setError(null);
    setInfo(null);
    const result = await verifyOtp(email, code, mode);
    if (!result.ok) {
      // The digits stay exactly as typed. A screen that clears them makes
      // somebody re-read a code they already read once, to fix one wrong key.
      setPhase("idle");
      refuse(result.message);
      if (needsNewCode(result.reason)) {
        // This code is gone. Re-arm Resend and put the focus on it, because
        // retyping is now the one thing that cannot work.
        setSpent(true);
        setCooldown(0);
        later(RECOVERY_MS, () => resendButton.current?.focus());
        return;
      }
      if (result.reason === "mismatch" || result.reason === "incomplete") {
        // Back to the first box, selected, so one keystroke replaces a digit.
        later(RECOVERY_MS, () => {
          boxes.current[0]?.focus();
          boxes.current[0]?.select();
        });
      }
      // Anything else was ours (unreachable, timed out). Focus stays on the
      // button they pressed, because pressing it again is the next move.
      return;
    }
    // Say so before leaving. The navigation below is a full document load, and
    // the last thing a person saw used to be the button they had pressed.
    setPhase("done");
    // A full document load, not a client transition: a session cookie has just
    // been set on the API origin and everything downstream has to re-read it.
    // Through the resolver, never straight to the destination (F-S02): the
    // person's role may require a second factor first, and only `/start`
    // knows. The destination travels along and is honoured afterwards.
    later(ACKNOWLEDGE_MS, () =>
      window.location.assign(`/start?redirect=${encodeURIComponent(redirectTo)}`),
    );
  }

  async function resend() {
    // The guard is the reason this exists: without it a second press sent a
    // second code, and the second code invalidates the first — so the diligent
    // person who pressed twice was left holding two dead codes.
    if (cooldown > 0 || busy) return;
    setResending(true);
    setError(null);
    setInfo(null);
    const result = await sendOtp(email);
    setResending(false);
    if (!result.ok) {
      refuse(result.message);
      return;
    }
    setMode(result.mode);
    setSpent(false);
    setTtl(CODE_TTL_S);
    setCooldown(RESEND_COOLDOWN_S);
    // The old digits belong to a code that no longer works, so they go.
    setDigits(Array(OTP_LENGTH).fill(""));
    setInfo(`A new code is on its way to ${email}.`);
    later(RECOVERY_MS, () => boxes.current[0]?.focus());
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {mode === "offline" ? "Sign-in is offline" : "Check your email"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {/* Offline means the send never reached the API, so "We sent a code to
            you" would be false on the one screen asking somebody to go and read
            an email that was never posted. */}
        {mode === "offline" ? (
          <>
            We couldn&rsquo;t reach sign-in, so no code was sent to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </>
        ) : (
          <>
            We sent a {OTP_LENGTH}-digit code to{" "}
            <span className="font-semibold text-foreground">{email}</span>.{" "}
          </>
        )}
        {/* At 0:00 the countdown used to keep saying "expires in 0:00" while the
            Verify button still looked ready — so the screen let somebody press
            it and be refused by the server for something it already knew. */}
        {expired ? (
          <span className="font-semibold text-foreground">
            This code has expired — send yourself a new one below.
          </span>
        ) : mode === "live" ? (
          <>
            It expires in{" "}
            <span className="font-semibold text-foreground">{clock(ttl)}</span>.
          </>
        ) : null}
      </p>

      {/* The demo publishes its code (ADR-043, AC-17): a visitor has no inbox
          to read, and a demo that hides the one thing needed to get in is a
          demo that does not work. Shown only on a live send to the demo API,
          never on production or staging, and never in offline mode below. */}
      {demo && mode === "live" ? (
        <p
          className="mt-5 rounded-card border border-border bg-field p-4 text-sm text-muted-foreground"
          data-cy="otp-demo-code"
        >
          <Icon name="info" className="mr-1.5 inline h-4 w-4 align-[-3px]" />
          This is the Injishi demo, so every code is{" "}
          <span className="font-semibold tracking-wider text-foreground">
            {DEMO_OTP_CODE}
          </span>
          .
        </p>
      ) : null}

      <div
        className="mt-8 flex justify-between gap-2"
        role="group"
        aria-label="One-time code"
      >
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el: HTMLInputElement | null) => {
              boxes.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={OTP_LENGTH}
            value={d}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => write(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            // Clicking a box that already holds a digit selects it, so one
            // keystroke replaces it. Without this the browser puts the caret
            // after the digit and the pair reads as a paste.
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
            className="h-14 w-12 px-0 text-center text-xl font-bold"
          />
        ))}
      </div>

      {mode === "offline" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {OTP_MESSAGES.offlineNotice}
        </p>
      ) : null}

      {/* `pending` rather than `disabled` while checking: the button keeps its
          focus, refuses a second press itself, and says what it is doing. */}
      <Button
        type="button"
        variant="secondary"
        className="mt-6 w-full"
        disabled={!complete && phase === "idle"}
        pending={phase === "checking"}
        onClick={() => void submit()}
        data-cy="otp-verify"
      >
        {phase === "done" ? (
          <>
            <DoneMark />
            Signed in
          </>
        ) : phase === "checking" ? (
          "Checking your code…"
        ) : (
          "Verify and continue"
        )}
      </Button>

      {/* The button's own label change is not reliably announced, and "you are
          in" is the one thing a person waiting on a code needs to hear. */}
      <p role="status" className="sr-only">
        {phase === "done" ? "Signed in. Taking you through now." : ""}
      </p>

      {slowCheck ? (
        <InlineNote className="mt-3">
          Still checking — this can take a few seconds.
        </InlineNote>
      ) : null}
      {error ? (
        <InlineError key={attempt} className="mt-3">
          {error}
        </InlineError>
      ) : null}
      {info ? <InlineNote className="mt-3">{info}</InlineNote> : null}

      {/* An expired code makes Resend the only action that can work, so it stops
          being a link in the corner and becomes the button. */}
      {expired ? (
        <Button
          ref={resendButton}
          variant="secondary"
          className="mt-3 w-full"
          disabled={busy && !resending}
          pending={resending}
          onClick={() => void resend()}
          data-cy="otp-resend"
        >
          {resending ? "Sending your code…" : "Send me a new code"}
        </Button>
      ) : null}

      {slowSend ? (
        <InlineNote className="mt-3">
          Still sending — this can take a few seconds.
        </InlineNote>
      ) : null}

      <div className="mt-5 flex items-center justify-between text-sm">
        <Button asChild variant="ghost" size="sm">
          <a href="/sign-in">
            <Icon name="arrow-left" className="h-4 w-4" />
            Different email
          </a>
        </Button>
        {expired ? null : (
          <Button
            ref={resendButton}
            variant="link"
            size="sm"
            disabled={cooldown > 0 || (busy && !resending)}
            pending={resending}
            onClick={() => void resend()}
            data-cy="otp-resend"
          >
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </Button>
        )}
      </div>

      <p className="mt-6 rounded-card border border-border bg-field p-4 text-xs text-muted-foreground">
        <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Use the same email with Google later and it opens this same account.
      </p>
    </div>
  );
}
