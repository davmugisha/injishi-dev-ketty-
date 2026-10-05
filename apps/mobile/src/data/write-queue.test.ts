/**
 * The offline write queue's obligations, as tests.
 *
 * `data-seam.md` §5 gives the queue exactly two rules and one exclusion, and
 * every one of them exists because of a specific failure:
 *
 *   - **Idempotent by client token**, or a bad connection turns one press into
 *     two fault reports, two revealed contacts, or two payments. The cost is
 *     not uniform, which is why the token is minted by the caller: only the
 *     caller knows whether two presses are one intent.
 *   - **Visible and cancellable**, because *"an invisible queue that fires
 *     three hours later is worse than a refusal."*
 *   - **Rent payment is excluded**, because *"a queued payment is a payment
 *     nobody consciously authorised at the moment it fires."*
 *
 * The fourth property is not a rule but a consequence: a queued write is
 * outbound INTENT, not a cache, so losing it is data loss and it has to survive
 * a process kill.
 */
import {
  cancel,
  clearSettled,
  drain,
  enqueue,
  hydrate,
  mintWriteId,
  readQueue,
  registerHandler,
  resetQueue,
  type WriteKind,
} from './write-queue';

/**
 * The keychain, as a map.
 *
 * `expo-secure-store` is a native binding with no implementation under Jest,
 * and what the attachment tests below are actually about is whether the queue
 * WROTE the right thing to it and read the right thing back. A map is enough to
 * answer that, and it lets one test kill the process and restore.
 */
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

/** Every call `/uploads` received, and what it should answer. */
const mockUploads: { path: string }[] = [];
let mockUploadAnswer: unknown = { status: 'ok', data: { objectKey: 'key-1' } };

jest.mock('@/lib/api', () => ({
  api: jest.fn(async (path: string) => {
    mockUploads.push({ path });
    return typeof mockUploadAnswer === 'function'
      ? (mockUploadAnswer as () => unknown)()
      : mockUploadAnswer;
  }),
}));

beforeEach(() => {
  resetQueue();
  mockStore.clear();
  mockUploads.length = 0;
  mockUploadAnswer = { status: 'ok', data: { objectKey: 'key-1' } };
});

describe('idempotency — one intent, one item', () => {
  it('is a no-op on an id it already holds', () => {
    const id = 'fault-abc';
    enqueue({ id, kind: 'fault', payload: { note: 'lift stuck' }, label: 'Fault report' });
    enqueue({ id, kind: 'fault', payload: { note: 'lift stuck' }, label: 'Fault report' });
    enqueue({ id, kind: 'fault', payload: { note: 'lift stuck' }, label: 'Fault report' });
    expect(readQueue()).toHaveLength(1);
  });

  it('returns the item already there rather than a fresh one', () => {
    const first = enqueue({ id: 'x', kind: 'message', payload: 'hi', label: 'Message' });
    const second = enqueue({ id: 'x', kind: 'message', payload: 'DIFFERENT', label: 'Message' });
    // The FIRST payload wins. A second press is the same intent, not a revision
    // of it, and letting the later call overwrite would make a double-tap
    // silently change what is about to be sent.
    expect(second).toBe(first);
    expect(second.payload).toBe('hi');
  });

  it('mints ids that differ inside the same millisecond', () => {
    const ids = new Set(Array.from({ length: 500 }, () => mintWriteId('reveal')));
    expect(ids.size).toBe(500);
  });

  it('names the kind in the id, so a person can read one out to support', () => {
    expect(mintWriteId('recordPayment').startsWith('recordPayment-')).toBe(true);
  });
});

describe('visible and cancellable', () => {
  it('shows what is waiting', () => {
    enqueue({ id: 'a', kind: 'message', payload: 1, label: 'To Jean' });
    enqueue({ id: 'b', kind: 'fault', payload: 2, label: 'Lift on 3' });
    expect(readQueue().map((i) => i.label)).toEqual(['To Jean', 'Lift on 3']);
    expect(readQueue().every((i) => i.state === 'queued')).toBe(true);
  });

  it('lets a person abandon one without touching the others', () => {
    enqueue({ id: 'a', kind: 'message', payload: 1, label: 'To Jean' });
    enqueue({ id: 'b', kind: 'fault', payload: 2, label: 'Lift on 3' });
    cancel('a');
    expect(readQueue().map((i) => i.id)).toEqual(['b']);
  });
});

describe('draining', () => {
  it('sends in the order the person acted', async () => {
    const sent: number[] = [];
    registerHandler<number>('message', async (n) => {
      sent.push(n);
      return { status: 'ok' as const };
    });
    enqueue({ id: 'a', kind: 'message', payload: 1, label: '1' });
    enqueue({ id: 'b', kind: 'message', payload: 2, label: '2' });
    enqueue({ id: 'c', kind: 'message', payload: 3, label: '3' });
    await drain();
    // Serial, not parallel: a message that arrives before the one it followed
    // reads as a different conversation.
    expect(sent).toEqual([1, 2, 3]);
    expect(readQueue().every((i) => i.state === 'sent')).toBe(true);
  });

  it('sends each item once when two drains start together', async () => {
    // The shell and every mounted offline form drain on reconnect. Each drain
    // used to walk its own snapshot, so the second sent what the first had not
    // reached yet, and the first sent it again (mobile audit, IN-11).
    const sent: number[] = [];
    registerHandler<number>('message', async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      sent.push(n);
      return { status: 'ok' as const };
    });
    enqueue({ id: 'a', kind: 'message', payload: 1, label: '1' });
    enqueue({ id: 'b', kind: 'message', payload: 2, label: '2' });

    await Promise.all([drain(), drain(), drain()]);

    expect(sent).toEqual([1, 2]);
  });

  it('picks up an item queued while a drain is running', async () => {
    const sent: number[] = [];
    registerHandler<number>('message', async (n) => {
      if (n === 1) enqueue({ id: 'late', kind: 'message', payload: 9, label: '9' });
      sent.push(n);
      return { status: 'ok' as const };
    });
    enqueue({ id: 'a', kind: 'message', payload: 1, label: '1' });

    const first = drain();
    const joined = drain();
    await Promise.all([first, joined]);

    expect(sent).toEqual([1, 9]);
  });

  it('keeps a failure IN the queue with a reason, rather than dropping it', async () => {
    registerHandler('fault', () => ({ status: 'failed' as const }));
    enqueue({ id: 'f', kind: 'fault', payload: {}, label: 'Lift on 3' });
    await drain();
    const [item] = readQueue();
    expect(item.state).toBe('failed-retryable');
    // ui-rules.md bans a raw error, and a queue is where they hide. The reason
    // is a message key, never the exception's own words.
    expect(item.error).toBe('queue.sendFailed');
    expect(item.attempts).toBe(1);
  });

  it('treats a handler that THROWS as retryable rather than refused', async () => {
    // A throw is a bug in the handler, not an answer from the server. Marking
    // it refused would strand a person's intent permanently on a `TypeError`.
    registerHandler('fault', () => {
      throw new Error('no route to host');
    });
    enqueue({ id: 'boom', kind: 'fault', payload: {}, label: 'Lift on 3' });
    await drain();
    expect(readQueue()[0].state).toBe('failed-retryable');
  });

  it('keeps a REFUSAL with the server\'s own message, and never retries it', async () => {
    // AC-S17. The server answered; asking again gets the same answer, and the
    // person needs to read what it said rather than watch a spinner.
    let calls = 0;
    registerHandler('fault', () => {
      calls += 1;
      return { status: 'refused' as const, message: 'That unit is not yours.' };
    });
    enqueue({ id: 'r', kind: 'fault', payload: {}, label: 'Lift on 3' });
    await drain();

    const [item] = readQueue();
    expect(item.state).toBe('failed-refused');
    expect(item.error).toBe('queue.refused');
    // The one raw string this file allows, for the reason `api.ts` allows it:
    // a refusal the app has no words for has to reach the person regardless.
    expect(item.serverMessage).toBe('That unit is not yours.');

    // A second drain must not touch it.
    await drain();
    expect(calls).toBe(1);
    expect(readQueue()[0].state).toBe('failed-refused');
    expect(readQueue()[0].attempts).toBe(1);
  });

  it('retries a failure on the next drain rather than giving up', async () => {
    let calls = 0;
    registerHandler('checkIn', () => {
      calls += 1;
      return calls === 1 ? { status: 'failed' as const } : { status: 'ok' as const };
    });
    enqueue({ id: 't', kind: 'checkIn', payload: {}, label: 'Check-in photos' });
    await drain();
    expect(readQueue()[0].state).toBe('failed-retryable');
    await drain();
    expect(readQueue()[0].state).toBe('sent');
    expect(readQueue()[0].attempts).toBe(2);
  });

  it('does not silently swallow a kind nobody registered', async () => {
    enqueue({ id: 'orphan', kind: 'reveal', payload: {}, label: 'Reveal' });
    await drain();
    // An intent with no handler waits forever looking like it is about to send.
    // Saying so is the difference between a bug and a mystery.
    expect(readQueue()[0].error).toBe('queue.noHandler');
    // Retryable, not refused: the handler is registered by a screen, and the
    // screen may simply not be mounted yet.
    expect(readQueue()[0].state).toBe('failed-retryable');
  });

  it('does not re-send something that already landed', async () => {
    let calls = 0;
    registerHandler('save', () => {
      calls += 1;
      return { status: 'ok' as const };
    });
    enqueue({ id: 's', kind: 'save', payload: {}, label: 'Saved' });
    await drain();
    await drain();
    expect(calls).toBe(1);
  });

  it('clears settled items only when told', async () => {
    registerHandler('save', () => ({ status: 'ok' as const }));
    enqueue({ id: 's', kind: 'save', payload: {}, label: 'Saved' });
    await drain();
    expect(readQueue()).toHaveLength(1);
    clearSettled();
    expect(readQueue()).toHaveLength(0);
  });
});

/**
 * Task 17, AC-S16 — the gap this file's own comment used to record.
 *
 * A fault report queued in a corridor and killed by memory pressure used to
 * come back WITHOUT its photographs: the queue survived and the images did not,
 * because they lived in component state rather than beside the intent. These
 * are the assertions that it now comes back with them.
 */
describe('attachments survive the kill (AC-S16)', () => {
  it('persists the file URIs beside the intent', async () => {
    enqueue({
      id: 'fault-1',
      kind: 'fault',
      payload: { note: 'lift stuck between 2 and 3' },
      label: 'Lift on 3',
      attachments: ['file:///cache/lift-a.jpg', 'file:///cache/lift-b.jpg'],
    });

    // `persist` is fire-and-forget, so let its microtask land.
    await Promise.resolve();
    await Promise.resolve();

    const written = JSON.parse(mockStore.get('injishi.write-queue') ?? '[]');
    expect(written[0].attachments).toEqual([
      'file:///cache/lift-a.jpg',
      'file:///cache/lift-b.jpg',
    ]);
  });

  it('comes back with its photographs after a process kill', async () => {
    enqueue({
      id: 'fault-1',
      kind: 'fault',
      payload: { note: 'lift stuck' },
      label: 'Lift on 3',
      attachments: ['file:///cache/lift-a.jpg'],
    });
    await Promise.resolve();
    await Promise.resolve();

    // The kill: everything in MEMORY goes and the keychain does not.
    //
    // `resetQueue()` is a test helper and it also clears the store, which is
    // right for isolating a test and wrong for modelling a process death — so
    // the stored journal is held across it. That is what a real kill leaves
    // behind: an untouched keychain and nothing else.
    const journal = mockStore.get('injishi.write-queue');
    resetQueue();
    expect(readQueue()).toHaveLength(0);
    mockStore.set('injishi.write-queue', journal ?? '[]');

    await hydrate();

    const [restored] = readQueue();
    expect(restored.id).toBe('fault-1');
    // Without this, the report flushes later WITHOUT the photographs, which is
    // the exact failure AC-S16 names.
    expect(restored.attachments).toEqual(['file:///cache/lift-a.jpg']);
  });

  it('uploads the bytes BEFORE the write that references them', async () => {
    const order: string[] = [];
    mockUploadAnswer = () => {
      order.push('upload');
      return { status: 'ok', data: { objectKey: 'obj-1' } };
    };
    registerHandler('fault', (_payload, context) => {
      order.push('write:' + context.objectKeys.join(','));
      return { status: 'ok' as const };
    });

    enqueue({
      id: 'fault-1',
      kind: 'fault',
      payload: {},
      label: 'Lift on 3',
      attachments: ['file:///cache/lift-a.jpg'],
    });
    await drain();

    // A write that referenced an object key before the bytes existed would
    // point at nothing.
    expect(order).toEqual(['upload', 'write:obj-1']);
    expect(mockUploads[0].path).toBe('/uploads');
  });

  it('keeps the keys that landed, so a retry does not re-send the bytes', async () => {
    let uploads = 0;
    mockUploadAnswer = () => {
      uploads += 1;
      // The first photograph lands; the second cannot be reached.
      return uploads === 1
        ? { status: 'ok', data: { objectKey: 'obj-1' } }
        : { status: 'failed' };
    };
    registerHandler('fault', () => ({ status: 'ok' as const }));

    enqueue({
      id: 'fault-1',
      kind: 'fault',
      payload: {},
      label: 'Lift on 3',
      attachments: ['file:///a.jpg', 'file:///b.jpg'],
    });
    await drain();

    const [item] = readQueue();
    expect(item.state).toBe('failed-retryable');
    // Bytes are the slow half of a flush on the connection this app is built
    // for, and sending them twice is how a queue drains slower than it fills.
    expect(item.objectKeys).toEqual(['obj-1']);

    // The retry resumes at the second photograph.
    mockUploadAnswer = { status: 'ok', data: { objectKey: 'obj-2' } };
    await drain();
    expect(readQueue()[0].state).toBe('sent');
    expect(readQueue()[0].objectKeys).toEqual(['obj-1', 'obj-2']);
  });

  it('marks the item refused when the upload itself is refused', async () => {
    mockUploadAnswer = { status: 'refused', message: 'That file is too large.' };
    registerHandler('fault', () => ({ status: 'ok' as const }));

    enqueue({
      id: 'fault-1',
      kind: 'fault',
      payload: {},
      label: 'Lift on 3',
      attachments: ['file:///huge.jpg'],
    });
    await drain();

    const [item] = readQueue();
    // Retrying an 8 MB photograph the server has already refused is asking the
    // same question at the slowest possible speed.
    expect(item.state).toBe('failed-refused');
    expect(item.serverMessage).toBe('That file is too large.');
  });

  it('sends nothing to /uploads for a write with no attachments', async () => {
    registerHandler('message', () => ({ status: 'ok' as const }));
    enqueue({ id: 'm', kind: 'message', payload: 'hi', label: 'To Jean' });
    await drain();
    expect(mockUploads).toHaveLength(0);
    expect(readQueue()[0].state).toBe('sent');
  });
});

describe('the exclusion', () => {
  it('has no payment kind, and that is the decision rather than an omission', () => {
    // data-seam.md §5: "Rent payment is deliberately excluded. A queued payment
    // is a payment nobody consciously authorised at the moment it fires. Refuse
    // it while offline, say why, and leave the obligation visible."
    const kinds: WriteKind[] = ['message', 'fault', 'save', 'checkIn', 'reveal', 'recordPayment'];
    // A compile error here is the point: adding 'payment' to WriteKind makes
    // this list incomplete and `tsc` says so before any test runs.
    const exhaustive: Record<WriteKind, true> = {
      message: true,
      fault: true,
      save: true,
      checkIn: true,
      reveal: true,
      recordPayment: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...kinds].sort());
  });

  it('distinguishes recording a payment already made from taking one', () => {
    // `recordPayment` IS in the queue and rent payment is not, and the two look
    // similar enough to be worth pinning. A landlord standing in front of a
    // tenant who has just handed over cash is recording a fact that already
    // happened; a tenant pressing "pay" is authorising money to move. The first
    // survives a delay, the second does not.
    registerHandler('recordPayment', () => ({ status: 'ok' as const }));
    const item = enqueue({
      id: mintWriteId('recordPayment'),
      kind: 'recordPayment',
      payload: { amountRwf: 120000 },
      label: 'Recorded RWF 120,000',
    });
    expect(item.state).toBe('queued');
  });
});
