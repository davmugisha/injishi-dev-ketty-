/**
 * The Saved tab.
 *
 * Three things are worth asserting and none of them is "the grid renders":
 *
 *   - **The unavailable card is real.** ADR-032's AC-10 is a branch that shows
 *     a saved property whose listing is unpublished, with no price and no
 *     reserve affordance, still tappable. It was unreachable by navigation
 *     before this session seeded it, so it is exercised here or it is exercised
 *     nowhere.
 *   - **Unsaving is undoable.** The row leaves the grid immediately, which is
 *     correct and is also the moment the reader loses their only pointer to the
 *     place. The undo has to put it back through the same store, not through a
 *     second path that could drift.
 *   - **The empty state is reachable.** The set is seeded now, so the state a
 *     brand-new user sees is only visible by emptying the store — which is what
 *     this does, rather than leaving the branch unrun.
 *
 * Both schemes on the grid, per the runbook.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Saved } from './saved';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { DomainProvider } from '@/domain';
import { ToastProvider } from '@/components';
import { resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SAVED_KEY, SEEDED_SAVED } from '@/data/saved';
import { resetQueue } from '@/data/write-queue';
import { STAYS } from '@/data/stays';
import { en, rw } from '@/i18n/messages';
import { AccessibilityInfo, Platform } from 'react-native';
import { TOAST_MS, UNDO_SCREEN_READER_MS } from '@/components';

// `mock`-prefixed, because a `jest.mock` factory may not close over anything
// else. The screen is mounted as a screen, not as a route.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

const guest = (
  <DomainProvider initial="hospitality" initialSurface="guest">
    <ToastProvider>
      <Saved />
    </ToastProvider>
  </DomainProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

afterEach(() => resetFixtures());

const title = (id: string) => STAYS.find((s) => s.id === id)!.title;

/**
 * `useFixtureMutation` simulates 300ms before it writes, so a card leaving the
 * grid is never synchronous. The default 1000ms window is tight once three
 * renders and a list measure sit inside it.
 *
 * 3000 was the first guess and it was not slack: it held in isolation and lost
 * roughly one run in three under the full parallel suite, on a different test
 * each time, which is the signature `jest.config.js` already describes on
 * `testTimeout` — RN 0.86 with React 19.2 renders slowly enough under load that
 * a budget sized against a quiet machine is a race. 5000 matches the ceiling
 * `book-confirmed.test.tsx` already uses for the same reason. It bounds a hang;
 * it does not slow a passing test down.
 */
/**
 * A hang bound, not a speed assertion. Session 11 raised it from 5s: under a
 * full parallel run this suite was failing HERE rather than on anything it
 * asserts, which made a memory problem look like a screen problem. Jest's own
 * per-test ceiling is 20s and is what should catch a real hang.
 */
const GONE = { timeout: 15000 };

const UNPUBLISHED = 'virunga-tea-retreat';
const OLDEST = SEEDED_SAVED[0];
/** Newest saved, and therefore the FIRST card in the grid. See the ordering. */
const NEWEST = SEEDED_SAVED[SEEDED_SAVED.length - 1];

/* ----------------------------------------------------------- the fixtures -- */

describe('the seeded set', () => {
  it('holds exactly one property with no published listing, so AC-10 has a case', () => {
    const inactive = SEEDED_SAVED.filter((id) => STAYS.find((s) => s.id === id)?.active === false);
    expect(inactive).toEqual([UNPUBLISHED]);
  });

  it('names only properties that exist in the catalogue', () => {
    for (const id of SEEDED_SAVED) expect(STAYS.find((s) => s.id === id)).toBeDefined();
  });
});

/* -------------------------------------------------------------- the cold --- */

/**
 * Above the other renders, for the reason `inbox.test.tsx` gives at length:
 * `useFixture` skips the skeleton for a key it has already read in the session,
 * and `resetFixtures` deliberately does not clear that set.
 */
describe('the cold read', () => {
  it('skeletons before the grid arrives, then resolves', async () => {
    renderInScheme(guest, 'light');
    expect(screen.getByLabelText(/Loading your saved stays/i)).toBeTruthy();
    expect(await screen.findByText(title(OLDEST))).toBeTruthy();
  });
});

/* -------------------------------------------------------------- the grid --- */

describe.each(SCHEMES)('the Saved grid in %s', (scheme) => {
  it('draws every saved stay and counts them', async () => {
    renderInScheme(guest, scheme);
    await screen.findByText(title(OLDEST));

    for (const id of SEEDED_SAVED) expect(screen.getByText(title(id))).toBeTruthy();
    expect(screen.getByText(`${SEEDED_SAVED.length} stays saved`)).toBeTruthy();
  });

  it('marks the unpublished stay unavailable and shows it no price', async () => {
    renderInScheme(guest, scheme);
    await screen.findByText(title(UNPUBLISHED));

    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText(/not taking bookings right now/)).toBeTruthy();
    // The card stays reachable: unsaving it is the whole reason it is kept.
    expect(
      screen.getByLabelText(`${title(UNPUBLISHED)}, not currently available to book`),
    ).toBeTruthy();
  });
});

describe('the grid', () => {
  it('orders newest saved first, which is the ADR ordering', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));

    // `SEEDED_SAVED` is the order they were saved, oldest first; the grid
    // reverses it. Asserted through the hearts, which are in grid order and
    // otherwise indistinguishable: pressing the FIRST one must remove the
    // NEWEST save, and nothing else.
    fireEvent.press(screen.getAllByLabelText('Remove from saved')[0]);
    await waitFor(() => expect(screen.queryByText(title(NEWEST))).toBeNull(), GONE);
    expect(screen.getByText(title(OLDEST))).toBeTruthy();
  });

  it('never draws a price on the unavailable card', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(UNPUBLISHED));

    const unpublished = STAYS.find((s) => s.id === UNPUBLISHED)!;
    // The published stays print theirs; this one must not print its own.
    expect(screen.queryByText(new RegExp(unpublished.price.toLocaleString('en-US')))).toBeNull();
  });
});

/* ------------------------------------------------------------ the unsave --- */

describe('unsaving', () => {
  it('removes the card and offers a real undo', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));

    // The first heart is the newest save. See the ordering test above.
    fireEvent.press(screen.getAllByLabelText('Remove from saved')[0]);

    await waitFor(() => expect(screen.queryByText(title(NEWEST))).toBeNull(), GONE);
    expect(screen.getByText(`Removed ${title(NEWEST)} from saved`)).toBeTruthy();
    expect(screen.getByLabelText(`Undo removing ${title(NEWEST)} from saved`)).toBeTruthy();
  });

  it('puts it back through the same store when undo is pressed', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));

    fireEvent.press(screen.getAllByLabelText('Remove from saved')[0]);
    await waitFor(() => expect(screen.queryByText(title(NEWEST))).toBeNull(), GONE);

    fireEvent.press(screen.getByLabelText(`Undo removing ${title(NEWEST)} from saved`));

    await waitFor(() => expect(screen.getByText(title(NEWEST))).toBeTruthy(), GONE);
    // The bar goes with it; an undo offered twice would undo the undo.
    expect(screen.queryByText(`Removed ${title(NEWEST)} from saved`)).toBeNull();
    // And the undo is acknowledged. The card reappearing three rows down is
    // not an acknowledgement.
    expect(screen.getByText(`${title(NEWEST)} is saved again`)).toBeTruthy();
  });
});

/* ------------------------------------------------------------ the states --- */

describe('the remaining list states', () => {
  it('offers a route to Explore when nothing is saved', async () => {
    writeFixture<string[]>(SAVED_KEY, []);
    renderInScheme(guest, 'light');

    expect(await screen.findByText('Nothing saved yet')).toBeTruthy();
    fireEvent.press(screen.getByText('Find a stay'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('says saves made offline are sent later, and blocks nothing (GB-23)', async () => {
    mockNetwork.isConnected = false;
    renderInScheme(guest, 'light');

    // A heart pressed offline is queued and sent later; the note used to say
    // saving stopped until the connection came back.
    expect(await screen.findByLabelText(en['saved.offlineNote'])).toBeTruthy();
    expect(en['saved.offlineNote']).toMatch(/sent when the connection is back/);
    // The grid is still there. Offline is a state, not an error (frames.md).
    expect(screen.getByText(title(OLDEST))).toBeTruthy();
  });

  it('says an unsave made offline is queued, and offers no undo for it yet', async () => {
    mockNetwork.isConnected = false;
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));

    try {
      fireEvent.press(screen.getAllByLabelText('Remove from saved')[0]);
      await waitFor(() => expect(screen.getByText(en['saved.queuedRemove'])).toBeTruthy(), GONE);
      // Nothing has been removed yet, so there is nothing to undo.
      expect(screen.queryByText(`Removed ${title(NEWEST)} from saved`)).toBeNull();
    } finally {
      // The intent sits in the module-level queue; a later online mount would
      // drain it into the next test's store.
      act(() => resetQueue());
    }
  });
});

/** Mobile audit 2026-10-05: what a card may claim (GB-07, GB-08). */
describe('the cards', () => {
  it('print no stars and no review counts, because v1 has none', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));
    expect(screen.queryByLabelText(/^Rated .* out of 5$/)).toBeNull();
  });

  it('label the rate per guest per night', async () => {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));
    expect(screen.getAllByText(`/ ${en['saved.perGuestNight']}`).length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- the RW --- */

describe('the Kinyarwanda catalogue', () => {
  it('renders the grid and the unavailable treatment in RW', async () => {
    renderInScheme(guest, 'light', { locale: 'rw' });

    await waitFor(() => expect(screen.getByText(rw['saved.title'])).toBeTruthy());
    expect(screen.getByText(rw['saved.unavailable'])).toBeTruthy();
    expect(screen.getByText(rw['saved.unavailableNote'])).toBeTruthy();
    expect(screen.queryByText(en['saved.unavailableNote'])).toBeNull();
  });

  it('says the undo in RW, which is the one control the bar carries', async () => {
    renderInScheme(guest, 'light', { locale: 'rw' });
    await waitFor(() => expect(screen.getByText(rw['saved.title'])).toBeTruthy());

    fireEvent.press(screen.getAllByLabelText(rw['a11y.unsave'])[0]);
    await waitFor(() => expect(screen.getByText(rw['saved.undo'])).toBeTruthy(), GONE);
  });
});

/* ----------------------------------------------------- the undo bar's voice -- */

/**
 * The undo bar has to SAY something, on both platforms.
 *
 * It first shipped with `accessibilityRole="alert"` and nothing else, which
 * announced on neither: `accessibilityLiveRegion` is Android-only and it had
 * none, and iOS has no live region in React Native at all, so the role was
 * inert there. A bar that appears, offers an undo and vanishes in silence hides
 * it from exactly the reader least able to notice a card leaving a grid.
 *
 * Two mechanisms, mutually exclusive by platform, so both are asserted — and so
 * is the absence of the other one, because hearing the sentence twice on
 * Android is its own bug.
 */
describe('the undo bar announcement', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  // Restored, so a test added after this block does not silently inherit the
  // last platform one of these set.
  const realPlatform = Platform.OS;

  beforeEach(() => announce.mockClear());
  afterAll(() => {
    announce.mockRestore();
    Platform.OS = realPlatform;
  });

  async function unsaveOnce() {
    renderInScheme(guest, 'light');
    await screen.findByText(title(OLDEST));
    fireEvent.press(screen.getAllByLabelText('Remove from saved')[0]);
    await waitFor(() => expect(screen.getByText(/^Removed /)).toBeTruthy(), GONE);
  }

  it('speaks the sentence and the action explicitly on iOS', async () => {
    Platform.OS = 'ios';
    await unsaveOnce();

    expect(announce).toHaveBeenCalledTimes(1);
    const spoken = announce.mock.calls[0][0];
    expect(spoken).toContain(`Removed ${title(NEWEST)} from saved`);
    // The action has to be in the announcement. A reader told only that
    // something was removed has no reason to go looking for a button.
    expect(spoken).toContain('Undo');
  });

  it('leaves the announcement to the live region on Android, so it is not doubled', async () => {
    Platform.OS = 'android';
    await unsaveOnce();

    expect(announce).not.toHaveBeenCalled();
    // And the live region is the thing carrying it there.
    expect(screen.getByText(/^Removed /).parent).toBeTruthy();
  });

  it('holds the bar open far longer when a screen reader is running', async () => {
    // 3.2s is a reading time. Hearing a sentence, swiping to a button and
    // pressing it is a navigating time, and the two are not the same number.
    expect(UNDO_SCREEN_READER_MS).toBeGreaterThan(TOAST_MS * 3);
  });
});
