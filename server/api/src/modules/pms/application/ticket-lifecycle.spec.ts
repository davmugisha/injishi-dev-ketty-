import { describe, expect, it } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TICKET_MOVES, addDays, kigaliToday, type MaintenanceStatus } from '@injishi/contracts';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { Db } from '../infrastructure/room-events';
import { TicketLifecycle } from './ticket-lifecycle';

/**
 * The shared ticket lifecycle (WP 4.1) with the database doubled: the chain
 * from `TICKET_MOVES` (legal and illegal moves, the 409 that says where the
 * ticket stands), "won't fix" needing its reason, the tenant's 14-day reopen
 * window, staying put being no move, and handing a ticket over. The SQL
 * itself runs against Postgres in `faults.integration.spec.ts`.
 */
const dialect = new PgDialect();
const TICKET = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

interface FakeTicket {
  status: MaintenanceStatus;
  lease_id: string | null;
  resolved_at: Date | null;
  assigned_to_user_id: string | null;
  assigned_contractor: string | null;
  assigned_contractor_phone: string | null;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a double's shape is what the test reads
function fakeTx(start: Partial<FakeTicket> | null) {
  const ticket: FakeTicket | null = start
    ? {
        status: 'open',
        lease_id: 'lease',
        resolved_at: null,
        assigned_to_user_id: null,
        assigned_contractor: null,
        assigned_contractor_phone: null,
        ...start,
      }
    : null;
  const updates: unknown[][] = [];
  const events: unknown[][] = [];
  const tx = {
    execute: async (query: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      const q = text.replace(/\s+/g, ' ').trim();
      if (q.startsWith('select id, status, lease_id')) {
        return { rows: ticket ? [{ id: TICKET, ...ticket }] : [] };
      }
      if (q.startsWith('update maintenance_tickets set status')) {
        updates.push(params);
        const to = params[0] as MaintenanceStatus;
        if (ticket) {
          ticket.status = to;
          if (to === 'resolved' || to === 'wont_fix') ticket.resolved_at = new Date();
          if (to === 'open') ticket.resolved_at = null;
        }
        return { rows: [] };
      }
      if (q.startsWith('update maintenance_tickets set assignee_kind')) {
        updates.push(params);
        if (ticket) {
          ticket.assigned_to_user_id = params[1] as string | null;
          ticket.assigned_contractor = params[2] as string | null;
          ticket.assigned_contractor_phone = params[3] as string | null;
          ticket.status = params[4] as MaintenanceStatus;
        }
        return { rows: [] };
      }
      if (q.startsWith('insert into maintenance_events')) {
        events.push(params);
        return { rows: [{ id: `event-${events.length}` }] };
      }
      throw new Error(`unexpected query: ${q.slice(0, 80)}`);
    },
  };
  return { tx: tx as unknown as Db, ticket, updates, events };
}

const lifecycle = new TicketLifecycle();
const move = (tx: Db, to: MaintenanceStatus, extra: Partial<Parameters<TicketLifecycle['move']>[1]> = {}): ReturnType<TicketLifecycle['move']> =>
  lifecycle.move(tx, { ticketId: TICKET, to, actorUserId: USER, actorRole: 'staff', ...extra });

describe('TicketLifecycle.move', () => {
  it('walks the whole chain: Reported, Seen, Assigned, In progress, Fixed, Closed', async () => {
    const f = fakeTx({ status: 'open', assigned_contractor: 'Eric' });
    const chain: MaintenanceStatus[] = ['acknowledged', 'assigned', 'in_progress', 'resolved', 'closed'];
    let from: MaintenanceStatus = 'open';
    for (const to of chain) {
      const out = await move(f.tx, to);
      expect(out).toMatchObject({ moved: true, from, to });
      from = to;
    }
    expect(f.updates).toHaveLength(5);
    // Each move wrote one timeline row with its kind, from and to.
    const kinds = f.events.map((p) => p[3]);
    expect(kinds).toEqual(['acknowledged', 'assigned', 'started', 'fixed', 'closed']);
    expect(f.events[0]?.slice(5, 7)).toEqual(['open', 'acknowledged']);
    // A ticket on a lease is on the tenant's timeline by default.
    expect(f.events.every((p) => p[7] === true)).toBe(true);
  });

  it('allows exactly the moves in TICKET_MOVES and refuses the rest with a 409 naming where it stands', async () => {
    const all: MaintenanceStatus[] = ['open', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'closed', 'wont_fix', 'cancelled'];
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue;
        const f = fakeTx({ status: from });
        const legal = TICKET_MOVES[from].includes(to);
        const run = move(f.tx, to, { note: 'because' });
        if (legal) {
          await expect(run).resolves.toMatchObject({ moved: true });
        } else {
          const err = await run.catch((e: unknown) => e);
          expect(err).toBeInstanceOf(ConflictException);
          expect((err as ConflictException).getResponse()).toMatchObject({ code: 'ticket_move', current: from });
          expect(f.updates).toHaveLength(0);
        }
      }
    }
  });

  it('refuses the moves people get wrong', async () => {
    await expect(move(fakeTx({ status: 'resolved' }).tx, 'in_progress')).rejects.toBeInstanceOf(ConflictException);
    await expect(move(fakeTx({ status: 'open' }).tx, 'closed')).rejects.toBeInstanceOf(ConflictException);
    await expect(move(fakeTx({ status: 'cancelled' }).tx, 'open')).rejects.toBeInstanceOf(ConflictException);
    await expect(move(fakeTx({ status: 'in_progress' }).tx, 'acknowledged')).rejects.toBeInstanceOf(ConflictException);
    await expect(move(fakeTx({ status: 'wont_fix' }).tx, 'closed')).rejects.toBeInstanceOf(ConflictException);
  });

  it('treats a move to where the ticket already is as no move', async () => {
    const f = fakeTx({ status: 'in_progress' });
    await expect(move(f.tx, 'in_progress')).resolves.toMatchObject({ moved: false, from: 'in_progress', to: 'in_progress', eventId: null });
    expect(f.updates).toHaveLength(0);
    expect(f.events).toHaveLength(0);
  });

  it("needs the reason for won't fix, and writes it on the ticket", async () => {
    await expect(move(fakeTx({ status: 'acknowledged' }).tx, 'wont_fix')).rejects.toBeInstanceOf(BadRequestException);
    await expect(move(fakeTx({ status: 'acknowledged' }).tx, 'wont_fix', { note: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    const f = fakeTx({ status: 'acknowledged' });
    await move(f.tx, 'wont_fix', { note: 'The tenant broke it; the deposit covers it.' });
    expect(f.updates[0]).toContain('The tenant broke it; the deposit covers it.');
    expect(f.events[0]?.[3]).toBe('wont_fix');
  });

  it("lets the tenant reopen within 14 days of the fix, and not after", async () => {
    const today = kigaliToday();
    const recent = fakeTx({ status: 'resolved', resolved_at: new Date(Date.now() - 3 * 86_400_000) });
    await expect(move(recent.tx, 'open', { actorRole: 'tenant', note: 'Still drips', tenantReopen: { today } })).resolves.toMatchObject({ moved: true, to: 'open' });
    expect(recent.events[0]?.[3]).toBe('reopened');

    const closed = fakeTx({ status: 'closed', resolved_at: new Date(Date.now() - 10 * 86_400_000) });
    await expect(move(closed.tx, 'open', { actorRole: 'tenant', note: 'Again', tenantReopen: { today } })).resolves.toMatchObject({ moved: true });

    const refused = fakeTx({ status: 'wont_fix', resolved_at: new Date(Date.now() - 2 * 86_400_000) });
    await expect(move(refused.tx, 'open', { actorRole: 'tenant', note: 'Please', tenantReopen: { today } })).resolves.toMatchObject({ moved: true });

    const old = fakeTx({ status: 'resolved', resolved_at: new Date(Date.now() - 20 * 86_400_000) });
    const err = await move(old.tx, 'open', { actorRole: 'tenant', note: 'Still', tenantReopen: { today } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'reopen_window' });
    expect(old.updates).toHaveLength(0);

    // The window is counted in Kigali days: day 14 is still in, day 15 is out.
    const settled = new Date(`${addDays(today, -14)}T09:00:00+02:00`);
    await expect(move(fakeTx({ status: 'resolved', resolved_at: settled }).tx, 'open', { actorRole: 'tenant', note: 'x', tenantReopen: { today } })).resolves.toMatchObject({ moved: true });
    const late = new Date(`${addDays(today, -15)}T09:00:00+02:00`);
    await expect(move(fakeTx({ status: 'resolved', resolved_at: late }).tx, 'open', { actorRole: 'tenant', note: 'x', tenantReopen: { today } })).rejects.toBeInstanceOf(ConflictException);

    // The landlord's reopen has no window.
    await expect(move(fakeTx({ status: 'resolved', resolved_at: late }).tx, 'open')).resolves.toMatchObject({ moved: true });
  });

  it('answers 404 for a ticket that does not exist', async () => {
    await expect(move(fakeTx(null).tx, 'acknowledged')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps a hotel order off any tenant timeline', async () => {
    const f = fakeTx({ status: 'assigned', lease_id: null });
    await move(f.tx, 'in_progress');
    expect(f.events[0]?.[7]).toBe(false);
  });
});

describe('TicketLifecycle.assign', () => {
  const contractor = { kind: 'contractor' as const, name: 'Eric', phone: '+250788000111' };

  it('moves a waiting ticket to assigned, and says who on the timeline', async () => {
    for (const from of ['open', 'acknowledged'] as const) {
      const f = fakeTx({ status: from });
      const out = await lifecycle.assign(f.tx, { ticketId: TICKET, assignee: contractor, actorUserId: USER, actorRole: 'staff' });
      expect(out).toMatchObject({ moved: true, from, to: 'assigned' });
      expect(f.events[0]?.[4]).toBe('Assigned to Eric.');
    }
  });

  it('hands a ticket being worked to someone else without moving it, and does nothing for the same person', async () => {
    const f = fakeTx({ status: 'in_progress', assigned_to_user_id: USER });
    const out = await lifecycle.assign(f.tx, { ticketId: TICKET, assignee: contractor, actorUserId: USER, actorRole: 'staff', note: 'Bring a washer' });
    expect(out).toMatchObject({ moved: false, from: 'in_progress', to: 'in_progress' });
    expect(out.eventId).not.toBeNull();
    expect(f.events[0]?.[4]).toBe('Assigned to Eric. Bring a washer');
    const again = await lifecycle.assign(f.tx, { ticketId: TICKET, assignee: contractor, actorUserId: USER, actorRole: 'staff' });
    expect(again).toMatchObject({ moved: false, eventId: null });
  });

  it('refuses to hand over a ticket that is settled', async () => {
    for (const from of ['closed', 'wont_fix', 'cancelled'] as const) {
      await expect(lifecycle.assign(fakeTx({ status: from }).tx, { ticketId: TICKET, assignee: contractor, actorUserId: USER, actorRole: 'staff' })).rejects.toBeInstanceOf(ConflictException);
    }
    await expect(
      lifecycle.assign(fakeTx({ status: 'resolved' }).tx, { ticketId: TICKET, assignee: contractor, actorUserId: USER, actorRole: 'staff', allowedFrom: ['open', 'acknowledged', 'assigned', 'in_progress'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
