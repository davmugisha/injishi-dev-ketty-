"use client";

import { Button, Checkbox } from "@injishi/web-ui";
import { useTranslations } from "next-intl";
import { StepButton } from "@/components/shared/step-button";
import {
  DEFAULT_GUESTS,
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
  labelKey: "adults" | "children" | "infants";
  personKey: "adult" | "child" | "infant";
  ageKey: "adultAge" | "childAge" | "infantAge";
}[] = [
  { field: "adults", labelKey: "adults", personKey: "adult", ageKey: "adultAge" },
  { field: "children", labelKey: "children", personKey: "child", ageKey: "childAge" },
  { field: "infants", labelKey: "infants", personKey: "infant", ageKey: "infantAge" },
];

export function GuestPanel({
  guests,
  onChange,
  onDone,
}: {
  /** Null while the field is untouched; the steppers show the default party. */
  guests: GuestCounts | null;
  /**
   * Any step or tick answers the question, so it hands back a party. Reset
   * hands back null, which UNASKS it — the field goes back to its placeholder
   * rather than to a party of two the guest never typed.
   */
  onChange: (next: GuestCounts | null) => void;
  onDone: () => void;
}) {
  const t = useTranslations("search");
  const party = guests ?? DEFAULT_GUESTS;

  const set = (field: GuestField, value: number) =>
    onChange({ ...party, [field]: value });

  // Reset is offered exactly while there is an answer to discard. It used to
  // compare the counts against the default, which cannot tell a party of two
  // somebody chose from a party of two nobody did.
  const untouched = guests === null;

  return (
    <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-card bg-white shadow-[0_18px_50px_-12px_rgba(4,35,48,0.35)] ring-1 ring-black/5">
      <div className="px-6 pt-5">
        {ROWS.map(({ field, labelKey, personKey, ageKey }) => {
          const value = party[field];
          const { min, max } = GUEST_LIMITS[field];
          return (
            <div
              key={field}
              className="flex items-center justify-between border-b border-black/5 py-4 last:border-b-0"
            >
              <span>
                  <span className="block text-base leading-tight text-ink">{t(labelKey)}</span>
                <span className="block text-sm leading-tight text-ink/65">
                  {t(ageKey)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <StepButton
                  tone="overlay"
                  sign="minus"
                  label={t("removeOne", { person: t(personKey) })}
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
                  label={t("addOne", { person: t(personKey) })}
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
        isSelected={party.pets}
        onChange={(isSelected) => onChange({ ...party, pets: isSelected })}
        className="flex w-full items-start gap-3 border-t border-black/5 px-6 py-4 font-normal"
        controlClassName="mt-0.5"
      >
        <span className="block">
          <span className="block text-base leading-tight text-ink">
            {t("travellingPets")}
          </span>
          <span className="block text-sm leading-tight text-ink/65">
            {t("petsHint")}
          </span>
        </span>
      </Checkbox>

      <div className="flex items-center justify-between border-t border-black/5 px-6 py-4">
        <Button
          variant="link"
          size="sm"
          disabled={untouched}
          onClick={() => onChange(null)}
          className="text-ink/50 hover:text-ink"
        >
          {t("reset")}
        </Button>
        <Button variant="primary" size="sm" onClick={onDone} className="h-auto px-6 py-2">
          {t("done")}
        </Button>
      </div>
    </div>
  );
}

