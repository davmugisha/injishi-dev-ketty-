/**
 * The tenant's writes, as functions.
 *
 * Every `apply` in `./tenancy-store` is pure, which is what `useFixtureMutation`
 * asks for and what makes the domain rules assertable without rendering a
 * screen. The rules worth pinning here are the ones that would otherwise only
 * be visible as a wrong screen three taps in:
 *
 *   - signing STARTS the rent schedule (FL21 step 4), so a freshly active lease
 *     is never sent to a Rent tab that says nothing is due;
 *   - the first charge is `due`, never `overdue`, even on a commencement date
 *     that has already passed;
 *   - a settlement is stamped `mock` (FL28 §6, ui-rules.md's adapter rule);
 *   - a notice moves the lease to `ending` and stops there — `ended` belongs to
 *     the close, when the Caution settles (FL24);
 *   - a renewal request does NOT move `endOn` (FL26 step 3 does that).
 *
 * Each applier is given an explicit array rather than the module fixture, so a
 * change to the seed data cannot quietly rewrite what these assert.
 */
import { TENANCIES, type Tenancy } from './rentals';
import {
  applyMoveOut,
  applyRenewal,
  applyRentPayment,
  applySignature,
  applyVisitor,
  monthKeyOf,
} from './tenancy-store';

const base = (id: string): Tenancy => {
  const found = TENANCIES.find((x) => x.id === id);
  if (!found) throw new Error(`fixture ${id} is gone`);
  // A deep-enough copy that a mutation bug in an applier fails a test here
  // rather than leaking into the next one.
  return JSON.parse(JSON.stringify(found)) as Tenancy;
};

/** Awaiting signature, empty ledger. The invite's lease, and frame R16's. */
const UNSIGNED = 'kimironko-flat-3';
/** Running, six periods, two of them unpaid. */
const RUNNING = 'nyamirambo-flat-1';
/** Settled and closed. The read-only arm of R15 and R19. */
const CLOSED = 'gikondo-garden-flat';

describe('monthKeyOf', () => {
  it('is the English key a ledger row is stored under', () => {
    expect(monthKeyOf('2026-09-01')).toBe('September 2026');
    expect(monthKeyOf('2027-01-15')).toBe('January 2027');
  });
});

describe('applySignature', () => {
  it('activates the lease and records the day it was signed', () => {
    const [lease] = applySignature([base(UNSIGNED)], {
      leaseId: UNSIGNED,
      signedOn: '2026-08-20',
    });
    expect(lease.leaseState).toBe('active');
    expect(lease.signedOn).toBe('2026-08-20');
  });

  /** FL21 step 4. Without this the lease goes active owing nothing. */
  it('starts the rent schedule at the commencement date', () => {
    const [lease] = applySignature([base(UNSIGNED)], {
      leaseId: UNSIGNED,
      signedOn: '2026-08-20',
    });
    expect(lease.history).toHaveLength(1);
    expect(lease.history[0]).toMatchObject({
      month: 'October 2026',
      amount: 410000,
      status: 'due',
      dueOn: '2026-10-01',
    });
  });

  /**
   * Signing late is normal; being told you are already behind because of it is
   * not. The charge is raised AT signature, so it cannot predate itself.
   */
  it('raises the first charge as due even when the start date has passed', () => {
    const [lease] = applySignature([base(UNSIGNED)], {
      leaseId: UNSIGNED,
      signedOn: '2026-11-04',
    });
    expect(lease.history[0].status).toBe('due');
  });

  it('turns the draft contract into the signed one', () => {
    const [lease] = applySignature([base(UNSIGNED)], {
      leaseId: UNSIGNED,
      signedOn: '2026-08-20',
    });
    expect(lease.documents[0].label).toBe('Lease contract');
    expect(lease.documents[0].meta).toContain('signed 2026-08-20');
  });

  it('refuses to re-sign a lease that is already running', () => {
    const running = base(RUNNING);
    const [lease] = applySignature([running], { leaseId: RUNNING, signedOn: '2026-09-06' });
    expect(lease).toEqual(running);
  });

  it('leaves every other lease alone', () => {
    const others = [base(RUNNING), base(CLOSED)];
    const next = applySignature([base(UNSIGNED), ...others], {
      leaseId: UNSIGNED,
      signedOn: '2026-08-20',
    });
    expect(next.slice(1)).toEqual(others);
  });
});

describe('applyRentPayment', () => {
  const pay = (month: string) =>
    applyRentPayment([base(RUNNING)], {
      leaseId: RUNNING,
      month,
      paidOn: '2026-09-06',
      method: 'mtn_momo',
    })[0];

  it('settles the named period and records how', () => {
    const period = pay('August 2026').history.find((p) => p.month === 'August 2026');
    expect(period).toMatchObject({
      status: 'paid',
      paidOn: '2026-09-06',
      method: 'mtn_momo',
    });
  });

  /** ui-rules.md: a mocked success must never look like a real one. */
  it('stamps the row mock, so every screen that draws it says so', () => {
    expect(pay('August 2026').history.find((p) => p.month === 'August 2026')?.mock).toBe(true);
  });

  it('does not touch the other periods', () => {
    const lease = pay('August 2026');
    expect(lease.history.find((p) => p.month === 'September 2026')?.status).toBe('due');
    expect(lease.history.find((p) => p.month === 'July 2026')?.mock).toBeUndefined();
  });

  /** Paying an already-settled month must not re-stamp a real payment as mock. */
  it('leaves a period that is already paid exactly as it was', () => {
    const before = base(RUNNING).history.find((p) => p.month === 'July 2026');
    expect(pay('July 2026').history.find((p) => p.month === 'July 2026')).toEqual(before);
  });
});

describe('applyMoveOut', () => {
  const notice = { filedOn: '2026-09-06', moveOutOn: '2026-10-31', message: 'Relocating.' };

  it('moves a running lease to ending and carries the notice', () => {
    const [lease] = applyMoveOut([base(RUNNING)], { leaseId: RUNNING, notice });
    expect(lease.leaseState).toBe('ending');
    expect(lease.notice).toEqual(notice);
  });

  /** `ended` belongs to the close and to FL24, not to filing a notice. */
  it('stops at ending rather than closing the lease', () => {
    const [lease] = applyMoveOut([base(RUNNING)], { leaseId: RUNNING, notice });
    expect(lease.leaseState).not.toBe('ended');
  });

  it('refuses a notice on a lease that has already closed', () => {
    const closed = base(CLOSED);
    const [lease] = applyMoveOut([closed], { leaseId: CLOSED, notice });
    expect(lease).toEqual(closed);
  });

  it('refuses a notice on a lease nobody has signed', () => {
    const unsigned = base(UNSIGNED);
    const [lease] = applyMoveOut([unsigned], { leaseId: UNSIGNED, notice });
    expect(lease).toEqual(unsigned);
  });
});

describe('applyRenewal', () => {
  const renewal = {
    requestedOn: '2026-09-06',
    termMonths: 12,
    startOn: '2027-02-02',
    endOn: '2028-02-01',
    rent: 450000,
    note: 'Same rate please.',
    state: 'pending' as const,
  };

  it('records the request', () => {
    const [lease] = applyRenewal([base(RUNNING)], { leaseId: RUNNING, renewal });
    expect(lease.renewal).toEqual(renewal);
  });

  /**
   * FL26 step 3: `endOn` moves on APPROVAL. A portal that moved it on the
   * request would be showing a term nobody has agreed to.
   */
  it('leaves the current term untouched', () => {
    const before = base(RUNNING);
    const [lease] = applyRenewal([before], { leaseId: RUNNING, renewal });
    expect(lease.endOn).toBe(before.endOn);
    expect(lease.endDate).toBe(before.endDate);
    expect(lease.leaseState).toBe(before.leaseState);
  });

  /** F-R13 §6: a rent change needs a new lease, so a renewal carries the rent. */
  it('carries the current rent rather than a new one', () => {
    const [lease] = applyRenewal([base(RUNNING)], { leaseId: RUNNING, renewal });
    expect(lease.renewal?.rent).toBe(lease.rent);
  });
});

describe('applyVisitor', () => {
  const visitor = {
    id: 'v-test',
    name: 'Marie Keza',
    relation: 'family' as const,
    stay: 'overnight' as const,
    arrivedOn: '2026-09-06',
  };

  it('puts the newest entry first', () => {
    const [lease] = applyVisitor([base(RUNNING)], { leaseId: RUNNING, visitor });
    expect(lease.visitors[0]).toEqual(visitor);
    expect(lease.visitors).toHaveLength(base(RUNNING).visitors.length + 1);
  });

  /** F-R14 §8: no departure recorded means the visitor is still in the unit. */
  it('records no departure for an overnight visitor', () => {
    const [lease] = applyVisitor([base(RUNNING)], { leaseId: RUNNING, visitor });
    expect(lease.visitors[0].leftOn).toBeUndefined();
  });
});
