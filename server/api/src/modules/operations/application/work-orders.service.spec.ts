import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';
import type { StaffPhoneRepository } from '../infrastructure/staff-phone.repository';
import { WorkOrdersRepository, type WorkOrderRow } from '../infrastructure/work-orders.repository';
import type { TicketLifecycle } from './ticket-lifecycle';
import { WorkOrderTimeService } from './work-order-time.service';
import { WorkOrdersService } from './work-orders.service';

/**
 * The hotel's work orders after the shared ticket lifecycle (WP 4.1): a
 * regression spec. Handing an order over, starting it and marking it fixed
 * still do what the maintenance board and the technician's phone expect, now
 * through `TicketLifecycle` (open > assigned > in progress > resolved, the
 * `started` and `fixed` timeline rows, the fix written), a closed order is
 * still refused, photos come from `maintenance_photos`, and the board never
 * lists a rented unit's fault.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const ORDER = '44444444-4444-4444-8444-444444444444';
const TECH = '55555555-5555-4555-8555-555555555555';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: '22222222-2222-4222-8222-222222222222',
  domain: 'hospitality',
  orgRole: 'manager',
  permissions: ['ticket.advance'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const order = (over: Partial<WorkOrderRow> = {}): WorkOrderRow => ({
  id: ORDER,
  workspace_id: WS,
  org_id: ws.orgId,
  property_id: PROPERTY,
  reference: 'WO-7',
  room_id: 'room',
  room_label: '302',
  room_type_name: 'Deluxe',
  floor: 3,
  space_id: null,
  space_name: null,
  asset_id: null,
  asset_name: null,
  title: 'AC drips',
  description: null,
  category: 'hvac',
  priority: 'normal',
  status: 'open',
  assigned_to_user_id: null,
  assigned_to_name: null,
  assigned_contractor: null,
  scheduled_for: null,
  raised_by_name: 'Desk',
  raised_via: 'maintenance board',
  created_at: new Date('2026-10-20T08:00:00Z'),
  impact_note: null,
  release_note: null,
  photo_object_keys: null,
  resolved_at: null,
  verified_at: null,
  ...over,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a double's shape is what the test reads
function harness(row: WorkOrderRow) {
  const tx = {};
  const database = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb(tx) };
  const repo = {
    database,
    find: jest.fn(async () => row),
    parts: jest.fn(async () => []),
    events: jest.fn(async () => []),
    blocks: jest.fn(async () => []),
    photos: jest.fn(async () => [{ ticket_id: ORDER, object_key: 'fault_photo/a.jpg', caption: null }]),
    openBlockForTicket: jest.fn(async () => null),
    addEvent: jest.fn(async () => undefined),
  };
  const lifecycle = {
    move: jest.fn(async () => ({ moved: true })),
    assign: jest.fn(async () => ({ moved: true })),
  };
  const phone = {
    stopLogs: jest.fn(async () => undefined),
    runningLog: jest.fn(async () => null),
    startLog: jest.fn(async () => undefined),
  };
  const orders = new WorkOrdersService(repo as unknown as WorkOrdersRepository, lifecycle as unknown as TicketLifecycle);
  const time = new WorkOrderTimeService(
    repo as unknown as WorkOrdersRepository,
    phone as unknown as StaffPhoneRepository,
    orders,
    lifecycle as unknown as TicketLifecycle,
  );
  return { orders, time, repo, lifecycle, phone, tx };
}

describe('hotel work orders on the shared ticket lifecycle', () => {
  it('hands an order to a contractor through the lifecycle, off any tenant timeline', async () => {
    const h = harness(order());
    const view = await h.orders.assign(ws, ORDER, { contractor: 'CoolFix Ltd' }, TECH);
    expect(h.lifecycle.assign).toHaveBeenCalledWith(h.tx, {
      ticketId: ORDER,
      assignee: { kind: 'contractor', name: 'CoolFix Ltd', phone: null },
      actorUserId: TECH,
      actorRole: 'staff',
      visibleToTenant: false,
    });
    expect(view.photos).toEqual([{ key: 'fault_photo/a.jpg', caption: '' }]);
  });

  it('still refuses to hand over a closed or cancelled order', async () => {
    for (const status of ['closed', 'cancelled', 'wont_fix'] as const) {
      const h = harness(order({ status }));
      await expect(h.orders.assign(ws, ORDER, { contractor: 'CoolFix Ltd' }, TECH)).rejects.toBeInstanceOf(ConflictException);
      expect(h.lifecycle.assign).not.toHaveBeenCalled();
    }
  });

  it('starting an assigned order moves it to in progress with a started row', async () => {
    const h = harness(order({ status: 'assigned', assigned_to_user_id: TECH }));
    await h.time.start(ws, ORDER, TECH);
    expect(h.lifecycle.move).toHaveBeenCalledWith(h.tx, {
      ticketId: ORDER,
      to: 'in_progress',
      actorUserId: TECH,
      actorRole: 'staff',
      eventKind: 'started',
      visibleToTenant: false,
    });
  });

  it('starting an order already in progress moves nothing', async () => {
    const h = harness(order({ status: 'in_progress', assigned_to_user_id: TECH }));
    await h.time.start(ws, ORDER, TECH);
    expect(h.lifecycle.move).not.toHaveBeenCalled();
  });

  it('marking it fixed stops the timers and writes the fix as the fixed row', async () => {
    const h = harness(order({ status: 'in_progress', assigned_to_user_id: TECH }));
    await h.time.resolve(ws, ORDER, { fix: 'Cleared the drain line', askRelease: false }, TECH);
    expect(h.phone.stopLogs).toHaveBeenCalledWith(h.tx, ORDER, null);
    expect(h.lifecycle.move).toHaveBeenCalledWith(h.tx, {
      ticketId: ORDER,
      to: 'resolved',
      actorUserId: TECH,
      actorRole: 'staff',
      note: 'Cleared the drain line',
      eventKind: 'fixed',
      visibleToTenant: false,
    });
  });

  it('refuses a fixed order and somebody else’s order, as before', async () => {
    await expect(harness(order({ status: 'resolved', assigned_to_user_id: TECH })).time.resolve(ws, ORDER, { fix: 'x', askRelease: false }, TECH)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(harness(order({ status: 'assigned', assigned_to_user_id: 'someone-else' })).time.start(ws, ORDER, TECH)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never lists a rented unit’s fault on the hotel board', async () => {
    const dialect = new PgDialect();
    const seen: string[] = [];
    const db = { execute: async (q: SQL) => (seen.push(dialect.sqlToQuery(q).sql.replace(/\s+/g, ' ')), { rows: [] }) };
    const repo = new WorkOrdersRepository(db as unknown as Database);
    await repo.list(WS, ws.branchScope);
    expect(seen[0]).toContain('t.lease_id is null and t.unit_id is null');
  });
});
