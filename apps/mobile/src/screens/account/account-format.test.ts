/**
 * The pure half of Account: the seat's role and chip, lines built from parts,
 * dates, plan names, staff states, and how long ago a device was last used.
 *
 * All of it asserted without rendering, which is the point of these living in
 * `account-format.ts` rather than inline in the screens — and which is what
 * lets the Kinyarwanda column be exercised by the same calls rather than by a
 * second suite that would drift from the first.
 */
import { formatLongDay, planKey, staffStateKey, staffStateTone } from './account-format';
import { daysSince, isStaleSession, sessionMeta, STALE_SESSION_DAYS } from './account-format';
import { joinParts, seatChipLabel, seatRoleKey, seatRoleLabel } from './account-format';
import type { DeviceSession } from './account-fixtures';
import type { WorkspaceEntry } from '@/data/rentals';
import { en, rw } from '@/i18n/messages';
import type { MessageKey } from '@/i18n/i18n';

const t = (key: MessageKey, values?: Record<string, string | number>) =>
  (en[key] as string).replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );

const trw = (key: MessageKey, values?: Record<string, string | number>) =>
  rw[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );

/**
 * A seat as `toWorkspaceEntry` hands it to the screens: the server's `orgRole`
 * passed through as `role`, and nothing at all for a broker. Defaults to a
 * business seat; each case says what it changes.
 */
function seat(over: Partial<WorkspaceEntry>): WorkspaceEntry {
  return {
    id: 'ws-1',
    type: 'business',
    kind: 'landlord',
    surface: 'landlord',
    name: 'Kayitare Court',
    role: 'owner',
    org: 'Kayitare Court',
    ...over,
  };
}

describe('a line built from parts', () => {
  /**
   * The rig read "owner ·", "Guest · Tenant ·" and a lone "·" on a Broker row
   * (mobile audit 2026-10-05, SA-10): a template prints its separator whether
   * or not the part after it exists.
   */
  it('drops an empty part along with its separator', () => {
    expect(joinParts(['Owner', ''])).toBe('Owner');
    expect(joinParts(['', 'Rent roll'])).toBe('Rent roll');
    expect(joinParts([null, undefined, '  '])).toBe('');
    expect(joinParts(['Owner', 'Rent roll'])).toBe('Owner · Rent roll');
  });

  it('joins with whatever a screen reader label needs instead', () => {
    expect(joinParts(['Grace Mukamana', ''], ', ')).toBe('Grace Mukamana');
    expect(joinParts(['Grace Mukamana', '+250 788 123 456'], ', ')).toBe(
      'Grace Mukamana, +250 788 123 456',
    );
  });
});

describe('the role a seat is held in', () => {
  it('turns every org role the contract has into a word', () => {
    expect(seatRoleLabel(seat({ role: 'owner' }), 'landlord', t)).toBe(en['role.owner']);
    expect(seatRoleLabel(seat({ role: 'manager' }), 'host', t)).toBe(en['role.manager']);
    expect(seatRoleLabel(seat({ role: 'receptionist' }), 'host', t)).toBe(en['role.receptionist']);
    expect(seatRoleLabel(seat({ role: 'housekeeper' }), 'work', t)).toBe(en['role.housekeeper']);
  });

  it('never prints the server enum', () => {
    for (const role of ['owner', 'manager', 'receptionist', 'housekeeper']) {
      expect(seatRoleLabel(seat({ role }), 'landlord', t)).not.toBe(role);
    }
  });

  /** The server sends no `orgRole` on a broker seat, which left the row blank. */
  it('gives a broker seat its own word rather than nothing', () => {
    const broker = seat({ type: 'broker', kind: 'broker', name: 'Broker', role: '', org: undefined });
    expect(seatRoleKey(broker, 'broker')).toBe('role.broker');
    expect(seatRoleLabel(broker, 'broker', t)).toBe(en['role.broker']);
  });

  /** FL25 §9: one Personal workspace, two hats. The open side is the role. */
  it('names a personal seat by the side of it that is open', () => {
    const personal = seat({ type: 'personal', kind: 'personal', name: 'Personal', role: 'Guest · Tenant' });
    expect(seatRoleLabel(personal, 'guest', t)).toBe(en['role.guest']);
    expect(seatRoleLabel(personal, 'tenant', t)).toBe(en['role.tenant']);
  });

  it('reads a role the contract does not know as nothing, not as an enum', () => {
    expect(seatRoleKey(seat({ role: 'concierge' }), 'host')).toBeNull();
    expect(seatRoleLabel(seat({ role: 'constructor' }), 'host', t)).toBe('');
    expect(seatRoleLabel(seat({ role: '' }), 'landlord', t)).toBe('');
  });
});

describe('the seat chip', () => {
  /**
   * It used to be a verification claim nobody checked: "ID verified", "TIN
   * verified", "Licensed · RW-BK-0221" (mobile audit 2026-10-05, SA-02). It now
   * says which workspace this is, and nothing else.
   */
  it('says where you stand, never what was checked', () => {
    expect(seatChipLabel(seat({ type: 'personal', kind: 'personal', org: undefined }), t)).toBe(
      en['account.badgePersonal'],
    );
    expect(seatChipLabel(seat({ kind: 'staff', org: 'Kivu Crest Hotel' }), t)).toBe(
      en['account.badgeStaffSeat'],
    );
    expect(seatChipLabel(seat({ org: 'Kayitare Court' }), t)).toBe('Kayitare Court');
  });

  it('is empty when the seat names no organisation, rather than repeating the role', () => {
    // A broker seat as the server sends it: no org name at all.
    expect(seatChipLabel(seat({ type: 'broker', kind: 'broker', org: undefined }), t)).toBe('');
  });

  it('has no word in the catalogue that claims a check', () => {
    for (const key of ['account.badgePersonal', 'account.badgeStaffSeat'] as const) {
      expect(en[key]).not.toMatch(/verified|licen[cs]ed|checked/i);
    }
    expect(Object.keys(en)).not.toContain('account.badgeTinVerified');
    expect(Object.keys(en)).not.toContain('account.badgeIdVerified');
    expect(Object.keys(en)).not.toContain('account.badgeLicensed');
  });
});

describe('the long date', () => {
  /**
   * `formatDay` gives "14 Jul", which is right for a booking, a rent due date
   * and a shift because all three are inside the current year. A TIN
   * verification and a plan renewal are not, and a date without a year is the
   * one that gets misread.
   */
  it('carries the year, which the short form drops', () => {
    expect(formatLongDay('2026-07-14', t)).toBe('14 Jul 2026');
    expect(formatLongDay('2025-11-03', t)).toBe('3 Nov 2025');
  });

  it('reads the month out of the Kinyarwanda catalogue too', () => {
    // The year is a number in either language; the month is not.
    expect(formatLongDay('2026-07-14', trw)).toContain('2026');
    expect(formatLongDay('2026-07-14', trw)).not.toBe(formatLongDay('2026-07-14', t));
  });
});

describe('the plan', () => {
  it('names each plan through its own key, so RW gets its own word', () => {
    expect(planKey('growth')).toBe('plan.growth');
    expect(t(planKey('growth'))).toBe('Growth');
    expect(trw(planKey('growth'))).not.toBe('Growth');
  });
});

describe('a staff row', () => {
  it('gives every state a word and a tone, never a tone alone', () => {
    for (const state of ['active', 'invited', 'suspended'] as const) {
      const key = staffStateKey(state);
      expect(en[key]).toBeTruthy();
      expect(rw[key]).toBeTruthy();
      expect(staffStateTone(state)).toBeTruthy();
    }
  });

  /**
   * The tones have to differ, or the badge is decoration. Revoked is neutral
   * rather than danger on purpose: a revoked seat is a record, not a problem,
   * and colouring it red would make an audit trail read as an incident list.
   */
  it('separates working from invited from revoked', () => {
    expect(staffStateTone('active')).toBe('success');
    expect(staffStateTone('invited')).toBe('warning');
    expect(staffStateTone('suspended')).toBe('neutral');
  });
});

describe('how long ago a device was used', () => {
  const on = (lastSeen: string, current = false): DeviceSession => ({
    id: 'd',
    label: 'Chrome · Windows',
    place: 'Kigali, RW',
    lastSeen,
    current,
  });

  it('counts whole days from the day passed in, not from the clock', () => {
    expect(daysSince('2026-09-07', '2026-09-07')).toBe(0);
    expect(daysSince('2026-09-06', '2026-09-07')).toBe(1);
    expect(daysSince('2026-08-22', '2026-09-07')).toBe(16);
  });

  it('never goes negative on a device seen in the future', () => {
    // A clock skew must not print "used -3 days ago".
    expect(daysSince('2026-09-09', '2026-09-07')).toBe(0);
  });

  it('reads a garbled date as today rather than throwing', () => {
    expect(daysSince('not-a-day', '2026-09-07')).toBe(0);
  });

  it('bands the sentence rather than printing a bare number', () => {
    expect(sessionMeta(on('2026-09-07'), '2026-09-07', t)).toContain(en['security.seenToday']);
    expect(sessionMeta(on('2026-09-06'), '2026-09-07', t)).toContain(en['security.seenYesterday']);
    expect(sessionMeta(on('2026-08-22'), '2026-09-07', t)).toContain('16');
  });

  it('always names the place, which is what makes recognition possible', () => {
    expect(sessionMeta(on('2026-08-22'), '2026-09-07', t)).toContain('Kigali, RW');
  });
});

describe('which device is worth a second look', () => {
  const at = (lastSeen: string, current = false): DeviceSession => ({
    id: 'd',
    label: 'Chrome · Android',
    place: 'Rubavu, RW',
    lastSeen,
    current,
  });

  it('marks one unused for a fortnight', () => {
    expect(isStaleSession(at('2026-08-22'), '2026-09-07')).toBe(true);
    expect(daysSince('2026-08-22', '2026-09-07')).toBeGreaterThanOrEqual(STALE_SESSION_DAYS);
  });

  it('leaves a recent one alone', () => {
    expect(isStaleSession(at('2026-09-05'), '2026-09-07')).toBe(false);
  });

  /**
   * The phone in your hand is never stale, however long since the app was
   * opened — it is being used right now, which is how the screen is on screen.
   */
  it('never marks the current device, whatever its last-seen day says', () => {
    expect(isStaleSession(at('2025-01-01', true), '2026-09-07')).toBe(false);
  });
});
