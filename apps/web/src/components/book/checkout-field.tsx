"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { caretAfterFormat } from "@/lib/payment-methods";

/**
 * The grouped-box form family the payment step is built from.
 *
 * `booking-widget.tsx` already carries this exact idea for the date and guest
 * picker — "one box, three cells, hairlines between" — because that is what
 * turns three separate fields into one question the card is asking. The card
 * form in capture 2 is the same idea run over more rows: card number above
 * expiry-and-CVV in one box, first-and-last name in a second, the billing
 * address in a third. `CheckoutFieldGroup` is that box.
 *
 * Every field keeps a small always-visible label rather than the capture's
 * placeholder-only text. A placeholder is not a label — it disappears the
 * moment a guest types, which is the WCAG failure `ui-registry.md` requires
 * this codebase avoid. `FieldButton` in the booking widget already shows a
 * label this way, so this keeps the app speaking one visual language instead
 * of introducing a second, less accessible one for one screen.
 */
export function CheckoutFieldGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded border border-input ${className}`}>
      {children}
    </div>
  );
}

export function CheckoutField({
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  disabled,
  reformats = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  type?: "text" | "tel";
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel";
  placeholder?: string;
  disabled?: boolean;
  /**
   * True when the caller passes a value it has REFORMATTED — a grouped card
   * number, a punctuated expiry. The field then restores the caret after the
   * same digit the guest was editing, instead of letting the browser drop it at
   * the end of the rebuilt string. See `caretAfterFormat`.
   */
  reformats?: boolean;
}) {
  /*
   * The error has to be REACHABLE from the input, not merely next to it.
   *
   * This field set `aria-invalid` and then rendered the message in a bare
   * span. A screen reader therefore said "invalid" and stopped: the sentence
   * that says what to do — "That is an Airtel Money number. Pick Airtel Money
   * above" — was orphaned from the control it was about. `aria-describedby`
   * is what joins them, and it needs a stable id on both sides, which is what
   * `useId` is for (it also survives hydration, which a counter would not).
   *
   * The colour is `text-danger-text`, not `text-destructive`. `--danger` is a
   * FILL role, tuned so `--danger-foreground` reads on it; as 12px text on a
   * surface it measures 3.63:1 in dark theme, under the 4.5:1 that binds here.
   * `--danger-text` is the same hue and chroma with lightness moved just far
   * enough, the way `--accent-text` already is for the accent.
   */
  const id = useId();
  const errorId = `${id}-error`;

  const input = useRef<HTMLInputElement>(null);
  /**
   * What the guest typed, and where their caret was in it, kept until the
   * reformatted `value` comes back down as a prop. The new string is not
   * knowable at the moment of the keystroke — the parent strips and re-groups
   * it — so the caret is resolved on the next paint, against the value that
   * actually arrived.
   */
  const typed = useRef<{ text: string; at: number } | null>(null);

  useLayoutEffect(() => {
    const pending = typed.current;
    typed.current = null;
    if (!pending || !input.current) return;
    const at = caretAfterFormat(value, pending.at, pending.text);
    // A no-op on an unfocused field, which is the correct behaviour: this must
    // never pull focus, only preserve a caret that is already there.
    if (document.activeElement === input.current) {
      input.current.setSelectionRange(at, at);
    }
  }, [value]);

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-2.5" htmlFor={id}>
      <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-page-fg">
        {label}
      </span>
      <input
        ref={input}
        id={id}
        type={type}
        value={value}
        onChange={(event) => {
          if (reformats) {
            typed.current = {
              text: event.target.value,
              at: event.target.selectionStart ?? event.target.value.length,
            };
          }
          onChange(event.target.value);
        }}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-page-fg outline-none placeholder:text-page-fg-70 disabled:opacity-50"
      />
      {error ? (
        <span id={errorId} className="text-xs text-danger-text">
          {error}
        </span>
      ) : null}
    </label>
  );
}

