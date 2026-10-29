import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';
import type { MessageFilesStorage } from '../../storage/application/message-files-storage';
import type { LeaseMessagesRepository, LeaseThreadContext } from '../infrastructure/lease-messages.repository';
import { LeaseMessagesService } from './lease-messages.service';
import type { MessageEvents } from './message-events';

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LEASE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const THREAD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BUILDING = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TENANT = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '99999999-9999-4999-8999-999999999999';

const ctx = (over: Partial<LeaseThreadContext> = {}): LeaseThreadContext => ({
  leaseId: LEASE,
  workspaceId: WS,
  orgId: 'org',
  propertyId: BUILDING,
  status: 'active',
  reference: 'L-0002',
  unitLabel: 'A-02',
  propertyName: 'Amani Residences',
  landlordName: 'Amani Residences Ltd',
  tenantId: 'tenant',
  tenantName: 'Grace Mukamana',
  tenantEmail: 'grace@example.test',
  tenantUserId: TENANT,
  threadId: THREAD,
  ...over,
});

const ws = (over: Partial<ScopedWorkspace> = {}): ScopedWorkspace =>
  ({
    workspaceId: WS,
    kind: 'business',
    orgId: 'org',
    domain: 'residence',
    orgRole: 'owner',
    permissions: ['message.send'],
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    ...over,
  }) as unknown as ScopedWorkspace;

const at = (iso: string): Date => new Date(iso);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the doubles are what the tests read
function build(lease: LeaseThreadContext | null, reads: { userId: string; lastReadAt: Date }[] = []) {
  const emitted: string[] = [];
  const repo = {
    context: vi.fn(async () => lease),
    reads: vi.fn(async () => reads),
    page: vi.fn(async () => [
      { id: 'm2', threadId: THREAD, senderUserId: OWNER, senderName: 'Amani', bodyType: 'text', body: 'Rent received', voiceDurationS: null, createdAt: at('2026-10-25T10:05:00Z'), faultId: null, faultReference: null, faultTitle: null, faultStatus: null },
      { id: 'm1', threadId: THREAD, senderUserId: TENANT, senderName: 'Grace', bodyType: 'text', body: 'Paid', voiceDurationS: null, createdAt: at('2026-10-25T10:00:00Z'), faultId: null, faultReference: null, faultTitle: null, faultStatus: null },
    ]),
    attachments: vi.fn(async () => []),
    markRead: vi.fn(async () => at('2026-10-25T10:06:00Z')),
    ensureThread: vi.fn(async () => THREAD),
    insertMessage: vi.fn(async () => ({ id: 'm2', createdAt: at('2026-10-25T10:05:00Z') })),
  } as unknown as LeaseMessagesRepository;
  const db = { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) } as unknown as Database;
  const files = { put: vi.fn() } as unknown as MessageFilesStorage;
  const events = {
    messageNew: () => emitted.push('message:new'),
    threadRead: () => emitted.push('thread:read'),
  } as unknown as MessageEvents;
  return { service: new LeaseMessagesService(db, repo, files, events), repo, emitted, files };
}

describe('lease conversations: who may open one', () => {
  it("lets the landlord's reader open a lease of their business, in their buildings", async () => {
    const { service } = build(ctx());
    await expect(service.landlordThread(ws(), OWNER, LEASE)).resolves.toMatchObject({ leaseId: LEASE, counterpartName: 'Grace Mukamana' });
  });

  it('answers 404 for another business, a building outside the reader, a draft, or a business that is not residence', async () => {
    await expect(build(ctx({ workspaceId: OTHER_WS })).service.landlordThread(ws(), OWNER, LEASE)).rejects.toBeInstanceOf(NotFoundException);
    const narrow = ws({ branchScope: { coverage: 'some', selectedPropertyId: null, propertyIds: ['other'], includesUnbranched: false } as never });
    await expect(build(ctx()).service.landlordThread(narrow, OWNER, LEASE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(ctx({ status: 'draft' })).service.landlordThread(ws(), OWNER, LEASE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(ctx()).service.landlordThread(ws({ domain: 'hospitality' } as never), OWNER, LEASE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(null).service.landlordThread(ws(), OWNER, LEASE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets the tenant open only their own lease's conversation", async () => {
    const mine = { leaseId: LEASE, tenantId: 'tenant', userId: TENANT, workspaceId: WS };
    await expect(build(ctx()).service.tenantThread(mine)).resolves.toMatchObject({ counterpartName: 'Amani Residences Ltd' });
    await expect(build(ctx()).service.tenantThread({ ...mine, userId: STRANGER })).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(ctx({ status: 'draft' })).service.tenantThread(mine)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the gateway put a socket in a thread room only for those same people', async () => {
    const { service } = build(ctx());
    await expect(service.mayListen(TENANT, LEASE, null)).resolves.toMatchObject({ threadId: THREAD });
    await expect(service.mayListen(STRANGER, LEASE, null)).resolves.toBeNull();
    await expect(service.mayListen(OWNER, LEASE, { workspaceId: WS })).resolves.toMatchObject({ threadId: THREAD });
    await expect(service.mayListen(OWNER, LEASE, { workspaceId: OTHER_WS })).resolves.toBeNull();
  });
});

describe('lease conversations: reading and receipts', () => {
  it('sides the lines for each reader and ticks ours read once the other side opened it after', async () => {
    const reads = [
      { userId: TENANT, lastReadAt: at('2026-10-25T10:06:00Z') },
      { userId: OWNER, lastReadAt: at('2026-10-25T10:01:00Z') },
    ];
    const landlord = await build(ctx(), reads).service.landlordThread(ws(), OWNER, LEASE);
    expect(landlord.messages.map((m) => [m.id, m.side, m.fromMe, m.receipt])).toEqual([
      ['m1', 'tenant', false, null],
      ['m2', 'landlord', true, 'read'],
    ]);
    expect(landlord.myLastReadAt).toBe('2026-10-25T10:01:00.000Z');
    expect(landlord.otherLastReadAt).toBe('2026-10-25T10:06:00.000Z');

    const tenant = await build(ctx(), reads).service.tenantThread({ leaseId: LEASE, tenantId: 'tenant', userId: TENANT, workspaceId: WS });
    // The landlord's side read at 10:01, after the tenant's 10:00 line.
    expect(tenant.messages.map((m) => [m.id, m.fromMe, m.receipt, m.senderName])).toEqual([
      ['m1', true, 'read', 'Grace Mukamana'],
      ['m2', false, null, 'Amani Residences Ltd'],
    ]);
  });

  it('marks a conversation read at the server clock and tells the thread room', async () => {
    const { service, emitted, repo } = build(ctx());
    await expect(service.landlordRead(ws(), OWNER, LEASE)).resolves.toEqual({ readAt: '2026-10-25T10:06:00.000Z' });
    expect(repo.markRead).toHaveBeenCalledWith(THREAD, OWNER);
    expect(emitted).toEqual(['thread:read']);
  });

  it('opens a lease with no conversation yet as empty, without making one', async () => {
    const { service, repo } = build(ctx({ threadId: null }));
    await expect(service.landlordThread(ws(), OWNER, LEASE)).resolves.toMatchObject({ threadId: null, messages: [], writable: true });
    expect(repo.ensureThread).not.toHaveBeenCalled();
  });
});

describe('lease conversations: sending', () => {
  const mine = { leaseId: LEASE, tenantId: 'tenant', userId: TENANT, workspaceId: WS };

  it('refuses an empty message, too many files, and a voice length with no recording, before storing anything', async () => {
    const { service, files } = build(ctx());
    await expect(service.tenantSend(mine, {}, [])).rejects.toBeInstanceOf(BadRequestException);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ filename: `p${i}.jpg`, mime: 'image/jpeg', body: Buffer.alloc(10) }));
    await expect(service.tenantSend(mine, { body: 'hi' }, eleven)).rejects.toThrow('Send up to 10 files at once.');
    await expect(service.tenantSend(mine, { body: 'hi', voiceDurationS: 5 }, [])).rejects.toThrow('A voice note needs its recording.');
    await expect(service.tenantSend(mine, {}, [{ filename: 'v.webm', mime: 'audio/webm', body: Buffer.alloc(10) }])).rejects.toThrow(/length is missing/);
    expect(files.put).not.toHaveBeenCalled();
  });

  it('refuses a conversation whose lease ended (409)', async () => {
    await expect(build(ctx({ status: 'ended' })).service.tenantSend(mine, { body: 'hello' }, [])).rejects.toBeInstanceOf(ConflictException);
  });

  it('makes the thread on the first message, marks the sender read, and tells open screens', async () => {
    const { service, repo, emitted } = build(ctx({ threadId: null }));
    const sent = await service.landlordSend(ws(), OWNER, LEASE, { body: 'Welcome home' }, []);
    expect(repo.ensureThread).toHaveBeenCalled();
    expect(repo.insertMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ bodyType: 'text', body: 'Welcome home', senderUserId: OWNER }));
    expect(repo.markRead).toHaveBeenCalledWith(THREAD, OWNER);
    expect(emitted).toEqual(['message:new']);
    expect(sent).toMatchObject({ id: 'm2', fromMe: true, receipt: 'delivered' });
  });
});
