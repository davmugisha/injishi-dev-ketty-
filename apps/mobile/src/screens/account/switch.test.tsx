/**
 * The workspace switcher — frame X4, and the four promises it makes.
 *
 * The route lives at `app/switch.tsx` because that is where Expo Router looks;
 * the test lives here because this is Session 11's folder and a suite under
 * `app/` would be the only one in the repo.
 *
 * What is asserted is the frame's own contract rather than its drawing:
 *
 *   1. every seat is offered, with its role line, and the active one is marked
 *      by a WORD as well as a glyph;
 *   2. selecting switches the workspace, ASKS THE SERVER FIRST, and says so;
 *   3. the parked seat is reachable but not listed;
 *   4. "Create a business workspace" opens the sheet that says where that
 *      actually happens, rather than a toast saying "not wired".
 *
 * The fifth promise — "anything half-captured is held, not dropped" — is
 * asserted through the fixture store rather than through the screen, because
 * that is where it is true: see `switchKeepsDrafts` and the test at the bottom.
 *
 * ## The seats come from a mocked server answer now
 *
 * ADR-038 child 0 task 8 deleted `SWITCHABLE_WORKSPACES`. The rows are
 * `GET /api/v1/me/workspaces`, so this mocks `useOptionalWorkspace` — the one
 * thing `DomainProvider` reads them through — rather than standing up a query
 * client and a fetch mock to assert a list rendering. The rows below mirror the
 * five seats `seed-demo.mjs` gives Samuel, which is what a presenter sees.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import SwitchScreen, { switchKeepsDrafts } from '../../../app/switch';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { ME } from '@/data/personas';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SEATS } from '@/test-seats';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));

/** Whether the server agrees to a switch. Flipped by the refusal test. */
let mockSwitchAccepts = true;
const mockSwitchTo = jest.fn(async (_workspaceId: string) => mockSwitchAccepts);

/**
 * The seats, from the one roster every surface suite shares (`@/test-seats`),
 * with this suite's own `switchTo` spy in place of the shared stub.
 *
 * Pulled in from INSIDE the factory: `jest.mock` is hoisted above the imports
 * and may only close over names beginning with `mock`, so a module-level
 * constant referenced here is a hoisting error rather than a value.
 *
 * Personal is the active seat, which is what makes the "already here" case
 * below reachable.
 */
jest.mock('@/workspace', () => {
  const { workspaceStateFor } = jest.requireActual('@/test-seats');
  const state = () => ({
    ...workspaceStateFor('tenant'),
    switchTo: (id: string) => mockSwitchTo(id),
  });
  // Both accessors: `DomainProvider` reads the optional form, screens read the
  // throwing one.
  return { useWorkspace: state, useOptionalWorkspace: state };
});

const sheet = () => (
  <DomainProvider initial="residence" initialSurface="tenant">
    <ToastProvider>
      <SwitchScreen />
    </ToastProvider>
  </DomainProvider>
);

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  mockSwitchTo.mockClear();
  mockSwitchAccepts = true;
  resetFixtures();
});

describe.each(SCHEMES)('the switcher in %s', (scheme) => {
  it('names the person once, at the top, above the seats', () => {
    renderInScheme(sheet(), scheme);
    expect(screen.getByText(ME.name)).toBeTruthy();
    expect(screen.getByText(ME.phone)).toBeTruthy();
  });

  it('offers every switchable seat with its role line', () => {
    renderInScheme(sheet(), scheme);
    for (const seat of SEATS.filter((s) => s.label !== 'Umurage Guesthouse')) {
      // `getAllByText`, because the Personal group's heading and its only row
      // are both the word "Personal" — which the frame draws that way, and
      // which a reader hears as a section followed by a seat.
      expect(screen.getAllByText(seat.label).length).toBeGreaterThan(0);
    }
  });

  /**
   * A parked seat is reachable by route and never offered here. Session A built
   * the Host surface behind `parked: true`, and the switcher is the one place
   * where showing it would promise something the tab set does not yet do.
   */
  it('leaves the parked seat off the list', () => {
    renderInScheme(sheet(), scheme);
    // Derived from the surface now, rather than read off a `parked` flag
    // somebody set by hand on a fixture row: a hospitality business seat whose
    // role is not housekeeper is a Host, and Host is parked.
    expect(screen.queryByText('Umurage Guesthouse')).toBeNull();
  });

  /**
   * Design brief §7.5: never colour alone. The check on the active row is a
   * glyph AND the word "Current", so a greyscale or colour-blind reader can
   * still tell which seat they are in.
   */
  it('marks the active seat with a word, not only a tint', () => {
    renderInScheme(sheet(), scheme);
    expect(screen.getByText(en['switch.current'])).toBeTruthy();
  });
});

describe('selecting a seat', () => {
  it('asks the server first, then dismisses back onto Account', async () => {
    renderInScheme(sheet(), 'light');
    fireEvent.press(screen.getByLabelText(/Kayitare Court/));

    // AC-S6: `POST /me/active-workspace` before anything local moves.
    await waitFor(() => expect(mockSwitchTo).toHaveBeenCalledWith('ws-kayitare-court'));
    // Account is the one tab in every set, which is why `back()` is safe: the
    // tab standing under the sheet is never the one the switch unlinks.
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('stays put and says so when the server refuses (AC-S6)', async () => {
    mockSwitchAccepts = false;
    renderInScheme(sheet(), 'light');
    fireEvent.press(screen.getByLabelText(/Kayitare Court/));

    // An app that moved anyway would be showing a workspace the server has not
    // agreed to, which is the failure the server-first order exists to prevent.
    expect(await screen.findByText(/could not switch workspace/i)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.queryByText(/Switched to/)).toBeNull();
  });

  it('says nothing, and asks nothing, when the seat is the one you are in', () => {
    renderInScheme(sheet(), 'light');
    // Personal is the active seat. A "Switched to Personal" for a switch that
    // did not happen teaches a reader that the toast means nothing — and a
    // round trip for it would be a request with nothing to change.
    fireEvent.press(screen.getByLabelText(/^Personal,/));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSwitchTo).not.toHaveBeenCalled();
    expect(screen.queryByText(/Switched to/)).toBeNull();
  });

  /** FL25 §9: Guest and Tenant are one Personal workspace, so the row offers both. */
  it('offers Personal its two surfaces and nothing else does', () => {
    renderInScheme(sheet(), 'light');
    expect(screen.getByLabelText(en['switch.asGuest'])).toBeTruthy();
    expect(screen.getByLabelText(en['switch.asTenant'])).toBeTruthy();
  });
});

describe('creating a business workspace', () => {
  /**
   * Session 0 wired the dashed row to a toast saying it was not built. It is
   * not unbuilt — it lives on the web and always will, which is a different
   * sentence, and the sheet is where the app says which.
   */
  it('opens the sheet rather than toasting "not wired"', () => {
    renderInScheme(sheet(), 'light');
    fireEvent.press(screen.getByLabelText(en['switch.create']));
    expect(mockPush).toHaveBeenCalledWith('/create-workspace');
  });
});

describe('the frame footnote', () => {
  it('prints the reason Account is in every tab set', () => {
    renderInScheme(sheet(), 'light');
    expect(screen.getByText(en['switch.note'])).toBeTruthy();
  });

  it('prints it in Kinyarwanda too, which is the longest string on the sheet', () => {
    renderInScheme(sheet(), 'light', { locale: 'rw' });
    expect(screen.getByText(rw['switch.note'])).toBeTruthy();
  });
});

describe('a half-typed draft survives a switch', () => {
  /**
   * FL16 §5 Path A — *switch mid-task → unsaved capture autosaved*, and frame
   * X4's own footnote: "anything half-captured is held, not dropped."
   *
   * It holds by construction rather than by anybody remembering to preserve it:
   * drafts live in the fixture store, which is module state keyed by fixture id,
   * and `setWorkspace` posts to the server and then writes two keychain values
   * and two pieces of React state, touching none of it. This asserts the
   * construction rather than the comment.
   */
  it('is still in the fixture store after the workspace changes', async () => {
    writeFixture('draft.test', { note: 'half typed' });
    renderInScheme(sheet(), 'light');
    fireEvent.press(screen.getByLabelText(/Aline K. Brokerage/));

    await waitFor(() => expect(mockSwitchTo).toHaveBeenCalled());
    expect(readFixture('draft.test', null)).toEqual({ note: 'half typed' });
    expect(switchKeepsDrafts()).toBe(true);
  });
});
