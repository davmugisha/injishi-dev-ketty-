"use client";

import { Button, Form } from "@heroui/react";
import { useState, useTransition } from "react";
import { PasswordField } from "@/features/platform/auth/PasswordField";
import { createFirstPassword } from "@/lib/password-actions";

/**
 * Offered once, straight after a tenant accepts a lease invitation (2026-10-23): a password so the next
 * sign in skips the emailed code. Skipping keeps the code; a password can be set later from Account.
 */
export function CreatePasswordStep({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const r = await createFirstPassword({ password, confirm });
      if (!r.ok) setError(r.message);
      else onDone();
    });
  return (
    <Form
      className="flex flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Create a password</h2>
        <p className="text-sm text-muted">Next time, sign in with {email} and this password, no code needed.</p>
      </div>
      {/* For password managers: the account this password belongs to. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField label="Password" value={password} onChange={setPassword} isNew autoFocus />
      <PasswordField label="Type it again" value={confirm} onChange={setConfirm} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" isDisabled={pending} onPress={onDone}>
          Skip for now
        </Button>
        <Button type="submit" variant="primary" isPending={pending}>
          Save and continue
        </Button>
      </div>
    </Form>
  );
}
