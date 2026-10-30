"use client";

import { InputOTP, Label, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { type ClipboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ActionButton } from "./buttons.tsx";
import { CODE_LENGTH, completion, formatCountdown, pasteIntoCode } from "./code-row.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface CodeInputProps {
  /** Controlled: the digits typed so far. */
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  /**
   * The code ARRIVED (`code-row.ts`): the last digit went in, a whole code was pasted or autofilled, or the
   * last digit was typed again. Fired once per code, never twice in a row for the same one. Check the
   * code here without a press; keep a button for anybody who edits a digit in the middle.
   */
  onComplete?: (code: string) => void;
  /** @default 6 */
  length?: number;
  /** @default "Code from your email" */
  label?: ReactNode;
  /** One helper line ("We sent it to aline@example.com"). Hidden while an error shows. */
  description?: ReactNode;
  /** "That code is not right. Check the email and try again." Marks the boxes invalid. */
  errorMessage?: string | null;
  isDisabled?: boolean;
  autoFocus?: boolean;
  /** The form field name: the code is posted under it. */
  name?: string;
  className?: string;
}

/**
 * A one-time code, one box per digit (HeroUI InputOTP). Typing moves forward and Backspace back; a code
 * pasted into any box fills every box from the first, even with words around it ("Your code is
 * 047600."), and is checked once. Phones offer the code from the email or SMS as autofill.
 */
export function CodeInput({
  value,
  defaultValue = "",
  onChange,
  onComplete,
  length = CODE_LENGTH,
  label = "Code from your email",
  description,
  errorMessage,
  isDisabled,
  autoFocus,
  name,
  className,
}: CodeInputProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  // The latest value and the code last handed to onComplete, read inside event handlers.
  const latest = useRef(current);
  latest.current = current;
  const fired = useRef<string | null>(null);

  const apply = (next: string, how: "type" | "paste") => {
    const previous = latest.current;
    latest.current = next;
    if (value === undefined) setInner(next);
    onChange?.(next);
    const result = completion(fired.current, previous, next, how, length);
    fired.current = result.lastFired;
    if (result.fire) onComplete?.(next);
  };

  // Read every paste ourselves, before the field does: a whole code fills from the first box wherever
  // it lands, and words around it are dropped.
  const onPasteCapture = (event: ClipboardEvent<HTMLDivElement>) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const at = input?.selectionStart ?? latest.current.length;
    const pasted = pasteIntoCode(latest.current, event.clipboardData.getData("text"), at, length);
    event.preventDefault();
    event.stopPropagation();
    if (pasted) apply(pasted.next, pasted.whole ? "paste" : "type");
  };

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className={cx("flex flex-col gap-1", className)} onPasteCapture={onPasteCapture}>
      <Label htmlFor={id} isInvalid={Boolean(errorMessage)} isDisabled={isDisabled}>
        {label}
      </Label>
      <InputOTP
        id={id}
        name={name}
        maxLength={length}
        value={current}
        onChange={(next) => apply(next, "type")}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        isInvalid={Boolean(errorMessage)}
        isDisabled={isDisabled}
        autoFocus={autoFocus}
        aria-describedby={errorMessage ? errorId : description ? helpId : undefined}
        textAlign="center"
      >
        <InputOTP.Group className="flex w-full max-w-sm gap-2">
          {Array.from({ length }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one box per digit position, fixed for the field's life
            <InputOTP.Slot key={i} index={i} className="h-12 min-w-0 flex-1 text-lg font-semibold tabular" />
          ))}
        </InputOTP.Group>
      </InputOTP>
      {errorMessage ? (
        <p id={errorId} role="alert" className="px-1 text-xs text-danger">
          {errorMessage}
        </p>
      ) : description ? (
        <p id={helpId} className="px-1 text-xs text-pretty text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export interface ResendTimer {
  /** Whole seconds until a new code may be sent; 0 when it may. */
  secondsLeft: number;
  canResend: boolean;
  /** Start waiting again, after a code was sent (the API says how long). */
  restart: (seconds?: number) => void;
  /** "0:42". */
  countdown: string;
}

/**
 * The wait before "Send a new code" works again, counted against a deadline (so a tab in the background
 * comes back right). Starts at `seconds` on mount; 0 starts ready.
 */
export function useResendTimer(seconds: number): ResendTimer {
  const [deadline, setDeadline] = useState<number | null>(() => (seconds > 0 ? Date.now() + seconds * 1000 : null));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= deadline) setDeadline(null);
    }, 250);
    return () => window.clearInterval(tick);
  }, [deadline]);
  const restart = useCallback(
    (next: number = seconds) => {
      const at = Date.now();
      setNow(at);
      setDeadline(next > 0 ? at + next * 1000 : null);
    },
    [seconds],
  );
  const secondsLeft = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return { secondsLeft, canResend: secondsLeft === 0, restart, countdown: formatCountdown(secondsLeft) };
}

/** "Send a new code", waiting out the timer first ("New code in 0:42"). */
export function ResendCodeButton({
  timer,
  onResend,
  isPending,
  label = "Send a new code",
  className,
}: {
  timer: ResendTimer;
  onResend: () => void;
  isPending?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <ActionButton
      icon="ArrowRotateRight"
      size="sm"
      intent="ghost"
      isPending={isPending}
      isDisabled={!timer.canResend}
      onPress={onResend}
      className={className}
    >
      {timer.canResend ? label : <span className="tabular">New code in {timer.countdown}</span>}
    </ActionButton>
  );
}
