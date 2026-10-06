"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  Button,
  Input,
  ListBox,
  Select,
  TextArea as HeroTextArea,
} from "@heroui/react";

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
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
}) {
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
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">
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
      <span className="mt-1.5 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-sm text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
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
            <span className="rounded-full bg-accent-brand/15 px-2 py-0.5 text-2xs font-semibold text-accent-text">
              {badge}
            </span>
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

/** The footer every step shares: back on the left, forward on the right. */
export function StepActions({
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel,
  busy,
  disabled,
}: {
  onBack?: () => void;
  backLabel?: string;
  onNext: () => void;
  nextLabel: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      {onBack ? (
        <Button variant="outline" onPress={onBack}>
          {backLabel}
        </Button>
      ) : null}
      <span className="grow" />
      {/* `isPending` rather than a swapped label alone: it puts the button in
          HeroUI's pending state, which also stops a second press. The old
          version only changed the text and stayed live. */}
      <Button
        variant="primary"
        onPress={onNext}
        isDisabled={busy || disabled}
        isPending={busy}
      >
        {busy ? "Working…" : nextLabel}
      </Button>
    </div>
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
          <span className="text-xs leading-[1.5] text-muted-foreground">
            {blurb}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * A question with two answers (ADR-026, AC-6).
 *
 * Chamber of Tourism and PSF membership used to be checkboxes. A checkbox has
 * one state a person can reach without acting — unticked — and it means both
 * "no" and "I did not read this". These two answers go to a government officer
 * who checks them, so the difference matters: this control has no such state,
 * and `answered` says plainly whether the question has been dealt with.
 *
 * Both stay OPTIONAL in the contract, where each defaults to `false`. What
 * changed is the act, not the requirement.
 *
 * `logo` puts the body's own mark beside the question, so a registrant who
 * knows the chamber by its logo rather than its full name recognises it. The
 * tile is a fixed white ground (`bg-white`, ADR-028) because the artwork is
 * published for a light background: the Chamber of Tourism ring is near-black
 * and would vanish on the dark theme. The image is decorative (`alt=""`); the
 * legend beside it already names the body.
 */
export function YesNoField({
  legend,
  hint,
  value,
  onChange,
  name,
  error,
  logo,
}: {
  legend: string;
  hint?: ReactNode;
  value: boolean | null;
  onChange: (next: boolean) => void;
  name: string;
  /** Why this question cannot be left as it is, shown under the question. */
  error?: string;
  /** The body's official logo, served from `public/`, with its pixel size. */
  logo?: { src: string; width: number; height: number };
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-4">
      {logo ? (
        <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-border bg-white p-1.5">
          <Image
            src={logo.src}
            width={logo.width}
            height={logo.height}
            alt=""
            sizes="96px"
            className="h-full w-auto max-w-full object-contain"
          />
        </span>
      ) : null}
      <span className="min-w-[12rem] flex-1">
        <legend className="text-sm font-semibold">{legend}</legend>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
        {error ? (
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 gap-2" role="radiogroup" aria-label={legend}>
        {[
          { answer: true, label: "Yes" },
          { answer: false, label: "No" },
        ].map(({ answer, label }) => (
          <label
            key={label}
            className={[
              "cursor-pointer rounded border px-4 py-1.5 text-sm font-semibold transition-colors",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              value === answer
                ? "border-accent-brand bg-accent-brand text-accent-brand-foreground"
                : "border-input text-muted-foreground hover:bg-secondary",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              checked={value === answer}
              onChange={() => onChange(answer)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </span>
    </fieldset>
  );
}

/**
 * One line of a review: what was asked on the left, what was answered on the
 * right, and a way back to the step that asked it.
 *
 * The `onEdit` link is the point. A review that a person cannot act on is a
 * wall of text they scroll past, and the last screen before money moves is the
 * worst place to make someone press Back four times to fix a typo.
 */
export function SummaryRow({
  label,
  value,
  onEdit,
  editLabel = "Change",
}: {
  label: string;
  value: ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 items-baseline gap-3 text-right">
        <span className="min-w-0 break-words text-sm">{value}</span>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-xs font-semibold text-accent-text underline underline-offset-2"
          >
            {editLabel}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** A titled block on the review step, so the answers are grouped as they were asked. */
export function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Bytes, as a person reads them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
