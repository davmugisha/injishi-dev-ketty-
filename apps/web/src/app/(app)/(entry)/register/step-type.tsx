"use client";

import { iconFor } from "./kind-summary";
import { REGISTRATION_KINDS, type RegistrationKind } from "./registration-kinds";
import { Field, TextInput, TileCard } from "./wizard-ui";

/**
 * The kind chooser, at the top of Business when no kind arrived from `/host`
 * (ADR-075 S3): one question, "What kind of business?", and the groups `/host`
 * uses, Stay, Food and drink, Lease (AC-1). What is pressed decides the
 * heading, the documents asked for and the fee (`registrationForKind` derives
 * the role, the kind and the class; nothing else in the wizard decides them).
 *
 * "Other" asks what kind of place it is, here, where the question is; an
 * officer reads it and picks the closest RDB class. A broker is not a tile: it
 * keeps its own short registration and is outside this record.
 */

const GROUPS: ReadonlyArray<{ id: "stay" | "venue" | "lease"; label: string }> = [
  { id: "stay", label: "Stay" },
  { id: "venue", label: "Food and drink" },
  { id: "lease", label: "Lease" },
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
      <h3 className="text-base font-semibold">What kind of business?</h3>
      {GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold text-muted-foreground">{group.label}</legend>
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

    </div>
  );
}
