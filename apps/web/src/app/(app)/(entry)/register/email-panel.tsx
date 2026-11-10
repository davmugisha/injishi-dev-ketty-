"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

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
  position = null,
}: {
  /**
   * Where the panel stands in the form: the start of its first step, 1 of 5.
   * Drawn as the phone's "Step 1 of 5 · Business" over its thin bar, as `StepFrame` does; from
   * a tablet up the shell's rail says it. Null when there are no steps (a broker).
   */
  position?: { n: number; of: number; title: string } | null;
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
  const tr = useTranslations("register");
  const tc = useTranslations("common");

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
      refuse(address ? tr("email.emailInvalid") : tr("email.enterEmail"));
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
    if (resend) setInfo(tr("email.newCodeOnWay", { email: address }));
    window.setTimeout(() => codeField.current?.focus(), 50);
  }

  async function verify() {
    if (sent === null || checking) return;
    setError(null);
    setInfo(null);
    const otp = sanitizeOtp(code);
    if (otp.length !== OTP_LENGTH) {
      refuse(tr("email.enterDigits", { length: OTP_LENGTH }));
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
      level={position ? "h2" : "h1"}
      chip={
        position ? (
          <span className="flex w-full flex-col gap-1.5 md:hidden">
            <span className="text-sm font-semibold">
              {tc("stepOf", { n: position.n, of: position.of, title: position.title })}
            </span>
            <span aria-hidden className="grid gap-1" style={{ gridTemplateColumns: `repeat(${position.of}, minmax(0, 1fr))` }}>
              {Array.from({ length: position.of }, (_, i) => (
                <span key={i} className={cn("h-1 rounded-full", i < position.n ? "bg-accent-brand" : "bg-secondary")} />
              ))}
            </span>
          </span>
        ) : undefined
      }
      title={position ? tr("email.title") : tr("email.titleStandalone")}
      lead={tr("email.lead")}
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
                {tc("or")}
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
            <Field label={tr("email.label")} error={error ?? undefined}>
              <TextInput
                ref={emailField}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={tr("email.placeholder")}
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
                {sending ? tr("email.sending") : tr("email.send")}
              </Button>
            </div>
            {slowSend ? <Note>{tr("email.stillSending")}</Note> : null}
          </form>
          {demo ? (
            <Note>
              {tr("email.demoNote", { code: DEMO_OTP_CODE })}
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
            label={tr("email.codeLabel")}
            hint={
              <>
                {tr.rich(sent === "offline" ? "email.offlineSentTo" : "email.sentTo", {
                  email: email.trim(),
                  b: (chunks) => <b className="text-foreground">{chunks}</b>,
                })}{" "}
                <button
                  type="button"
                  onClick={differentEmail}
                  className="rounded font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tr("email.useDifferent")}
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
              {tr("email.demoFilled", { code: DEMO_OTP_CODE })}
            </Note>
          ) : null}
          {sent === "offline" ? <Note>{OTP_MESSAGES.offlineNotice}</Note> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" pending={checking}>
              {checking ? tr("email.verifying") : tr("email.verify")}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={cooldown > 0 || sending || checking}
              pending={sending}
              onClick={() => void send(true)}
            >
              {cooldown > 0 ? tr("email.resendIn", { seconds: cooldown }) : tr("email.resend")}
            </Button>
          </div>
          {slowCheck ? <Note>{tr("email.stillChecking")}</Note> : null}
          {info ? <Note>{info}</Note> : null}
          {noSession ? (
            <Note tone="danger" key={attempt}>
              {tr.rich("email.noSession", {
                signin: (chunks) => (
                  <a href={fallbackHref} className="font-semibold underline underline-offset-2">
                    {chunks}
                  </a>
                ),
              })}
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
