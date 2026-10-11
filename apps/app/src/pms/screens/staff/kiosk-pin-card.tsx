"use client";

/**
 * A person's kiosk PIN, on their file (ADR-058, 058-time AC-TM11).
 *
 * Whether they have one and since when, and a way to set or reset it. The PIN
 * is typed here once and never shown again, by this screen or any other; a
 * reset also lifts every wrong PIN lock the person holds, and is audited.
 */

import { Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, SectionHeading } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { usePinState, useSetPin } from "../../data/time";
import { dshortIso, kigaliDateOf } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, inputClass } from "./staff-ui";

export function KioskPinCard({ employeeId, name }: { employeeId: string; name: string }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const state = usePinState(workspaceId, employeeId);
  const setPin = useSetPin(workspaceId);
  const [pin, setPinValue] = useState("");
  const has = state.data?.hasPin ?? false;
  const valid = /^\d{4,6}$/.test(pin);

  return (
    <section aria-label="Kiosk PIN" className="flex flex-col gap-2">
      <SectionHeading>Kiosk PIN</SectionHeading>
      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!valid) return;
          setPin.mutate(
            { employeeId, pin },
            {
              onSuccess: () => {
                toast(`PIN ${has ? "reset" : "set"} for ${name}. Tell them; it is not shown again.`, "ok");
                setPinValue("");
              },
            },
          );
        }}
      >
        <span className="w-full text-sm text-ink2">
          {state.isPending
            ? "Reading…"
            : has
              ? `${name} clocks in at a kiosk with a PIN set ${state.data?.setAt ? dshortIso(kigaliDateOf(state.data.setAt)) : "before"}.`
              : `${name} has no kiosk PIN yet.`}
        </span>
        <div className="w-48">
          <Field label={has ? "New PIN" : "PIN"} hint="4 to 6 digits." htmlFor="file-pin">
            <Input
              id="file-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </Field>
        </div>
        <ActionButton variant="primary" type="submit" pending={setPin.isPending} deniedReason={valid ? undefined : "4 to 6 digits"}>
          {has ? "Reset the PIN" : "Set the PIN"}
        </ActionButton>
        <div className="w-full">
          <FormError error={setPin.error} />
        </div>
      </form>
    </section>
  );
}
