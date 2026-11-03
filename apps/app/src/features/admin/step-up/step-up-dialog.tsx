"use client";

import { Description, Input, Label, TextField } from "@heroui/react";
import { FormDialog } from "@injishi/ui";
import { type ReactNode, useCallback, useRef, useState, useTransition } from "react";
import { confirmStepUpCode, sendStepUpCode } from "./actions";

/** What a write answers: the step-up flag is the only thing this hook reads. */
type Guarded = { ok: boolean; stepUp?: true };

/**
 * Grants ask for a recent emailed code (2026-11-02). `guard(write)` runs the write; when the API answers
 * that the step-up is too old, it asks for a new code in a dialog, checks it, and runs the write again.
 * Render `dialog` once in the component that uses the hook.
 */
export function useStepUp(): {
  guard: <R extends Guarded>(write: () => Promise<R>, done: (result: R) => void) => void;
  dialog: ReactNode;
  pending: boolean;
} {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const retry = useRef<(() => void) | null>(null);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await sendStepUpCode();
      if (result.ok) setSentTo(result.value.sentTo);
      else setError(result.error);
    });

  const guard = useCallback(<R extends Guarded>(write: () => Promise<R>, done: (result: R) => void) => {
    start(async () => {
      const result = await write();
      if (!result.ok && result.stepUp) {
        retry.current = () =>
          start(async () => {
            done(await write());
          });
        setCode("");
        setError(null);
        setSentTo(null);
        setOpen(true);
        const sent = await sendStepUpCode();
        if (sent.ok) setSentTo(sent.value.sentTo);
        else setError(sent.error);
        return;
      }
      done(result);
    });
  }, []);

  const confirm = () =>
    start(async () => {
      setError(null);
      const result = await confirmStepUpCode(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      retry.current?.();
      retry.current = null;
    });

  const dialog = (
    <FormDialog
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) retry.current = null;
      }}
      title="Confirm it is you"
      description={
        sentTo
          ? `Giving authority needs a fresh code. We emailed one to ${sentTo}.`
          : "Giving authority needs a fresh code."
      }
      submitLabel="Confirm"
      isPending={pending}
      formError={error ?? undefined}
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <TextField value={code} onChange={setCode} autoFocus className="flex flex-col gap-1">
        <Label>Code</Label>
        <Input
          placeholder="6-digit code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={7}
          className="tracking-[0.2em]"
        />
        <Description>
          No email?{" "}
          <button type="button" className="text-accent underline" onClick={send} disabled={pending}>
            Send a new code
          </button>
        </Description>
      </TextField>
    </FormDialog>
  );

  return { guard, dialog, pending };
}
