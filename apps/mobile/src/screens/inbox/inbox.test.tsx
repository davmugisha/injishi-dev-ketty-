/**
 * The Inbox tab, the thread screen, and the badge the tab bar reads.
 *
 * What is asserted here is what a reviewer cannot see by looking: the four list
 * states per segment, the unread arithmetic, the redaction reaching the row as
 * well as the bubble, and the archived refusal happening in the STORE rather
 * than only in the markup.
 *
 * Both schemes on the surfaces that render a list, per the runbook. A colour
 * assertion would be a palette test and `palette.test.ts` already owns that;
 * what these prove is that neither scheme throws and that the copy is the same
 * in both, which is the failure mode a scheme-specific branch actually has.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Inbox } from './inbox';
import { Thread } from './thread';
import { invertedRows } from './thread';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { DomainProvider } from '@/domain';
import { ToastProvider } from '@/components';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { readQueue, registerHandler, resetQueue } from '@/data/write-queue';
import {
  READS_KEY,
  SEEDED_READS,
  THREADS,
  THREADS_KEY,
  guestThreadId,
  messagesOf,
  sendMessageHandler,
  unreadIn,
  type Message,
  type SentMessages,
} from '@/data/threads';
import { NOTIFICATIONS, NOTIFICATIONS_KEY } from '@/data/notifications';
import { useInboxCounts } from '@/data/inbox-unread';
import type { Surface } from '@/data/rentals';
import { en, rw } from '@/i18n/messages';

/* ------------------------------------------------------------ the harness -- */

// `mock`-prefixed, because a `jest.mock` factory may not close over anything
// else. The screens are mounted as screens, not as routes: the real router
// hooks need a navigator, and mounting one to assert a sentence would be
// testing the router.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams.current,
}));

/** Network state is a native module; the screens read two booleans off it. */
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

/**
 * Forces an online send to fail (mobile audit 2026-10-05, IN-15).
 *
 * The fixture store cannot fail by itself, so no test could reach the failed
 * bubble an online send produces. This wraps the real hook and answers `error`
 * from `mutate` while `fail` is set; everything else is the real store.
 */
const mockWrites = { fail: false };
jest.mock('@/data/use-fixture-mutation', () => {
  const actual = jest.requireActual('@/data/use-fixture-mutation');
  return {
    ...actual,
    useFixtureMutation: (...args: unknown[]) => {
      const real = actual.useFixtureMutation(...args);
      return {
        ...real,
        mutate: async (input: unknown) => (mockWrites.fail ? 'error' : real.mutate(input)),
      };
    },
  };
});

const inSurface = (surface: Surface, node: React.ReactElement) => (
  <DomainProvider
    initial={surface === 'guest' ? 'hospitality' : 'residence'}
    initialSurface={surface}
  >
    <ToastProvider>{node}</ToastProvider>
  </DomainProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockParams.current = {};
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
  mockWrites.fail = false;
});

afterEach(() => {
  resetFixtures();
  resetQueue();
});

/** The fixture ids these tests lean on, named once. */
const KIVU_THREAD = guestThreadId('BK-4821');
const CANCELLED_THREAD = guestThreadId('BK-4266');
const INGORO_THREAD = THREADS.find((t) => t.subjectId === 'ingoro-apartments-a2')!.id;

/* ----------------------------------------------------------- the fixtures -- */

describe('the thread fixtures', () => {
  it('hang every thread off a booking or a lease, never off nothing', () => {
    for (const thread of THREADS) {
      expect(thread.subjectId).toBeTruthy();
      expect(['booking', 'lease']).toContain(thread.scope);
    }
  });

  it('archives a terminal booking and an ended lease, and nothing else', () => {
    // BK-4266 is cancelled, BK-4402 and BK-4310 completed. Their threads are
    // read only; the live ones are not.
    expect(THREADS.find((t) => t.id === CANCELLED_THREAD)?.status).toBe('archived');
    expect(THREADS.find((t) => t.id === guestThreadId('BK-4402'))?.status).toBe('archived');
    expect(THREADS.find((t) => t.id === KIVU_THREAD)?.status).toBe('active');
    expect(THREADS.find((t) => t.id === INGORO_THREAD)?.status).toBe('active');
  });

  it('never leaves an archived thread unread, because there is nothing to do', () => {
    for (const thread of THREADS.filter((t) => t.status === 'archived')) {
      expect(unreadIn(thread, messagesOf(thread.id, {}), SEEDED_READS)).toBe(0);
    }
  });

  it('counts as unread only what arrived after the read mark, and never our own', () => {
    const thread = THREADS.find((t) => t.id === KIVU_THREAD)!;
    const messages = messagesOf(thread.id, {});
    expect(unreadIn(thread, messages, SEEDED_READS)).toBe(2);

    // A mark after everything clears it.
    const now = Date.now() + 1000;
    expect(unreadIn(thread, messages, { [thread.id]: now })).toBe(0);

    // No mark at all means every message from THEM, which is the no-row case.
    const fromThem = messages.filter((m) => !m.fromUs).length;
    expect(unreadIn(thread, messages, {})).toBe(fromThem);
  });

  it('stores the landlord phone number verbatim, for the redaction to hide on read', () => {
    const body = messagesOf(INGORO_THREAD, {}).find((m) => m.body.includes('+250'))?.body;
    expect(body).toContain('+250 788 512 004');
  });
});

/* -------------------------------------------------------- the cold read --- */

/**
 * **This block must stay above every other render in the file.**
 *
 * `useFixture` keeps a module-level set of keys already read in the session and
 * skips the skeleton for a warm one, which is the whole point of it — that is
 * how a query cache behaves, and it is why navigating back to a screen does not
 * re-skeleton it. `resetFixtures` clears the WRITE store and deliberately not
 * that set. So the loading branch is observable exactly once per key per file,
 * and asserting it anywhere else would be asserting a warm read.
 */
describe('the cold read', () => {
  it('skeletons before the rows arrive, and only the first time', async () => {
    renderInScheme(inSurface('guest', <Inbox />), 'light');
    expect(screen.getByLabelText(/Loading your conversations/i)).toBeTruthy();

    // And it resolves, rather than skeletoning forever.
    expect(await screen.findByText('Kivu Shores Hotel')).toBeTruthy();
  });
});

/* --------------------------------------------------------------- the list -- */

describe.each(SCHEMES)('the Inbox tab in %s', (scheme) => {
  it('lists the guest threads with their counterparty and the unread dot', async () => {
    renderInScheme(inSurface('guest', <Inbox />), scheme);

    expect(await screen.findByText('Kivu Shores Hotel')).toBeTruthy();
    expect(screen.getByText('Akagera Plains Camp')).toBeTruthy();
    // Two unread on the hero thread, so at least one dot is drawn.
    expect(screen.getAllByLabelText('Unread').length).toBeGreaterThan(0);
  });

  it('lists the tenant threads instead when the surface is tenant', async () => {
    renderInScheme(inSurface('tenant', <Inbox />), scheme);

    expect(await screen.findByText('Jean Bosco Habimana')).toBeTruthy();
    // A guest counterparty must not leak into the tenant list.
    expect(screen.queryByText('Kivu Shores Hotel')).toBeNull();
  });

  it('redacts a phone number in the row preview, not only inside the thread', async () => {
    // Make the number the LAST message, so it is what the preview shows.
    const withNumber: Message = {
      id: 'sent-probe',
      threadId: INGORO_THREAD,
      body: 'You can also try 0788 431 209.',
      fromUs: false,
      createdAt: Date.now(),
    };
    writeFixture(THREADS_KEY, { [INGORO_THREAD]: [withNumber] });

    renderInScheme(inSurface('tenant', <Inbox />), scheme);

    expect(await screen.findByText(/number hidden/)).toBeTruthy();
    expect(screen.queryByText(/0788 431 209/)).toBeNull();
  });
});

describe('the Inbox segments', () => {
  it('shows the notifications in their own list, each with its own word', async () => {
    renderInScheme(inSurface('tenant', <Inbox />), 'light');
    await screen.findByText('Jean Bosco Habimana');

    // `SegmentedTabs` labels a tab "<label>, <count>" when it carries a count,
    // so match on the role and a prefix rather than on an exact string that
    // moves whenever a fixture's read state does.
    fireEvent.press(screen.getByRole('tab', { name: /^Notifications/ }));

    // Frame R13's maintenance row, with its own word rather than a bare glyph.
    expect(await screen.findByText('Maintenance')).toBeTruthy();
    expect(screen.getByText('Signature needed')).toBeTruthy();
    // And the thread list is gone, not merely scrolled past.
    expect(screen.queryByText('Jean Bosco Habimana')).toBeNull();
  });

  it('claims no payment or receipt that never happened (IN-02)', () => {
    // Every seed is still a fixture, so none may say money moved: no
    // "July rent received", no "RWF 464,850 charged to MTN MoMo".
    for (const n of NOTIFICATIONS) {
      expect({ id: n.id, claim: /received|charged|receipt|paid/i.test(`${n.title} ${n.body}`) }).toEqual({
        id: n.id,
        claim: false,
      });
      expect(n.type).not.toBe('rent_receipt');
      // Nor an invitation to the review screen the app has hidden.
      expect(n.type).not.toBe('review_invite');
    }
  });

  it('counts unread notifications separately from unread messages', () => {
    const tenantUnread = NOTIFICATIONS.filter(
      (n) => n.surface === 'tenant' && n.readAt === undefined,
    );
    // The fixture owes at least one of each, or the segment counts are untested
    // by construction.
    expect(tenantUnread.length).toBeGreaterThan(0);
    expect(NOTIFICATIONS.filter((n) => n.surface === 'guest').length).toBeGreaterThan(0);
  });
});

describe('the four list states', () => {
  it('offers a way out of the guest empty state and names the booking rule', async () => {
    // Host links the tab and has no threads behind it, which is the empty case
    // reachable without deleting a fixture.
    renderInScheme(inSurface('host', <Inbox />), 'light');
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
    expect(screen.getByText(/Messaging opens once you have a booking/)).toBeTruthy();
  });

  it('says the list is the last one that loaded when the device is offline', async () => {
    mockNetwork.isConnected = false;
    renderInScheme(inSurface('guest', <Inbox />), 'light');
    expect(await screen.findByLabelText(/Showing the last list that loaded/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------- the thread -- */

describe('invertedRows', () => {
  it('puts the newest message first and the day line above each day', () => {
    const day = 24 * 60 * 60 * 1000;
    const at = new Date(2026, 8, 6, 10, 0).getTime();
    const messages: Message[] = [
      { id: 'a', threadId: 't', body: 'older', fromUs: true, createdAt: at - day },
      { id: 'b', threadId: 't', body: 'newer', fromUs: false, createdAt: at },
      { id: 'c', threadId: 't', body: 'newest', fromUs: false, createdAt: at + 60_000 },
    ];

    const rows = invertedRows(messages);
    // Newest first, and one day line per calendar day — not one per message.
    expect(rows.map((r) => (r.kind === 'message' ? r.message.id : 'day'))).toEqual([
      'c',
      'b',
      'day',
      'a',
      'day',
    ]);
  });

  it('draws a single day line for a conversation that happened in one day', () => {
    const at = new Date(2026, 8, 6, 10, 0).getTime();
    const rows = invertedRows([
      { id: 'a', threadId: 't', body: 'one', fromUs: true, createdAt: at },
      { id: 'b', threadId: 't', body: 'two', fromUs: false, createdAt: at + 60_000 },
    ]);
    expect(rows.filter((r) => r.kind === 'day')).toHaveLength(1);
  });
});

describe.each(SCHEMES)('the thread screen in %s', (scheme) => {
  it('draws the bubbles and the composer on a live thread', async () => {
    mockParams.current = { threadId: KIVU_THREAD };
    renderInScheme(inSurface('guest', <Thread />), scheme);

    expect(await screen.findByText(/Muraho! Yes, reception is staffed overnight/)).toBeTruthy();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByLabelText('Send the message')).toBeTruthy();
  });

  it('replaces the composer with the ADR copy on an archived thread', async () => {
    mockParams.current = { threadId: CANCELLED_THREAD };
    renderInScheme(inSurface('guest', <Thread />), scheme);

    expect(
      await screen.findByText('This conversation is closed because the stay has ended.'),
    ).toBeTruthy();
    expect(screen.getByText('Everything said here is kept, and stays readable.')).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });
});

describe('the thread screen', () => {
  it('hides a phone number in the bubble and says one was hidden', async () => {
    mockParams.current = { threadId: INGORO_THREAD };
    renderInScheme(inSurface('tenant', <Thread />), 'light');

    expect(await screen.findByText(/He may call ahead/)).toBeTruthy();
    expect(screen.getByText('[number hidden]')).toBeTruthy();
    expect(screen.queryByText(/\+250 788 512 004/)).toBeNull();
    // And the reason, once, above the conversation.
    expect(screen.getByText(/Phone numbers are hidden/)).toBeTruthy();
  });

  it('marks the thread read on mount, which is what clears the badge', async () => {
    mockParams.current = { threadId: KIVU_THREAD };
    renderInScheme(inSurface('guest', <Thread />), 'light');
    await screen.findByText(/Muraho!/);

    await waitFor(() => {
      // The store is module state; read it the way the badge does, rather than
      // reaching into the hook that wrote it.
      const thread = THREADS.find((t) => t.id === KIVU_THREAD)!;
      expect(unreadIn(thread, messagesOf(thread.id, {}), readReads())).toBe(0);
    });
  });

  it('appends the bubble optimistically, then settles it', async () => {
    mockParams.current = { threadId: KIVU_THREAD };
    renderInScheme(inSurface('guest', <Thread />), 'light');
    await screen.findByText(/Muraho!/);

    fireEvent.changeText(screen.getByLabelText('Your message'), 'Thank you, see you Friday.');
    fireEvent.press(screen.getByLabelText('Send the message'));

    // Immediately, before the 300ms write: the bubble is there and marked as in
    // flight. That is the whole of the ADR's optimistic send.
    expect(screen.getByText('Thank you, see you Friday.')).toBeTruthy();
    expect(screen.getByText('Sending')).toBeTruthy();

    // And it settles: the pending mark goes and the message stays. 5000, not
    // 3000: the write takes 300ms, but the budget has to cover the renders
    // around it under the full parallel suite, not on a quiet machine.
    await waitFor(() => expect(screen.queryByText('Sending')).toBeNull(), { timeout: 5000 });
    expect(screen.getByText('Thank you, see you Friday.')).toBeTruthy();
  });

  it('will not send an empty or whitespace-only body', async () => {
    mockParams.current = { threadId: KIVU_THREAD };
    renderInScheme(inSurface('guest', <Thread />), 'light');
    await screen.findByText(/Muraho!/);

    const send = screen.getByLabelText('Send the message');
    expect(send).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Your message'), '   ');
    expect(screen.getByLabelText('Send the message')).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Your message'), 'a');
    expect(screen.getByLabelText('Send the message')).not.toBeDisabled();
  });

  it('refuses a send into an archived thread in the STORE, not only in the markup', async () => {
    // AC-19: the rule has to hold with a stale client. `useSendMessage` is the
    // prototype's only server, so this is where the refusal has to live — the
    // screen hiding the composer is the visible half, not the enforcement.
    const { useSendMessage } = jest.requireActual<typeof import('@/data/threads')>(
      '@/data/threads',
    );
    let send: ReturnType<typeof useSendMessage>['send'] | undefined;

    function Probe() {
      send = useSendMessage().send;
      return <RNText testID="probe">ready</RNText>;
    }

    render(inSurface('guest', <Probe />));
    // An outcome, not a throw, so a screen branches on it rather than wording
    // every failure as a closed conversation (IN-12). Nothing is written.
    await expect(send!(CANCELLED_THREAD, 'let me back in')).resolves.toBe('closed');
    expect(readFixture<SentMessages>(THREADS_KEY, {})[CANCELLED_THREAD]).toBeUndefined();
  });

  it('says the conversation is not yours for an id that resolves to nothing', async () => {
    mockParams.current = { threadId: 'TH-does-not-exist' };
    renderInScheme(inSurface('guest', <Thread />), 'light');

    // `404`, never `403`: the copy must not confirm that the id exists.
    expect(await screen.findByText('That conversation is not yours')).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('names whose conversation it is as the page heading (IN-14)', async () => {
    mockParams.current = { threadId: KIVU_THREAD };
    renderInScheme(inSurface('guest', <Thread />), 'light');
    await screen.findByText(/Muraho!/);

    const kivu = THREADS.find((t) => t.id === KIVU_THREAD)!;
    expect(screen.getByRole('header', { name: kivu.counterpartyName })).toBeTruthy();
  });
});

/* ------------------------------------------------------ the delivery states -- */

/**
 * Queued, failed, retried and discarded bubbles (mobile audit 2026-10-05,
 * IN-07, IN-12, IN-15). Each pending message is its own bubble with its own
 * actions, and a failure is worded as a failure, never as a closed thread.
 */
describe('a message that has not landed', () => {
  /**
   * The wait for a queue drain or a 300ms write and the renders around it.
   * Above the 1000ms default, which a loaded machine loses, and low enough
   * that the longest test here (four waits) stays under the 60s `testTimeout`.
   */
  const SLOW = { timeout: 10000 };

  /**
   * Type a message and press send, the way a person does.
   *
   * The two events are NOT wrapped in one `act`: inside a single scope the
   * typing is not rendered before the press, so the press reads the previous
   * render's text. Each `fireEvent` is its own `act`, and the empty one after
   * lets the send's own promise settle.
   */
  async function sendText(body: string) {
    fireEvent.changeText(screen.getByLabelText(en['inbox.composerLabel']), body);
    fireEvent.press(screen.getByLabelText(en['inbox.sendLabel']));
    await act(async () => {});
  }

  /** The bodies of this thread's queued intents, in the order they were queued. */
  const queuedBodies = () =>
    readQueue()
      .filter((item) => item.kind === 'message')
      .map((item) => (item.payload as { body: string }).body);

  /**
   * Two sends a few milliseconds apart, so "newest" is a fact and not a tie
   * the sort happens to break one way.
   */
  async function sendTwo(first: string, second: string) {
    await sendText(first);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    await sendText(second);
  }

  async function openKivu() {
    mockParams.current = { threadId: KIVU_THREAD };
    const view = renderInScheme(inSurface('guest', <Thread />), 'light');
    await screen.findByText(/Muraho!/, {}, SLOW);
    return view;
  }

  it('draws two messages sent offline as two waiting bubbles, then sends both', async () => {
    mockNetwork.isConnected = false;
    const view = await openKivu();

    await sendTwo('First, from the lift.', 'Second, still in the lift.');

    // Both are on screen and both say they are waiting. It used to be one
    // bubble: the second replaced the first, which stayed in the queue unseen.
    expect(screen.getByText('First, from the lift.')).toBeTruthy();
    expect(screen.getByText('Second, still in the lift.')).toBeTruthy();
    expect(screen.getAllByText(en['inbox.queued'])).toHaveLength(2);
    expect(queuedBodies()).toEqual(['First, from the lift.', 'Second, still in the lift.']);

    // Signal returns: the reconnect drain sends both, and neither is pending.
    mockNetwork.isConnected = true;
    await act(async () => view.rerender(inSurface('guest', <Thread />)));
    await waitFor(() => {
      expect(screen.queryByText(en['inbox.queued'])).toBeNull();
      expect(screen.queryByText(en['inbox.sending'])).toBeNull();
    }, SLOW);
    expect(screen.getByText('First, from the lift.')).toBeTruthy();
    expect(screen.getByText('Second, still in the lift.')).toBeTruthy();
    const stored = readFixture<SentMessages>(THREADS_KEY, {})[KIVU_THREAD] ?? [];
    expect(stored.map((m) => m.body)).toEqual(['First, from the lift.', 'Second, still in the lift.']);
  });

  it('discards exactly the message chosen, and retries the other until it sends', async () => {
    // A queue that cannot reach the server, so both sends come back failed.
    registerHandler('message', () => ({ status: 'failed' as const }), { fixtureBacked: true });
    mockNetwork.isConnected = false;
    const view = await openKivu();

    await sendTwo('Keep this one.', 'Throw this one away.');

    mockNetwork.isConnected = true;
    await act(async () => view.rerender(inSurface('guest', <Thread />)));
    await waitFor(() => expect(screen.getAllByText(en['inbox.failed'])).toHaveLength(2), SLOW);
    // Never worded as a closed conversation.
    expect(screen.queryByText(en['inbox.archivedRefused'])).toBeNull();

    // An inverted list draws newest first, so the first Discard is the newest.
    fireEvent.press(screen.getAllByLabelText(en['inbox.discardSend'])[0]);

    await waitFor(() => expect(screen.queryByText('Throw this one away.')).toBeNull(), SLOW);
    expect(screen.getByText('Keep this one.')).toBeTruthy();
    expect(queuedBodies()).toEqual(['Keep this one.']);

    // The connection recovers, and Try again sends the one that is left.
    registerHandler('message', sendMessageHandler, { fixtureBacked: true });
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['inbox.retrySend']));
    });

    await waitFor(() => {
      expect(screen.queryByText(en['inbox.failed'])).toBeNull();
      expect(screen.queryByText(en['inbox.sending'])).toBeNull();
    }, SLOW);
    expect(screen.getByText('Keep this one.')).toBeTruthy();
    const stored = readFixture<SentMessages>(THREADS_KEY, {})[KIVU_THREAD] ?? [];
    expect(stored.map((m) => m.body)).toEqual(['Keep this one.']);
  });

  it('keeps a message whose online send failed, says Not sent, and sends it on Try again', async () => {
    mockWrites.fail = true;
    await openKivu();

    await sendText('Is breakfast included?');

    await waitFor(() => expect(screen.getByText(en['inbox.failed'])).toBeTruthy(), SLOW);
    expect(screen.getByText('Is breakfast included?')).toBeTruthy();
    // A failed write is not a closed conversation (IN-12).
    expect(screen.queryByText(en['inbox.archivedRefused'])).toBeNull();
    // Both actions are reachable on their own, not folded into one label.
    expect(screen.getByLabelText(en['inbox.retrySend'])).toBeTruthy();
    expect(screen.getByLabelText(en['inbox.discardSend'])).toBeTruthy();

    mockWrites.fail = false;
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['inbox.retrySend']));
    });

    // It goes back to Sending for the write's 300ms, then settles.
    await waitFor(
      () => {
        expect(screen.queryByText(en['inbox.failed'])).toBeNull();
        expect(screen.queryByText(en['inbox.sending'])).toBeNull();
      },
      SLOW,
    );
    expect(screen.getByText('Is breakfast included?')).toBeTruthy();
    const stored = readFixture<SentMessages>(THREADS_KEY, {})[KIVU_THREAD] ?? [];
    expect(stored.map((m) => m.body)).toEqual(['Is breakfast included?']);
  });

  it('drops a failed online message on Discard and sends nothing', async () => {
    mockWrites.fail = true;
    await openKivu();

    await sendText('Never mind.');
    await waitFor(() => expect(screen.getByText(en['inbox.failed'])).toBeTruthy(), SLOW);

    fireEvent.press(screen.getByLabelText(en['inbox.discardSend']));

    await waitFor(() => expect(screen.queryByText('Never mind.')).toBeNull(), SLOW);
    expect(readFixture<SentMessages>(THREADS_KEY, {})[KIVU_THREAD]).toBeUndefined();
    expect(readQueue()).toHaveLength(0);
  });
});

/* ---------------------------------------------------------- the day lines -- */

/**
 * A thread left open across midnight (mobile audit 2026-10-05, IN-13).
 *
 * Fake timers, so the minute clock can be walked past midnight. `setImmediate`
 * stays real: React Native's scheduler flushes through it, and faking it hangs
 * `act` (see `bootstrap.test.tsx`).
 */
describe('the day lines in a thread left open', () => {
  afterEach(() => jest.useRealTimers());

  it('turn Today into Yesterday when the clock passes midnight', async () => {
    const lateTonight = new Date();
    lateTonight.setHours(23, 59, 0, 0);
    jest.useFakeTimers({
      now: lateTonight,
      doNotFake: ['setImmediate', 'clearImmediate'],
    });

    // A short thread, with one message from this evening, so every day line
    // fits in the rows the list renders first.
    const thread = guestThreadId('BK-4790');
    writeFixture<SentMessages>(THREADS_KEY, {
      [thread]: [
        {
          id: 'evening',
          threadId: thread,
          body: 'See you in the morning.',
          fromUs: true,
          createdAt: lateTonight.getTime() - 30 * 60_000,
        },
      ],
    });
    mockParams.current = { threadId: thread };
    renderInScheme(inSurface('guest', <Thread />), 'light');
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('See you in the morning.')).toBeTruthy();
    expect(screen.getAllByLabelText(en['inbox.dayToday']).length).toBeGreaterThan(0);

    // Two minutes on, it is tomorrow, and nothing on screen is from today.
    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });

    expect(screen.queryByLabelText(en['inbox.dayToday'])).toBeNull();
    expect(screen.getAllByLabelText(en['inbox.dayYesterday']).length).toBeGreaterThan(0);
  });
});

/**
 * The read marks, straight out of the fixture store.
 *
 * `useMarkThreadRead` writes through `useFixtureMutation`, so the assertion
 * reads the same key the badge reads rather than reaching into the hook.
 */
function readReads(): Record<string, number> {
  return readFixture<Record<string, number>>(READS_KEY, SEEDED_READS);
}

describe('the notification store', () => {
  it('starts with the seeded read marks rather than an empty slate', () => {
    const read = NOTIFICATIONS.filter((n) => n.readAt !== undefined);
    const unread = NOTIFICATIONS.filter((n) => n.readAt === undefined);
    // Both halves must exist, or the read/unread treatment has no fixture.
    expect(read.length).toBeGreaterThan(0);
    expect(unread.length).toBeGreaterThan(0);
  });

  it('does not clear a notification just because the segment was opened', async () => {
    renderInScheme(inSurface('tenant', <Inbox />), 'light');
    await screen.findByText('Jean Bosco Habimana');

    // Nothing has been written to the notification read store by rendering.
    expect(readFixture(NOTIFICATIONS_KEY, 'untouched')).toBe('untouched');
  });
});

/* -------------------------------------------------------------- the badge -- */

/**
 * The number the tab bar draws.
 *
 * The one that matters is `undefined` versus `0`. React Navigation renders
 * `tabBarBadge` for any DEFINED value, so a zero would put a permanent pill on
 * the Inbox tab saying nothing is waiting — a mark that means "nothing" is
 * worse than no mark, and it is the bug this hook exists to make impossible at
 * the call site rather than to leave as a check the layout has to remember.
 */
describe('the tab badge', () => {
  function Probe({ surface }: { surface: Surface }) {
    const counts = useInboxCounts(surface);
    return (
      <>
        <RNText testID="badge">
          {counts.badge === undefined ? 'absent' : String(counts.badge)}
        </RNText>
        <RNText testID="segments">{`${counts.messages}/${counts.notifications}`}</RNText>
      </>
    );
  }

  const badgeFor = (surface: Surface) => {
    render(inSurface(surface, <Probe surface={surface} />));
    return screen.getByTestId('badge').props.children as string;
  };

  it('draws nothing while every unread behind it is a fixture (IN-03)', () => {
    // The fixtures hold unread threads and notifications for a guest, and the
    // tab bar used to show their sum to every real guest as their own unread
    // count. Nothing is counted until the Inbox reads the server.
    const guestUnread =
      THREADS.filter((t) => t.surface === 'guest').reduce(
        (total, thread) => total + unreadIn(thread, messagesOf(thread.id, {}), SEEDED_READS),
        0,
      ) + NOTIFICATIONS.filter((n) => n.surface === 'guest' && n.readAt === undefined).length;

    expect(guestUnread).toBeGreaterThan(0);
    expect(badgeFor('guest')).toBe('absent');
    expect(badgeFor('tenant')).toBe('absent');
  });

  it('still counts each segment, which sits beside the rows it counts', () => {
    const guestMessages = THREADS.filter((t) => t.surface === 'guest').reduce(
      (total, thread) => total + unreadIn(thread, messagesOf(thread.id, {}), SEEDED_READS),
      0,
    );
    const guestNotifications = NOTIFICATIONS.filter(
      (n) => n.surface === 'guest' && n.readAt === undefined,
    ).length;

    render(inSurface('guest', <Probe surface="guest" />));
    expect(screen.getByTestId('segments').props.children).toBe(
      `${guestMessages}/${guestNotifications}`,
    );
  });

  it('is absent rather than zero once everything has been read', () => {
    const marked = Object.fromEntries(THREADS.map((t) => [t.id, Date.now() + 60_000]));
    writeFixture(READS_KEY, marked);
    writeFixture(
      NOTIFICATIONS_KEY,
      Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, Date.now()])),
    );

    expect(badgeFor('guest')).toBe('absent');
    expect(badgeFor('tenant')).toBe('absent');
  });

  it('is absent on a surface that has no Inbox fixtures at all', () => {
    // Host links the tab; landlord, broker and work do not. Neither may borrow
    // another surface's count.
    for (const surface of ['host', 'landlord', 'broker', 'work'] as Surface[]) {
      expect(badgeFor(surface)).toBe('absent');
    }
  });
});

/* ---------------------------------------------------------------- the RW --- */

/**
 * Kinyarwanda.
 *
 * Two claims. That the screens render off the RW catalogue rather than falling
 * back to English, and that this session left nothing for the audit to pick up.
 * `ui-rules.md` warns that RW runs longer than EN and that nothing may
 * truncate, so switching the language here is also what stresses the layout.
 */
describe('the Kinyarwanda catalogue', () => {
  it('renders the Inbox in RW, with no English of the same key beside it', async () => {
    renderInScheme(inSurface('tenant', <Inbox />), 'light', { locale: 'rw' });

    await waitFor(() => expect(screen.getByText(rw['inbox.title'])).toBeTruthy());
    expect(screen.getByText(rw['inbox.tabMessages'])).toBeTruthy();
    expect(screen.getByText(rw['inbox.tabNotifications'])).toBeTruthy();
    expect(screen.getByText(rw['inbox.greetingTenant'])).toBeTruthy();
    expect(screen.queryByText(en['inbox.greetingTenant'])).toBeNull();
  });

  it('renders the thread, the composer and the redaction mark in RW', async () => {
    mockParams.current = { threadId: INGORO_THREAD };
    renderInScheme(inSurface('tenant', <Thread />), 'light', { locale: 'rw' });

    await waitFor(() => expect(screen.getByLabelText(rw['inbox.composerLabel'])).toBeTruthy());
    expect(screen.getByLabelText(rw['inbox.sendLabel'])).toBeTruthy();
    // The hidden number is translated too. A redaction mark left in English is
    // the one piece of chrome a reader is guaranteed to stop and read.
    expect(screen.getByText(`[${rw['inbox.redacted']}]`)).toBeTruthy();
    expect(screen.queryByText(`[${en['inbox.redacted']}]`)).toBeNull();
  });

  it('says the archived line in RW, which is the ADR copy a reader acts on', async () => {
    mockParams.current = { threadId: CANCELLED_THREAD };
    renderInScheme(inSurface('guest', <Thread />), 'light', { locale: 'rw' });

    await waitFor(() => expect(screen.getByText(rw['inbox.archivedStay'])).toBeTruthy());
    expect(screen.getByText(rw['inbox.archivedKept'])).toBeTruthy();
  });

  it('leaves no key of this session untranslated', () => {
    // A string ending in " (RW)" is one no session had Kinyarwanda for. It is
    // allowed elsewhere and is the audit's work list; the two namespaces this
    // session owns carry none.
    const mine = Object.keys(en).filter(
      (key) => key.startsWith('inbox.') || key.startsWith('messages.') || key.startsWith('saved.'),
    ) as (keyof typeof en)[];


    /**
     * The keys gaps.md phase 1 added, which ARE marked and deliberately so.
     *
     * Kinyarwanda is not in v1.0 — it lands after it — so a string added now
     * ships English and carries the pack's ` (RW)` marker rather than an
     * invented translation. Naming them here keeps the invariant sharp: a NEW
     * untranslated key in these namespaces still fails, and this list is what a
     * translation pass reads.
     */
    const PHASE_1 = new Set([
      'inbox.queued',
      'inbox.failed',
      'inbox.retrySend',
      'inbox.discardSend',
      'inbox.failedA11y',
    ]);

    expect(mine.length).toBeGreaterThan(60);
    for (const key of mine) {
      expect(rw[key]).toBeTruthy();
      expect({ key, marked: rw[key].endsWith(' (RW)') }).toEqual({
        key,
        marked: PHASE_1.has(key),
      });
    }
  });
});
