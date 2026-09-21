"use client";

import { Button } from "@heroui/react";
import { Check, Pencil } from "lucide-react";

import { BrokerIcon, HostKindIcons } from "@/components/icons/search";
import { OtherPropertyIcon } from "@/components/icons/search";

import {
  REGISTRATION_KINDS,
  type RegistrationKind,
  whatWeAskFor,
} from "./registration-kinds";
import { Notice, StepActions, TileCard } from "./wizard-ui";

/**
 * Step 1 — what you are registering (ADR-026, AC-1 and AC-2).
 *
 * ONE question where there used to be three. `/host` asked what kind of place
 * you have, `/register` then asked whether you were a host, a landlord or a
 * broker, and two steps after that it asked what kind of place you have again.
 * All three read the same answer: a Villa is a host registering a hospitality
 * business, and there is no combination where knowing the tile leaves the role
 * open.
 *
 * So this step has two faces, and which one shows is the whole fix:
 *
 * - **Carried.** A person who chose on `/host` sees their answer confirmed,
 *   with what happens next and a Change control. They are not re-asked, and
 *   they are not silently skipped past either — the choice they made on another
 *   page is shown back on the page that uses it, which is what makes the next
 *   screen legible.
 * - **Cold.** A person who opened `/register` directly sees the ten tiles and
 *   answers once.
 *
 * `registrationForKind` derives the role and the class. Nothing else in the
 * wizard is allowed to decide either.
 */

/** The mark for a tile. `broker` is the one value `HostKindIcons` cannot hold. */
function iconFor(kind: RegistrationKind) {
  if (kind === "broker") return BrokerIcon;
  if (kind === "other") return OtherPropertyIcon;
  return HostKindIcons[kind];
}

/** One sentence, both faces of the step, and no figure in it. */
const FEE_LINE =
  "A one time registration fee applies. You pay it at the last step.";

export function StepPlace({
  kind,
  carried,
  onChoose,
  onReopen,
  onNext,
}: {
  kind: RegistrationKind | null;
  /** True when this answer arrived from `/host` and has not been changed here. */
  carried: boolean;
  onChoose: (kind: RegistrationKind) => void;
  /** Drop back to the ten tiles. Separate from `onChoose`, which ANSWERS. */
  onReopen: () => void;
  onNext: () => void;
}) {
  const chosen = kind
    ? REGISTRATION_KINDS.find((k) => k.value === kind) ?? null
    : null;

  if (carried && chosen) {
    const Icon = iconFor(chosen.value);
    return (
      <section aria-labelledby="step-place">
        <h2 id="step-place" className="text-xl font-semibold tracking-tight">
          You are registering a {chosen.label.toLowerCase()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Carried over from the listing page. Change it here if it is not right.
        </p>

        <div className="mt-6 flex items-start gap-4 rounded-card border border-accent-brand bg-accent-brand/10 p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-brand text-accent-brand-foreground">
            <Icon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {chosen.label}
              <Check size={15} aria-hidden className="text-accent-text" />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {chosen.blurb}
            </p>
            <p className="mt-3 text-sm">{whatWeAskFor(chosen.value)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onPress={onReopen}
          >
            <Pencil size={14} aria-hidden className="mr-1.5" />
            Change
          </Button>
        </div>

        {/* THAT a fee applies, never how much. The figure used to be printed
            here (ADR-026 AC-3); the owner reversed that on 2026-09-21. The
            amount is stated nowhere in this flow, so this line says a fee is
            coming without quoting one. */}
        {chosen.value !== "broker" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {FEE_LINE}
          </p>
        ) : null}
        {chosen.value === "broker" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Broker registration is free.
          </p>
        ) : null}

        <StepActions onNext={onNext} nextLabel="Continue" />
      </section>
    );
  }

  const stay = REGISTRATION_KINDS.filter((k) => k.group === "stay");
  const venue = REGISTRATION_KINDS.filter((k) => k.group === "venue");
  const lease = REGISTRATION_KINDS.filter((k) => k.group === "lease");

  return (
    <section aria-labelledby="step-place">
      <h2 id="step-place" className="text-xl font-semibold tracking-tight">
        What are you registering?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This decides everything we ask you next. You are asked it once.
      </p>

      <div className="mt-6 space-y-6">
        <fieldset>
          <legend className="text-sm font-semibold">
            Somewhere guests stay by the night
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stay.map((entry) => {
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

        {/* Its own group rather than a ninth building. Every tile above answers
            "what shape is the place a guest sleeps in"; this one answers "what
            does a guest buy", and a venue with no rooms sitting in that grid
            would read as a kind of stay. Same fee and same gate — the split is
            in the question, not in the price. */}
        <fieldset>
          <legend className="text-sm font-semibold">
            Somewhere guests eat and drink
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {venue.map((entry) => {
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

        <fieldset>
          <legend className="text-sm font-semibold">
            Somewhere people live, or the person who places them
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lease.map((entry) => {
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

        {chosen ? (
          <Notice tone="info">
            <b>{chosen.label}.</b> {whatWeAskFor(chosen.value)}{" "}
            {chosen.value === "broker"
              ? "There is no registration fee."
              : FEE_LINE}
          </Notice>
        ) : null}
      </div>

      <StepActions
        onNext={onNext}
        nextLabel="Continue"
        disabled={kind === null}
      />
    </section>
  );
}
