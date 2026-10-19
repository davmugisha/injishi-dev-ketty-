"use client";

import { iconFor } from "./kind-summary";
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
 * ONE FACE NOW. It had two: a person who chose on `/host` was shown their
 * answer back here ("You are registering a guest house", Change, Continue),
 * and a person who opened `/register` directly saw the tiles. The confirmation
 * was a screen with one question already answered and one button, straight
 * after `/host/start` had said the same sentence, so an answered kind now skips
 * this step altogether (`wizard-path.ts`) and is shown back where it is used,
 * on About you and on Business, each with a Change control that opens these
 * tiles. So the tiles are all this step is: reached cold, or reached by Change.
 *
 * `registrationForKind` derives the role and the class. Nothing else in the
 * wizard is allowed to decide either.
 */

/** One sentence, and no figure in it. */
const FEE_LINE =
  "A one time registration fee, paid at the last step, then a monthly plan once you are live. No commission.";
/** A PSF business lists nothing, so it has no plan: the fee, then PSF's own membership. */
const PSF_FEE_LINE =
  "A one time registration fee, paid at the last step. Your PSF membership fee is separate, and paid once PSF approves you.";

export function StepPlace({
  kind,
  onChoose,
  onNext,
}: {
  kind: RegistrationKind | null;
  onChoose: (kind: RegistrationKind) => void;
  onNext: () => void;
}) {
  const chosen = kind
    ? REGISTRATION_KINDS.find((k) => k.value === kind) ?? null
    : null;

  const stay = REGISTRATION_KINDS.filter((k) => k.group === "stay");
  const venue = REGISTRATION_KINDS.filter((k) => k.group === "venue");
  const lease = REGISTRATION_KINDS.filter((k) => k.group === "lease");
  const psf = REGISTRATION_KINDS.filter((k) => k.group === "psf");

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

        {/* THE PSF PATH: not a place at all. A business of any sector joins
            the Private Sector Federation through Injishi, so it sits apart from
            the three questions about where people stay, eat or live. */}
        <fieldset>
          <legend className="text-sm font-semibold">
            Any other business, joining PSF
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {psf.map((entry) => {
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
              : chosen.value === "psf"
                ? PSF_FEE_LINE
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
