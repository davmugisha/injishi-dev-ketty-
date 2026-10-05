"use client";

import * as React from "react";
import { MAX_BULK_IDS, type BulkResponse, type ListIds } from "@injishi/contracts";
import { cn } from "@injishi/utils";

import { Button } from "./button";

/** One action the list offers on many rows; the server runs it once per id. */
export interface BulkAction {
  readonly key: string;
  readonly label: string;
  /** A destructive action is drawn as one. */
  readonly danger?: boolean;
}

export interface BulkBarProps {
  /** How many rows are selected, on any page. */
  readonly selected: number;
  /** How many rows the current filter matches. */
  readonly total: number;
  readonly actions: readonly BulkAction[];
  /** Ask the list's `ids` route for every id the filter matches (AC-LF15). */
  readonly onSelectAll: () => Promise<ListIds>;
  /** Replace the selection, from select all. */
  readonly onSelect: (ids: string[]) => void;
  readonly onClear: () => void;
  /** Run an action over the selection; the answer carries one result per id (AC-LF6). */
  readonly onAction: (key: string) => Promise<BulkResponse>;
  /** Names a row for a refusal ("Uwase Aline: already decided"), when the screen can. */
  readonly labelOf?: (id: string) => string | undefined;
  readonly className?: string;
}

/**
 * The bar a selection brings up (058-list-framework AC-LF6, AC-LF15).
 *
 * Select all asks the server for the ids that match, up to the 200 a bulk
 * action takes, and when the filter matches more it says so and asks for a
 * narrower one rather than acting on the first 200 in silence.
 *
 * An action is the module's single row command once per id, so one refusal
 * does not undo the rows already done. The bar reports both counts and lists
 * every refusal in the command's own words.
 */
function BulkBar({
  selected,
  total,
  actions,
  onSelectAll,
  onSelect,
  onClear,
  onAction,
  labelOf,
  className,
}: BulkBarProps) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [refusals, setRefusals] = React.useState<{ id: string; error: string }[]>([]);

  const selectAll = async () => {
    setBusy("__all");
    setNotice(null);
    try {
      const answer = await onSelectAll();
      if (answer.total > MAX_BULK_IDS) {
        setNotice(
          `This filter matches ${answer.total} rows, more than the ${MAX_BULK_IDS} one action can take. Narrow the filter first.`,
        );
      } else {
        onSelect(answer.ids);
      }
    } catch {
      setNotice("We couldn't select every row. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string) => {
    setBusy(key);
    setNotice(null);
    setRefusals([]);
    try {
      const { results } = await onAction(key);
      const done = results.filter((r) => r.ok).length;
      const refused = results.filter((r) => !r.ok);
      setRefusals(refused.map((r) => ({ id: r.id, error: r.error ?? "Refused." })));
      setNotice(
        refused.length === 0
          ? `Done for all ${done}.`
          : `Done for ${done}. ${refused.length} could not be done, and are listed below.`,
      );
    } catch {
      setNotice("Nothing was done: we couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (selected === 0 && !notice) return null;

  return (
    <section
      aria-label="Selected rows"
      className={cn("flex flex-col gap-2 rounded-card border border-border bg-secondary p-3", className)}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold tabular-nums">{selected} selected</span>
        {selected > 0 && selected < Math.min(total, MAX_BULK_IDS) ? (
          <Button variant="link" size="sm" pending={busy === "__all"} onClick={() => void selectAll()}>
            Select all {total} matching
          </Button>
        ) : null}
        {selected > 0 ? (
          <Button variant="link" size="sm" onClick={onClear}>
            Clear selection
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant={action.danger ? "danger" : "primary"}
              disabled={selected === 0 || (busy !== null && busy !== action.key)}
              pending={busy === action.key}
              onClick={() => void run(action.key)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
      {notice ? (
        <p role="status" className="text-sm text-foreground">
          {notice}
        </p>
      ) : null}
      {refusals.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {refusals.map((r) => (
            <li key={r.id}>
              <span className="text-foreground">{labelOf?.(r.id) ?? "One row"}</span>: {r.error}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export { BulkBar };
