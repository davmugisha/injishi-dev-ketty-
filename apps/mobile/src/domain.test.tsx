/**
 * `surfaceFor` — the derivation the whole shell branches on.
 *
 * Six tab sets hang off this one function, so a wrong answer is not a styling
 * bug: it is a Landlord looking at Explore. It is a pure function precisely so
 * it can be asserted without mounting a navigator.
 *
 * ## These now assert the TABLE, not a fixture
 *
 * They used to read `WORKSPACES` out of `data/personas.ts` and check that five
 * hard-coded seats resolved correctly. ADR-038 child 0 task 8 deleted that
 * constant: the seats are `GET /api/v1/me/workspaces` now, and a test that
 * asserted the contents of a list the server owns would be asserting the seed.
 *
 * What is left is the thing that is genuinely this app's to get right — the
 * parent's derivation table, row by row, from the `WorkspaceAccess` shape the
 * server actually sends. The case carrying the weight is **Personal**, the one
 * seat holding two surfaces (FL25 §9 — Guest and Tenant are one Personal
 * workspace). Every other seat carries its answer in its own fields and must
 * IGNORE the domain toggle, which is the second half of what these assert.
 */
import type { WorkspaceAccess } from '@injishi/contracts';
import { surfaceFor, toWorkspaceEntry } from './domain';

/** A `WorkspaceAccess` as the server sends one, with only the fields that decide. */
const access = (over: Partial<WorkspaceAccess>): WorkspaceAccess =>
  ({
    workspaceId: 'w1',
    kind: 'personal',
    orgId: null,
    orgName: null,
    domain: null,
    orgRole: null,
    permissions: [],
    propertyName: null,
    ...over,
  }) as WorkspaceAccess;

describe('surfaceFor, the parent’s derivation table', () => {
  it('personal · any · any → guest or tenant, by the stored toggle', () => {
    const personal = access({ kind: 'personal' });
    expect(surfaceFor(personal, 'hospitality')).toBe('guest');
    expect(surfaceFor(personal, 'residence')).toBe('tenant');
  });

  it('broker · any · any → broker, whatever the domain says', () => {
    // The seat is the stronger fact. A Broker seat does not become a Guest
    // because the domain toggle happens to say hospitality.
    const broker = access({ kind: 'broker', domain: 'residence' });
    expect(surfaceFor(broker, 'residence')).toBe('broker');
    expect(surfaceFor(broker, 'hospitality')).toBe('broker');
  });

  it('business · residence · any → landlord', () => {
    const landlord = access({ kind: 'business', domain: 'residence', orgRole: 'owner' });
    expect(surfaceFor(landlord, 'residence')).toBe('landlord');
    expect(surfaceFor(landlord, 'hospitality')).toBe('landlord');
  });

  it('business · hospitality · housekeeper → work', () => {
    const work = access({ kind: 'business', domain: 'hospitality', orgRole: 'housekeeper' });
    expect(surfaceFor(work, 'residence')).toBe('work');
    expect(surfaceFor(work, 'hospitality')).toBe('work');
  });

  it.each(['owner', 'manager', 'receptionist'] as const)(
    'business · hospitality · %s → host, which is parked',
    (role) => {
      const host = access({ kind: 'business', domain: 'hospitality', orgRole: role });
      expect(surfaceFor(host, 'hospitality')).toBe('host');
    },
  );

  it('falls back to a Personal surface for a business seat with no domain', () => {
    // Not something the schema produces. Guessing a surface for it would put
    // somebody on a tab set nobody chose; Personal is the seat everybody has.
    const odd = access({ kind: 'business', domain: null });
    expect(surfaceFor(odd, 'hospitality')).toBe('guest');
    expect(surfaceFor(odd, 'residence')).toBe('tenant');
  });
});

describe('toWorkspaceEntry', () => {
  it('keeps the shape forty-seven screens already read', () => {
    const entry = toWorkspaceEntry(
      access({
        workspaceId: 'ws-1',
        kind: 'business',
        domain: 'residence',
        orgRole: 'owner',
        orgName: 'Kayitare Court',
        propertyName: 'Kayitare Court',
        label: 'Kayitare Court',
      } as Partial<WorkspaceAccess>) as WorkspaceAccess & { label?: string },
      'residence',
    );

    expect(entry.id).toBe('ws-1');
    expect(entry.surface).toBe('landlord');
    // The CLIENT's seat vocabulary, which is not the server's: the server says
    // `business`, the app says `landlord` once it knows what that business is.
    expect(entry.kind).toBe('landlord');
    expect(entry.type).toBe('business');
    expect(entry.name).toBe('Kayitare Court');
  });

  it('labels a personal seat Personal, and gives it both roles', () => {
    const entry = toWorkspaceEntry(access({ kind: 'personal' }), 'residence');

    expect(entry.name).toBe('Personal');
    expect(entry.role).toBe('Guest · Tenant');
    // No domain, so switching to it changes neither the domain nor the surface.
    expect(entry.domain).toBeUndefined();
  });

  it('marks a host seat parked, so the switcher never lists it', () => {
    const entry = toWorkspaceEntry(
      access({ kind: 'business', domain: 'hospitality', orgRole: 'manager' }),
      'hospitality',
    );

    // Parked, not deleted: reachable by deep link, never offered.
    expect(entry.surface).toBe('host');
    expect(entry.parked).toBe(true);
  });

  it('never invents a role out of a permission', () => {
    // The role line is what a person reads. Authorization is the `permissions`
    // array on the access row and is never derived from this (AC-6).
    const entry = toWorkspaceEntry(
      access({ kind: 'business', domain: 'residence', orgRole: null, orgName: 'Somewhere' }),
      'residence',
    );
    expect(entry.role).toBe('');
  });
});
