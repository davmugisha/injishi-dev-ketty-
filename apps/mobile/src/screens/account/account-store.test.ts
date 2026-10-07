/**
 * The `apply` functions behind Account's fixture-backed screens, and the one
 * rule left of the personal details store.
 *
 * They are asserted directly rather than through a screen because each is the
 * ONLY description of its change — a later `useMutation` calls the same
 * function to build its optimistic update (decision D9), so a bug here would be
 * a bug the server and the client both told the same way.
 *
 * Each carries one rule that is easy to get wrong and impossible to see from a
 * rendered screen:
 *
 *   - a session list may not revoke the device it is running on;
 *   - resending an invitation changes nothing about the row;
 *   - the public name is DERIVED from the private one.
 *
 * The personal details store these tests used to cover is gone. It was seeded
 * from the `ME` persona, Samuel Kayitare and his email, and its edits never
 * reached the server (mobile audit 2026-10-05, SA-01 and SA-14). The screen
 * reads `GET /api/v1/me/profile` now; `account.test.tsx` covers it.
 */
import * as store from './account-store';
import { applySessionChange, applyStaffChange, publicForm } from './account-store';
import { SESSIONS, STAFF } from './account-fixtures';

describe('revoking a session', () => {
  it('drops the one named', () => {
    const next = applySessionChange(SESSIONS, { kind: 'revoke', id: 'dev-2' });
    expect(next.map((s) => s.id)).not.toContain('dev-2');
    expect(next).toHaveLength(SESSIONS.length - 1);
  });

  /**
   * The whole reason this is a function rather than a `filter` at the call
   * site. Signing the phone in your hand out from a row labelled "this device"
   * is a control that reads as a mistake even when it is not one, and a future
   * caller must not be able to get it wrong by forgetting the guard.
   */
  it('refuses to revoke the device it is running on', () => {
    const current = SESSIONS.find((s) => s.current);
    expect(current).toBeDefined();
    const next = applySessionChange(SESSIONS, { kind: 'revoke', id: current!.id });
    expect(next.map((s) => s.id)).toContain(current!.id);
    expect(next).toHaveLength(SESSIONS.length);
  });

  it('signs out everywhere else and keeps exactly this one', () => {
    const next = applySessionChange(SESSIONS, { kind: 'revoke_others' });
    expect(next).toHaveLength(1);
    expect(next[0].current).toBe(true);
  });

  it('is a no-op on an id that is not there', () => {
    expect(applySessionChange(SESSIONS, { kind: 'revoke', id: 'nope' })).toHaveLength(
      SESSIONS.length,
    );
  });
});

describe('a staff change', () => {
  /**
   * Deliberate, not an omission: the state is still `invited` and the person
   * still has not accepted, so a row that moved would be reporting something
   * that happened at the other end. The toast is what says the message went.
   */
  it('leaves the row exactly as it was when an invitation is resent', () => {
    const before = STAFF.find((m) => m.state === 'invited');
    const next = applyStaffChange(STAFF, { kind: 'resend', id: before!.id });
    expect(next).toEqual(STAFF);
  });

  it('suspends rather than deletes, so the audit trail survives', () => {
    const next = applyStaffChange(STAFF, { kind: 'revoke', id: 'st-1' });
    expect(next).toHaveLength(STAFF.length);
    expect(next.find((m) => m.id === 'st-1')?.state).toBe('suspended');
  });

  it('restores a suspended seat to working', () => {
    const next = applyStaffChange(STAFF, { kind: 'restore', id: 'st-4' });
    expect(next.find((m) => m.id === 'st-4')?.state).toBe('active');
  });

  it('adds an invitation as `invited`, never as `active`', () => {
    const next = applyStaffChange(STAFF, {
      kind: 'invite',
      name: 'Yves Rugema',
      phone: '+250 788 111 222',
    });
    expect(next).toHaveLength(STAFF.length + 1);
    const added = next[next.length - 1];
    expect(added.name).toBe('Yves Rugema');
    expect(added.state).toBe('invited');
    // An invited row is the only kind that carries a number, because it is
    // what "Resend" resends.
    expect(added.phone).toBe('+250 788 111 222');
  });

  it('never mutates the list it was given', () => {
    const copy = STAFF.map((m) => ({ ...m }));
    applyStaffChange(STAFF, { kind: 'revoke', id: 'st-1' });
    expect(STAFF).toEqual(copy);
  });
});

describe('the public form of a name', () => {
  /**
   * F-S12 §6: "reviews show first name + last initial only". Derived rather
   * than stored, so it cannot fall out of step with the name it comes from.
   */
  it('is the first name and the last initial', () => {
    expect(publicForm('Claudine Uwase')).toBe('Claudine U.');
    expect(publicForm('Marie Claire Uwimana')).toBe('Marie U.');
  });

  it('trims what it is given, so a stray space is not a name', () => {
    expect(publicForm('  Eric Twagirimana ')).toBe('Eric T.');
  });

  it('survives a one-word name rather than printing "Eric ."', () => {
    expect(publicForm('Eric')).toBe('Eric');
  });

  it('is nothing at all for no name', () => {
    expect(publicForm('')).toBe('');
    expect(publicForm('   ')).toBe('');
  });
});

describe('what the store no longer holds', () => {
  /**
   * The fixture switch for two-step sign-in, and the personal details store
   * seeded from the `ME` persona. Asserted gone, so neither comes back by an
   * innocent re-export: each one put a fixture fact in front of a real person
   * (SA-01, SA-06, SA-14).
   */
  it('has no fixture two-factor switch and no personal details store', () => {
    const exported = Object.keys(store);
    for (const gone of [
      'useTwoFactor',
      'seedPersonal',
      'usePersonalDetails',
      'usePersonalMutation',
      'applyPersonalChange',
    ]) {
      expect(exported).not.toContain(gone);
    }
    // The real read that replaced the switch.
    expect(exported).toContain('useTwoFactorState');
  });
});
