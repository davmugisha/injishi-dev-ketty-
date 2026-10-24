"use client";

import { Description, FieldError, Label, ListBox, NumberField, Select } from "@heroui/react";
import type { ReactNode } from "react";
import { RWF_MAX } from "./money.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface SelectOption {
  id: string;
  label: string;
  /** One muted line under the option in the list. */
  description?: string;
}

/**
 * A labelled single choice from a list of five or more (two to four fixed choices are radio cards).
 * Its list opens in a layer above dialogs and side panels, so it works inside both.
 */
export function SelectField({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  placeholder = "Choose one",
  isRequired,
  isDisabled,
  description,
  errorMessage,
  className,
}: {
  label: ReactNode;
  options: readonly (string | SelectOption)[];
  /** Controlled selection; null while nothing is chosen. */
  value?: string | null;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** The form field name: the chosen id is posted under it, and `validationErrors` find it by it. */
  name?: string;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  description?: ReactNode;
  errorMessage?: string | null;
  className?: string;
}) {
  const items: SelectOption[] = options.map((o) => (typeof o === "string" ? { id: o, label: o } : o));
  return (
    <Select
      fullWidth
      name={name}
      value={value === undefined ? undefined : value}
      defaultValue={defaultValue}
      onChange={(k) => (k != null && onChange ? onChange(String(k)) : undefined)}
      placeholder={placeholder}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={errorMessage ? true : undefined}
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Select.Popover>
        <ListBox>
          {items.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              <span className="flex min-w-0 flex-col">
                <span>{o.label}</span>
                {o.description ? <span className="text-xs text-muted">{o.description}</span> : null}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export interface MoneyInputProps {
  label: ReactNode;
  /** Controlled value in whole francs; null while empty. */
  value?: number | null;
  defaultValue?: number;
  onChange?: (value: number | null) => void;
  /** The form field name, for forms posted to a server action. */
  name?: string;
  /** @default 0 */
  minValue?: number;
  /** @default RWF_MAX (ten billion) */
  maxValue?: number;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** One short helper line under the field. Hidden while the field shows an error. */
  description?: ReactNode;
  /** The error to show (from the shared zod schema or the API). Marks the field invalid. */
  errorMessage?: string | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * An amount in whole Rwandan francs: thousands separators, no decimals, kept within `minValue`..`maxValue`.
 * Any whole amount is allowed (no snapping to round numbers).
 */
export function MoneyInput({
  label,
  value,
  defaultValue,
  onChange,
  name,
  minValue = 0,
  maxValue = RWF_MAX,
  isRequired,
  isDisabled,
  description,
  errorMessage,
  placeholder,
  className,
  autoFocus,
}: MoneyInputProps) {
  return (
    <NumberField
      fullWidth
      name={name}
      value={value === undefined ? undefined : (value ?? Number.NaN)}
      defaultValue={defaultValue}
      onChange={onChange ? (v) => onChange(Number.isNaN(v) ? null : Math.round(v)) : undefined}
      minValue={minValue}
      maxValue={maxValue}
      step={1}
      formatOptions={{ maximumFractionDigits: 0, useGrouping: true }}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={errorMessage ? true : undefined}
      autoFocus={autoFocus}
      className={cx("gap-1", className)}
    >
      <Label>
        {label}
        <span className="sr-only"> in Rwandan francs</span>
      </Label>
      <NumberField.Group className="flex">
        <span aria-hidden="true" className="flex shrink-0 items-center pl-3 text-sm text-muted">
          RWF
        </span>
        <NumberField.Input className="min-w-0 flex-1 tabular" placeholder={placeholder} />
      </NumberField.Group>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </NumberField>
  );
}
