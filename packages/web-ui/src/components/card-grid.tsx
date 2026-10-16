"use client";

import * as React from "react";
import type { ListGroup } from "@injishi/contracts";
import { cn } from "@injishi/utils";

import { Checkbox } from "./checkbox";

export interface CardGridProps<Row> {
  readonly rows: readonly Row[];
  readonly getRowId: (row: Row) => string;
  /** One card's content. The grid draws the card itself and the selection box. */
  readonly renderCard: (row: Row) => React.ReactNode;
  /** A name for the row, for the selection box's label. */
  readonly labelOf: (row: Row) => string;
  readonly selection?: {
    readonly selected: ReadonlySet<string>;
    readonly onChange: (selected: Set<string>) => void;
  };
  /** A grouped page, as `DataTable` takes it: each group under its own heading. */
  readonly group?: {
    readonly keyOf: (row: Row) => string | null;
    readonly groups: readonly ListGroup[];
  };
  readonly className?: string;
}

/**
 * The card view of `DataView` (058-list-framework AC-LF1): the same page of
 * rows as the table, one card each, for screens where a person is better read
 * as a face and a few facts than as a line. A grouped page keeps its groups,
 * each under a heading with its count.
 */
function CardGrid<Row>({ rows, getRowId, renderCard, labelOf, selection, group, className }: CardGridProps<Row>) {
  const sections: { key: string | null; rows: Row[] }[] = [];
  for (const row of rows) {
    const key = group ? group.keyOf(row) : null;
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else sections.push({ key, rows: [row] });
  }

  const toggle = (id: string, on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (on) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {sections.map((section, i) => {
        const info = group?.groups.find((g) => g.key === section.key);
        return (
          <section key={`${section.key ?? "none"}-${i}`} className="flex flex-col gap-3">
            {group ? (
              <h3 className="text-sm font-semibold">
                {info?.label ?? (section.key === null ? "None" : section.key)}
                {info ? <span className="ml-2 font-normal tabular-nums text-muted-foreground">{info.count}</span> : null}
              </h3>
            ) : null}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.rows.map((row) => {
                const id = getRowId(row);
                const selected = selection?.selected.has(id) ?? false;
                return (
                  <li
                    key={id}
                    data-state={selected ? "selected" : undefined}
                    className="relative flex rounded-card border border-border bg-card p-4 text-card-foreground transition-colors duration-quick data-[state=selected]:border-ring"
                  >
                    {selection ? (
                      <Checkbox
                        aria-label={`Select ${labelOf(row)}`}
                        isSelected={selected}
                        onChange={(on: boolean) => toggle(id, on)}
                        className="absolute right-3 top-3"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">{renderCard(row)}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export { CardGrid };
