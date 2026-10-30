"use client";

/**
 * The timing and the wording of the toast stack, shared by the operator store
 * and the console store.
 *
 * Both used to hold a `TOAST_MS` of their own and a single timer over the whole
 * queue, which is two bugs in one line. Four and a half seconds is generous for
 * "Saved" and nowhere near enough for a thirty word refusal that says what to
 * check — and the operator store's timer dismissed the NEWEST toast, so a
 * message that arrived while another was on screen took the other one's place
 * in the queue and the older one sat there until something else displaced it.
 *
 * So each message gets its own timer, sized by `toastDwellMs` from the words it
 * carries, and a message never leaves before the one above it: the stack reads
 * top to bottom in the order things happened, and it stays that way.
 */

import { useEffect, useMemo, useRef } from "react";
import { toastDwellMs, type Toast as ShownToast, type ToastTone } from "../legacy-ui";

import type { Intent } from "../data/types";

/** A toast as either store holds it. */
export interface QueuedToast {
  id: number;
  txt: string;
  intent: Intent;
}

/**
 * The app's six intents onto the shared component's four tones.
 *
 * `info`, `accent` and `neutral` are all "here is a fact" — they differ in how
 * a BADGE is painted, which a toast has no equivalent of. Collapsing them is
 * the point of the shared vocabulary: a toast's tone chooses an icon and how
 * long the message stays, and those three want the same answer to both.
 */
const TONE: Record<Intent, ToastTone> = {
  ok: "success",
  bad: "danger",
  warn: "warning",
  info: "neutral",
  accent: "neutral",
  neutral: "neutral",
};

/** The store's queue, in the shape `<Toaster />` renders. */
export function toShownToasts(toasts: readonly QueuedToast[]): ShownToast[] {
  return toasts.map((t) => ({ id: String(t.id), message: t.txt, tone: TONE[t.intent] }));
}

/**
 * Give every toast its own timer, and dismiss them oldest first.
 *
 * Lives with the store rather than with the renderer because the STORE owns the
 * queue: a message has to expire whether or not a shell happens to be mounted,
 * and two mounted renderers must not run two sets of timers over one list.
 *
 * `dismiss` must be stable — a `dispatch`, or a `useCallback` with no deps.
 */
export function useToastExpiry(
  toasts: readonly QueuedToast[],
  dismiss: (id: number) => void,
): void {
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  /** When the last message on the stack is due to go, so none overtakes it. */
  const lastDue = useRef(0);

  useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timers.current) {
      if (live.has(id)) continue;
      clearTimeout(timer);
      timers.current.delete(id);
    }

    const now = Date.now();
    for (const toast of toasts) {
      if (timers.current.has(toast.id)) continue;
      const tone = TONE[toast.intent];
      const due = Math.max(now + toastDwellMs(toast.txt, tone), lastDue.current);
      lastDue.current = due;
      timers.current.set(
        toast.id,
        setTimeout(() => {
          timers.current.delete(toast.id);
          dismiss(toast.id);
        }, due - now),
      );
    }
  }, [toasts, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);
}

/** The same list, memoised, so the renderer's presence tracking stays still. */
export function useShownToasts(toasts: readonly QueuedToast[]): ShownToast[] {
  return useMemo(() => toShownToasts(toasts), [toasts]);
}
