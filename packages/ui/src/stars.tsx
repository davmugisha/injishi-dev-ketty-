"use client";

import { Icon } from "./icon.tsx";

/** Stars as a row of icons, read out as "4 of 5 stars". `size` is the icons' size class. */
export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning" role="img" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={n <= value ? "StarFill" : "Star"} className={size} />
      ))}
    </span>
  );
}

/** Pick one to five stars: one button per star, the chosen one pressed. */
export function StarInput({
  value,
  onChange,
  error,
  label = "Stars",
}: {
  value: number;
  onChange: (n: number) => void;
  error?: string;
  label?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className="rounded-md p-1 text-warning outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name={n <= value ? "StarFill" : "Star"} className="size-6" />
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </fieldset>
  );
}
