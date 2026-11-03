// The real outbox, as the outbox screen draws it (mobile spec 0003, AC-8; prototype `shared-05-outbox`):
// the rows on this phone, sorted into waiting, refused and sent today, each named by its kind and
// saying what others still see meanwhile. The shared outbox screen reads this in api mode through
// `features/shared/data.ts`; sample data mode never calls it.

import { type OutboxRow, sentToday } from "@/data/outbox";
import { kinds } from "@/data/outbox/kinds";
import { isUnsent, STILL_TRYING_AFTER } from "@/data/outbox/rules";
import type { OutboxItem, OutboxView } from "@/features/shared/types";
import { kigaliTime } from "@/lib/kigali";

function label(row: OutboxRow): string {
  return kinds[row.kind]?.label(row) ?? "A change";
}

/** "Saved 07:02 · your manager doesn't see you clocked in yet", or why it is still trying. */
function waitingWords(row: OutboxRow, offset: number): string {
  const others = kinds[row.kind]?.othersSee(row);
  const saved = `Saved ${kigaliTime(row.createdAt + offset)}`;
  const reason = row.state === "waiting_retry" && row.serverMessage ? row.serverMessage : null;
  return [saved, reason, others?.toLowerCase()].filter(Boolean).join(" · ");
}

function waitingItem(row: OutboxRow, offset: number): OutboxItem {
  return {
    id: row.id,
    icon: "Clock",
    title: label(row),
    detail: waitingWords(row, offset),
    state: row.attempts >= STILL_TRYING_AFTER ? "trying" : row.state === "sending" ? "sending" : "waiting",
  };
}

function refusedItem(row: OutboxRow, offset: number): OutboxItem {
  return {
    id: row.id,
    icon: "CircleExclamation",
    title: label(row),
    detail: `Saved ${kigaliTime(row.createdAt + offset)} · ${row.serverMessage ?? "Injishi couldn't accept this."}`,
    state: "refused",
  };
}

function sentItem(row: OutboxRow, offset: number): OutboxItem {
  return {
    id: row.id,
    icon: "CircleCheck",
    title: label(row),
    detail: [
      `Done ${kigaliTime(row.createdAt + offset)}`,
      `sent ${kigaliTime((row.sentAt ?? row.createdAt) + offset)}`,
      row.serverMessage,
    ]
      .filter(Boolean)
      .join(" · "),
    state: "sent",
  };
}

/** One account's rows as the screen's view; `signedIn` false when nobody is (the screen then leaves). */
export function outboxViewOf(rows: readonly OutboxRow[], offset: number, signedIn: boolean): OutboxView {
  return {
    signedIn,
    waiting: rows.filter(isUnsent).map((row) => waitingItem(row, offset)),
    refused: rows.filter((row) => row.state === "refused").map((row) => refusedItem(row, offset)),
    sent: rows
      .filter((row) => sentToday(row, offset))
      .reverse()
      .map((row) => sentItem(row, offset)),
  };
}
