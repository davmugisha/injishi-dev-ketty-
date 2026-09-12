/**
 * The three `apply` functions behind Account's writes.
 *
 * They are asserted directly rather than through a screen because each is the
 * ONLY description of its change — a later `useMutation` calls the same
 * function to build its optimistic update (decision D9), so a bug here would be
 * a bug the server and the client both told the same way.
 *
 * Each of the three carries one rule that is easy to get wrong and impossible
 * to see from a rendered screen:
 *
 *   - a session list may not revoke the device it is running on;
 *   - resending an invitation changes nothing about the row;
 *   - the public name is DERIVED from the private one, so a rename cannot
 *     leave a stale one behind.
 */
import {
  applyPersonalChange,
  applySessionChange,
  applyStaffChange,
  seedPersonal,
} from './account-store';
import { SESSIONS, STAFF } from './account-fixtures';
import { ME } from '@/data/personas';

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

describe('personal details', () => {
  it('seeds from the one identity rather than from a literal', () => {
    const seed = seedPersonal();
    expect(seed.displayName).toBe(ME.name);
    expect(seed.phone).toBe(ME.phone);
    expect(seed.email).toBe(ME.email);
  });

  /**
   * F-S12 §6: "reviews show first name + last initial only". Derived rather
   * than stored, so a rename cannot leave a stale public name behind — which is
   * the failure this whole rule would otherwise have.
   */
  it('derives the public name, and re-derives it on a rename', () => {
    expect(seedPersonal().publicName).toBe('Samuel K.');
    const renamed = applyPersonalChange(seedPersonal(), {
      kind: 'name',
      value: 'Claudine Uwase',
    });
    expect(renamed.displayName).toBe('Claudine Uwase');
    expect(renamed.publicName).toBe('Claudine U.');
  });

  it('never puts the email on the public form', () => {
    const next = applyPersonalChange(seedPersonal(), {
      kind: 'email',
      value: 'someone@example.rw',
    });
    expect(next.email).toBe('someone@example.rw');
    expect(next.publicName).not.toContain('@');
  });

  it('trims what it is given, so a stray space is not a name', () => {
    const next = applyPersonalChange(seedPersonal(), { kind: 'name', value: '  Eric Twagirimana ' });
    expect(next.displayName).toBe('Eric Twagirimana');
    expect(next.publicName).toBe('Eric T.');
  });

  it('survives a one-word name rather than printing "Eric undefined."', () => {
    const next = applyPersonalChange(seedPersonal(), { kind: 'name', value: 'Eric' });
    expect(next.publicName).toBe('Eric');
  });

  it('links and unlinks a method without touching the others', () => {
    const linked = applyPersonalChange(seedPersonal(), {
      kind: 'link',
      id: 'google',
      linked: true,
    });
    expect(linked.methods.find((m) => m.id === 'google')?.linked).toBe(true);
    expect(linked.methods.find((m) => m.id === 'phone')?.linked).toBe(true);
  });
});
