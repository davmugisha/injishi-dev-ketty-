"use client";

import * as React from "react";
import type { ListCount, ListField } from "@injishi/contracts";
import { cn } from "@injishi/utils";

export interface StatusChipsProps {
  /** The list spec's status field: an enum, whose values become the chips in their declared order. */
  readonly field: ListField;
  /** `ListPage.statusCounts`: counted without the status filter itself, so every chip keeps its number. */
  readonly counts: readonly ListCount[] | undefined;
  /** The status chosen, or null for all of them. */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly className?: string;
}

/**
 * The quick status filter above a list (058-list-framework AC-LF2): one chip
 * per status with its count, and an "All" chip carrying their sum. A chip is a
 * toggle button, so a screen reader hears which one is pressed.
 *
 * The counts come from the server's status count query, which leaves the
 * status filter out on purpose; otherwise choosing "Left" would zero every
 * other chip and the row would stop saying where the people are.
 */
function StatusChips({ field, counts, value, onChange, className }: StatusChipsProps) {
  const countOf = (status: string) => counts?.find((c) => c.value === status)?.count;
  const total = counts?.reduce((sum, c) => sum + c.count, 0);
  const chips: { value: string | null; label: string; count: number | undefined }[] = [
    { value: null, label: "All", count: total },
    ...(field.enumValues ?? []).map((status) => ({
      value: status,
      label: field.enumLabels?.[status] ?? status,
      count: countOf(status),
    })),
  ];
  return (
    <div role="group" aria-label={`Filter by ${field.label.toLowerCase()}`} className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => {
        const pressed = chip.value === value;
        return (
          <button
            key={chip.value ?? "all"}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? null : chip.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm outline-none transition-colors duration-quick",
              "focus-visible:ring-2 focus-visible:ring-ring",
              pressed
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:bg-secondary",
            )}
          >
            {chip.label}
            {chip.count !== undefined ? (
              <span className={cn("tabular-nums", pressed ? "text-background" : "text-muted-foreground")}>
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { StatusChips };
