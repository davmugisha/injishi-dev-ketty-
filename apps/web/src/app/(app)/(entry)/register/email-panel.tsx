"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@injishi/web-ui";

import GoogleButton from "@/components/auth/google-button";
import { useSlow } from "@/components/auth/auth-feedback";
import {
  DEMO_OTP_CODE,
  OTP_LENGTH,
  OTP_MESSAGES,
  isValidEmail,
  needsNewCode,
  sanitizeOtp,
  sendOtp,
  verifyOtp,
  type OtpMode,
} from "@/lib/otp";

import { StepCard } from "./register-shell";
import { Field, TextInput } from "./wizard-ui";

/** How long before Resend re-arms, the same as the verify screen (F-S01). */
const RESEND_COOLDOWN_S = 30;

/**
 * "Start with your email": the one sign-in, shown in place as the first panel
 * of `/register` (ADR-069 D-g, the RegisterIA board).
 *
 * IT IS NOT A SECOND SIGN-IN. Google is `/sign-in`'s own `GoogleButton`; the
 * code is sent and checked only through `lib/otp.ts`, the browser transport the
 * verify screen uses, so the code is the same hashed, capped, one-instance
 * code. The demo's persona picker is NOT mounted here: its one-press sign in
 * goes on through `/start` to the persona's home, away from this registration,
 * so the demo is told its published code instead. The one thing
 * that differs is where the person stands afterwards: on `/register`, carried
 * straight on to the registration's first step, Business, with no `?redirect=`
 * and no `/start` in between.
 * The gate re-reads the session (`lib/session.ts`) and only a real session
 * moves the page on; a code this panel accepted proves nothing by itself.
 */
export function EmailPanel({
  demo,
  googleReturn,
  fallbackHref,
  onSignedIn,
}: {
  /** `GET /api/v1/platform` said demo; null while it has not answered. */
  demo: boolean | null;
  /** This page, path and query, for Google to bring the person back to. */
  googleReturn: string | null;
  /** The sign-in page with this page as its return, for when no session sticks. */
  fallbackHref: string;
  /** Re-read the session. True when a real one now exists. */
  onSignedIn: () => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<OtpMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const slowSend = useSlow(sending);
  const slowCheck = useSlow(checking);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function refuse(message: string) {
    setError(message);
    setAttempt((n) => n + 1);
  }

  async function send(resend = false) {
    setError(null);
    setInfo(null);
    const address = email.trim();
    if (!isValidEmail(address)) {
      refuse(address ? OTP_MESSAGES.emailInvalid : "Enter your email address, like you@yourhotel.rw.");
      emailField.current?.focus();
      return;
    }
    setSending(true);
    const result = await sendOtp(address);
    setSending(false);
    if (!result.ok) {
      refuse(result.message);
      return;
    }
    setSent(result.mode);
    setCooldown(RESEND_COOLDOWN_S);
    // The demo publishes its code (ADR-043, AC-17), so it is filled in for a
    // live send to the demo API, exactly as the verify screen does.
    setCode(demo && result.mode === "live" ? DEMO_OTP_CODE : "");
    if (resend) setInfo(`A new code is on its way to ${address}.`);
    window.setTimeout(() => codeField.current?.focus(), 50);
  }

  async function verify() {
    if (sent === null || checking) return;
    setError(null);
    setInfo(null);
    const otp = sanitizeOtp(code);
    if (otp.length !== OTP_LENGTH) {
      refuse(`Enter the ${OTP_LENGTH} digits from the email.`);
      return;
    }
    setChecking(true);
    const result = await verifyOtp(email, otp, sent);
    if (!result.ok) {
      setChecking(false);
      refuse(result.message);
      if (needsNewCode(result.reason)) setCooldown(0);
      return;
    }
    if (result.mode === "offline") {
      // A practice run: no session exists, so nothing past this panel can work.
      setChecking(false);
      refuse(OTP_MESSAGES.offlineNotice);
      return;
    }
    const signedIn = await onSignedIn();
    setChecking(false);
    if (!signedIn) setNoSession(true);
  }

  function differentEmail() {
    setSent(null);
    setCode("");
    setError(null);
    setInfo(null);
    setNoSession(false);
    window.setTimeout(() => emailField.current?.focus(), 50);
  }

  return (
    <StepCard
      id="register-email"
      title="Start with your email"
      lead="We send a 6-digit code. There is no password, and your answers save as you go."
    >
      {sent === null ? (
        <>
          {/* Not on the demo: it has no Google client of its own, so the
              button could only end in "couldn't start" (the sign-in screen
              leaves it out for the same reason). */}
          {demo !== false || googleReturn === null ? null : (
            <>
              <GoogleButton redirectTo={googleReturn} />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Field label="Email" error={error ?? undefined}>
              <TextInput
                ref={emailField}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@yourhotel.rw"
                className="w-full"
                aria-invalid={error ? true : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            <div>
              <Button type="submit" pending={sending}>
                {sending ? "Sending your code…" : "Send code"}
              </Button>
            </div>
            {slowSend ? <Note>Still sending. The first code can take a few seconds.</Note> : null}
          </form>
          {demo ? (
            <Note>
              This is the Injishi demo, so every code is {DEMO_OTP_CODE}. A demo persona&apos;s email signs in as them.
            </Note>
          ) : null}
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <Field
            label="6-digit code"
            hint={
              <>
                {sent === "offline" ? "Sign-in is offline, so no code was sent to " : "Sent to "}
                <b className="text-foreground">{email.trim()}</b>.{" "}
                <button
                  type="button"
                  onClick={differentEmail}
                  className="rounded font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Use a different email
                </button>
              </>
            }
            error={error ?? undefined}
          >
            <TextInput
              ref={codeField}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="000000"
              className="w-full max-w-tile text-lg tracking-widest tabular-nums"
              aria-invalid={error ? true : undefined}
              value={code}
              onChange={(e) => {
                setCode(sanitizeOtp(e.target.value).slice(0, OTP_LENGTH));
                setError(null);
              }}
            />
          </Field>
          {demo && sent === "live" ? (
            <Note>
              This is the Injishi demo, so every code is {DEMO_OTP_CODE}. It is filled in for you.
            </Note>
          ) : null}
          {sent === "offline" ? <Note>{OTP_MESSAGES.offlineNotice}</Note> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" pending={checking}>
              {checking ? "Checking your code…" : "Verify and continue"}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={cooldown > 0 || sending || checking}
              pending={sending}
              onClick={() => void send(true)}
            >
              {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
            </Button>
          </div>
          {slowCheck ? <Note>Still checking. This can take a few seconds.</Note> : null}
          {info ? <Note>{info}</Note> : null}
          {noSession ? (
            <Note tone="danger" key={attempt}>
              Your code was accepted, but this browser did not keep you signed in here.{" "}
              <a href={fallbackHref} className="font-semibold underline underline-offset-2">
                Sign in on the sign-in page
              </a>{" "}
              and you come straight back to this registration.
            </Note>
          ) : null}
        </form>
      )}
    </StepCard>
  );
}

/** One line under the fields: news, or (in danger) a refusal with a way on. */
function Note({ tone, children }: { tone?: "danger"; children: ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={tone === "danger" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}
    >
      {children}
    </p>
  );
}
