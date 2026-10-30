"use client";

import { createContext, isValidElement, useContext, useId, type ReactNode } from "react";
import { CloudOff } from "lucide-react";
import {
  Input,
  ListBox,
  Select,
  TextArea as HeroTextArea,
} from "@heroui/react";
import { Badge } from "@injishi/web-ui";

/**
 * The small shared pieces every step of the wizard uses.
 *
 * Kept together so a field, its label, its hint and its error are laid out the
 * same way on all three steps. Colour comes from semantic tokens only
 * (`text-destructive`, `border-input`, …) — never a hex value or a raw palette
 * class, per the root AGENTS.md rule.
 *
 * The controls are HeroUI's. `TextInput` and `TextArea` below replaced
 * `<input className="field">`, which drew its own box at `--radius-lg`
 * (0.5rem) while the theme asks for an extra-small form radius
 * (`--field-radius`, 0.125rem) — so every control in the wizard was rounder
 * than every control in the rest of the app. HeroUI reads the field roles
 * directly, which is what keeps the two in step without a second rule to
 * remember.
 */

/** A single-line control. Replaces `<input className="field">`. */
export const TextInput = Input;

/** A multi-line control. Replaces `<textarea className="field">`. */
export const TextArea = HeroTextArea;

/**
 * An empty string is a real answer on one of these fields ("Rather not say"),
 * but React Aria reads an empty key as NO selection, so the two cannot share a
 * value. This sentinel carries "" through the list and is unwrapped on the way
 * back out, which keeps `""` meaning the same thing to the draft as it always
 * has.
 */
const EMPTY_KEY = "__empty__";
const FieldLabelId = createContext<string | null>(null);

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A dropdown. Replaces `<select className="field">`.
 *
 * HeroUI's Select is a listbox rather than a native control, so the options are
 * data here instead of `<option>` children — that is the whole reason this
 * wrapper exists, so nine call sites are not each spelling out a Trigger, a
 * Value, an Indicator, a Popover and a ListBox.
 *
 * The old empty first row is gone. It was a fake option standing in for "not
 * chosen yet"; `placeholder` says the same thing without being selectable, so
 * a person can no longer pick "Choose a province" and have it count as an
 * answer. Where the empty value IS an answer, pass it as a normal option and
 * the sentinel above carries it.
 *
 * `disabled` stays the prop name even though React Aria calls it `isDisabled`.
 * These are form fields written against the DOM vocabulary and the cascade in
 * `AddressPicker` reads much better as `disabled={!draft.provinceId}`.
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  invalid,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  /** For a standalone select, such as the country code inside PhoneInput. */
  ariaLabel?: string;
}) {
  const fieldLabelId = useContext(FieldLabelId);
  const toKey = (v: string) => (v === "" ? EMPTY_KEY : v);
  const fromKey = (k: unknown) => {
    const key = k === null || k === undefined ? "" : String(k);
    return key === EMPTY_KEY ? "" : key;
  };
  // `null`, not `""` — React Aria reads an empty key as a selected item with an
  // empty id, which then renders a blank row instead of the placeholder.
  const selected = value === "" && !options.some((o) => o.value === "")
    ? null
    : toKey(value);

  return (
    <Select
      selectedKey={selected}
      onSelectionChange={(key) => onChange(fromKey(key))}
      isDisabled={disabled}
      isInvalid={invalid}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : fieldLabelId ?? undefined}
      className="w-full"
    >
      <Select.Trigger id={id} className="w-full">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={toKey(option.value)}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** One labelled control, with room for a hint and a validation message. */
export function Field({
  label,
  hint,
  error,
  required,
  composite = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** A compound control labels its parts individually and cannot sit in a label. */
  composite?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();
  const selectChild = isValidElement(children) && children.type === SelectField;
  const content = (
    <>
      <span id={selectChild ? labelId : undefined} className="text-sm font-semibold">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {selectChild || composite ? (
        <div className="mt-1.5">{children}</div>
      ) : (
        <span className="mt-1.5 block">{children}</span>
      )}
      {error ? (
        <span className="mt-1 block text-sm text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
  // A Select renders a button and its own hidden label/select. Nesting it inside
  // an HTML label makes the option box's trigger ambiguous to browsers and AT.
  if (selectChild || composite) {
    return (
      <FieldLabelId.Provider value={selectChild ? labelId : null}>
        <div className="block">{content}</div>
      </FieldLabelId.Provider>
    );
  }
  return <label className="block">{content}</label>;
}

/** A group of related choices that is not a single labelled input. */
export function Fieldset({
  legend,
  hint,
  error,
  children,
}: {
  legend: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="block">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * A large pickable card — the accommodation classes, the registrant roles.
 *
 * A real radio input underneath rather than a div with a click handler, so
 * arrow keys, the focus ring, and a screen reader all work without being
 * reimplemented.
 *
 * It stays a NATIVE radio while every other control in this wizard is HeroUI's,
 * and that is a decision rather than an oversight. HeroUI's `Radio` only works
 * inside a `RadioGroup`, which owns the selection for the whole group; this
 * component owns its own `checked` and is rendered nine times across four
 * files. Wrapping each card in a group of ONE would compile and would make a
 * screen reader announce "group, 1 item" per card — a worse control than the
 * correct native group these already form through their shared `name`.
 * Converting properly means lifting selection into a `RadioGroup` at all nine
 * call sites, which is a restructure, not a swap.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  title,
  description,
  badge,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  title: string;
  description?: string;
  /**
   * A short mark shown beside the title, checked cards only — the state that
   * says WHY this card is already picked, so an answer carried in from
   * another page shows on the control that asks the question rather than in
   * a separate paragraph above it.
   */
  badge?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer flex-col gap-1 rounded-card border p-4 transition-colors",
        checked
          ? "border-accent-brand bg-accent-brand/10"
          : "border-input hover:bg-secondary",
      ].join(" ")}
    >
      <span className="flex items-start gap-2">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onSelect(value)}
          className="mt-1"
        />
        <span className="flex flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{title}</span>
          {checked && badge ? (
            <Badge variant="accent" size="sm">
              {badge}
            </Badge>
          ) : null}
        </span>
      </span>
      {description ? (
        <span className="pl-6 text-xs text-muted-foreground">{description}</span>
      ) : null}
    </label>
  );
}

/** A message the person has to read before they can carry on. */
export function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-border bg-secondary text-secondary-foreground",
    warning: "border-warning/40 bg-warning/10 text-foreground",
    danger: "border-destructive/40 bg-destructive/10 text-foreground",
    success: "border-success/40 bg-success/10 text-foreground",
  }[tone];
  return (
    <div className={`rounded-card border p-4 text-sm ${toneClass}`} role="status">
      {children}
    </div>
  );
}

/**
 * Said beside the one thing that cannot be done offline (ADR-075 S9): the TIN
 * check, an upload, the ID scan, paying. Everything else carries on, and the
 * answers are kept on this phone meanwhile, which the header already says.
 */
export function Offline({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CloudOff size={14} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

/**
 * RWF, grouped, with no currency guessing.
 *
 * Re-exported rather than defined here: the definition lives in `lib/money.ts`,
 * where a server render can reach it without pulling this `"use client"`
 * module in (`/host/start` was that server render, and printed the fee).
 */
export { formatRwf } from "@/lib/money";

/**
 * A pickable tile — an icon, a label, a line of explanation.
 *
 * The registration card's own control, and a different animal from
 * `ChoiceCard`. `ChoiceCard` is a wide row for two or three long options that
 * need a sentence each; this is a small square for ten short ones that need a
 * mark to be told apart at a glance. Ten `ChoiceCard`s is a wall of text and no
 * shape, which is what the two-question version was avoiding by splitting them.
 *
 * A real radio underneath, for the same reason `ChoiceCard` keeps one: arrow
 * keys, the focus ring and the screen reader all work without being rebuilt.
 * The input is visually hidden rather than removed, so the group is a real
 * radio group and not a div that listens for clicks.
 *
 * A press on the tile that is ALREADY picked still answers. A radio fires no
 * change when it is checked again, so after Change reopened the chooser, the
 * kind already chosen could not be chosen again to close it; the click is
 * caught for that one case, and a press on any other tile stays the change.
 */
export function TileCard({
  name,
  value,
  checked,
  label,
  blurb,
  icon,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  blurb?: string;
  icon?: ReactNode;
  onSelect: (value: string) => void;
}) {
  return (
    <label
      className={[
        "group relative flex h-full cursor-pointer flex-col gap-2.5 rounded-card border p-4 transition-colors",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        checked
          ? "border-accent-brand bg-accent-brand/10"
          : "border-input hover:border-accent-brand/50 hover:bg-secondary",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        onClick={() => {
          if (checked) onSelect(value);
        }}
        className="sr-only"
      />
      {icon ? (
        <span
          className={[
            "flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors",
            checked
              ? "border-accent-brand bg-accent-brand text-accent-brand-foreground"
              : "border-border text-foreground",
          ].join(" ")}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {blurb ? (
          <span className="text-xs leading-normal text-muted-foreground">
            {blurb}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * A wide pickable tile with an icon, a title and a line under it: the
 * artboard's "Who is registering it?" and "Apply now / Not now" choices. A real
 * radio underneath, visually hidden, for the reason `TileCard` keeps one.
 */
export function ChoiceTile({
  name,
  checked,
  title,
  description,
  icon,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        checked ? "border-accent-brand bg-accent-brand/10" : "border-input hover:bg-secondary",
      ].join(" ")}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {icon ? <span className={checked ? "mt-0.5 text-accent-text" : "mt-0.5 text-muted-foreground"}>{icon}</span> : null}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

/** Bytes, as a person reads them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
