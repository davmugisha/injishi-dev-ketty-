/**
 * A drain after a cold start finds every handler with no screen mounted.
 *
 * The failure this pins: handlers used to be registered by `useOfflineSubmit`
 * inside a mounted screen, so a queue restored from the keychain after a
 * process kill drained into `queue.noHandler` and sat there. Nothing in this
 * file renders a component. If a handler is found, it was found because
 * `write-handlers.ts` registered it at import.
 */
import { drain, hydrate, readQueue, resetQueue, type QueuedWrite } from './write-queue';
import { registerWriteHandlers, resetWriteHandlersForTest } from './write-handlers';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStore.delete(k);
  }),
}));

const mockCalls: { path: string; options: Record<string, unknown> }[] = [];
let mockActiveWorkspace: string | null = 'ws-1';

jest.mock('@/lib/api', () => ({
  api: jest.fn(async (path: string, options: Record<string, unknown> = {}) => {
    mockCalls.push({ path, options });
    return { status: 'ok', data: { objectKey: 'never' } };
  }),
  getActiveWorkspaceId: () => mockActiveWorkspace,
  shouldRetry: () => false,
}));

const KEY = '7d1f2c3a-4b5e-4f60-8a71-92b3c4d5e6f7';

function journalItem(partial: Partial<QueuedWrite> & Pick<QueuedWrite, 'id' | 'kind' | 'payload'>): QueuedWrite {
  return {
    state: 'queued',
    label: partial.kind,
    queuedAt: Date.now(),
    attempts: 0,
    error: null,
    serverMessage: null,
    ...partial,
  };
}

/** What the previous process left in the keychain before it was killed. */
function leaveJournal(items: QueuedWrite[]): void {
  mockStore.set('injishi.write-queue', JSON.stringify(items));
}

beforeEach(() => {
  // `resetQueue` models a fresh process, and it drops handlers too. Re-running
  // the module's own registration is the same thing importing it at boot does.
  resetQueue();
  resetWriteHandlersForTest();
  registerWriteHandlers();
  mockStore.clear();
  mockCalls.length = 0;
  mockActiveWorkspace = 'ws-1';
});

describe('a drain after a cold start', () => {
  it('finds the recordPayment handler and sends it with its own key', async () => {
    leaveJournal([
      journalItem({
        id: KEY,
        kind: 'recordPayment',
        payload: { workspaceId: 'ws-1', leaseId: 'lease-1', periodMonth: '2026-09-01', amountRwf: 250000 },
      }),
      // A mid-send kill: owed again, and still sendable.
      journalItem({ id: 'save-a', kind: 'save', state: 'sending', payload: { propertyId: 'kigali-cbd-loft', next: true } }),
    ]);

    await hydrate();
    await drain();

    const byId = Object.fromEntries(readQueue().map((i) => [i.id, i]));
    expect(byId[KEY].error).not.toBe('queue.noHandler');
    expect(byId[KEY].state).toBe('sent');
    expect(byId['save-a'].state).toBe('sent');

    expect(mockCalls).toEqual([
      {
        path: '/ops/leases/lease-1/rent',
        options: {
          method: 'POST',
          body: { periodMonth: '2026-09-01', amountRwf: 250000, method: 'cash' },
          idempotencyKey: KEY,
        },
      },
    ]);
  });

  it('never uploads attachments for a write that only lands in a fixture', async () => {
    leaveJournal([
      journalItem({
        id: 'fault-1',
        kind: 'fault',
        payload: {
          leaseId: 'l-0142',
          title: 'Lift stuck',
          reporter: 'tenant',
          priority: 'high',
          filedOn: '2026-09-15',
          photos: [],
        },
        attachments: ['file:///cache/lift.jpg'],
      }),
    ]);

    await hydrate();
    await drain();

    expect(readQueue()[0].state).toBe('sent');
    expect(mockCalls.filter((c) => c.path === '/uploads')).toHaveLength(0);
  });

  it('keeps a payment owed rather than sending it into another workspace', async () => {
    mockActiveWorkspace = 'ws-2';
    leaveJournal([
      journalItem({
        id: KEY,
        kind: 'recordPayment',
        payload: { workspaceId: 'ws-1', leaseId: 'lease-1', periodMonth: '2026-09-01', amountRwf: 250000 },
      }),
    ]);

    await hydrate();
    await drain();

    expect(readQueue()[0].state).toBe('failed-retryable');
    expect(readQueue()[0].error).toBe('queue.sendFailed');
    expect(mockCalls).toHaveLength(0);
  });
});
