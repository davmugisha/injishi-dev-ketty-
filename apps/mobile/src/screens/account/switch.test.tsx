/**
 * The workspace switcher — frame X4, and the promises it can keep.
 *
 * The route lives at `app/switch.tsx` because that is where Expo Router looks;
 * the test lives here because this is Session 11's folder and a suite under
 * `app/` would be the only one in the repo.
 *
 * What is asserted is the frame's own contract rather than its drawing:
 *
 *   1. the person at the top is whoever `GET /me/profile` names, and nobody
 *      when it names nobody (mobile audit 2026-10-05, SA-01);
 *   2. every seat is offered with its role as a word and the tab it opens,
 *      with no stray separator, and the active one is marked by a WORD as well
 *      as a glyph (SA-10);
 *   3. selecting switches the workspace, ASKS THE SERVER FIRST, and says so;
 *   4. the parked seat is reachable but not listed;
 *   5. "Create a business workspace" opens the sheet that says where that
 *      actually happens, rather than a toast saying "not wired".
 *
 * This suite used to assert the fixture person, Samuel Kayitare, at the top of
 * the sheet, and that "anything half-captured is held, not dropped". The first
 * was a stranger's name on every account; the second was true only of drafts
 * kept in the fixture store (SA-35, SA-36). The narrow thing that is true is
 * still asserted, at the bottom.
 *
 * ## The seats and the person come from mocked server answers
 *
 * The rows are `GET /api/v1/me/workspaces`, so this mocks `useOptionalWorkspace`
 * — the one thing `DomainProvider` reads them through — with the shared roster
 * in `@/test-seats`. The person is `GET /api/v1/me/profile`, answered at
 * `api()`, so the mapping from a profile to the header runs for real.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import SwitchScreen, { switchKeepsDrafts } from '../../../app/switch';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SessionProvider } from '@/session';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
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
 * The broker seat as the API really sends it: labelled "Broker", with no org
 * name, no domain and no role (`WorkspaceService` builds own workspaces that
 * way). The shared roster names it after the seed's brokerage instead, so the
 * case that cares swaps this in.
 */
let mockBrokerAsServer = false;
let mockServerSeats: unknown[] | null = null;

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
  const state = () => {
    const base = workspaceStateFor('tenant');
    let workspaces = base.workspaces;
    if (mockBrokerAsServer) {
      // Built once, so every render sees the same array.
      mockServerSeats ??= base.workspaces.map((w: { kind: string }) =>
        w.kind === 'broker'
          ? { ...w, label: 'Broker', orgName: null, orgId: null, domain: null, orgRole: null }
          : w,
      );
      workspaces = mockServerSeats;
    }
    return { ...base, workspaces, switchTo: (id: string) => mockSwitchTo(id) };
  };
  // Both accessors: `DomainProvider` reads the optional form, screens read the
  // throwing one.
  return {
    useWorkspace: state,
    useOptionalWorkspace: state,
    useMayI: (permission: string) => state().permissions.includes(permission),
  };
});

/** `GET /me/profile`, per test. `'pending'` never settles. */
type MockAnswer = { status: 'ok'; data: unknown } | { status: 'failed' } | 'pending';
let mockProfile: MockAnswer = 'pending';
const mockCalls: string[] = [];

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: (path: string) => {
      mockCalls.push(path);
      const answer: MockAnswer = path.endsWith('/me/profile') ? mockProfile : { status: 'failed' };
      return answer === 'pending' ? new Promise(() => undefined) : Promise.resolve(answer);
    },
  };
});

const profile = (fullName: string | null, phoneE164: string | null): MockAnswer => ({
  status: 'ok',
  data: {
    fullName,
    gender: null,
    dateOfBirth: null,
    phoneE164,
    document: null,
    address: null,
    complete: fullName !== null,
  },
});

/** A returning person with a name and a phone on file. Not a seed persona. */
const GRACE = profile('Grace Mukamana', '+250788123456');

const sheet = () => (
  <SessionProvider initial="authenticated">
    <DomainProvider initial="residence" initialSurface="tenant">
      <ToastProvider>
        <SwitchScreen />
      </ToastProvider>
    </DomainProvider>
  </SessionProvider>
);

/** Let the profile read land, for a case asserting what is NOT drawn. */
async function settle() {
  await waitFor(() => expect(mockCalls.some((p) => p.endsWith('/me/profile'))).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  mockSwitchTo.mockClear();
  mockSwitchAccepts = true;
  mockBrokerAsServer = false;
  mockServerSeats = null;
  // Pending unless a case is about the person, so a case about the seats is
  // not racing a profile answer that lands after its last assertion.
  mockProfile = 'pending';
  mockCalls.length = 0;
  resetFixtures();
});

afterEach(async () => {
  // A profile read that answers after a test's last assertion lands inside
  // `act` here, rather than as a warning about an update nobody was watching.
  // TanStack Query hands its updates over on a timer, so this waits one.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

/* --------------------------------------------------------------- the person */

describe.each(SCHEMES)('the person at the top, in %s', (scheme) => {
  it('names the person the server holds, once, with their phone', async () => {
    mockProfile = GRACE;
    renderInScheme(sheet(), scheme);
    expect(await screen.findByText('Grace Mukamana')).toBeTruthy();
    expect(screen.getByText('+250 788 123 456')).toBeTruthy();
    expect(screen.getByLabelText('Grace Mukamana, +250 788 123 456')).toBeTruthy();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  /**
   * The rig heard "Samuel Kayitare, " over an empty line (SA-10). Without a
   * phone there is no comma and no second line.
   */
  it('reads no trailing comma and draws no empty line when there is no phone', async () => {
    mockProfile = profile('Grace Mukamana', null);
    renderInScheme(sheet(), scheme);
    expect(await screen.findByLabelText('Grace Mukamana')).toBeTruthy();
    expect(screen.queryByLabelText(/, $/)).toBeNull();
    const empty = screen.UNSAFE_root.findAll(
      (node) =>
        (node.type as unknown) === 'Text' &&
        (node.props.children === '' || node.props.children == null),
    );
    expect(empty).toHaveLength(0);
  });

  it('says the name is not added yet rather than borrowing one', async () => {
    mockProfile = profile(null, null);
    renderInScheme(sheet(), scheme);
    expect(await screen.findByText(en['identity.unnamed'])).toBeTruthy();
    expect(screen.getByLabelText(en['identity.unnamed'])).toBeTruthy();
    expect(screen.getByTestId('person-avatar-unnamed')).toBeTruthy();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  it('draws no name and no "not added" while the read is in flight', () => {
    mockProfile = 'pending';
    renderInScheme(sheet(), scheme);
    expect(screen.getByLabelText(en['state.loading'])).toBeTruthy();
    expect(screen.queryByText(en['identity.unnamed'])).toBeNull();
  });
});

/* ---------------------------------------------------------------- the seats */

describe.each(SCHEMES)('the seats, in %s', (scheme) => {
  it('offers every switchable seat', () => {
    renderInScheme(sheet(), scheme);
    for (const seat of SEATS.filter((s) => s.label !== 'Umurage Guesthouse')) {
      // `getAllByText`, because the Personal group's heading and its only row
      // are both the word "Personal" — which the frame draws that way, and
      // which a reader hears as a section followed by a seat.
      expect(screen.getAllByText(seat.label).length).toBeGreaterThan(0);
    }
  });

  /** The role as a word, then the tab the seat opens on. */
  it('gives each row its role and its tab, joined only where both exist', () => {
    renderInScheme(sheet(), scheme);
    expect(screen.getByText(`${en['role.tenant']} · ${en['nav.leases']}`)).toBeTruthy();
    expect(screen.getByText(`${en['role.owner']} · ${en['nav.rentRoll']}`)).toBeTruthy();
    expect(screen.getByText(`${en['role.broker']} · ${en['nav.directory']}`)).toBeTruthy();
    expect(screen.getByText(`${en['role.housekeeper']} · ${en['nav.queue']}`)).toBeTruthy();
  });

  /**
   * The rig: "owner ·", "housekeeper ·", "Guest · Tenant ·" and a lone "·" on
   * the Broker row (SA-10).
   */
  it('never ends or starts a line on a separator, and never prints the enum', () => {
    renderInScheme(sheet(), scheme);
    expect(screen.queryByText(/·\s*$/)).toBeNull();
    expect(screen.queryByText(/^\s*·/)).toBeNull();
    expect(screen.queryByText(/^(owner|manager|receptionist|housekeeper)\b/)).toBeNull();
    expect(screen.queryByText('Guest · Tenant')).toBeNull();
  });

  /**
   * A parked seat is reachable by route and never offered here. Session A built
   * the Host surface behind `parked: true`, and the switcher is the one place
   * where showing it would promise something the tab set does not yet do.
   */
  it('leaves the parked seat off the list', () => {
    renderInScheme(sheet(), scheme);
    // Derived from the surface: a hospitality business seat whose role is not
    // housekeeper is a Host, and Host is parked.
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

describe('a broker seat as the server sends it', () => {
  /**
   * The API labels a broker seat "Broker" and sends no role, which drew a row
   * whose second line was a lone "·" and whose spoken label was "Broker, ".
   * It is never blank now, and it does not say "Broker" twice either.
   */
  it('names the tab it opens and does not repeat its own title', () => {
    mockBrokerAsServer = true;
    renderInScheme(sheet(), 'light');
    expect(screen.getByLabelText('Broker')).toBeTruthy();
    expect(screen.getByText(en['nav.directory'])).toBeTruthy();
    expect(screen.queryByText(`${en['role.broker']} · ${en['nav.directory']}`)).toBeNull();
    expect(screen.queryByText(/·\s*$/)).toBeNull();
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
    fireEvent.press(screen.getByLabelText(`Personal, ${en['role.tenant']}`));
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
  it('prints the reason Account is in every tab set, and promises nothing about drafts', () => {
    renderInScheme(sheet(), 'light');
    expect(screen.getByText(en['switch.note'])).toBeTruthy();
    // True of the fixture store only, so it is no longer said (SA-35).
    expect(en['switch.note']).not.toMatch(/half-captured|not dropped/);
  });

  it('prints it in Kinyarwanda too, which is the longest string on the sheet', () => {
    renderInScheme(sheet(), 'light', { locale: 'rw' });
    expect(screen.getByText(rw['switch.note'])).toBeTruthy();
  });
});

describe('a draft in the fixture store survives a switch', () => {
  /**
   * The narrow truth behind FL16 §5 Path A. A started check-in or booking is
   * kept in the fixture store, module state keyed by fixture id, and
   * `setWorkspace` posts to the server and then writes two keychain values and
   * two pieces of React state, touching none of it. A draft kept in a screen's
   * own state is NOT covered, which is why the footnote stopped promising it.
   */
  it('is still in the fixture store after the workspace changes', async () => {
    writeFixture('draft.test', { note: 'half typed' });
    renderInScheme(sheet(), 'light');
    await settle();
    fireEvent.press(screen.getByLabelText(/Aline K. Brokerage/));

    await waitFor(() => expect(mockSwitchTo).toHaveBeenCalled());
    expect(readFixture('draft.test', null)).toEqual({ note: 'half typed' });
    expect(switchKeepsDrafts()).toBe(true);
  });
});
