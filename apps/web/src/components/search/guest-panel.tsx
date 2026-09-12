"use client";

import { Button, Checkbox } from "@injishi/ui";
import { StepButton } from "@/components/shared/step-button";
import {
  DEFAULT_GUESTS,
  GUEST_AGES,
  GUEST_LIMITS,
  type GuestCounts,
  type GuestField,
} from "@/lib/stay-search";

/**
 * The guest stepper.
 *
 * Adults, children and infants as three bounded counters, plus the pets flag —
 * the reference's set, because it is the set that changes which properties
 * qualify. The bounds come from `GUEST_LIMITS` rather than being open-ended so
 * a held-down `+` cannot produce a party of 400.
 */

/**
 * `singular` is spelled out rather than derived: stripping a trailing "s" off
 * "Children" leaves "children", so the stepper announced "Add one children".
 */
const ROWS: {
  field: GuestField;
  label: string;
  singular: string;
  helper: string;
}[] = [
  { field: "adults", label: "Adults", singular: "adult", helper: GUEST_AGES.adults },
  { field: "children", label: "Children", singular: "child", helper: GUEST_AGES.children },
  { field: "infants", label: "Infants", singular: "infant", helper: GUEST_AGES.infants },
];

export function GuestPanel({
  guests,
  onChange,
  onDone,
}: {
  guests: GuestCounts;
  onChange: (next: GuestCounts) => void;
  onDone: () => void;
}) {
  const set = (field: GuestField, value: number) =>
    onChange({ ...guests, [field]: value });

  const isDefault =
    guests.adults === DEFAULT_GUESTS.adults &&
    guests.children === 0 &&
    guests.infants === 0 &&
    !guests.pets;

  return (
    <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-card bg-white shadow-[0_18px_50px_-12px_rgba(4,35,48,0.35)] ring-1 ring-black/5">
      <div className="px-6 pt-5">
        {ROWS.map(({ field, label, singular, helper }) => {
          const value = guests[field];
          const { min, max } = GUEST_LIMITS[field];
          return (
            <div
              key={field}
              className="flex items-center justify-between border-b border-black/5 py-4 last:border-b-0"
            >
              <span>
                <span className="block text-base leading-tight text-ink">{label}</span>
                <span className="block text-sm leading-tight text-ink/65">
                  {helper}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <StepButton
                  tone="overlay"
                  sign="minus"
                  label={`Remove one ${singular}`}
                  disabled={value <= min}
                  onClick={() => set(field, value - 1)}
                />
                <span
                  aria-live="polite"
                  className="w-9 text-center text-base tabular-nums text-ink"
                >
                  {value}
                </span>
                <StepButton
                  tone="overlay"
                  sign="plus"
                  label={`Add one ${singular}`}
                  disabled={value >= max}
                  onClick={() => set(field, value + 1)}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* One control. HeroUI's Checkbox carries its own label, so the separate
          `htmlFor` pairing is gone and the whole two-line row toggles. */}
      <Checkbox
        isSelected={guests.pets}
        onChange={(isSelected) => onChange({ ...guests, pets: isSelected })}
        className="flex items-start gap-3 border-t border-black/5 px-6 py-4 font-normal"
      >
        <span className="block">
          <span className="block text-base leading-tight text-ink">
            I’m travelling with pets
          </span>
          <span className="block text-sm leading-tight text-ink/65">
            Shows only stays that allow them
          </span>
        </span>
      </Checkbox>

      <div className="flex items-center justify-between border-t border-black/5 px-6 py-4">
        <Button
          variant="link"
          size="sm"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_GUESTS)}
          className="text-ink/50 hover:text-ink"
        >
          Reset
        </Button>
        <Button variant="primary" size="sm" onClick={onDone} className="h-auto px-6 py-2">
          Done
        </Button>
      </div>
    </div>
  );
}

