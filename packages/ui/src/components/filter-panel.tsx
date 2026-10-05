"use client";

import * as React from "react";
import {
  ListQuery,
  checkListQuery,
  opsFor,
  visibleFields,
  type ListField,
  type ListFilter,
  type ListFilterOp,
  type ListReader,
  type ListSpec,
  type ListView,
} from "@injishi/contracts";
import { cn } from "@injishi/utils";
import { FilterIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** A choice for a `ref` field: the id the server filters on, the name a person reads. */
export interface RefOption {
  readonly value: string;
  readonly label: string;
}

export interface FilterPanelProps {
  readonly spec: ListSpec;
  readonly reader: ListView | ListReader;
  readonly filters: readonly ListFilter[];
  readonly onChange: (filters: ListFilter[]) => void;
  /** Choices for each `ref` field, by field key. A ref field with none is not offered. */
  readonly refOptions?: Readonly<Record<string, readonly RefOption[]>>;
  /** Fields filtered elsewhere on the screen (the status chips), left out of the panel. */
  readonly exclude?: readonly string[];
}

/** Plain words for each operator; a date reads "after" where a number reads "more than". */
const OP_LABEL: Record<ListFilterOp, string> = {
  eq: "is",
  ne: "is not",
  in: "is any of",
  nin: "is none of",
  contains: "contains",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  isNull: "is empty",
  isNotNull: "is not empty",
};
const TIME_OP_LABEL: Partial<Record<ListFilterOp, string>> = {
  gt: "is after",
  gte: "is on or after",
  lt: "is before",
  lte: "is on or before",
};

function opLabel(field: ListField, op: ListFilterOp): string {
  return (field.type === "date" || field.type === "datetime" ? TIME_OP_LABEL[op] : undefined) ?? OP_LABEL[op];
}

interface DraftRow {
  readonly id: number;
  readonly field: string;
  readonly op: ListFilterOp;
  readonly value: ListFilter["value"];
}

/** A `datetime-local` input speaks local wall time; the wire speaks ISO. */
function toLocalInput(iso: unknown): string {
  if (typeof iso !== "string" || Number.isNaN(Date.parse(iso))) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInput(field: ListField, raw: string): string | number | undefined {
  if (raw === "") return undefined;
  if (field.type === "number" || field.type === "money") return Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  if (field.type === "datetime") return Number.isNaN(Date.parse(raw)) ? undefined : new Date(raw).toISOString();
  return raw;
}

function inputType(field: ListField): string {
  if (field.type === "number" || field.type === "money") return "number";
  if (field.type === "date") return "date";
  if (field.type === "datetime") return "datetime-local";
  return "text";
}

function shownValue(field: ListField, value: unknown): string {
  if (value === undefined || value === null) return "";
  return field.type === "datetime" ? toLocalInput(value) : String(value);
}

/** The choices of an enum, a bool or a ref field. */
function choicesOf(field: ListField, refOptions: FilterPanelProps["refOptions"]): readonly RefOption[] {
  if (field.type === "enum") {
    return (field.enumValues ?? []).map((v) => ({ value: v, label: field.enumLabels?.[v] ?? v }));
  }
  if (field.type === "bool") return [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];
  if (field.type === "ref") return refOptions?.[field.key] ?? [];
  return [];
}

function ValueEditor({
  field,
  op,
  value,
  onChange,
  refOptions,
  invalid,
}: {
  field: ListField;
  op: ListFilterOp;
  value: ListFilter["value"];
  onChange: (value: ListFilter["value"]) => void;
  refOptions: FilterPanelProps["refOptions"];
  invalid: boolean;
}) {
  if (op === "isNull" || op === "isNotNull") return <span className="text-sm text-muted-foreground">No value needed</span>;
  const choices = choicesOf(field, refOptions);

  if (choices.length > 0 && (op === "in" || op === "nin")) {
    const chosen = new Set(Array.isArray(value) ? value.map(String) : []);
    return (
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto scrollbar-thin" role="group" aria-label={field.label}>
        {choices.map((choice) => (
          <Checkbox
            key={choice.value}
            isSelected={chosen.has(choice.value)}
            onChange={(on: boolean) => {
              const next = new Set(chosen);
              if (on) next.add(choice.value);
              else next.delete(choice.value);
              onChange([...next]);
            }}
          >
            <span className="text-sm">{choice.label}</span>
          </Checkbox>
        ))}
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <Select
        value={value === undefined ? undefined : String(value)}
        onValueChange={(v) => onChange(field.type === "bool" ? v === "true" : v)}
      >
        <SelectTrigger aria-label={`${field.label} value`} aria-invalid={invalid} className="h-9 px-3 text-sm">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (op === "between") {
    const [from, to] = Array.isArray(value) ? value : [undefined, undefined];
    const set = (i: 0 | 1, raw: string) => {
      const next = [from, to];
      next[i] = fromInput(field, raw);
      onChange(next as (string | number)[]);
    };
    return (
      <div className="flex items-center gap-2">
        <Input
          type={inputType(field)}
          size="sm"
          aria-label={`${field.label} from`}
          aria-invalid={invalid}
          value={shownValue(field, from)}
          onChange={(e) => set(0, e.target.value)}
        />
        <span className="text-sm text-muted-foreground">and</span>
        <Input
          type={inputType(field)}
          size="sm"
          aria-label={`${field.label} to`}
          aria-invalid={invalid}
          value={shownValue(field, to)}
          onChange={(e) => set(1, e.target.value)}
        />
      </div>
    );
  }

  if (op === "in" || op === "nin") {
    return (
      <Input
        size="sm"
        aria-label={`${field.label} values, separated by commas`}
        aria-invalid={invalid}
        placeholder="Separate values with commas"
        value={Array.isArray(value) ? value.join(", ") : ""}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((part) => fromInput(field, part.trim()))
              .filter((part): part is string | number => part !== undefined),
          )
        }
      />
    );
  }

  return (
    <Input
      type={inputType(field)}
      size="sm"
      aria-label={`${field.label} value`}
      aria-invalid={invalid}
      value={shownValue(field, value)}
      onChange={(e) => onChange(fromInput(field, e.target.value))}
    />
  );
}

/**
 * The filter panel (058-list-framework AC-LF2), built from the list spec: the
 * fields it offers are the filterable ones the reader may see, and each field
 * offers only the operators its type allows (`opsFor`), so a work figure never
 * offers a threshold (AC-LF12) and a sensitive field never appears for a
 * `basic` reader (AC-LF4).
 *
 * Rows are edited as a draft and applied together. A row is checked with the
 * same `checkListQuery` the server answers 422 from, so the panel cannot send
 * what the route would refuse, and says why next to the row.
 */
function FilterPanel({ spec, reader, filters, onChange, refOptions, exclude = [] }: FilterPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftRow[]>([]);
  const nextId = React.useRef(0);

  const fields = React.useMemo(
    () =>
      visibleFields(spec, reader).filter(
        (f) => f.filterable && !exclude.includes(f.key) && (f.type !== "ref" || (refOptions?.[f.key]?.length ?? 0) > 0),
      ),
    [spec, reader, exclude, refOptions],
  );
  const fieldOf = (key: string) => fields.find((f) => f.key === key);
  const counted = filters.filter((f) => !exclude.includes(f.field)).length;

  const rowOf = (filter: ListFilter): DraftRow => ({ id: nextId.current++, ...filter, value: filter.value });
  const onOpenChange = (next: boolean) => {
    if (next) setDraft(filters.filter((f) => !exclude.includes(f.field)).map(rowOf));
    setOpen(next);
  };

  const asFilters = (rows: readonly DraftRow[]): ListFilter[] =>
    rows.map(({ field, op, value }) => (value === undefined ? { field, op } : { field, op, value }));
  const issues = React.useMemo(() => {
    const parsed = ListQuery.safeParse({ filters: asFilters(draft) });
    if (!parsed.success) return new Map(draft.map((_, i) => [i, "A value does not fit."]));
    return new Map(
      checkListQuery(spec, parsed.data, reader).flatMap((issue) => {
        const match = /^filters\.(\d+)$/.exec(issue.path);
        return match ? [[Number(match[1]), issue.message] as const] : [];
      }),
    );
  }, [draft, spec, reader]);

  const update = (id: number, patch: Partial<DraftRow>) =>
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const addRow = () => {
    const field = fields[0];
    if (!field) return;
    setDraft((rows) => [...rows, { id: nextId.current++, field: field.key, op: opsFor(field)[0], value: undefined }]);
  };
  const kept = filters.filter((f) => exclude.includes(f.field));
  const apply = () => {
    onChange([...kept, ...asFilters(draft)]);
    setOpen(false);
  };
  const clear = () => {
    onChange(kept);
    setOpen(false);
  };

  if (fields.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FilterIcon aria-hidden className="size-4" />
          Filters
          {counted > 0 ? <span className="tabular-nums">({counted})</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(40rem,calc(100vw-2rem))]">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Filters</p>
          {draft.length === 0 ? (
            <p className="text-sm text-muted-foreground">No filters. Every row in your branches is shown.</p>
          ) : null}
          {draft.map((row, i) => {
            const field = fieldOf(row.field);
            if (!field) return null;
            const issue = issues.get(i);
            return (
              <div key={row.id} className="flex flex-col gap-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_9rem_1fr_auto] sm:items-start">
                  <Select
                    value={row.field}
                    onValueChange={(key) => {
                      const next = fieldOf(key);
                      if (next) update(row.id, { field: key, op: opsFor(next)[0], value: undefined });
                    }}
                  >
                    <SelectTrigger aria-label="Field" className="h-9 px-3 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.op}
                    onValueChange={(op) => update(row.id, { op: op as ListFilterOp, value: undefined })}
                  >
                    <SelectTrigger aria-label="Condition" className="h-9 px-3 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opsFor(field).map((op) => (
                        <SelectItem key={op} value={op}>
                          {opLabel(field, op)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ValueEditor
                    field={field}
                    op={row.op}
                    value={row.value}
                    onChange={(value) => update(row.id, { value })}
                    refOptions={refOptions}
                    invalid={issue !== undefined}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove the ${field.label.toLowerCase()} filter`}
                    onClick={() => setDraft((rows) => rows.filter((r) => r.id !== row.id))}
                  >
                    <XIcon aria-hidden className="size-4" />
                  </Button>
                </div>
                {issue ? <p className={cn("text-xs text-destructive")}>{issue}</p> : null}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={addRow} disabled={draft.length >= 20}>
              <PlusIcon aria-hidden className="size-4" />
              Add a filter
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clear} disabled={counted === 0 && draft.length === 0}>
                Clear all
              </Button>
              <Button size="sm" onClick={apply} disabled={issues.size > 0}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { FilterPanel };
