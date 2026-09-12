"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { DemoPersona } from "@injishi/contracts";
import { Button, Input } from "@injishi/ui";

import DemoPersonaPicker from "@/components/auth/demo-persona-picker";
import {
  InlineError,
  InlineNote,
  RECOVERY_MS,
  useSlow,
} from "@/components/auth/auth-feedback";
import type { SendCodeState } from "@/lib/otp.server";

/**
 * The email half of /sign-in (ADR-017, AC-3 and AC-4).
 *
 * The action is BOUND ON THE SERVER and handed down as a prop. It already
 * carries the resolved redirect target, so this component never sees the raw
 * `?redirect=` value and cannot weaken the allowlist by accident.
 *
 * WHY THIS IS A CLIENT COMPONENT AND THE FORM STILL WORKS WITHOUT JAVASCRIPT.
 * `useActionState` only adds the pending state and the error line. React
 * renders the form on the server either way, and a Server Action posts on its
 * own, so with scripting off the Continue button still sends a code. That is
 * the whole point: the capture this replaced rendered its button `disabled`
 * and enabled it from a DOM script, so the button was dead until the bundle
 * arrived. Nothing here may reintroduce a disabled attribute that only
 * JavaScript can clear.
 *
 * The field is re-filled from the returned state so a refused address is not
 * lost. Losing what somebody typed is the failure this replaces, not a detail.
 * It is controlled so the demo's persona picker can fill it (ADR-043, AC-18);
 * it still posts by `name`, so a scriptless submit is unchanged.
 */
export default function SignInForm({
  action,
  demo,
}: {
  action: (state: SendCodeState, formData: FormData) => Promise<SendCodeState>;
  /** Present only when `GET /api/v1/platform` said demo. */
  demo?: { personas: DemoPersona[]; seededAt: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [email, setEmail] = useState(state.email ?? "");
  const field = useRef<HTMLInputElement>(null);

  /**
   * A cold send costs seconds, not milliseconds — 17.7 s measured, and the
   * ceiling allows 30 (`AUTH_TIMEOUT_MS`). Nothing about a button that says
   * "Sending your code…" tells somebody whether four seconds is normal, so
   * after six the screen says so rather than letting them guess it is broken.
   */
  const slow = useSlow(pending);

  /**
   * Hand the caret back only when the ADDRESS was the problem. When the fault
   * was ours the next move is to press again, and pulling focus off the button
   * somebody is about to press a second time is the wrong kind of help.
   */
  useEffect(() => {
    if (!state.fixEmail) return;
    const timer = setTimeout(() => {
      field.current?.focus();
      field.current?.select();
    }, RECOVERY_MS);
    return () => clearTimeout(timer);
  }, [state.attempt, state.fixEmail]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-1">
        <Input
          ref={field}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          aria-label="Email address"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "sign-in-error" : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-cy="email-input"
        />
      </div>

      {/* `pending`, never `disabled`: the button keeps its focus and its label,
          refuses a second press itself, and wears the shimmer. A `disabled`
          here would also be the capture's bug in a new coat — with scripting
          off `pending` is false, so the form still posts. */}
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        pending={pending}
        data-cy="continue-button"
      >
        {pending ? "Sending your code…" : "Continue"}
      </Button>

      {slow ? (
        <InlineNote>
          Still sending — this can take a few seconds the first time.
        </InlineNote>
      ) : null}

      {state.error ? (
        <InlineError key={state.attempt} id="sign-in-error">
          {state.error}
        </InlineError>
      ) : null}

      {demo ? (
        <DemoPersonaPicker
          personas={demo.personas}
          seededAt={demo.seededAt}
          selected={email}
          onPick={setEmail}
        />
      ) : null}
    </form>
  );
}
