import { ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import type { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import type { LeaseRemindersRepository, RemindableCharge } from '../infrastructure/lease-reminders.repository';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SigningRepository } from '../infrastructure/signing.repository';
import { RentRemindersService } from './rent-reminders.service';

/**
 * Rent reminders with every collaborator doubled (WP 1.6a). Pinned here: the
 * windows (3 days before, the day, after the grace days, then +7 and +14),
 * the hours (08:00 to 18:00 Kigali), one reminder per charge, kind and stage
 * (a taken claim sends nothing), a claim whose email did not go is withdrawn,
 * the email's words, and the landlord's own reminder at most once a day.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const CHARGE = '88888888-8888-4888-8888-888888888888';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: '22222222-2222-4222-8222-222222222222',
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['rent.record'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

/** 09:00 in Kigali on `day`. */
const at = (day: string, hour = 9): Date => new Date(`${day}T${String(hour - 2).padStart(2, '0')}:00:00Z`);

const remindable = (over: Partial<RemindableCharge> = {}): RemindableCharge => ({
  chargeId: CHARGE,
  kind: 'rent',
  periodStart: '2026-11-01',
  dueOn: '2026-11-05',
  amountRwf: 350_000,
  paidRwf: 0,
  leaseId: LEASE,
  workspaceId: WS,
  propertyId: PROPERTY,
  graceDays: 5,
  ...over,
});

interface Opts {
  charges?: RemindableCharge[];
  claimed?: boolean;
  mailOk?: boolean;
  manualToday?: number;
  tenantEmail?: string | null;
  chargeRow?: Partial<ChargeRow>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const sent: { to: string; subject: string; lines: string[] }[] = [];
  const events: { kind: string; payload: Record<string, unknown> }[] = [];
  const claims: { kind: string; stage: number }[] = [];
  const withdrawn: string[] = [];
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const reminders = {
    remindable: jest.fn(async () => opts.charges ?? [remindable()]),
    claim: jest.fn(async (_db: unknown, input: { kind: string; stage: number }) => {
      if (opts.claimed) return null;
      claims.push({ kind: input.kind, stage: input.stage });
      return `rem-${claims.length}`;
    }),
    withdraw: jest.fn(async (_db: unknown, id: string) => {
      withdrawn.push(id);
    }),
    manualCountSince: jest.fn(async () => opts.manualToday ?? 0),
    insertManual: jest.fn(async () => 'manual-1'),
  };
  const record = {
    lease: { id: LEASE, workspaceId: WS, orgId: ws.orgId, propertyId: PROPERTY, graceDays: 5, reference: 'L-0001' },
    tenant: { id: 'tenant', userId: null, fullName: 'Aline Uwera', email: opts.tenantEmail === undefined ? 'aline@example.rw' : opts.tenantEmail },
    unitLabel: 'A-01',
    propertyName: 'Amani Residences',
  } as unknown as LeaseRecord;
  const leases = { find: jest.fn(async () => record) };
  const payments = {
    charges: jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, leaseId: LEASE, kind: 'rent', periodStart: '2026-11-01', dueOn: '2026-11-05', amountRwf: 350_000, paidRwf: 0, status: 'open', ...opts.chargeRow }) as ChargeRow),
    ),
  };
  const context = { org: jest.fn(async () => ({ legalName: 'Amani Residences' })) };
  const signing = { accountEmail: jest.fn(async () => null) };
  const eventsWriter = { write: jest.fn(async (_tx: unknown, e: { kind: string; payload: Record<string, unknown> }) => events.push(e)) };
  const mailer = {
    appUrl: 'http://localhost:3002',
    send: jest.fn(async (_ref: string, to: string, mail: { subject: string; lines: string[] }) => {
      sent.push({ to, subject: mail.subject, lines: mail.lines });
      return opts.mailOk ?? true;
    }),
  };
  const service = new RentRemindersService(
    db as never,
    reminders as unknown as LeaseRemindersRepository,
    leases as unknown as LeasesRepository,
    payments as unknown as LeasePaymentsRepository,
    context as unknown as RentalsContextRepository,
    signing as unknown as SigningRepository,
    eventsWriter as unknown as LeaseEventsWriter,
    mailer as unknown as RentalsMailer,
  );
  return { service, sent, events, claims, withdrawn, reminders };
}

describe('RentRemindersService', () => {
  describe('the automatic reminders', () => {
    it('looks at nothing outside 08:00 to 18:00 Kigali', async () => {
      const h = harness();
      expect(await h.service.run(at('2026-11-05', 7))).toMatchObject({ skipped: true, sent: [] });
      expect(await h.service.run(at('2026-11-05', 18))).toMatchObject({ skipped: true });
      expect(h.reminders.remindable).not.toHaveBeenCalled();
    });

    it.each([
      ['2026-11-01', null],
      ['2026-11-02', { kind: 'upcoming', stage: 0 }],
      ['2026-11-05', { kind: 'due', stage: 0 }],
      ['2026-11-07', null],
      ['2026-11-11', { kind: 'overdue', stage: 0 }],
      ['2026-11-18', { kind: 'overdue', stage: 1 }],
      ['2026-11-25', { kind: 'overdue', stage: 2 }],
    ])('on %s sends %j', async (day, expected) => {
      const h = harness();
      const run = await h.service.run(at(day));
      if (expected) {
        expect(run.sent).toEqual([{ chargeId: CHARGE, ...expected, to: 'aline@example.rw' }]);
        expect(h.claims).toEqual([expected]);
      } else {
        expect(run.sent).toEqual([]);
        expect(h.claims).toEqual([]);
      }
    });

    it('sends nothing when the claim is already taken: one reminder per charge, kind and stage', async () => {
      const h = harness({ claimed: true });
      const run = await h.service.run(at('2026-11-05'));
      expect(run.sent).toEqual([]);
      expect(h.sent).toEqual([]);
      expect(h.events).toEqual([]);
    });

    it('words the email plainly, with the amount in francs and the home', async () => {
      const h = harness({ charges: [remindable({ paidRwf: 50_000 })] });
      await h.service.run(at('2026-11-05'));
      expect(h.sent[0]).toMatchObject({ to: 'aline@example.rw', subject: 'Rent for November 2026 is due today' });
      expect(h.sent[0]!.lines.join('\n')).toContain('Your rent for November 2026 is RWF 300,000 and is due today. This is for unit A-01 at Amani Residences.');
      expect(h.sent[0]!.lines.join('\n')).not.toMatch(/[–—]/);
      expect(h.events[0]).toMatchObject({ kind: 'reminder_sent', payload: expect.objectContaining({ kind: 'due', owedRwf: 300_000, emailed: true }) });
    });

    it('withdraws the claim when the email did not go, so the next run tries again', async () => {
      const h = harness({ mailOk: false });
      const run = await h.service.run(at('2026-11-05'));
      expect(run.failed).toEqual([{ chargeId: CHARGE, message: expect.stringContaining('did not go') }]);
      expect(h.withdrawn).toEqual(['rem-1']);
      expect(h.events).toEqual([]);
    });

    it('keeps the claim and the timeline row for a tenant with no email address', async () => {
      const h = harness({ tenantEmail: null });
      const run = await h.service.run(at('2026-11-05'));
      expect(run.sent).toEqual([{ chargeId: CHARGE, kind: 'due', stage: 0, to: null }]);
      expect(h.sent).toEqual([]);
      expect(h.events[0]).toMatchObject({ kind: 'reminder_sent', payload: expect.objectContaining({ emailed: false }) });
    });
  });

  describe('the landlord reminder', () => {
    it('sends it with the landlord note and records who sent it', async () => {
      const h = harness();
      const out = await h.service.sendManual(ws, USER, { chargeIds: [CHARGE], note: 'Please pay by Friday.' }, at('2026-11-03'));
      expect(out).toEqual({ sent: [{ chargeId: CHARGE, reminderId: 'manual-1', emailedTo: 'aline@example.rw' }], skipped: [] });
      expect(h.sent[0]!.lines.join('\n')).toContain('From Amani Residences: Please pay by Friday.');
      expect(h.sent[0]!.lines.join('\n')).toContain('A reminder from Amani Residences: RWF 350,000 for your rent for November 2026 is due on 5 November 2026.');
      expect(h.events[0]).toMatchObject({ kind: 'reminder_sent', payload: expect.objectContaining({ kind: 'manual' }) });
    });

    it('refuses a second one on the same day', async () => {
      const h = harness({ manualToday: 1 });
      await expect(h.service.sendManual(ws, USER, { chargeIds: [CHARGE] }, at('2026-11-03'))).rejects.toThrow(ConflictException);
      expect(h.sent).toEqual([]);
    });

    it('skips a charge with nothing owed, and says why', async () => {
      const h = harness({ chargeRow: { status: 'paid', paidRwf: 350_000 } });
      await expect(h.service.sendManual(ws, USER, { chargeIds: [CHARGE] }, at('2026-11-03'))).rejects.toMatchObject({ response: { code: 'reminder_skipped', message: 'Nothing is owed on this charge.' } });
    });
  });
});
