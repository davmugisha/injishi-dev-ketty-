/**
 * IS AN OUTLET OPEN RIGHT NOW (ADR-050 D-o, value sourcing "whether an outlet
 * is open now").
 *
 * Pure, so the rules can be tested without a clock or a database. Three rules,
 * all named by the spec:
 *
 * 1. **Null hours means always open.** Room service and a minibar have no
 *    window, and making every host type one would make every outlet closed on
 *    the day this ships.
 * 2. **A window whose end is before its start spans midnight.** A bar open
 *    `["18:00", "02:00"]` on Friday is still open at 01:30 on Saturday.
 * 3. **The outlet's clock is the property's time zone**, never the server's.
 *
 * The stored shape is the one `outlets.hours` documents, one window per day,
 * `{"mon": ["07:00", "22:00"]}`, and a list of windows is accepted too so a
 * kitchen that closes between lunch and dinner can say so. A day with no key is
 * closed that day. A value that cannot be read FAILS CLOSED: an outlet that
 * takes an order it cannot serve is worse than one that takes none, and the
 * host sees the refusal and fixes the hours.
 */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type Day = (typeof DAYS)[number];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes after midnight, or null when the string is not `HH:MM`. */
function minutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** One day's windows, or null when the day's value cannot be read. */
function windowsFor(value: unknown): Array<[number, number]> | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const pairs = value.length > 0 && Array.isArray(value[0]) ? value : [value];
  const out: Array<[number, number]> = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const start = minutes(pair[0]);
    const end = minutes(pair[1]);
    if (start === null || end === null) return null;
    out.push([start, end]);
  }
  return out;
}

/** The day and minute of `at` as a clock in `timeZone` reads it. */
function localClock(at: Date, timeZone: string): { day: Day; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3) as Day;
  return { day, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function isOutletOpen(hours: unknown, at: Date, timeZone: string): boolean {
  if (hours === null || hours === undefined) return true;
  if (typeof hours !== 'object' || Array.isArray(hours)) return false;
  const table = hours as Record<string, unknown>;

  const { day, minute } = localClock(at, timeZone);
  const today = windowsFor(table[day]);
  const yesterday = windowsFor(table[DAYS[(DAYS.indexOf(day) + 6) % 7]]);
  if (today === null || yesterday === null) return false;

  for (const [start, end] of today) {
    if (start === end) return true; // a 24 hour day
    if (end > start ? minute >= start && minute < end : minute >= start) return true;
  }
  // Yesterday's late window still running after midnight.
  for (const [start, end] of yesterday) {
    if (end < start && minute < end) return true;
  }
  return false;
}
