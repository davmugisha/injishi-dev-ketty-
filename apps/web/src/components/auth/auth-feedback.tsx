"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert } from "lucide-react";

/**
 * The small feedback parts every sign-in screen needs, defined once.
 *
 * They exist because the four auth screens each had their own answer to the
 * same three moments, and all three answers were the thin one:
 *
 *  - a refusal was a centred `role="status"` line in destructive ink, with no
 *    icon and no entrance. Colour alone carried "this is an error", it blinked
 *    into place, and `status` is polite — a screen reader reached it whenever it
 *    got round to it, which for the answer to a press is too late.
 *  - a wait was "Sending…", and a cold send measured 17.7 s (see
 *    `AUTH_TIMEOUT_MS`). Seventeen seconds of a word with an ellipsis is how a
 *    person decides the thing is broken and starts pressing again.
 *  - a success navigated instantly, so the last thing anyone saw was the button
 *    they had pressed still saying "Verify".
 *
 * Nothing here is decoration: each one is the missing half of a state the
 * screens were already in.
 */

/**
 * How long to leave somebody alone after a refusal before taking their focus.
 *
 * Moving the caret in the same frame as the error appears means the message is
 * announced against a moving focus and the person is typing before they have
 * read why. A beat is enough to read the line and still land where they need to
 * be, without a second press.
 */
export const RECOVERY_MS = 300;

/**
 * How long a success stays on screen before the navigation takes it away.
 *
 * NOT motion, so reduced motion does not shorten it: it is the moment the
 * product says "that worked" before the page goes. Without it a correct code
 * looks identical to a page that reloaded on its own.
 */
export const ACKNOWLEDGE_MS = 500;

/** When a wait stops being ordinary and needs a word about itself. */
export const SLOW_MS = 6_000;

/**
 * True once `active` has been true for `ms` without interruption.
 *
 * Resets the moment the work finishes, so the hint cannot outlive the wait it
 * was explaining.
 */
export function useSlow(active: boolean, ms: number = SLOW_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && slow;
}

/**
 * Schedule work that must not run after the screen has gone.
 *
 * Every delayed action here moves focus or navigates, and both are bugs once
 * the component is unmounted.
 */
export function useLater(): (ms: number, run: () => void) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);
  return useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  }, []);
}

/**
 * A refusal that is the answer to a press.
 *
 * `alert` rather than `status` because the person is waiting for exactly this
 * sentence; an icon because colour must not be the only signal (WCAG 1.4.1);
 * `animate-settle-in` because a line that appears without moving reads as a
 * line that was always there.
 */
export function InlineError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={`animate-settle-in text-center text-sm font-medium text-destructive ${className ?? ""}`}
    >
      <CircleAlert className="mr-1.5 inline size-4 shrink-0 align-[-3px]" aria-hidden />
      {children}
    </p>
  );
}

/** A quiet line that is news rather than a refusal: sent, still sending, expired. */
export function InlineNote({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={`animate-settle-in text-center text-sm text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

/** The check a button wears for the half-second between "done" and "gone". */
export function DoneMark() {
  return <Check className="size-4 shrink-0 animate-acknowledge" aria-hidden />;
}
