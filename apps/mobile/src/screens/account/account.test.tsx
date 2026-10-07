/**
 * Account across six seats, and the places its rows go.
 *
 * Rewritten for the mobile honesty pass (audit 2026-10-05, SA-36). This suite
 * used to assert the prototype: that every seat named "the one person", Samuel
 * Kayitare, that each seat wore its verification claim, and that the landlord's
 * payout, organisation, people and plan rows all went somewhere. Each of those
 * was a fixture fact shown to a real person as their own. What it asserts now
 * is the opposite, seat by seat:
 *
 *   - the person is whoever `GET /me/profile` names, a skeleton while it is
 *     asked, and "Name not added yet" when it names nobody, never a stand-in;
 *   - the chip says which workspace a seat is, and nothing claims a check;
 *   - no row leads to a route that is closed for the seat;
 *   - two-step sign-in is the server's answer, read only, and the devices list
 *     is not invented;
 *   - Personal details reads and does not pretend to save;
 *   - sign out names the right person and counts what it will throw away.
 *
 * ## The server, mocked at `api()`
 *
 * `useMyIdentity` and `useTwoFactorState` both read through `api()`, so this
 * suite answers there, per path, rather than mocking the hooks: the mapping
 * from a profile to what a screen prints (`toIdentity`) runs for real. The
 * seats are the shared roster in `@/test-seats`, the server's answer for the
 * five seats `seed-demo.mjs` gives its demo person.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Account } from './account';
import { PayoutAccountSheet } from './payout-account';
import { OrganisationScreen } from './organisation';
import { StaffScreen } from './staff';
import { SubscriptionScreen } from './subscription';
import { RevealCreditsScreen } from './reveal-credits';
import { PersonalDetailsScreen } from './personal-details';
import { SecurityScreen } from './security';
import { AppearanceSheet } from './appearance';
import { APPEARANCES } from '@/theme/theme';
import { SignOutSheet } from './sign-out';
import { CreateWorkspaceSheet, ONBOARDING_URL } from './create-workspace';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SessionProvider } from '@/session';
import { SCHEMES, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { en as accountEn } from '@/i18n/messages/account';
import { resetFixtures } from '@/data/use-fixture-mutation';
import { enqueue, resetQueue } from '@/data/write-queue';
import type { Surface } from '@/data/rentals';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), navigate: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => undefined) }));

/* -------------------------------------------------------------- the server */

/** One answer from `api()`. `'pending'` never settles: a read in flight. */
type MockAnswer = { status: 'ok'; data: unknown } | { status: 'failed' } | 'pending';

/**
 * What the server says, per route. Reset before every test, so each case
 * states the answer it is about.
 */
const mockServer: { profile: MockAnswer; twoFactor: MockAnswer } = {
  profile: 'pending',
  twoFactor: 'pending',
};
/** Every path asked for, in order. */
const mockCalls: string[] = [];

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: (path: string) => {
      mockCalls.push(path);
      const answer: MockAnswer = path.endsWith('/me/profile')
        ? mockServer.profile
        : path.endsWith('/me/two-factor')
          ? mockServer.twoFactor
          : { status: 'failed' };
      return answer === 'pending' ? new Promise(() => undefined) : Promise.resolve(answer);
    },
  };
});

/** A returning person, with a name and a phone on file. Not a seed persona. */
const NAMED: MockAnswer = {
  status: 'ok',
  data: {
    fullName: 'Grace Mukamana',
    gender: null,
    dateOfBirth: null,
    phoneE164: '+250788123456',
    document: null,
    address: null,
    complete: true,
  },
};

/** A new account: the server answers, and every Step 1 field is null. */
const UNNAMED: MockAnswer = {
  status: 'ok',
  data: {
    fullName: null,
    gender: null,
    dateOfBirth: null,
    phoneE164: null,
    document: null,
    address: null,
    complete: false,
  },
};

/** `GET /me/two-factor` for an operator signed in with an emailed code. */
const STEPPED_UP: MockAnswer = {
  status: 'ok',
  data: { required: true, verified: true, sentTo: 'gr••••@example.rw' },
};

/** The same, for somebody who holds no business or broker workspace. */
const NOT_NEEDED: MockAnswer = {
  status: 'ok',
  data: { required: false, verified: true, sentTo: 'gr••••@example.rw' },
};

/* --------------------------------------------------------------- the seats */

let mockSurface: Surface = 'tenant';
/** Overrides the active seat's permissions, for the case that needs some. */
let mockPermissions: string[] | null = null;

jest.mock('@/workspace', () => {
  const { workspaceStateFor } = jest.requireActual('@/test-seats');
  const state = () => {
    const base = workspaceStateFor(mockSurface);
    return mockPermissions ? { ...base, permissions: mockPermissions } : base;
  };
  // Both accessors, and `useMayI`, so a block mounted from another surface
  // that asks a permission question gets the same answer the seat holds.
  return {
    useWorkspace: state,
    useOptionalWorkspace: state,
    useMayI: (permission: string) => state().permissions.includes(permission),
  };
});

/**
 * Every screen here reads the active seat, the session and the toast provider.
 * `hospitality` for guest, work and host, `residence` for the rest:
 * `surfaceFor` only consults the domain for Personal.
 */
function seat(ui: ReactElement, surface: Surface) {
  const domain =
    surface === 'guest' || surface === 'work' || surface === 'host' ? 'hospitality' : 'residence';
  // Set before the tree renders, so the mocked active workspace is the seat
  // this case is about.
  mockSurface = surface;
  return (
    <SessionProvider initial="authenticated">
      <DomainProvider initial={domain} initialSurface={surface}>
        <ToastProvider>{ui}</ToastProvider>
      </DomainProvider>
    </SessionProvider>
  );
}

const fill = (key: keyof typeof en, values?: Record<string, string | number>) =>
  (en[key] as string).replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );

/** Let every settled read land, for a case asserting what is NOT drawn. */
async function settle(path: string) {
  await waitFor(() => expect(mockCalls.some((p) => p.endsWith(path))).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const SEATS: Surface[] = ['guest', 'tenant', 'landlord', 'broker', 'work', 'host'];

/** The four rows whose routes are closed for every seat (SA-03, SA-04, SA-05, HO-05). */
const CLOSED_ROWS = ['Payout account', 'Organisation profile', 'People', 'Subscription'];
const CLOSED_ROUTES = ['/payout-account', '/organisation', '/staff', '/subscription'];

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockCalls.length = 0;
  mockServer.profile = NAMED;
  mockServer.twoFactor = STEPPED_UP;
  mockPermissions = null;
  resetFixtures();
  // Before rather than after: emptying the queue notifies whatever is still
  // mounted, and the last test's sheet is unmounted by now.
  resetQueue();
});

afterEach(async () => {
  // A read that answers after a test's last assertion lands inside `act`
  // here, rather than as a warning about an update nobody was watching.
  // TanStack Query hands its updates over on a timer, so this waits one.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

/* ------------------------------------------------------------- the identity */

describe.each(SCHEMES)('the identity card in %s', (scheme) => {
  it('names the person the server holds on every seat, and nobody else', async () => {
    for (const surface of SEATS) {
      const view = renderInScheme(seat(<Account />, surface), scheme);
      expect((await screen.findAllByText('Grace Mukamana')).length).toBeGreaterThan(0);
      // The fixture persona used to stand in for anybody the server had no
      // name for, and on every seat (mobile audit 2026-10-05, SA-01).
      expect(screen.queryByText(/Samuel/)).toBeNull();
      view.unmount();
    }
  });

  it('says the name is not added yet, with no initials, when the server holds none', async () => {
    mockServer.profile = UNNAMED;
    renderInScheme(seat(<Account />, 'tenant'), scheme);
    expect(await screen.findByText(en['identity.unnamed'])).toBeTruthy();
    // A plain glyph where initials would go: never "SK", never anybody's.
    expect(screen.getByTestId('person-avatar-unnamed')).toBeTruthy();
    expect(screen.queryByText('SK')).toBeNull();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  it('draws a skeleton rather than a name while the read is in flight', () => {
    mockServer.profile = 'pending';
    mockServer.twoFactor = 'pending';
    renderInScheme(seat(<Account />, 'tenant'), scheme);
    // The card's one sentence says it is loading; no name and no "not added"
    // is printed before the server has said which it is.
    expect(
      screen.getByLabelText(`${en['state.loading']}, ${en['role.tenant']}, ${en['account.badgePersonal']}`),
    ).toBeTruthy();
    expect(screen.queryByText(en['identity.unnamed'])).toBeNull();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  it('wears no presence dot, because the app knows nothing about presence', async () => {
    renderInScheme(seat(<Account />, 'tenant'), scheme);
    await screen.findAllByText('Grace Mukamana');
    // The "online" dot was an absolutely placed circle in the success fill on
    // the avatar (SA-35).
    const dots = screen.UNSAFE_root.findAll((node) => {
      if (typeof node.type !== 'string') return false;
      const style = flattenStyle(node.props.style);
      return style.position === 'absolute' && style.backgroundColor === paletteFor(scheme).success500;
    });
    expect(dots).toHaveLength(0);
  });
});

describe('what each seat says about itself', () => {
  /**
   * One sentence per seat, the role as a word and the chip as a plain fact:
   * the claims that used to be here ("ID verified", "TIN verified", "Licensed ·
   * RW-BK-0221", "Broker · Kigali City") were checks nobody ran (SA-02).
   */
  it('reads the role and the workspace off the seat, and claims no check', async () => {
    const said: [Surface, string][] = [
      ['guest', `Grace Mukamana, ${en['role.guest']}, ${en['account.badgePersonal']}`],
      ['tenant', `Grace Mukamana, ${en['role.tenant']}, ${en['account.badgePersonal']}`],
      ['landlord', `Grace Mukamana, ${en['role.owner']}, Kayitare Court`],
      ['broker', `Grace Mukamana, ${en['role.broker']}, Aline K. Brokerage`],
      ['work', `Grace Mukamana, ${en['role.housekeeper']} · Kivu Crest Hotel, ${en['account.badgeStaffSeat']}`],
      ['host', `Grace Mukamana, ${en['role.manager']}, Umurage Guesthouse`],
    ];
    for (const [surface, sentence] of said) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      expect(await screen.findByLabelText(sentence)).toBeTruthy();
      expect(screen.queryByText(/verified|Licensed|RW-BK|Kigali City/i)).toBeNull();
      view.unmount();
    }
  });

  /**
   * SA-10: the chip and the switch row printed the server's enum ("owner") and
   * nothing at all on a broker seat, so the chip read "Broker, " aloud.
   */
  it('names the role as a word on the chip and the switch row, never blank', async () => {
    const landlord = renderInScheme(seat(<Account />, 'landlord'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(screen.getByLabelText(`${en['switch.open']}: Kayitare Court, ${en['role.owner']}`)).toBeTruthy();
    expect(screen.getAllByText(en['role.owner']).length).toBeGreaterThan(0);
    expect(screen.queryByText('owner')).toBeNull();
    landlord.unmount();

    renderInScheme(seat(<Account />, 'broker'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(
      screen.getByLabelText(`${en['switch.open']}: Aline K. Brokerage, ${en['role.broker']}`),
    ).toBeTruthy();
  });
});

/* ------------------------------------------------------------- the sections */

describe('which rows each seat gets', () => {
  /**
   * SA-03, SA-04, SA-05 and HO-05: the payout, the organisation, the people
   * and the plan were fixtures shown as the seat's own, and their routes are
   * closed for every seat, so a row would bounce whoever pressed it home.
   */
  it('offers no row to a route that is closed, on any seat', async () => {
    for (const surface of SEATS) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      await screen.findAllByText('Grace Mukamana');
      for (const label of CLOSED_ROWS) {
        expect(screen.queryByText(label)).toBeNull();
      }
      view.unmount();
    }
  });

  /**
   * SA-15: a row is never chosen by the surface. A landlord seat that holds
   * `money.view` and `team.manage` still gets no payout or people row, because
   * the routes behind them are closed whatever the seat may do.
   */
  it('draws no closed row even for a seat whose permissions would allow it', async () => {
    mockPermissions = ['money.view', 'team.manage'];
    renderInScheme(seat(<Account />, 'landlord'), 'light');
    await screen.findAllByText('Grace Mukamana');
    for (const label of CLOSED_ROWS) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByText(en['account.sectionBusiness'])).toBeNull();
  });

  it('gives the business section to the broker alone, for its reveal credits', async () => {
    const broker = renderInScheme(seat(<Account />, 'broker'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(screen.getByText(en['account.sectionBusiness'])).toBeTruthy();
    fireEvent.press(screen.getByLabelText(en['account.rowCredits']));
    expect(mockPush).toHaveBeenCalledWith('/reveal-credits');
    broker.unmount();

    for (const surface of ['guest', 'tenant', 'landlord', 'work', 'host'] as const) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      await screen.findAllByText('Grace Mukamana');
      expect(screen.queryByText(en['account.sectionBusiness'])).toBeNull();
      expect(screen.queryByText(en['account.rowCredits'])).toBeNull();
      view.unmount();
    }
  });

  /** SA-24: "7 left" was the fixture's seed, printed on every broker's row. */
  it('prints no credit count on the broker row', async () => {
    renderInScheme(seat(<Account />, 'broker'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(screen.queryByText(/\bleft\b/)).toBeNull();
    expect(en['account.creditsHint']).not.toMatch(/\{count\}|\d/);
  });

  /** Frame W7: the shift summary lives on Work Account, and nowhere else. */
  it('mounts the Work blocks on the Work seat, and nowhere else', async () => {
    const work = renderInScheme(seat(<Account />, 'work'), 'light');
    await waitFor(() => expect(screen.getByText(en['work.shift.title'])).toBeTruthy());
    work.unmount();

    renderInScheme(seat(<Account />, 'landlord'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(screen.queryByText(en['work.shift.title'])).toBeNull();
  });

  /** SA-18: v1 ships in English only, so there is no language to choose. */
  it('gives every seat the same preferences, with no language toggle', async () => {
    for (const surface of SEATS) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      await screen.findAllByText('Grace Mukamana');
      expect(screen.getByText(en['account.sectionPreferences'])).toBeTruthy();
      expect(screen.getByText(en['account.rowSecurity'])).toBeTruthy();
      expect(screen.getByText(en['account.photoCredits'])).toBeTruthy();
      expect(screen.getAllByLabelText(en['account.signOut']).length).toBeGreaterThan(0);
      expect(screen.queryByText(en['account.language'])).toBeNull();
      expect(screen.queryByText(en['account.localeRw'])).toBeNull();
      view.unmount();
    }
  });
});

describe('the security row', () => {
  /** SA-06: it said "2FA · On" for everyone, from a fixture. */
  it('says 2FA is on when the server says this account needs it', async () => {
    mockServer.twoFactor = STEPPED_UP;
    renderInScheme(seat(<Account />, 'landlord'), 'light');
    expect(await screen.findByText(en['account.twoFactorOn'])).toBeTruthy();
  });

  it('says nothing when the account does not need it, rather than "Off"', async () => {
    mockServer.twoFactor = NOT_NEEDED;
    renderInScheme(seat(<Account />, 'tenant'), 'light');
    await settle('/me/two-factor');
    expect(screen.queryByText(en['account.twoFactorOn'])).toBeNull();
    expect(screen.queryByText(/2FA · Off/)).toBeNull();
  });

  it('says nothing while the read is out, and nothing when it fails', async () => {
    mockServer.twoFactor = 'pending';
    const pending = renderInScheme(seat(<Account />, 'landlord'), 'light');
    await screen.findAllByText('Grace Mukamana');
    expect(screen.queryByText(/2FA/)).toBeNull();
    pending.unmount();

    mockServer.twoFactor = { status: 'failed' };
    renderInScheme(seat(<Account />, 'landlord'), 'light');
    await settle('/me/two-factor');
    expect(screen.queryByText(/2FA/)).toBeNull();
  });
});

/* -------------------------------------------------------------- nothing dead */

describe('every row goes somewhere this seat may open', () => {
  it('routes every remaining row to its screen', async () => {
    renderInScheme(seat(<Account />, 'landlord'), 'light');
    await screen.findAllByText('Grace Mukamana');
    const rows: [string, string][] = [
      [en['account.rowPersonal'], '/personal-details'],
      [en['account.rowSecurity'], '/security'],
      [en['account.rowPrivacy'], '/privacy'],
      [en['account.rowAppearance'], '/appearance'],
      [en['account.photoCredits'], '/photo-credits'],
    ];
    for (const [label, route] of rows) {
      mockPush.mockClear();
      fireEvent.press(screen.getByLabelText(label));
      expect(mockPush).toHaveBeenCalledWith(route);
    }
    for (const route of CLOSED_ROUTES) {
      expect(mockPush).not.toHaveBeenCalledWith(route);
    }
  });

  it('opens the switcher from the row and from the chip', async () => {
    renderInScheme(seat(<Account />, 'tenant'), 'light');
    await screen.findAllByText('Grace Mukamana');
    fireEvent.press(screen.getByLabelText(en['switch.open']));
    expect(mockPush).toHaveBeenCalledWith('/switch');
  });

  it('asks before it signs out, rather than signing out on the tap', async () => {
    renderInScheme(seat(<Account />, 'tenant'), 'light');
    await screen.findAllByText('Grace Mukamana');
    fireEvent.press(screen.getAllByLabelText(en['account.signOut'])[0]);
    expect(mockPush).toHaveBeenCalledWith('/sign-out');
  });
});

/* ----------------------------------------------------------------- security */

describe.each(SCHEMES)('Security in %s', (scheme) => {
  it('reports two-step sign-in as needed and passed, with no switch to flip', async () => {
    mockServer.twoFactor = STEPPED_UP;
    renderInScheme(seat(<SecurityScreen />, 'landlord'), scheme);
    expect(await screen.findByText(en['security.statusPassed'])).toBeTruthy();
    expect(screen.getByText(en['security.on'])).toBeTruthy();
    // The toggle flipped a fixture and toasted success (SA-06). The server has
    // no switch, so neither does the screen.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/Turn (on|off)/)).toBeNull();
  });

  it('says it is not needed for an account that holds no business seat', async () => {
    mockServer.twoFactor = NOT_NEEDED;
    renderInScheme(seat(<SecurityScreen />, 'tenant'), scheme);
    expect(await screen.findByText(en['security.statusNotNeeded'])).toBeTruthy();
    expect(screen.getByText(en['security.notNeeded'])).toBeTruthy();
    // Sign in is a code sent by email; nothing here says a number signs you in.
    expect(screen.queryByText(/number alone/i)).toBeNull();
  });

  it('says this sign in has not passed it, when the server says so', async () => {
    mockServer.twoFactor = { status: 'ok', data: { required: true, verified: false, sentTo: 'gr••••@example.rw' } };
    renderInScheme(seat(<SecurityScreen />, 'landlord'), scheme);
    expect(await screen.findByText(en['security.statusOwed'])).toBeTruthy();
  });

  it('lists no invented device and offers no sign out it cannot do', async () => {
    renderInScheme(seat(<SecurityScreen />, 'landlord'), scheme);
    await screen.findByText(en['security.statusPassed']);
    expect(screen.queryByText('iPhone 13 · Injishi')).toBeNull();
    expect(screen.queryByText('Chrome · Windows')).toBeNull();
    expect(screen.queryByText('Sign out everywhere else')).toBeNull();
    expect(screen.getByText(en['security.devicesNote'])).toBeTruthy();
  });
});

describe('Security when the read fails', () => {
  it('shows an error whose retry asks the server again', async () => {
    mockServer.twoFactor = { status: 'failed' };
    renderInScheme(seat(<SecurityScreen />, 'landlord'), 'light');
    expect(await screen.findByText(en['state.errorTitle'])).toBeTruthy();
    const asked = mockCalls.filter((p) => p.endsWith('/me/two-factor')).length;

    mockServer.twoFactor = STEPPED_UP;
    fireEvent.press(screen.getByText(en['state.retry']));
    expect(await screen.findByText(en['security.statusPassed'])).toBeTruthy();
    expect(mockCalls.filter((p) => p.endsWith('/me/two-factor')).length).toBeGreaterThan(asked);
  });
});

/* --------------------------------------------------------- personal details */

describe.each(SCHEMES)('Personal details in %s', (scheme) => {
  it('reads the name and phone from the server, and has nothing to save', async () => {
    renderInScheme(seat(<PersonalDetailsScreen />, 'tenant'), scheme);
    expect((await screen.findAllByText('Grace Mukamana')).length).toBeGreaterThan(0);
    expect(screen.getByText('+250 788 123 456')).toBeTruthy();
    // F-S12 §6, derived from the server's name rather than stored.
    expect(screen.getByText('Grace M.')).toBeTruthy();
    // SA-14: the edits wrote to a fixture and toasted "Saved." regardless.
    expect(screen.queryByText('Change name')).toBeNull();
    expect(screen.queryByText('Change email')).toBeNull();
    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByText(en['personal.changeBody'])).toBeTruthy();
  });

  it('shows no fixture person and no fixture email when the server holds no name', async () => {
    mockServer.profile = UNNAMED;
    renderInScheme(seat(<PersonalDetailsScreen />, 'tenant'), scheme);
    expect(await screen.findByText(en['identity.unnamed'])).toBeTruthy();
    expect(screen.queryByText(/Samuel/)).toBeNull();
    expect(screen.queryByText(/kayitare\.rw/)).toBeNull();
    // No name, so no public form of one.
    expect(screen.queryByText(en['personal.publicTitle'])).toBeNull();
  });

  it('names one way in, the emailed code, and no phone or Google method', async () => {
    renderInScheme(seat(<PersonalDetailsScreen />, 'tenant'), scheme);
    expect(
      await screen.findByText(fill('personal.signInBodyTo', { address: 'gr••••@example.rw' })),
    ).toBeTruthy();
    expect(screen.queryByText('Google')).toBeNull();
    expect(screen.queryByText('Phone number')).toBeNull();
    expect(screen.queryByText(/^Link$|^Unlink$|Linked/)).toBeNull();
  });
});

describe('Personal details while it loads', () => {
  it('draws skeleton rows, not a name and not "not added"', () => {
    mockServer.profile = 'pending';
    mockServer.twoFactor = 'pending';
    renderInScheme(seat(<PersonalDetailsScreen />, 'tenant'), 'light');
    expect(screen.getByLabelText(`${en['personal.name']}, ${en['state.loading']}`)).toBeTruthy();
    expect(screen.queryByText(en['identity.unnamed'])).toBeNull();
    // Until the address is known the sentence names none, and says the rest.
    expect(screen.getByText(en['personal.signInBody'])).toBeTruthy();
  });
});

/* ----------------------------------------------------------------- sign out */

describe.each(SCHEMES)('the sign out confirm in %s', (scheme) => {
  it('names the person the server holds', async () => {
    renderInScheme(seat(<SignOutSheet />, 'landlord'), scheme);
    expect(await screen.findByText(fill('signOut.subtitle', { name: 'Grace Mukamana' }))).toBeTruthy();
  });

  it('names nobody when the server holds no name', async () => {
    mockServer.profile = UNNAMED;
    renderInScheme(seat(<SignOutSheet />, 'landlord'), scheme);
    await settle('/me/profile');
    expect(screen.getByText(en['signOut.subtitleNoName'])).toBeTruthy();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  it('names how many workspaces it is leaving', () => {
    // Neither read matters here, and an answer landing after the last
    // assertion is a state update nobody is watching.
    mockServer.profile = 'pending';
    mockServer.twoFactor = 'pending';
    renderInScheme(seat(<SignOutSheet />, 'landlord'), scheme);
    // Five seats, one parked: the sentence counts the switchable ones.
    expect(screen.getByText(fill('signOut.scope', { count: 4 }))).toBeTruthy();
    expect(screen.getByText(en['signOut.confirm'])).toBeTruthy();
  });
});

describe('what signing out throws away', () => {
  beforeEach(() => {
    // Who is signed in is not what these cases are about.
    mockServer.profile = 'pending';
    mockServer.twoFactor = 'pending';
  });

  const queue = (n: number) => {
    for (let i = 0; i < n; i += 1) {
      enqueue({ id: `msg-${i}`, kind: 'message', payload: {}, label: `Message ${i}` });
    }
  };

  it('says nothing about unsaved changes when there are none', () => {
    renderInScheme(seat(<SignOutSheet />, 'tenant'), 'light');
    expect(screen.queryByText(en['signOut.queuedOne'])).toBeNull();
    expect(screen.queryByText(/not been saved/)).toBeNull();
  });

  it('says one change is discarded when one is waiting', () => {
    queue(1);
    renderInScheme(seat(<SignOutSheet />, 'tenant'), 'light');
    expect(screen.getByText(en['signOut.queuedOne'])).toBeTruthy();
  });

  it('counts them when several are waiting, and says it before the tap', () => {
    queue(3);
    renderInScheme(seat(<SignOutSheet />, 'tenant'), 'light');
    const sentence = fill('signOut.queuedMany', { count: 3 });
    expect(screen.getByText(sentence)).toBeTruthy();
    // In the same spoken sentence as the scope, so a screen reader hears both.
    expect(screen.getByLabelText(`${fill('signOut.scope', { count: 4 })} ${sentence}`)).toBeTruthy();
  });
});

/* --------------------------------------------------------- the destinations */

describe.each(SCHEMES)('the other destinations in %s', (scheme) => {
  it('appearance offers every value APPEARANCES declares, and no more', () => {
    renderInScheme(seat(<AppearanceSheet />, 'tenant'), scheme);

    // Driven off APPEARANCES rather than a hand-written list, so a fourth value
    // added to the type cannot ship without a row on this sheet to choose it,
    // and a value REMOVED from it cannot leave a row behind. ADR-033's `white`
    // is the reason both ways: it went in as a type widening and came back out
    // as one, and a list written by hand here would have passed through both.
    for (const option of APPEARANCES) {
      expect(screen.getByLabelText(en[`appearance.${option}`])).toBeTruthy();
    }
    expect(screen.getAllByRole('radio')).toHaveLength(APPEARANCES.length);
  });

  it('marks exactly one appearance selected, and it is the one in force', () => {
    renderInScheme(seat(<AppearanceSheet />, 'tenant'), scheme);

    const selected = screen
      .getAllByRole('radio')
      .filter((node) => node.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);

    // `renderInScheme` drives both schemes through the OS mock (see
    // `src/test-utils.tsx`), so the row in force is always `system`.
    expect(selected[0].props.accessibilityLabel).toBe(en['appearance.system']);
  });

  it('creating a workspace prints the URL and names no wrong domain', () => {
    renderInScheme(seat(<CreateWorkspaceSheet />, 'tenant'), scheme);
    // Web sign in on the same stack, which then opens the registration wizard.
    // It used to print https://injishi.rw/business/new, a page that never existed.
    expect(ONBOARDING_URL).toBe('http://web.test.invalid/sign-in?redirect=/register');
    expect(screen.getByText('http://web.test.invalid/sign-in?redirect=/register')).toBeTruthy();
    expect(screen.getByText(en['createWorkspace.needTin'])).toBeTruthy();
    // SA-35: the hint said "Opens injishi.rw", which is not the web.
    expect(screen.getByText(en['createWorkspace.open'])).toBeTruthy();
    expect(en['createWorkspace.openHint']).not.toMatch(/injishi\.rw/);
  });

  it('reveal credits still opens for the broker it is linked from', async () => {
    renderInScheme(seat(<RevealCreditsScreen />, 'broker'), scheme);
    expect((await screen.findAllByText(en['credits.title'])).length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------- closed screens, kept for their reads */

/**
 * Payout, organisation, people and subscription are closed for every seat and
 * linked from nowhere (SA-03, SA-04, SA-05, HO-05). Their screens are kept for
 * the reads that will replace their fixtures, so they are still rendered here,
 * once each, to keep them from rotting while nobody can open them.
 */
describe('the closed screens still render', () => {
  it('payout says the money is mocked before it says how much', async () => {
    renderInScheme(seat(<PayoutAccountSheet />, 'landlord'), 'light');
    expect(await screen.findByText(en['payout.adapterMock'])).toBeTruthy();
  });

  it('organisation renders its card', () => {
    renderInScheme(seat(<OrganisationScreen />, 'landlord'), 'light');
    expect(screen.getByText(en['org.identityTitle'])).toBeTruthy();
  });

  it('people renders every state at once', async () => {
    renderInScheme(seat(<StaffScreen />, 'landlord'), 'light');
    await waitFor(() => expect(screen.getAllByText(en['staff.state.active']).length).toBeGreaterThan(0));
    expect(screen.getByText(en['staff.state.suspended'])).toBeTruthy();
  });

  it('subscription renders what the plan includes', () => {
    renderInScheme(seat(<SubscriptionScreen />, 'landlord'), 'light');
    expect(screen.getByText(en['subscription.includes'])).toBeTruthy();
  });
});

/* ------------------------------------------------------- the catalogue */

describe('the account catalogue', () => {
  /**
   * XC-16: developer copy reached the screen ("Nothing has moved in this
   * build", "It is not a screen we have not built yet"), and a seed persona's
   * business greeted every broker. None of the English here may say either.
   * "mock" stays allowed: on the demo stack a mock adapter label is true.
   */
  it('carries no developer copy and no seed persona', () => {
    for (const [key, value] of Object.entries(accountEn)) {
      expect({ key, dev: /wired|prototype|fixture|this build|built yet|session \d|frame [A-Z]\d/i.test(value) }).toEqual({ key, dev: false });
      expect({ key, persona: /Samuel|Aline K\.|RW-BK-0221|Kigali City|injishi\.rw/.test(value) }).toEqual({ key, persona: false });
    }
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders Account for every seat with rw active and no English left in the chrome', async () => {
    for (const surface of SEATS) {
      const view = renderInScheme(seat(<Account />, surface), 'light', { locale: 'rw' });
      await screen.findAllByText('Grace Mukamana');
      expect(screen.getByText(rw['account.title'])).toBeTruthy();
      expect(screen.queryByText(en['account.sectionPreferences'])).toBeNull();
      expect(screen.getByText(rw['account.sectionPreferences'])).toBeTruthy();
      view.unmount();
    }
  });

  it('carries the long RW consequence lines on the destinations that print one', async () => {
    const payout = renderInScheme(seat(<PayoutAccountSheet />, 'landlord'), 'light', {
      locale: 'rw',
    });
    expect(await screen.findByText(rw['payout.adapterMock'])).toBeTruthy();
    payout.unmount();

    mockServer.profile = 'pending';
    mockServer.twoFactor = 'pending';
    renderInScheme(seat(<SignOutSheet />, 'landlord'), 'light', { locale: 'rw' });
    expect(screen.getByText(rw['signOut.scope'].replace('{count}', '4'))).toBeTruthy();
  });
});
