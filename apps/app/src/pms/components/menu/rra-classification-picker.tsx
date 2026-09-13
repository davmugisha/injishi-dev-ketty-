"use client";

/**
 * Pick a code from RRA's item classification list (ADR-050 D-m).
 *
 * A search, not a dropdown: the list runs to thousands of rows, and an owner
 * knows "juice" or "1110", never which of forty pages it sits on. The server
 * does the searching (`GET /ops/rra/classifications`), behind `menu.manage`.
 *
 * The code is never TYPED into the item. It is chosen from what the server
 * found, because a code a person typed is a receipt line the Authority refuses,
 * and the picker is what makes a mistyped digit impossible rather than merely
 * unlikely.
 *
 * Built as a combobox over a listbox, so a keyboard user can type, arrow
 * through what came back and press Enter, and a screen reader hears how many
 * codes matched.
 */

import { Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useEffect, useId, useState } from "react";

import { useRraClassifications } from "../../data/ops";

export interface RraClassificationPickerProps {
  workspaceId: string | null;
  /** The chosen code, or empty. */
  value: string;
  /** The chosen code's name, when the server already told us. */
  valueName?: string | null;
  onChange: (code: string, name: string) => void;
  /** Accessible name of the search box. */
  label: string;
  disabled?: boolean;
}

export function RraClassificationPicker({
  workspaceId,
  value,
  valueName,
  onChange,
  label,
  disabled,
}: RraClassificationPickerProps) {
  const listId = useId();
  const statusId = useId();
  const [typed, setTyped] = useState("");
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // Wait for a pause in typing, so a word is one search rather than five.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(typed), 250);
    return () => clearTimeout(timer);
  }, [typed]);

  const query = useRraClassifications(workspaceId, term);
  const results = query.data?.classifications ?? [];
  const searching = term.trim().length >= 2;

  function choose(index: number) {
    const picked = results[index];
    if (!picked) return;
    onChange(picked.code, picked.name);
    setTyped("");
    setTerm("");
    setOpen(false);
  }

  const status = !searching
    ? "Type two letters or digits to search RRA's list."
    : query.isFetching
      ? "Searching RRA's list."
      : query.isError
        ? "The list could not be searched. Try again in a moment."
        : results.length === 0
          ? "No active code matches. Try the start of the code, or another word."
          : `${results.length} ${results.length === 1 ? "code matches" : "codes match"}.`;

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex flex-wrap items-baseline gap-2 rounded border border-line2 bg-field px-3 py-2">
          <span className="pms-num text-sm font-bold text-foreground">{value}</span>
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            {valueName ?? "On RRA's list"}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No classification chosen yet.</p>
      )}

      <div className="relative">
        <Input
          role="combobox"
          aria-label={label}
          aria-expanded={open && searching && results.length > 0}
          aria-controls={listId}
          aria-describedby={statusId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          value={typed}
          disabled={disabled}
          placeholder={value ? "Search to change it" : "Search by code or by name, e.g. juice"}
          onChange={(e) => {
            setTyped(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && results.length > 0) {
              e.preventDefault();
              choose(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-10 rounded border-line2 bg-field text-sm"
        />
        <p id={statusId} role="status" className="mt-1 text-2xs text-muted-foreground">
          {status}
        </p>

        {open && searching && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label}: matches`}
            className="scrollbar mt-1 max-h-64 overflow-y-auto rounded border border-line2 bg-card"
          >
            {results.map((c, i) => (
              <li
                key={c.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Pressing a result must not blur the box first, or the list
                // closes under the pointer before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm",
                  i === active ? "bg-accent-soft text-accent-text" : "text-foreground",
                )}
              >
                <span className="pms-num shrink-0 font-bold">{c.code}</span>
                <span className="min-w-0 flex-1 text-xs">{c.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
