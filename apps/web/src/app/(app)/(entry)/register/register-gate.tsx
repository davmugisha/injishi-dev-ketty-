"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@heroui/react";

import {
  InlineError,
  InlineNote,
  RECOVERY_MS,
  useLater,
  useSlow,
} from "@/components/auth/auth-feedback";
import {
  isValidEmail,
  needsNewCode,
  OTP_LENGTH,
  OTP_MESSAGES,
  sanitizeOtp,
  sendOtp,
  verifyOtp,
  type OtpMode,
} from "@/lib/otp";
import { sessionDisplayName, useSessionUser } from "@/lib/session";

/**
 * Identity gate for the business-registration wizard (FL01).
 *
 * Registering a business creates an org and makes the registrant its owner —
 * the grant every later permission check resolves against (Spec 0004). The
 * prototype wizard shipped with no identity at all: any visitor could walk all
 * three steps, and the "Email" field on step 1 was a free-text box defaulted to
 * a fixture address, so the application carried whatever was typed rather than
 * who was applying. This is the front door.
 *
 * WHY CLIENT-SIDE. The Better Auth session cookie belongs to the API origin
 * (:8000), so the browser never sends it to the Next server (:3000) — a Server
 * Component cannot read it, and a server-side redirect is not available in this
 * cross-origin split. The gate therefore resolves the session in the browser,
 * exactly as the booking flow's step 1 does.
 *
 * It is an affordance, not the control. Every write the wizard makes is guarded
 * by `SessionGuard` on the API, and the registration routes check membership on
 * top of that. This gate exists so a person is not walked through three steps
 * before being told they are not signed in.
 *
 * WHAT CHANGED. This used to also mount `injishi-register.js` and write the
 * account email into that script's own field by hand. Both are gone: the wizard
 * is React now, it reads the identity from the session rather than from a form
 * field, and every answer it collects goes to the API.
 */
export default function RegisterGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSessionUser();

  if (session.status === "loading") {
    return (
      <p className="mx-auto max-w-wide px-4 py-16 text-sm text-muted-foreground sm:px-6">
        Checking your account…
      </p>
    );
  }

  /**
   * Unreachable is NOT signed out (lib/session.ts).
   *
   * The prototype let this branch through and ran offline, because it posted
   * nowhere. The real wizard cannot: every step needs the API, so continuing
   * would show a form that is guaranteed to fail on submit. Saying so is the
   * honest answer.
   */
  if (session.status === "unreachable") {
    return (
      <div className="mx-auto max-w-form px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          We can&apos;t reach Injishi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Registering a business needs a live connection — we check your TIN with
          RRA and send your application to a government officer. Check your
          connection and try again.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onPress={() => void session.refresh()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (session.status === "anonymous") {
    return <SignInPanel onSignedIn={() => void session.refresh()} />;
  }

  return (
    <>
      <div className="mx-auto max-w-wide px-4 pt-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Registering as{" "}
          <b className="text-foreground">{sessionDisplayName(session.user)}</b>
          {session.user?.email ? ` · ${session.user.email}` : ""}.
        </p>
      </div>
      {children}
    </>
  );
}

/** The same email one-time-code sign-in the booking flow uses (lib/otp.ts). */
function SignInPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<OtpMode>("live");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState("");
  const codeField = useRef<HTMLInputElement>(null);
  const later = useLater();
  // A cold send has measured 17.7 s. Six seconds of nothing is where a person
  // decides it is broken, so the screen speaks before they do.
  const slow = useSlow(busy || sending);

  const refuse = (message: string) => {
    setErr(message);
    setAttempt((n) => n + 1);
  };

  const send = async (again = false) => {
    if (!isValidEmail(email)) return;
    setSending(true);
    setErr("");
    setNote("");
    const res = await sendOtp(email);
    setSending(false);
    if (!res.ok) {
      refuse(res.message);
      return;
    }
    setMode(res.mode);
    setPhase("otp");
    if (again) {
      setOtp("");
      setNote(`A new code is on its way to ${email}.`);
      later(RECOVERY_MS, () => codeField.current?.focus());
    }
  };

  const verify = async () => {
    setBusy(true);
    setErr("");
    setNote("");
    const res = await verifyOtp(email, otp, mode);
    setBusy(false);
    if (!res.ok) {
      // The digits stay: one wrong key should not cost the whole code.
      refuse(res.message);
      if (!needsNewCode(res.reason) && res.reason !== "system") {
        later(RECOVERY_MS, () => {
          codeField.current?.focus();
          codeField.current?.select();
        });
      }
      return;
    }
    onSignedIn();
  };

  return (
    <div className="mx-auto max-w-form px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        First, sign in to Injishi
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A business belongs to the person who registers it, so we need to know who
        that is before you start. One identity across Injishi — no password.
      </p>

      {phase === "email" ? (
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold">Email</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="mt-1.5 w-full"
              placeholder="you@example.rw"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
            />
          </label>
          {err ? <InlineError key={attempt}>{err}</InlineError> : null}
          <Button
            variant="primary"
            fullWidth
            isDisabled={!isValidEmail(email)}
            isPending={sending}
            onPress={() => void send()}
          >
            {sending ? "Sending your code…" : "Send me a code"}
          </Button>
          {slow ? (
            <InlineNote>
              Still sending — this can take a few seconds the first time.
            </InlineNote>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold">
              Enter the {OTP_LENGTH}-digit code
            </span>
            <Input
              ref={codeField}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              className="money mt-1.5 w-full tracking-[0.4em]"
              value={otp}
              onChange={(e) => setOtp(sanitizeOtp(e.target.value))}
              onKeyDown={(e) =>
                e.key === "Enter" && otp.length === OTP_LENGTH && void verify()
              }
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Sent to {email}.
            {mode === "offline" ? (
              <span className="font-semibold text-warning">
                {" "}
                {OTP_MESSAGES.offlineNotice}
              </span>
            ) : null}
          </p>
          {err ? <InlineError key={attempt}>{err}</InlineError> : null}
          {note ? <InlineNote>{note}</InlineNote> : null}
          <Button
            variant="primary"
            fullWidth
            isDisabled={otp.length !== OTP_LENGTH}
            isPending={busy}
            onPress={() => void verify()}
          >
            {busy ? "Checking your code…" : "Verify & continue"}
          </Button>
          {slow ? (
            <InlineNote>Still working — this can take a few seconds.</InlineNote>
          ) : null}
          {/* Without this the only way out of an expired code was to go back and
              retype the address — on the screen whose whole job is letting
              somebody in. */}
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            isPending={sending}
            onPress={() => void send(true)}
          >
            {sending ? "Sending your code…" : "Send me a new code"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onPress={() => setPhase("email")}
          >
            Use a different email
          </Button>
        </div>
      )}
    </div>
  );
}
