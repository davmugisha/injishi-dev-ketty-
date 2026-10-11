"use client";

import * as React from "react";
import type { ListField } from "@injishi/contracts";
import { cn } from "@injishi/utils";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** Radix Select refuses an empty value, so "no grouping" needs a name of its own. */
const NONE = "__none";

export interface GroupSelectProps {
  /** The fields the reader may group by: groupable, and visible to them. */
  readonly fields: readonly ListField[];
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
  readonly className?: string;
}

/**
 * Group by one field (058-list-framework AC-LF2). One level only: nested
 * groups double the query and the screen for little gain at a business's size.
 * The server counts each group over the whole filtered set and orders rows
 * group first, so a page never interleaves two groups (AC-LF14).
 */
function GroupSelect({ fields, value, onChange, className }: GroupSelectProps) {
  if (fields.length === 0) return null;
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
      <SelectTrigger aria-label="Group by" className={cn("h-9 w-auto gap-2 px-4 text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No grouping</SelectItem>
        {fields.map((field) => (
          <SelectItem key={field.key} value={field.key}>
            Group by {field.label.toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { GroupSelect };
