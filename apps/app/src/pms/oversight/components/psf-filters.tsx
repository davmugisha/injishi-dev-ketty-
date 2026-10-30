"use client";

/**
 * The PSF console's filter bar (2026-10-20): a search box and a row of
 * selects, shared by the Queue and the Decisions log so both read the same.
 *
 * The search waits for a pause in typing before it asks again, so a name
 * typed letter by letter is one request, not ten.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function PsfSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:min-w-64">
      <span className="sr-only">{placeholder}</span>
      <Search size={15} aria-hidden className="pointer-events-none absolute left-3 text-muted-foreground" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded border border-input bg-card pl-9 pr-8 text-sm shadow-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {text ? (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange("");
          }}
          aria-label="Clear the search"
          className="absolute right-2 rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/** One filter. Its label stays visible inside it, so a set filter reads "Sector: Trade". */
export function PsfFilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (next: string) => void;
  allLabel?: string;
}) {
  const on = value !== "";
  return (
    <label
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center rounded border text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring",
        on ? "border-primary bg-accent-soft text-accent-text" : "border-input bg-card",
      )}
    >
      <span className={cn("pointer-events-none pl-3 pr-1 text-xs", on ? "font-semibold" : "text-muted-foreground")}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full appearance-none bg-transparent pr-8 text-sm font-medium focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 text-muted-foreground" />
    </label>
  );
}

/** The bar itself: the search on its own line on a phone, beside the filters on a screen. */
export function PsfFilterBar({ children, onClear, active }: { children: ReactNode; onClear: () => void; active: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-line bg-card p-2.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      {children}
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-1 self-start rounded px-2.5 text-sm font-medium text-muted-foreground hover:bg-hover hover:text-foreground sm:self-auto"
        >
          <X size={14} aria-hidden /> Clear
        </button>
      ) : null}
    </div>
  );
}
