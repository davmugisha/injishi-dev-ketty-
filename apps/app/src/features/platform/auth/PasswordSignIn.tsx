"use client";

import { Alert, Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { CodeInput, Icon } from "@injishi/ui";
import { useActionState, useState, useTransition } from "react";
import { type PasswordSignInState, resetForgotPassword, sendForgotCode, signInPassword } from "@/lib/password-actions";
import { PasswordField } from "./PasswordField";

/**
 * Sign in with a password (tenants only, 2026-10-23). Offered as a quiet link for every address, and
 * every answer reads the same whether or not the address has a password, so it reveals nothing.
 */
export function PasswordSignInForm({
  next,
  email,
  onEmailChange,
  onForgot,
  onUseCode,
  notice,
}: {
  next: string;
  email: string;
  onEmailChange: (email: string) => void;
  onForgot: () => void;
  onUseCode: () => void;
  /** Shown above the form, e.g. "Password saved" after a reset. */
  notice?: string | null;
}) {
  const [state, formAction, pending] = useActionState<PasswordSignInState, FormData>(signInPassword, {});
  return (
    <div className="flex w-full flex-col gap-3">
      {notice ? (
        <Alert status="success">
          <Alert.Indicator>
            <Icon name="CircleCheck" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title className="text-sm">{notice}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <Form action={formAction} className="flex w-full flex-col gap-3" validationBehavior="aria">
        <input type="hidden" name="next" value={next} />
        <TextField name="email" type="email" value={email} onChange={onEmailChange} fullWidth autoComplete="email">
          <Label className="sr-only">Email</Label>
          <Input placeholder="Enter your email" className="rounded-xl" />
        </TextField>
        <PasswordField label="Password" name="password" hideLabel autoFocus={!!email} error={state.error} />
        <Button type="submit" fullWidth isPending={pending} className="rounded-full">
          Sign in
        </Button>
      </Form>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="text-sm" onPress={onUseCode}>
          Use an email code
        </Button>
        <Button variant="ghost" size="sm" className="text-sm" onPress={onForgot}>
          Forgot password?
        </Button>
      </div>
    </div>
  );
}

/**
 * Forgot password: an emailed code, then the new password typed twice. The send says the same for every
 * address; a code only ever reaches somebody who may hold a password.
 */
export function ForgotPasswordForm({
  email: initialEmail,
  onDone,
  onBack,
}: {
  email: string;
  onDone: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError(null);
      const r = await sendForgotCode(email);
      if (!r.ok) setError(r.message);
      else setStep("code");
    });
  const save = () =>
    start(async () => {
      setError(null);
      const r = await resetForgotPassword({ email, code, password, confirm });
      if (!r.ok) setError(r.message);
      else onDone(email);
    });

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Reset your password</h2>
        <p className="text-sm text-muted">
          {step === "email"
            ? "We email you a code to set a new one."
            : `If ${email.trim()} has a password, a code is on its way.`}
        </p>
      </div>
      {step === "email" ? (
        <Form
          className="flex flex-col gap-3"
          validationBehavior="aria"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <TextField type="email" value={email} onChange={setEmail} isInvalid={!!error} fullWidth autoComplete="email">
            <Label className="sr-only">Email</Label>
            <Input placeholder="Enter your email" className="rounded-xl" autoFocus />
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
          <Button type="submit" fullWidth isPending={pending} className="rounded-full">
            Send a code
          </Button>
        </Form>
      ) : (
        <Form
          className="flex flex-col gap-3"
          validationBehavior="aria"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <CodeInput value={code} onChange={setCode} autoFocus />
          <PasswordField label="New password" value={password} onChange={setPassword} isNew />
          <PasswordField label="Type it again" value={confirm} onChange={setConfirm} />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" fullWidth isPending={pending} className="rounded-full">
            Save password
          </Button>
          <Button variant="ghost" size="sm" className="self-center text-sm" isDisabled={pending} onPress={send}>
            Send a new code
          </Button>
        </Form>
      )}
      <Button variant="ghost" size="sm" className="self-start text-sm" onPress={onBack}>
        <Icon name="ArrowLeft" />
        Back to sign in
      </Button>
    </div>
  );
}
