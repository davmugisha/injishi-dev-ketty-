"use client";

import { ArrowLeft, CircleInfo } from "@gravity-ui/icons";
import { Alert, Button, Chip, Form, InputOTP, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { stock } from "@injishi/data/media";
import { LinkButton, Photo, TextLink } from "@injishi/ui";
import { useActionState, useEffect, useState, useTransition } from "react";
import { BrandMark, BrandPalm } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resendCode, type VerifyState, verifyCode } from "@/lib/auth-actions";

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [seconds]);
  return left;
}

/**
 * One-time-code step cloned from the legacy demo's /verify-otp page. On the demo stack the API accepts one
 * fixed code, which is filled in and named; in production `demoCode` is null and the field starts empty.
 */
export function VerifyView({
  email,
  next,
  expiresIn,
  demoCode,
  google,
}: {
  email: string;
  next: string;
  expiresIn: number;
  demoCode: string | null;
  /** Google sign-in works here, so the promise that it opens this same account can be made. */
  google: boolean;
}) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(verifyCode, {});
  const [code, setCode] = useState(demoCode ?? "");
  const expiry = useCountdown(expiresIn);
  const resend = useCountdown(30);
  const [resending, startResend] = useTransition();
  const [resendError, setResendError] = useState<string | null>(null);
  const signInHref = next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="relative hidden w-[52%] shrink-0 overflow-hidden lg:block" aria-label="About one-time codes">
        <Photo image={stock.otpHero} fill sizes="52vw" priority />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="flex items-center gap-2.5">
            <BrandMark size={34} className="brightness-0 invert" />
            <span className="text-xl font-semibold tracking-tight">Injishi</span>
          </span>
          <div className="flex max-w-[520px] flex-col gap-4">
            <Chip size="sm" className="self-start bg-black/40 text-white">
              No password needed
            </Chip>
            <h2 className="text-[40px] leading-[46px] font-semibold tracking-[-0.02em]">
              A code beats a password, every time.
            </h2>
            <p className="text-[17px] leading-7 text-white/85">
              Nothing to remember, nothing to reuse. Use the same email with Google later and it opens this same account
              — for the stays you book, the place you rent, and anything you host.
            </p>
          </div>
          <p className="text-[13px] text-white/75">Each code works for 10 minutes, and only for you.</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="flex w-full max-w-[400px] flex-col gap-5">
          <div className="flex items-center justify-between">
            <BrandPalm size={40} className="h-10 w-auto" />
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">Check your email</h1>
            <p className="text-[15px] leading-[22px] text-muted">
              We sent a 6-digit code to <strong className="font-semibold text-foreground">{email}</strong>. It expires
              in{" "}
              <strong className="font-semibold text-foreground tabular">
                {Math.floor(expiry / 60)}:{pad(expiry % 60)}
              </strong>
              .
            </p>
          </div>

          {demoCode ? (
            <Alert status="default">
              <Alert.Indicator>
                <CircleInfo />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Description>
                  This is the Injishi demo, so every code is{" "}
                  <strong className="font-semibold text-foreground">{demoCode}</strong>. We’ve filled it in for you.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Form action={formAction} className="flex flex-col gap-4" validationBehavior="aria">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="code" value={code} />
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              pattern={REGEXP_ONLY_DIGITS}
              isInvalid={!!state.error}
              aria-label="One-time code"
              autoFocus
              textAlign="center"
            >
              <InputOTP.Group className="flex w-full justify-between gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTP.Slot key={i} index={i} className="h-14 flex-1 text-xl font-semibold" />
                ))}
              </InputOTP.Group>
            </InputOTP>
            {state.error ? (
              <p role="alert" className="text-sm text-danger">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" fullWidth isPending={pending} isDisabled={code.length !== 6} className="rounded-full">
              Verify and continue
            </Button>
          </Form>

          <div className="flex items-center justify-between gap-3">
            <LinkButton href={signInHref} variant="ghost" size="sm" className="px-2">
              <ArrowLeft className="size-4" />
              Different email
            </LinkButton>
            {resend > 0 ? (
              <span className="text-[13px] text-muted tabular">Resend in {resend}s</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                isPending={resending}
                onPress={() =>
                  startResend(async () => {
                    setResendError(null);
                    // On success the action moves to a fresh code step, so only a failure comes back.
                    const result = await resendCode(next);
                    if (result.error) setResendError(result.error);
                  })
                }
              >
                Resend code
              </Button>
            )}
          </div>
          {resendError ? (
            <p role="alert" className="text-sm text-danger">
              {resendError}
            </p>
          ) : null}

          {google ? (
            <Alert status="default" className="bg-transparent ring-1 ring-border">
              <Alert.Indicator>
                <CircleInfo />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Description className="text-xs">
                  Use the same email with Google later and it opens this same account.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <p className="text-center text-xs text-muted">
            Not you?{" "}
            <TextLink href={signInHref}>{demoCode ? "Choose another person" : "Use a different email"}</TextLink>
          </p>
        </div>
      </main>
    </div>
  );
}
