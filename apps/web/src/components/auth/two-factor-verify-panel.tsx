"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Input } from "@injishi/web-ui";
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
import { apiFetch, apiResultMessage } from "@/lib/api";
import { DEMO_OTP_CODE, OTP_MESSAGES } from "@/lib/otp";

/**
 * The emailed step-up code (F-S02).
 *
 * A code is requested as soon as this screen opens, so the person is not made
 * to press "send" before anything can happen. Resending is on a cooldown the
 * server enforces as well, and the countdown here only mirrors it.
 *
 * THE SCREEN MUST NOT CLAIM A CODE IT HAS NOT SENT. It used to open with "We
 * sent a 6-digit code to your email" written before the request had left, and
 * it kept saying it when the send failed — so somebody sat waiting for a mail
 * nobody had posted. The header now reports the send: sending, sent, or failed.
 */

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

function clock(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function TwoFactorVerifyPanel({
  redirectTo,
  demo,
}: {
  redirectTo: string;
  /** The API says this is the demo (`GET /api/v1/platform`), so the code is fixed. */
  demo: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  /** Starts true: a code is on its way before anybody can read this screen. */
  const [sending, setSending] = useState(true);
  const [ttl, setTtl] = useState(0);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const later = useLater();

  const code = digits.join("");
  const complete = code.length === CODE_LENGTH;
  const busy = phase !== "idle" || sending;
  const expired = sentTo !== null && ttl <= 0;
  const slowCheck = useSlow(phase === "checking");
  const slowSend = useSlow(sending);

  const send = useCallback(
    async (announce: boolean) => {
      setSending(true);
      setError(null);
      setInfo(null);
      const res = await apiFetch<{ sentTo: string; expiresInSeconds: number }>(
        "/api/v1/me/two-factor/send",
        { method: "POST", body: {} },
      );
      if (res.status === "unauthenticated") {
        window.location.replace(
          `/sign-in?redirect=${encodeURIComponent(`/two-factor/verify?redirect=${encodeURIComponent(redirectTo)}`)}`,
        );
        return;
      }
      setSending(false);
      if (res.status !== "ok") {
        // `failed` is a timeout or an unreachable API — ours to own, never "check
        // your connection". A refusal carries the API's own human sentence.
        setError(res.status === "failed" ? OTP_MESSAGES.sendFailed : apiResultMessage(res));
        setAttempt((n) => n + 1);
        // A failed send must leave Resend pressable. Holding it shut for the
        // cooldown of a code that was never sent strands the person completely.
        setCooldown(0);
        return;
      }
      setSentTo(res.data.sentTo);
      setTtl(res.data.expiresInSeconds);
      setCooldown(RESEND_COOLDOWN_S);
      if (announce) {
        setDigits(Array(CODE_LENGTH).fill(""));
        setInfo(`A new code is on its way to ${res.data.sentTo}.`);
        later(RECOVERY_MS, () => boxes.current[0]?.focus());
      }
    },
    [later, redirectTo],
  );

  // One code on arrival. The ref guard is what stops React's development
  // double-effect asking for two codes, the second of which would invalidate
  // the first before the person had read either.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void send(false);
    boxes.current[0]?.focus();
  }, [send]);

  useEffect(() => {
    if (ttl <= 0) return;
    const t = setInterval(() => setTtl((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ttl]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function write(index: number, raw: string) {
    const only = raw.replace(/\D/g, "");
    setError(null);
    setInfo(null);
    if (only.length > 1) {
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < only.length && index + i < CODE_LENGTH; i++) {
          next[index + i] = only[i]!;
        }
        return next;
      });
      boxes.current[Math.min(index + only.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = only.slice(-1);
      return next;
    });
    if (only && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
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
    const res = await apiFetch<{ verified: true }>("/api/v1/me/two-factor/verify", {
      method: "POST",
      body: { code },
    });
    if (res.status === "unauthenticated") {
      window.location.replace(
        `/sign-in?redirect=${encodeURIComponent(`/two-factor/verify?redirect=${encodeURIComponent(redirectTo)}`)}`,
      );
      return;
    }
    if (res.status !== "ok") {
      setPhase("idle");
      // THE DIGITS STAY. This screen used to wipe all six over one wrong key,
      // which sends somebody back to their inbox to re-read a code they had
      // already read — the OTP screen next door has always kept them.
      setError(
        res.status === "failed" ? OTP_MESSAGES.verifyUnreachable : apiResultMessage(res),
      );
      setAttempt((n) => n + 1);
      if (res.status !== "failed") {
        later(RECOVERY_MS, () => {
          boxes.current[0]?.focus();
          boxes.current[0]?.select();
        });
      }
      return;
    }
    setPhase("done");
    later(ACKNOWLEDGE_MS, () => window.location.assign(redirectTo));
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Confirm it&rsquo;s you
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {sentTo === null ? (
          sending ? (
            <>Your account needs one more check. Sending a {CODE_LENGTH}-digit code to your email…</>
          ) : (
            <>
              Your account needs one more check, and we couldn&rsquo;t send your
              code. Try again below.
            </>
          )
        ) : (
          <>
            Your account needs one more check. We sent a {CODE_LENGTH}-digit code
            to <span className="font-semibold text-foreground">{sentTo}</span>.{" "}
            {expired ? (
              <span className="font-semibold text-foreground">
                This code has expired — ask for a new one below.
              </span>
            ) : (
              <>
                It expires in{" "}
                <span className="font-semibold text-foreground">{clock(ttl)}</span>.
              </>
            )}
          </>
        )}
      </p>

      {/* The demo's step-up code is the published one too (ADR-043, AC-17).
          Never shown on production or staging. */}
      {demo ? (
        <p
          className="mt-5 rounded-card border border-border bg-field p-4 text-sm text-muted-foreground"
          data-cy="two-factor-demo-code"
        >
          <Icon name="info" className="mr-1.5 inline h-4 w-4 align-[-3px]" />
          This is the Injishi demo, so every code is{" "}
          <span className="font-semibold tracking-wider text-foreground">
            {DEMO_OTP_CODE}
          </span>
          .
        </p>
      ) : null}

      <div className="mt-8 flex justify-between gap-2" role="group" aria-label="Step-up code">
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el: HTMLInputElement | null) => {
              boxes.current[i] = el;
            }}
            value={d}
            onChange={(e) => write(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CODE_LENGTH}
            aria-label={`Digit ${i + 1}`}
            className="h-12 w-full text-center text-lg font-semibold"
            data-cy={`two-factor-digit-${i}`}
          />
        ))}
      </div>

      <Button
        variant="secondary"
        className="mt-6 w-full"
        onClick={() => void submit()}
        disabled={!complete && phase === "idle"}
        pending={phase === "checking"}
        data-cy="two-factor-verify"
      >
        {phase === "done" ? (
          <>
            <DoneMark />
            Confirmed
          </>
        ) : phase === "checking" ? (
          "Checking your code…"
        ) : (
          "Verify and continue"
        )}
      </Button>

      <p role="status" className="sr-only">
        {phase === "done" ? "Confirmed. Taking you through now." : ""}
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
      {slowSend ? (
        <InlineNote className="mt-3">
          Still sending — this can take a few seconds.
        </InlineNote>
      ) : null}

      <div className="mt-6 flex justify-center">
        {/* `pending` while sending, so a second press cannot post a second code
            — and the second code would invalidate the first. */}
        <Button
          variant={expired || sentTo === null ? "secondary" : "ghost"}
          disabled={cooldown > 0 || (busy && !sending)}
          pending={sending}
          onClick={() => void send(true)}
          data-cy="two-factor-resend"
        >
          {sending
            ? "Sending your code…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : sentTo === null
                ? "Send my code"
                : "Resend code"}
        </Button>
      </div>
    </div>
  );
}
