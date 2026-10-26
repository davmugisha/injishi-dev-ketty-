"use client";

import { Info } from "lucide-react";

import { iconFor } from "./kind-summary";
import { Callout } from "./register-shell";
import { REGISTRATION_KINDS, type RegistrationKind } from "./registration-kinds";
import { Field, TextInput, TileCard } from "./wizard-ui";

/**
 * Step 1, Business type (Register.dc.html): eleven tiles in three groups, the
 * artboard's. What is pressed decides the steps, the documents asked for and
 * the fee (`registrationForKind` derives the role and the class; nothing else
 * in the wizard decides either).
 *
 * "Other" asks what kind of place it is, here, where the question is; an
 * officer reads it and picks the closest RDB class. "Broker" says that a broker
 * registers on a short form of its own, because a broker lists no property and
 * walks no TIN.
 */

const GROUPS: ReadonlyArray<{ id: "stay" | "venue" | "lease"; label: string }> = [
  { id: "stay", label: "A place to stay" },
  { id: "venue", label: "Food and drink" },
  { id: "lease", label: "On a lease" },
];

export function StepType({
  kind,
  other,
  otherError,
  onChoose,
  onOtherChange,
}: {
  kind: RegistrationKind | null;
  other: string;
  otherError?: string;
  onChoose: (kind: RegistrationKind) => void;
  onOtherChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-base font-semibold">{group.label}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {REGISTRATION_KINDS.filter((k) => k.group === group.id).map((entry) => {
              const Icon = iconFor(entry.value);
              return (
                <TileCard
                  key={entry.value}
                  name="registrationKind"
                  value={entry.value}
                  checked={kind === entry.value}
                  label={entry.label}
                  blurb={entry.blurb}
                  icon={<Icon size={20} />}
                  onSelect={() => onChoose(entry.value)}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {kind === "other" ? (
        <div className="max-w-form">
          <Field
            label="What kind of place is it?"
            hint="An officer reads this and picks the closest RDB class."
            error={otherError}
          >
            <TextInput
              id="register-other"
              className="w-full"
              placeholder="For example, a campsite with cabins"
              value={other}
              onChange={(e) => onOtherChange(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {kind === "broker" ? (
        <Callout tone="info" icon={<Info size={16} aria-hidden />} title="Brokers register on one short screen">
          A broker lists no property of their own, so there is no TIN walk here. Continue opens the broker form: your ID,
          checked once, and you are registered. There is no fee.
        </Callout>
      ) : null}
    </div>
  );
}
