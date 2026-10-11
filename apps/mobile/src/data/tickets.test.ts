/**
 * The maintenance ticket store — the one place the Tenant and Landlord seats
 * meet.
 *
 * The assertion that matters most is the boring one: a ticket a tenant files
 * carries the lease it was filed against, so `ticketsForLease` finds it and the
 * landlord's queue can too. F-R11 exists because maintenance requests happen
 * off-platform with no record; a store where the two seats disagree about which
 * tickets exist is that problem with extra steps.
 */
import {
  TICKETS,
  applyFiling,
  nextRef,
  openTicketsForLease,
  ticketsForLease,
  type Ticket,
} from './tickets';

const seed = (): Ticket[] => JSON.parse(JSON.stringify(TICKETS)) as Ticket[];

const INPUT = {
  title: 'Leaking kitchen tap',
  detail: 'Water pooling under the sink since this morning.',
  location: 'Nyamirambo Flat 1',
  leaseId: 'nyamirambo-flat-1',
  reporter: 'Samuel Kayitare',
  priority: 'urgent' as const,
  photos: ['file:///tmp/tap.jpg'],
  filedOn: '2026-09-06',
};

describe('nextRef', () => {
  /** A reference is read down a phone line, so it counts rather than hashes. */
  it('counts on from the highest already issued', () => {
    expect(nextRef(seed())).toBe('T-205');
  });

  it('starts at one on an empty queue', () => {
    expect(nextRef([])).toBe('T-1');
  });
});

describe('applyFiling', () => {
  it('opens the ticket and puts it at the front of the queue', () => {
    const all = applyFiling(seed(), INPUT);
    expect(all).toHaveLength(TICKETS.length + 1);
    expect(all[0]).toMatchObject({
      ref: 'T-205',
      title: INPUT.title,
      state: 'open',
      priority: 'urgent',
    });
  });

  /** The whole point of the shared store: the landlord's queue can find it. */
  it('carries the lease it was filed against', () => {
    const all = applyFiling(seed(), INPUT);
    expect(ticketsForLease(all, 'nyamirambo-flat-1').map((x) => x.ref)).toEqual(['T-205']);
  });

  it('opens the audit trail with the filing', () => {
    const [ticket] = applyFiling(seed(), INPUT);
    expect(ticket.events).toEqual([
      { on: '2026-09-06', what: 'filed', by: 'Samuel Kayitare' },
    ]);
  });

  it('keeps the evidence the reporter attached', () => {
    const [ticket] = applyFiling(seed(), INPUT);
    expect(ticket.photos).toEqual(['file:///tmp/tap.jpg']);
  });

  it('leaves the existing queue untouched', () => {
    const before = seed();
    expect(applyFiling(before, INPUT).slice(1)).toEqual(seed());
  });

  it('gives two tickets filed in a row two different references', () => {
    const once = applyFiling(seed(), INPUT);
    const twice = applyFiling(once, { ...INPUT, title: 'Second thing' });
    expect(twice[0].ref).toBe('T-206');
    expect(twice[1].ref).toBe('T-205');
  });
});

describe('ticketsForLease', () => {
  /** The seeded tickets belong to other units and carry no lease id at all. */
  it('is empty for a lease nothing has been filed against', () => {
    expect(ticketsForLease(seed(), 'nyamirambo-flat-1')).toEqual([]);
  });
});

/**
 * The one definition of "open" both tenant screens read. Lease detail dropped
 * resolved tickets and the report screen did not, so a fixed leak was listed as
 * open under the form that reports a new one (mobile audit 2026-10-05, TN-19).
 */
describe('openTicketsForLease', () => {
  const onLease = (ref: string, state: Ticket['state']): Ticket => ({
    ...seed()[0],
    ref,
    state,
    leaseId: 'nyamirambo-flat-1',
  });

  it('keeps open and assigned tickets and drops resolved ones', () => {
    const all = [
      onLease('T-3', 'open'),
      onLease('T-2', 'assigned'),
      onLease('T-1', 'resolved'),
      ...seed(),
    ];
    expect(openTicketsForLease(all, 'nyamirambo-flat-1').map((x) => x.ref)).toEqual([
      'T-3',
      'T-2',
    ]);
  });

  it('never reaches another lease', () => {
    expect(openTicketsForLease([onLease('T-3', 'open')], 'ingoro-apartments-a2')).toEqual([]);
  });
});
