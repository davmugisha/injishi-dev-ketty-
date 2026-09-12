"use client";

import type { ReactNode } from "react";

/**
 * One radio row: a native `<input type="radio">` under a full-width label,
 * so the whole row is the hit target and a screen reader announces it as one
 * item in a group.
 *
 * Every one of the captures uses this same shape for a different question —
 * "when to pay", "which payment method", "which card network" — which is why
 * it is one component rather than three, each hand-styled to look the same.
 * `@injishi/ui` carries no radio primitive today, so this stays a plain input
 * styled to the accent role rather than reaching for a library the package
 * does not export.
 */
export function CheckoutChoice({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  media,
  disabled = false,
  className = "",
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: ReactNode;
  description?: ReactNode;
  /** A brand mark or icon, shown before the label. */
  media?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      {/*
        A row that cannot be chosen still has to be READ. The description under
        an unavailable option is the sentence explaining why it is unavailable,
        so it is the one part of the row that must not be dimmed: it goes to
        `text-muted-foreground`, the role already measured for secondary copy
        (4.65:1 light, 5.6:1 dark on the checkout surfaces), rather than
        inheriting a wrapper opacity that multiplied with `text-page-fg-70` and
        landed at 2.67:1. Disabled-ness is carried by the control's own state
        and the cursor, which is where it belongs.
      */}
      <span className="flex min-w-0 items-start gap-3">
        {media ? <span className="mt-0.5 shrink-0">{media}</span> : null}
        <span className="flex min-w-0 flex-col">
          <span className={disabled ? "text-base text-muted-foreground" : "text-base text-page-fg"}>
            {label}
          </span>
          {description ? (
            <span className="mt-0.5 text-sm text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </span>

      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-input bg-transparent transition-colors checked:border-[6px] checked:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

/**
 * The group a set of `CheckoutChoice` rows belongs to.
 *
 * Native radios sharing a `name` form an implicit group, which is enough for
 * arrow-key navigation and NOT enough for a screen reader: the group had no
 * accessible name, so it was announced as "radio, 1 of 3" with nothing saying
 * what the three were choosing between. A `fieldset` with a `legend` is the
 * platform's own answer, and it costs nothing visually — the legend is
 * `sr-only`, because the numbered step heading above already says it on screen
 * and printing it twice would be the visible half of the same redundancy.
 */
export function CheckoutChoiceGroup({
  legend,
  children,
  className = "",
}: {
  /** What this set of rows is choosing between, as a sentence. */
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`}>
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** A hairline between two choices, matching the rest of the checkout list. */
export function CheckoutDivider() {
  return <span aria-hidden className="block h-px w-full bg-input" />;
}
