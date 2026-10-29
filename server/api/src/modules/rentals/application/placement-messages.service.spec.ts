import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceAccess } from '@injishi/contracts';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';
import type { MessageFilesStorage } from '../../storage/application/message-files-storage';
import type { LeaseMessagesRepository } from '../infrastructure/lease-messages.repository';
import type { PlacementMessagesRepository, PlacementThreadContext } from '../infrastructure/placement-messages.repository';
import type { MessageEvents } from './message-events';
import { PlacementMessagesService } from './placement-messages.service';

const LANDLORD_WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_LANDLORD_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROKER_WS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_BROKER_WS = 'c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc';
const TENANT_WS = 'c3c3c3c3-cccc-4ccc-8ccc-cccccccccccc';
const PLACEMENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const THREAD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const BUILDING = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const BROKER = '11111111-1111-4111-8111-111111111111';
const BROKER_USER = '22222222-2222-4222-8222-222222222222';
const OTHER_BROKER = '33333333-3333-4333-8333-333333333333';
const OTHER_BROKER_USER = '44444444-4444-4444-8444-444444444444';
const OWNER = '55555555-5555-4555-8555-555555555555';
const OTHER_OWNER = '66666666-6666-4666-8666-666666666666';
const TENANT_USER = '77777777-7777-4777-8777-777777777777';

const ctx = (over: Partial<PlacementThreadContext> = {}): PlacementThreadContext => ({
  placementId: PLACEMENT,
  status: 'initiated',
  brokerId: BROKER,
  brokerUserId: BROKER_USER,
  brokerStatus: 'active',
  brokerName: 'Didier Broker',
  brokerEmail: 'broker@injishi.test',
  workspaceId: LANDLORD_WS,
  orgId: 'org',
  propertyId: BUILDING,
  unitLabel: 'A-02',
  propertyName: 'Amani Residences',
  tenantName: 'Grace',
  landlordName: 'Amani Residences Ltd',
  threadId: THREAD,
  ...over,
});

const landlord = (over: Partial<ScopedWorkspace> = {}): ScopedWorkspace =>
  ({
    workspaceId: LANDLORD_WS,
    kind: 'business',
    orgId: 'org',
    domain: 'residence',
    orgRole: 'owner',
    permissions: ['lease.manage', 'message.send'],
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    ...over,
  }) as unknown as ScopedWorkspace;

const brokerWs = (workspaceId = BROKER_WS): WorkspaceAccess => ({ workspaceId, kind: 'broker' }) as unknown as WorkspaceAccess;
/** A tenant's own workspace (kind `guest`): they hold no broker registration and no business. */
const tenantWs = (): WorkspaceAccess => ({ workspaceId: TENANT_WS, kind: 'guest' }) as unknown as WorkspaceAccess;

const BROKERS: Record<string, { brokerId: string; userId: string; status: string }> = {
  [BROKER_WS]: { brokerId: BROKER, userId: BROKER_USER, status: 'active' },
  [OTHER_BROKER_WS]: { brokerId: OTHER_BROKER, userId: OTHER_BROKER_USER, status: 'active' },
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the doubles are what the tests read
function build(placement: PlacementThreadContext | null) {
  const emitted: string[] = [];
  const messages = {
    summaries: vi.fn(async () => new Map()),
    page: vi.fn(async () => [
      { id: 'm1', threadId: THREAD, senderUserId: BROKER_USER, senderName: 'Didier', bodyType: 'text', body: 'I have a tenant', voiceDurationS: null, createdAt: new Date('2026-10-26T09:00:00Z'), faultId: null, faultReference: null, faultTitle: null, faultStatus: null },
    ]),
    reads: vi.fn(async () => []),
    attachments: vi.fn(async () => []),
    attachment: vi.fn(async () => null),
    insertMessage: vi.fn(async () => ({ id: 'm1', createdAt: new Date('2026-10-26T09:00:00Z') })),
    markRead: vi.fn(async () => new Date('2026-10-26T09:01:00Z')),
  } as unknown as LeaseMessagesRepository;
  const repo = {
    context: vi.fn(async () => placement),
    brokerOfWorkspace: vi.fn(async (ws: string) => BROKERS[ws] ?? null),
    forBroker: vi.fn(async (brokerId: string) => (placement && placement.brokerId === brokerId ? [placement] : [])),
    forWorkspace: vi.fn(async (ws: string) => (placement && placement.workspaceId === ws ? [placement] : [])),
    ensureThread: vi.fn(async () => THREAD),
  } as unknown as PlacementMessagesRepository;
  const db = { transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) } as unknown as Database;
  const files = { put: vi.fn(), read: vi.fn() } as unknown as MessageFilesStorage;
  const events = {
    placementMessageNew: vi.fn(() => emitted.push('new')),
    placementThreadRead: vi.fn(() => emitted.push('read')),
  } as unknown as MessageEvents;
  return { service: new PlacementMessagesService(db, messages, repo, files, events), repo, messages, emitted };
}

describe('PlacementMessagesService: who may open a broker conversation', () => {
  it('the broker reads and writes their own placement', async () => {
    const { service, emitted } = build(ctx());
    const view = await service.brokerThread(brokerWs(), BROKER_USER, PLACEMENT);
    expect(view.counterpartName).toBe('Amani Residences Ltd');
    expect(view.messages[0]).toMatchObject({ side: 'broker', fromMe: true });
    await service.brokerSend(brokerWs(), BROKER_USER, PLACEMENT, { body: 'Hello' }, []);
    expect(emitted).toEqual(['new']);
  });

  it('the landlord team of the unit reads it, and sees the broker by name', async () => {
    const { service } = build(ctx());
    const view = await service.landlordThread(landlord(), OWNER, PLACEMENT);
    expect(view.counterpartName).toBe('Didier Broker');
    expect(view.messages[0]).toMatchObject({ side: 'broker', fromMe: false, senderName: 'Didier Broker' });
  });

  it('another broker is told it is not there (404), on every route', async () => {
    const { service } = build(ctx());
    const ws = brokerWs(OTHER_BROKER_WS);
    await expect(service.brokerThread(ws, OTHER_BROKER_USER, PLACEMENT)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.brokerSend(ws, OTHER_BROKER_USER, PLACEMENT, { body: 'x' }, [])).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.brokerRead(ws, OTHER_BROKER_USER, PLACEMENT)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.brokerFile(ws, OTHER_BROKER_USER, PLACEMENT, THREAD)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.brokerList(ws, OTHER_BROKER_USER)).threads).toEqual([]);
  });

  it("another landlord is told it is not there (404), and lists none of it", async () => {
    const { service } = build(ctx());
    const other = landlord({ workspaceId: OTHER_LANDLORD_WS, orgId: 'other-org' } as Partial<ScopedWorkspace>);
    await expect(service.landlordThread(other, OTHER_OWNER, PLACEMENT)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.landlordSend(other, OTHER_OWNER, PLACEMENT, { body: 'x' }, [])).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.landlordRead(other, OTHER_OWNER, PLACEMENT)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.landlordFile(other, PLACEMENT, THREAD)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.landlordList(other, OTHER_OWNER)).threads).toEqual([]);
    expect((await service.landlordUnread(other, OTHER_OWNER)).total).toBe(0);
  });

  it("a team member whose buildings don't cover the unit is told it is not there", async () => {
    const { service } = build(ctx());
    const narrow = landlord({
      branchScope: { coverage: 'limited', selectedPropertyId: null, propertyIds: ['somewhere-else'], includesUnbranched: false },
    } as Partial<ScopedWorkspace>);
    await expect(service.landlordThread(narrow, OWNER, PLACEMENT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a tenant is refused on the broker routes (403) and on the landlord routes (404)', async () => {
    const { service } = build(ctx());
    await expect(service.brokerThread(tenantWs(), TENANT_USER, PLACEMENT)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.brokerList(tenantWs(), TENANT_USER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.brokerSend(tenantWs(), TENANT_USER, PLACEMENT, { body: 'x' }, [])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.landlordThread(tenantWs() as unknown as ScopedWorkspace, TENANT_USER, PLACEMENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a broker workspace held by someone else is refused (403)", async () => {
    const { service } = build(ctx());
    await expect(service.brokerThread(brokerWs(), OTHER_BROKER_USER, PLACEMENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the live line admits the broker and the landlord business only', async () => {
    const { service } = build(ctx());
    expect(await service.mayListen(BROKER_USER, PLACEMENT, null)).toMatchObject({ threadId: THREAD });
    expect(await service.mayListen(OTHER_BROKER_USER, PLACEMENT, null)).toBeNull();
    expect(await service.mayListen(TENANT_USER, PLACEMENT, null)).toBeNull();
    expect(await service.mayListen(OWNER, PLACEMENT, { workspaceId: LANDLORD_WS })).toMatchObject({ threadId: THREAD });
    expect(await service.mayListen(OTHER_OWNER, PLACEMENT, { workspaceId: OTHER_LANDLORD_WS })).toBeNull();
  });

  it('makes the thread the first time either side opens it', async () => {
    const { service, repo } = build(ctx({ threadId: null }));
    const view = await service.landlordThread(landlord(), OWNER, PLACEMENT);
    expect(repo.ensureThread).toHaveBeenCalledTimes(1);
    expect(view.threadId).toBe(THREAD);
  });

  it('a dropped placement is read only and never makes a thread', async () => {
    const { service, repo } = build(ctx({ status: 'abandoned', threadId: null }));
    const view = await service.brokerThread(brokerWs(), BROKER_USER, PLACEMENT);
    expect(view.writable).toBe(false);
    expect(view.threadId).toBeNull();
    expect(repo.ensureThread).not.toHaveBeenCalled();
    await expect(service.brokerSend(brokerWs(), BROKER_USER, PLACEMENT, { body: 'x' }, [])).rejects.toBeInstanceOf(ConflictException);
  });

  it('a suspended broker reads but does not send', async () => {
    const { service } = build(ctx({ brokerStatus: 'suspended' }));
    await expect(service.brokerThread(brokerWs(), BROKER_USER, PLACEMENT)).resolves.toBeTruthy();
    await expect(service.brokerSend(brokerWs(), BROKER_USER, PLACEMENT, { body: 'x' }, [])).rejects.toBeInstanceOf(ForbiddenException);
  });
});
