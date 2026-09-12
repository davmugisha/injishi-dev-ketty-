"use client";

import type { DemoPersona } from "@injishi/contracts";
import { formatMarketDateTime } from "@injishi/utils";

import { Icon } from "@/components/app/icon";
import { DEMO_OTP_CODE } from "@/lib/otp";

/**
 * The demo's sign in shortcut (ADR-043, AC-18 and AC-19).
 *
 * Rendered only where `GET /api/v1/platform` said demo, so production and
 * staging never show it. A pick FILLS the email field and nothing more: the
 * visitor still presses Continue, so the one sign in path is the one being
 * demonstrated, and the picker cannot become a second way in.
 *
 * The roster comes from `GET /api/v1/demo/personas`, never from a list in this
 * app, so the seats it promises are the seats the switcher will show. Each
 * persona reads with every seat it holds; Samuel's five are not flattened.
 */
export default function DemoPersonaPicker({
  personas,
  seededAt,
  selected,
  onPick,
}: {
  personas: DemoPersona[];
  /** When the demo data was last reset, an ISO instant, or null if unknown. */
  seededAt: string | null;
  selected: string;
  onPick: (email: string) => void;
}) {
  return (
    <section
      aria-labelledby="demo-personas-title"
      className="rounded-card border border-border bg-field p-4"
      data-cy="demo-personas"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="demo-personas-title" className="text-sm font-semibold text-foreground">
          Explore the demo
        </h2>
        {seededAt ? (
          <p className="text-xs text-muted-foreground" data-cy="demo-reset">
            Data reset {formatMarketDateTime(new Date(seededAt))}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Pick someone to fill the email, then Continue. Every code is{" "}
        <span className="font-semibold tracking-wider text-foreground">{DEMO_OTP_CODE}</span>.
      </p>

      {personas.length > 0 ? (
        <ul className="scrollbar mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {personas.map((persona) => {
            const seats = persona.seats.map((seat) => seat.label).join(" · ");
            const picked = persona.email === selected;
            return (
              <li key={persona.email}>
                <button
                  type="button"
                  onClick={() => onPick(persona.email)}
                  aria-pressed={picked}
                  className={`w-full rounded px-3 py-2 text-left hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    picked ? "bg-surface-secondary" : ""
                  }`}
                  data-cy="demo-persona"
                >
                  <span className="block text-sm font-medium text-foreground">
                    {persona.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {persona.seats.length > 1 ? `${persona.seats.length} seats · ${seats}` : seats}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
