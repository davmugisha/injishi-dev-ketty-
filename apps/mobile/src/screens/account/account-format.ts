/**
 * Every sentence Account builds out of a value, as a pure function: a fixture
 * value on the screens still waiting for their reads, and the server's seat
 * (`/me/workspaces`) for the role and the chip.
 *
 * Here rather than inline in the screens for the reason `broker-format.ts`
 * gives: the same fact is printed in more than one place and has to read the
 * same way each time — a plan name is a row value on Account and a heading on
 * the subscription screen; a session's last-seen day is a row and a warning.
 * Keys rather than strings, and `Translate` passed in rather than reached for,
 * so all of it is testable without rendering and the Kinyarwanda column is
 * exercised by the same call.
 */
import { formatDay } from '@/data/search';
import type { Surface, WorkspaceEntry } from '@/data/rentals';
import type { MessageKey, Translate } from '@/i18n/i18n';
import type { DeviceSession, PlanId, StaffState } from './account-fixtures';

/**
 * The parts of a line that are actually there, joined with a middle dot.
 *
 * The seat lines on Account and the switcher were template strings, and a
 * template prints its separator whether or not the part after it exists. The
 * rig read "owner ·", "Guest · Tenant ·" and a lone "·" on a Broker row (mobile
 * audit 2026-10-05, SA-10). An empty part is dropped here, separator and all.
 */
export function joinParts(
  parts: readonly (string | null | undefined)[],
  separator = ' · ',
): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(separator);
}

/**
 * The role a seat is held in, as a message key, or null when it names none.
 *
 * The server sends `orgRole` on a business seat as a lowercase enum and nothing
 * at all on a broker or a personal seat (`WorkspaceAccess`), and
 * `toWorkspaceEntry` passes the enum straight through as `role`. Printed as it
 * came, that was "housekeeper" on one row and an empty line on the next
 * (SA-10). This is where it becomes a word.
 *
 * A personal seat's role is whichever side of it is open, because Guest and
 * Tenant are the two hats one Personal workspace holds (FL25 §9).
 *
 * A `switch` rather than a lookup table, so a role the contract does not know
 * yet reads as nothing rather than as a raw enum.
 */
export function seatRoleKey(
  seat: Pick<WorkspaceEntry, 'type' | 'role'>,
  surface: Surface,
): MessageKey | null {
  if (seat.type === 'personal') return surface === 'guest' ? 'role.guest' : 'role.tenant';
  if (seat.type === 'broker') return 'role.broker';
  switch (seat.role) {
    case 'owner':
      return 'role.owner';
    case 'manager':
      return 'role.manager';
    case 'receptionist':
      return 'role.receptionist';
    case 'finance':
      return 'role.finance';
    case 'hr':
      return 'role.hr';
    case 'housekeeper':
      return 'role.housekeeper';
    default:
      return null;
  }
}

/** `seatRoleKey`, translated. Empty when the seat names no role. */
export function seatRoleLabel(
  seat: Pick<WorkspaceEntry, 'type' | 'role'>,
  surface: Surface,
  t: Translate,
): string {
  const key = seatRoleKey(seat, surface);
  return key ? t(key) : '';
}

/**
 * The chip on the identity card: which workspace this seat is, and nothing
 * about what anybody checked.
 *
 * It used to be a verification claim per seat: "ID verified" on a guest, "TIN
 * verified" on a landlord or a host, and "Licensed · RW-BK-0221" (the frame's
 * own licence number) on every broker. No field said any of them had been
 * checked (mobile audit 2026-10-05, SA-02), so each one was a fabricated fact
 * about whoever held the phone.
 *
 * The design those claims came from is still right and is kept for when the
 * data exists (ADR-038 child 7, AC-A2): four different claims rendered as four
 * different claims, a checked one in the success tone and a statement of where
 * you stand in the neutral one. Their sources are a guest's verified identity
 * (`GET /api/v1/me/identity`), a business's `registrationStatus` (already on
 * `/me/workspaces`), and a broker licence the API does not serve yet. Until a
 * field says a claim was checked, no claim is drawn.
 *
 * Empty when there is nothing true to say: a broker seat carries no org name on
 * the server, and a chip repeating the role line would only say it twice.
 */
export function seatChipLabel(
  seat: Pick<WorkspaceEntry, 'type' | 'kind' | 'org'>,
  t: Translate,
): string {
  if (seat.type === 'personal') return t('account.badgePersonal');
  if (seat.kind === 'staff') return t('account.badgeStaffSeat');
  return seat.org?.trim() ?? '';
}

/**
 * `14 Jul 2026`. `formatDay` gives the day and the month, which is right
 * everywhere it is used — a booking, a rent due date, a shift — because those
 * are all inside the current year. A TIN verification and a plan renewal are
 * not, and a date without a year is the one that gets misread.
 */
export function formatLongDay(iso: string, t: Translate): string {
  return `${formatDay(iso, t)} ${iso.slice(0, 4)}`;
}

/** The plan's display name. One key per plan, so RW gets its own word. */
export function planKey(plan: PlanId): MessageKey {
  return `plan.${plan}` as MessageKey;
}

/** What a staff row's state is called, and how it is toned. */
export function staffStateKey(state: StaffState): MessageKey {
  return `staff.state.${state}` as MessageKey;
}

export function staffStateTone(state: StaffState): 'success' | 'warning' | 'neutral' {
  if (state === 'active') return 'success';
  if (state === 'invited') return 'warning';
  return 'neutral';
}

/**
 * How many days ago a session was last used.
 *
 * `today` is passed rather than read off the clock so a test asserts a number
 * rather than whatever day it happens to run on — the same reason every other
 * date helper in this app takes its `today`.
 */
export function daysSince(iso: string, today: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/**
 * The line under a device: where it was and how long ago.
 *
 * Three bands rather than a raw count, because "today" and "16 days ago" ask a
 * reader for different decisions and a bare number makes them do the comparison
 * themselves. F-S12 §9 names the case this exists for — a stolen session — and
 * the one a person is most likely to spot is the one they have not used in a
 * while.
 */
export function sessionMeta(session: DeviceSession, today: string, t: Translate): string {
  const days = daysSince(session.lastSeen, today);
  const when =
    days === 0
      ? t('security.seenToday')
      : days === 1
        ? t('security.seenYesterday')
        : t('security.seenDaysAgo', { days });
  return `${session.place} · ${when}`;
}

/**
 * Whether a session is old enough to be worth a second look.
 *
 * Not an alarm — an unused device is usually just an unused device — so this
 * only decides whether the row carries a quiet marker. Two weeks is the band
 * where "I was in Rubavu last month" stops being the obvious explanation.
 */
export const STALE_SESSION_DAYS = 14;

export function isStaleSession(session: DeviceSession, today: string): boolean {
  return !session.current && daysSince(session.lastSeen, today) >= STALE_SESSION_DAYS;
}
