"use client";

import { Alert, ComboBox, Description, FieldError, Input, InputGroup, Label, ListBox, TextField } from "@heroui/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActionButton } from "./buttons.tsx";
import { type CountryOption, countryMatches, countryOptions, flagOf, RWANDA } from "./countries.ts";
import { emailTypoMessage, looksLikeEmail, suggestEmailFix } from "./email-typo.ts";
import { Icon } from "./icon.tsx";
import { formatPhone, normalisePhone, phoneFieldText, phoneProblem } from "./phone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// --- CountrySelect ----------------------------------------------------------------------------------

export interface CountrySelectProps {
  label: ReactNode;
  /** Controlled: the chosen ISO code ("RW"), or null. */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (code: string | null) => void;
  /** The form field name: the code is posted under it. */
  name?: string;
  /** The countries to offer. @default every ISO country (the list the API accepts) */
  countries?: readonly CountryOption[];
  /** Offered first, in this order. @default ["RW"] */
  pinned?: readonly string[];
  /** Show each country's flag. @default true */
  showFlags?: boolean;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  description?: ReactNode;
  errorMessage?: string | null;
  className?: string;
}

/**
 * A country, searched by name (accents ignored) or by its code ("ug"), Rwanda first. Its list opens in
 * a layer above dialogs and side panels.
 */
export function CountrySelect({
  label,
  value,
  defaultValue = null,
  onChange,
  name,
  countries,
  pinned = [RWANDA],
  showFlags = true,
  placeholder = "Search countries",
  isRequired,
  isDisabled,
  description,
  errorMessage,
  className,
}: CountrySelectProps) {
  const options = useMemo(() => countryOptions(countries, pinned), [countries, pinned]);
  const byName = useMemo(() => new Map(options.map((c) => [c.name, c])), [options]);
  const [inner, setInner] = useState<string | null>(defaultValue);
  const current = value === undefined ? inner : value;
  const chosen = current ? options.find((c) => c.code === current.toUpperCase()) : undefined;
  return (
    <ComboBox
      fullWidth
      name={name}
      selectedKey={chosen?.code ?? null}
      onSelectionChange={(key) => {
        const code = key == null ? null : String(key);
        if (value === undefined) setInner(code);
        onChange?.(code);
      }}
      defaultFilter={(text, input) => {
        const country = byName.get(text);
        return country ? countryMatches(country, input) : text.toLowerCase().includes(input.toLowerCase());
      }}
      allowsEmptyCollection
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={errorMessage ? true : undefined}
      formValue="key"
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        {showFlags && chosen ? (
          <span aria-hidden="true" className="pointer-events-none absolute start-3 z-10 text-base leading-none">
            {flagOf(chosen.code)}
          </span>
        ) : null}
        <Input placeholder={placeholder} className={showFlags && chosen ? "ps-9" : undefined} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      {description && !errorMessage ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage || undefined}</FieldError>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => <p className="px-3 py-2 text-sm text-muted">No country by that name.</p>}>
          {options.map((c) => (
            <ListBox.Item key={c.code} id={c.code} textValue={c.name}>
              <span className="flex min-w-0 items-center gap-2">
                {showFlags ? (
                  <span aria-hidden="true" className="w-5 shrink-0 text-base leading-none">
                    {flagOf(c.code)}
                  </span>
                ) : null}
                <span className="truncate">{c.name}</span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

// --- PhoneInput -------------------------------------------------------------------------------------

export interface PhoneInputProps {
  label: ReactNode;
  /** Controlled: the number in E.164 (`+250788123456`), or null while empty or not a number yet. */
  value?: string | null;
  defaultValue?: string | null;
  /** The number in E.164 after every keystroke (null while it is not one), and the text as typed. */
  onChange?: (e164: string | null, text: string) => void;
  /** The form field name: the E.164 number is posted under it (the text as typed when it is not one). */
  name?: string;
  /** Also take numbers from other countries, typed with their + code. @default false */
  allowInternational?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** @default "MTN or Airtel" for Rwandan numbers */
  description?: ReactNode;
  /** An error from the schema or the API. Wins over the field's own check. */
  errorMessage?: string | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * A mobile number with +250 in front. People type it the way they write it (`0788 123 456`,
 * `788123456`, `+250 788...`); the field hands back E.164 and tidies the text when they leave it. A number
 * that is not a Rwandan mobile is pointed out after the field is left. With `allowInternational`, a
 * number typed with another + code is taken as it is.
 */
export function PhoneInput({
  label,
  value,
  defaultValue = null,
  onChange,
  name,
  allowInternational = false,
  isRequired,
  isDisabled,
  description,
  errorMessage,
  placeholder = "788 123 456",
  className,
  autoFocus,
}: PhoneInputProps) {
  const rules = { allowInternational };
  const [text, setText] = useState(() => phoneFieldText(value ?? defaultValue ?? ""));
  // A number already there (an edit form) is checked from the start; a new one once the field is left.
  const [left, setLeft] = useState(() => Boolean(value ?? defaultValue));
  const e164 = normalisePhone(text, rules);

  // A new number from outside (a reset, a loaded record) replaces the text unless it is the same number.
  useEffect(() => {
    if (value === undefined) return;
    setText((t) => (normalisePhone(t, { allowInternational }) === value ? t : phoneFieldText(value ?? "")));
  }, [value, allowInternational]);

  const own = left ? phoneProblem(text, rules) : null;
  const problem = errorMessage || own;
  const international =
    allowInternational && /^\s*(\+|00)/.test(text) && !/^\s*\+?\s*250/.test(text.replace(/^00/, "+"));
  const help =
    description ?? (allowInternational ? "Rwandan number, or start with + for another country." : "MTN or Airtel.");

  return (
    <TextField
      fullWidth
      value={text}
      onChange={(next) => {
        setText(next);
        if (left && !phoneProblem(next, rules)) setLeft(false);
        onChange?.(normalisePhone(next, rules), next);
      }}
      onBlur={() => {
        setLeft(true);
        if (e164) setText(international ? formatPhone(e164) : phoneFieldText(e164));
      }}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={problem ? true : undefined}
      autoFocus={autoFocus}
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      <InputGroup>
        {international ? null : (
          <InputGroup.Prefix>
            <span className="tabular">+250</span>
          </InputGroup.Prefix>
        )}
        <InputGroup.Input
          type="tel"
          inputMode="tel"
          autoComplete={allowInternational ? "tel" : "tel-national"}
          placeholder={placeholder}
          className="tabular"
        />
      </InputGroup>
      {help && !problem ? <Description>{help}</Description> : null}
      <FieldError>{problem || undefined}</FieldError>
      {name ? <input type="hidden" name={name} value={e164 ?? text.trim()} /> : null}
    </TextField>
  );
}

// --- EmailInput -------------------------------------------------------------------------------------

export interface EmailTypoState {
  /** The address as it was probably meant, or null when nothing looks wrong. */
  suggestion: string | null;
  /** The person said the address is right as typed: send `confirmEmail: true` with it. */
  kept: boolean;
}

export interface EmailInputProps {
  label: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (email: string) => void;
  /** The typo check after the field is left, and whether the person kept the address as typed. */
  onTypoChange?: (state: EmailTypoState) => void;
  /** The form field name: the trimmed, lower case address is posted under it. */
  name?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  description?: ReactNode;
  /** An error from the schema or the API. Wins over the field's own check. */
  errorMessage?: string | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * An email address that catches the slips nobody means (`.con`, `gmial`) when the field is left, and
 * offers the fix in one tap, or keeping it as typed (a real address can end in `.cm`). The API refuses
 * a likely typo unless `confirmEmail` is sent, so pass `onTypoChange`'s `kept` along.
 */
export function EmailInput({
  label,
  value,
  defaultValue = "",
  onChange,
  onTypoChange,
  name,
  isRequired,
  isDisabled,
  description,
  errorMessage,
  placeholder = "name@example.com",
  className,
  autoFocus,
}: EmailInputProps) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  // An address already there (an edit form) is checked from the start; a new one once the field is left.
  const [left, setLeft] = useState(() => Boolean(current));
  const [kept, setKept] = useState<string | null>(null);
  const clean = current.trim().toLowerCase();
  const suggestion = left ? suggestEmailFix(current) : null;
  const showTypo = suggestion !== null && kept !== clean;
  const own = left && clean && !looksLikeEmail(clean) ? "Enter an email address, like aline@example.com." : null;
  const problem = errorMessage || own;

  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  // Tell the form what the check found, each time it changes.
  const typoKey = `${suggestion ?? ""}|${kept === clean}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `typoKey` sums up what the form is told
  useEffect(() => {
    onTypoChange?.({ suggestion, kept: suggestion !== null && kept === clean });
  }, [typoKey]);

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <TextField
        fullWidth
        type="email"
        value={current}
        onChange={(next) => {
          set(next);
          setLeft(false);
        }}
        onBlur={() => setLeft(true)}
        isRequired={isRequired}
        isDisabled={isDisabled}
        isInvalid={problem ? true : undefined}
        autoFocus={autoFocus}
        className="gap-1"
      >
        <Label>{label}</Label>
        <Input
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
        />
        {description && !problem && !showTypo ? <Description>{description}</Description> : null}
        <FieldError>{problem || undefined}</FieldError>
      </TextField>
      {showTypo && !problem ? (
        <Alert status="warning" className="py-2">
          <Alert.Indicator>
            <Icon name="TriangleExclamation" />
          </Alert.Indicator>
          <Alert.Content className="gap-2">
            <Alert.Title className="text-sm text-pretty">{emailTypoMessage(suggestion)}</Alert.Title>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                icon="Check"
                size="sm"
                onPress={() => {
                  set(suggestion);
                  setKept(null);
                }}
              >
                Use {suggestion}
              </ActionButton>
              <ActionButton size="sm" intent="ghost" onPress={() => setKept(clean)}>
                Keep it
              </ActionButton>
            </div>
          </Alert.Content>
        </Alert>
      ) : null}
      {name ? <input type="hidden" name={name} value={clean} /> : null}
    </div>
  );
}
