/**
 * How a conversation reads (ported from feat/rentals, 2026-10-22): messages sent one after another by the
 * same person sit together as one group, with the sender's name once above the
 * first and the time once under the last, the way chat apps do it. Three
 * messages sent in a row no longer carry three dates.
 *
 * A group ends when the sender changes, when a system line comes between, when
 * the day changes, or when more than five minutes pass. A new day gets a
 * divider ("Today", "Yesterday", "Monday 20 October").
 *
 * Times are Kigali wall clock (UTC+02:00 all year, no daylight saving), worked
 * out from the ISO string so the server and the browser print the same thing.
 */

const KIGALI_OFFSET_MS = 120 * 60_000;
const GROUP_GAP_MS = 5 * 60_000;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

function kigali(iso: string): Date | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms + KIGALI_OFFSET_MS);
}

function dayOf(iso: string): string {
  const at = kigali(iso);
  return at ? `${at.getUTCFullYear()}-${pad2(at.getUTCMonth() + 1)}-${pad2(at.getUTCDate())}` : "";
}

/** "14:05", Kigali time. */
export function messageClock(iso: string): string {
  const at = kigali(iso);
  return at ? `${pad2(at.getUTCHours())}:${pad2(at.getUTCMinutes())}` : "";
}

/**
 * The divider above a new day. With `nowIso` (only pass it from the browser),
 * the last two days read "Today" and "Yesterday"; otherwise the full date.
 */
export function messageDay(iso: string, nowIso?: string): string {
  const at = kigali(iso);
  if (!at) return "";
  if (nowIso) {
    const today = dayOf(nowIso);
    const yesterday = dayOf(new Date(Date.parse(nowIso) - 86_400_000).toISOString());
    const day = dayOf(iso);
    if (day === today) return "Today";
    if (day === yesterday) return "Yesterday";
  }
  const now = nowIso ? kigali(nowIso) : null;
  const year = now && now.getUTCFullYear() === at.getUTCFullYear() ? "" : ` ${at.getUTCFullYear()}`;
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}${year}`;
}

export interface GroupableMessage {
  createdAt: string;
  fromUs: boolean;
  bodyType: string;
  senderName?: string | null;
}

export interface MessagePlace {
  /** A day divider goes above this message. */
  newDay: boolean;
  /** First of its group: the sender's name goes above, and a little more space. */
  first: boolean;
  /** Last of its group: the time goes under it. */
  last: boolean;
}

/** Where each message sits in its group, in the same order as `list` (oldest first). */
export function placeMessages(list: readonly GroupableMessage[]): MessagePlace[] {
  const joins = (a: GroupableMessage | undefined, b: GroupableMessage | undefined): boolean =>
    !!a &&
    !!b &&
    a.bodyType !== "system" &&
    b.bodyType !== "system" &&
    a.fromUs === b.fromUs &&
    (a.senderName ?? null) === (b.senderName ?? null) &&
    dayOf(a.createdAt) === dayOf(b.createdAt) &&
    Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <= GROUP_GAP_MS;

  return list.map((m, i) => ({
    newDay: i === 0 || dayOf(list[i - 1]?.createdAt ?? "") !== dayOf(m.createdAt),
    first: !joins(list[i - 1], m),
    last: !joins(m, list[i + 1]),
  }));
}

/** "0:07", "1:45": a voice note's length or position. */
export function voiceClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** "84 KB", "1.2 MB": a file's size on its card. */
export function fileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Where the "New messages" line goes: above the first line from the other side written after the
 * reader last opened the conversation. Null when nothing is new (or the reader never opened it and
 * everything is theirs to read: then the conversation simply opens at the newest line).
 */
export function unreadStart(
  list: readonly { id: string; createdAt: string; fromUs: boolean; bodyType: string }[],
  lastReadAt: string | null | undefined,
): string | null {
  if (!lastReadAt) return null;
  const read = Date.parse(lastReadAt);
  const first = list.find((m) => !m.fromUs && m.bodyType !== "system" && Date.parse(m.createdAt) > read);
  return first?.id ?? null;
}
