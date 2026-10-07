"use client";

import * as React from "react";
import { Columns3Icon } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface ColumnChooserProps {
  /** Every column the reader may see, in the screen's order. */
  readonly columns: readonly { readonly key: string; readonly header: string }[];
  /** The columns shown; null is the screen's default set. */
  readonly shown: readonly string[] | null;
  /** The default set, which "Reset" returns to. */
  readonly defaults: readonly string[];
  readonly onChange: (shown: string[] | null) => void;
}

/**
 * Show and hide columns (058-list-framework AC-LF2). The choice lives in the
 * URL and in a saved view, and order follows the screen's own column order, so
 * a hidden column comes back where it was. The last shown column cannot be
 * hidden: an empty table reads as a broken one.
 */
function ColumnChooser({ columns, shown, defaults, onChange }: ColumnChooserProps) {
  const current = new Set(shown ?? defaults);
  const toggle = (key: string, on: boolean) => {
    const next = columns.map((c) => c.key).filter((k) => (k === key ? on : current.has(k)));
    if (next.length === 0) return;
    const isDefault = next.length === defaults.length && next.every((k, i) => k === defaults[i]);
    onChange(isDefault ? null : next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon aria-hidden className="size-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={current.has(column.key)}
            disabled={current.has(column.key) && current.size === 1}
            onCheckedChange={(on) => toggle(column.key, on === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.header}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={shown === null} onSelect={() => onChange(null)}>
          Reset to the usual columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ColumnChooser };
