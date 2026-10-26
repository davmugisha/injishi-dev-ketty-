"use client";

import { Description, FieldError, Input, Label, NumberField, Switch, TextArea, TextField } from "@heroui/react";
import { type ReactNode, useId } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A labelled text field whose errors come from the form's `validationErrors` (by `name`) or `errorMessage`. */
export function TextInput({
  label,
  name,
  value,
  onChange,
  description,
  errorMessage,
  isRequired,
  placeholder,
  inputMode,
  autoFocus,
  multiline,
  className,
}: {
  label: ReactNode;
  name: string;
  value: string;
  onChange: (value: string) => void;
  description?: ReactNode;
  errorMessage?: string | null;
  isRequired?: boolean;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoFocus?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <TextField
      name={name}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isInvalid={errorMessage ? true : undefined}
      fullWidth
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      {multiline ? (
        <TextArea rows={3} placeholder={placeholder} />
      ) : (
        <Input placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} />
      )}
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

/** A whole number with its unit after it ("days", "m²"); null while empty. */
export function CountInput({
  label,
  name,
  value,
  onChange,
  minValue = 0,
  maxValue,
  unit,
  description,
  errorMessage,
  isRequired,
  className,
}: {
  label: ReactNode;
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  description?: ReactNode;
  errorMessage?: string | null;
  isRequired?: boolean;
  className?: string;
}) {
  return (
    <NumberField
      name={name}
      value={value ?? Number.NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : Math.round(v))}
      minValue={minValue}
      maxValue={maxValue}
      step={1}
      formatOptions={{ maximumFractionDigits: 0, useGrouping: false }}
      isRequired={isRequired}
      isInvalid={errorMessage ? true : undefined}
      fullWidth
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      <NumberField.Group className="flex">
        <NumberField.Input className="min-w-0 flex-1 tabular" />
        {unit ? (
          <span aria-hidden="true" className="flex shrink-0 items-center pr-3 text-sm text-muted">
            {unit}
          </span>
        ) : null}
      </NumberField.Group>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </NumberField>
  );
}

/** An on/off choice with its words beside it, a whole row wide. */
export function SwitchRow({
  label,
  description,
  isSelected,
  onChange,
  name,
}: {
  label: ReactNode;
  description?: ReactNode;
  isSelected: boolean;
  onChange: (on: boolean) => void;
  name?: string;
}) {
  const id = useId();
  return (
    <div className="flex w-full items-start justify-between gap-4">
      <span id={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
      <Switch isSelected={isSelected} onChange={onChange} name={name} aria-labelledby={id} className="mt-0.5 shrink-0">
        {/* The clickable part: without Switch.Content the control is drawn but takes no press. */}
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}

/** Field errors from an action, with the whole-form error left out. */
export function fieldErrorsOnly(errors: Record<string, string> | undefined): Record<string, string> {
  if (!errors) return {};
  const { _: _whole, ...rest } = errors;
  return rest;
}
