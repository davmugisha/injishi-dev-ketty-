/**
 * "Which of these five desks has said something I have not read?"
 *
 * A SEPARATE, TINY STORE, and the reason is ownership rather than taste.
 * `lib/order-store.ts` holds what was said and what was ordered — facts about
 * the hotel, shared with the operator side. Whether THIS person has looked at
 * a thread is a fact about one browser and belongs to nobody else, and writing
 * it into the conversation record would mean a guest opening their inbox
 * mutated the conversation. So it lives here, keyed by thread, and the chat
 * store stays a log.
 *
 * IT MARKS A MESSAGE ID, NOT A TIME. The obvious implementation stores "last
 * opened at" and counts everything newer. That reads the clock, which makes the
 * unread count depend on when the render happened — and a value derived from
 * `Date.now()` differs between the server and the browser, which is the defect
 * `order-store.ts` warns about at the top. An id is a fact about the log: the
 * count is "messages after this one", and it is the same answer on every render
 * until the log itself changes.
 *
 * SERVER SAFETY, same contract as the two stores it sits beside: every read and
 * write is guarded on `typeof window` and wrapped in `try`, so this module may
 * be imported by a file that also renders on the server and works in a browser
 * that refuses site data. The read answers `{}` there, which means "everything
 * is unread" — the safe direction, because a badge that should not be there is
 * a smaller failure than a message the guest is never told about.
 */

import type { ChatThread } from "@/lib/order-store";

const STORAGE_KEY = "injishi:inbox-read";

/**
 * Fired on every write, because `storage` is not delivered to the tab that
 * wrote it. The rail and the conversation are on screen together on a desktop
 * viewport, so without this the badge would still say 2 while the guest reads
 * the two messages beside it.
 */
export const INBOX_READ_CHANGE_EVENT = "injishi:inbox-read-change";

/** Thread id -> the id of the last message the guest has seen in it. */
export type ReadMarks = Record<string, string>;

function parseMarks(value: unknown): ReadMarks {
  if (typeof value !== "object" || value === null) return {};
  const out: ReadMarks = {};
  for (const [threadId, messageId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof messageId === "string") out[threadId] = messageId;
  }
  return out;
}

/** Every mark this browser holds, or none. Safe on the server. */
export function readInboxMarks(): ReadMarks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return parseMarks(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Record that the guest has now seen everything up to `lastMessageId`.
 *
 * A no-op when the mark is already where it would be written, so the effect
 * that calls this on every render of an open conversation does not dispatch a
 * change event into its own listener and spin.
 */
export function markThreadRead(threadId: string, lastMessageId: string): void {
  if (typeof window === "undefined") return;
  const marks = readInboxMarks();
  if (marks[threadId] === lastMessageId) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...marks, [threadId]: lastMessageId }),
    );
    window.dispatchEvent(new Event(INBOX_READ_CHANGE_EVENT));
  } catch {
    /* A browser refusing site data simply keeps showing the badge. */
  }
}

/**
 * How many messages in this thread the guest has not seen.
 *
 * The guest's OWN messages never count, whichever side of the mark they fall:
 * an inbox that told you that you had one unread message because you had just
 * sent one would be nonsense. An unknown or missing mark counts everything the
 * desks have said, which is what makes a first visit show the five opening
 * exchanges as new rather than as already read.
 */
export function unreadIn(thread: ChatThread, marks: ReadMarks): number {
  const mark = marks[thread.id];
  const at = mark === undefined ? -1 : thread.messages.findIndex((m) => m.id === mark);
  return thread.messages.slice(at + 1).filter((message) => message.from !== "guest").length;
}

/** Listen for a mark written here or in another tab. Returns its own teardown. */
export function subscribeInboxRead(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(INBOX_READ_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(INBOX_READ_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
