/**
 * Account across six seats, and the ten places its rows go.
 *
 * The claim this file exists to hold is the one the screen is built around:
 * **the same screen renders six different surfaces and nothing on it is dead.**
 * Session 0 shipped five rows with a chevron and a "not wired" toast, so the
 * per-seat assertions below are as much a guard against that returning as they
 * are a check that the frames were followed.
 *
 * Four things are asserted per seat rather than once:
 *
 *   - the role line and the verification badge, which are the only two things
 *     that move (frames R5, R14, B25, W7, Guest artboard 12);
 *   - that BUSINESS is present exactly on the seats that own a business;
 *   - that the Work section mounts the two blocks Session 10 exported for it;
 *   - that every row's label is real copy rather than a key.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
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
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { resetFixtures } from '@/data/use-fixture-mutation';
import { ME } from '@/data/personas';
import type { Surface } from '@/data/rentals';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), navigate: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => undefined) }));

/**
 * The seats, as `GET /api/v1/me/workspaces` answers them.
 *
 * ADR-038 child 0 task 8 deleted `WORKSPACES` from `data/personas.ts`, so the
 * active seat and the seat COUNT both come from the server now. This mock is
 * the server: five seats, one of them the parked Host, which is the roster
 * `seed-demo.mjs` gives Samuel and therefore what a reader of these tests
 * should picture.
 *
 * `mockSurface` follows the seat each test asks for, because `seat()` below
 * varies it per case and the active workspace has to agree with the surface
 * being rendered — otherwise a Landlord test would draw a Personal eyebrow.
 */
const SEATS = [
  { workspaceId: 'ws-personal', kind: 'personal', orgId: null, orgName: null, domain: null, orgRole: null, permissions: [], propertyName: null, label: 'Personal', surface: 'tenant' },
  { workspaceId: 'ws-court', kind: 'business', orgId: 'o1', orgName: 'Kayitare Court', domain: 'residence', orgRole: 'owner', permissions: [], propertyName: 'Kayitare Court', label: 'Kayitare Court', surface: 'landlord' },
  { workspaceId: 'ws-broker', kind: 'broker', orgId: 'o2', orgName: 'Aline K. Brokerage', domain: 'residence', orgRole: null, permissions: [], propertyName: null, label: 'Aline K. Brokerage', surface: 'broker' },
  { workspaceId: 'ws-kivu', kind: 'business', orgId: 'o3', orgName: 'Kivu Crest Hotel', domain: 'hospitality', orgRole: 'housekeeper', permissions: [], propertyName: 'Kivu Crest Hotel', label: 'Kivu Crest Hotel', surface: 'work' },
  { workspaceId: 'ws-umurage', kind: 'business', orgId: 'o4', orgName: 'Umurage Guesthouse', domain: 'hospitality', orgRole: 'manager', permissions: [], propertyName: 'Umurage Guesthouse', label: 'Umurage Guesthouse', surface: 'host' },
];

let mockSurface: string = 'tenant';

jest.mock('@/workspace', () => {
  const state = () => ({
    workspaces: SEATS,
    // Guest and Tenant are one Personal workspace (FL25 §9), so both map to it.
    active:
      SEATS.find((w) => w.surface === (mockSurface === 'guest' ? 'tenant' : mockSurface)) ??
      SEATS[0],
    activeWorkspaceId: 'ws-personal',
    permissions: [],
    twoFactor: { required: false, verified: true },
    isResolving: false,
    error: null,
    switchTo: jest.fn(async () => true),
    refetch: jest.fn(),
  });
  // One object behind both accessors: `DomainProvider` reads the optional form
  // and the screens read the throwing one, so supplying only one would crash
  // the provider above every screen here.
  return { useWorkspace: state, useOptionalWorkspace: state };
});

/**
 * Every screen here reads the active seat, the session and the toast provider.
 * `hospitality` for guest and work, `residence` for the rest — `surfaceFor`
 * only consults the domain for Personal, so the pairing matters on two of six.
 */
function seat(ui: ReactElement, surface: Surface) {
  const domain = surface === 'guest' || surface === 'work' || surface === 'host'
    ? 'hospitality'
    : 'residence';
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

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  resetFixtures();
});

/* ------------------------------------------------------------- the identity */

describe.each(SCHEMES)('the identity card in %s', (scheme) => {
  it('names the one person on every seat, and only the hat changes', () => {
    for (const surface of ['guest', 'tenant', 'landlord', 'broker', 'work'] as const) {
      const view = renderInScheme(seat(<Account />, surface), scheme);
      // Decision D7: one identity, many hats. The frames draw four different
      // people; the product has one.
      expect(screen.getAllByText(ME.name).length).toBeGreaterThan(0);
      view.unmount();
    }
  });

  it('draws each seat its own verification claim, never a generic "Verified"', () => {
    const claims: [Surface, string][] = [
      ['landlord', en['account.badgeTinVerified']],
      ['broker', fill('account.badgeLicensed', { licence: 'RW-BK-0221' })],
      ['tenant', en['account.badgePersonal']],
      ['guest', en['account.badgeIdVerified']],
      ['work', en['account.badgeStaffSeat']],
    ];
    for (const [surface, claim] of claims) {
      const view = renderInScheme(seat(<Account />, surface), scheme);
      expect(screen.getByText(claim)).toBeTruthy();
      view.unmount();
    }
  });
});

/* ------------------------------------------------------------- the sections */

describe('which sections each seat gets', () => {
  it('gives BUSINESS to the three seats that own a business and no others', () => {
    for (const surface of ['landlord', 'broker', 'host'] as const) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      expect(screen.getByText(en['account.sectionBusiness'])).toBeTruthy();
      view.unmount();
    }
    for (const surface of ['guest', 'tenant', 'work'] as const) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      expect(screen.queryByText(en['account.sectionBusiness'])).toBeNull();
      view.unmount();
    }
  });

  it('puts reveal credits on the broker only, and the org rows on the other two', () => {
    const broker = renderInScheme(seat(<Account />, 'broker'), 'light');
    expect(screen.getByText(en['account.rowCredits'])).toBeTruthy();
    expect(screen.queryByText(en['account.rowStaff'])).toBeNull();
    broker.unmount();

    renderInScheme(seat(<Account />, 'landlord'), 'light');
    expect(screen.queryByText(en['account.rowCredits'])).toBeNull();
    expect(screen.getByText(en['account.rowOrganisation'])).toBeTruthy();
    expect(screen.getByText(en['account.rowStaff'])).toBeTruthy();
  });

  /** Frame W7: the shift summary and the connection switch live on Work Account. */
  it('mounts the two Work blocks on the Work seat, and nowhere else', async () => {
    const work = renderInScheme(seat(<Account />, 'work'), 'light');
    await waitFor(() => expect(screen.getByText(en['work.shift.title'])).toBeTruthy());
    expect(screen.getByText(en['work.offline.title'])).toBeTruthy();
    work.unmount();

    renderInScheme(seat(<Account />, 'landlord'), 'light');
    expect(screen.queryByText(en['work.shift.title'])).toBeNull();
  });

  it('gives every seat the same PREFERENCES, because they belong to the person', () => {
    for (const surface of ['guest', 'tenant', 'landlord', 'broker', 'work'] as const) {
      const view = renderInScheme(seat(<Account />, surface), 'light');
      expect(screen.getByText(en['account.sectionPreferences'])).toBeTruthy();
      expect(screen.getByText(en['account.rowSecurity'])).toBeTruthy();
      expect(screen.getByText(en['account.language'])).toBeTruthy();
      expect(screen.getByText(en['account.photoCredits'])).toBeTruthy();
      expect(screen.getAllByLabelText(en['account.signOut']).length).toBeGreaterThan(0);
      view.unmount();
    }
  });
});

/* -------------------------------------------------------------- nothing dead */

describe('nothing on this screen is dead', () => {
  /**
   * Session 0 shipped five rows with a chevron and a toast saying they were not
   * wired, and said Session 11 would give them destinations. This is the guard
   * against that coming back: every row goes somewhere.
   */
  it('routes every landlord row to a real destination', () => {
    renderInScheme(seat(<Account />, 'landlord'), 'light');
    const rows: [string, string][] = [
      [en['account.rowPayout'], '/payout-account'],
      [en['account.rowOrganisation'], '/organisation'],
      [en['account.rowStaff'], '/staff'],
      [en['account.rowSubscription'], '/subscription'],
      [en['account.rowPersonal'], '/personal-details'],
      [en['account.rowSecurity'], '/security'],
      [en['account.rowAppearance'], '/appearance'],
      [en['account.photoCredits'], '/photo-credits'],
    ];
    for (const [label, route] of rows) {
      mockPush.mockClear();
      fireEvent.press(screen.getByLabelText(label));
      expect(mockPush).toHaveBeenCalledWith(route);
    }
  });

  it('opens the switcher from the row and from the chip', () => {
    renderInScheme(seat(<Account />, 'tenant'), 'light');
    fireEvent.press(screen.getByLabelText(en['switch.open']));
    expect(mockPush).toHaveBeenCalledWith('/switch');
  });

  it('asks before it signs out, rather than signing out on the tap', () => {
    renderInScheme(seat(<Account />, 'tenant'), 'light');
    fireEvent.press(screen.getAllByLabelText(en['account.signOut'])[0]);
    expect(mockPush).toHaveBeenCalledWith('/sign-out');
  });
});

/* ----------------------------------------------------------------- the rows */

describe.each(SCHEMES)('the destinations in %s', (scheme) => {
  it('payout says the money is mocked before it says how much', async () => {
    // Awaited since gaps.md §6: the sheet reads through `useFixture` so that its
    // loading, error and empty branches exist at all. On the screen that says
    // where money lands, the error branch is the one that matters — a failed
    // read that still painted the last-known destination would tell somebody
    // their rent is going somewhere it may no longer be going.
    renderInScheme(seat(<PayoutAccountSheet />, 'landlord'), scheme);
    expect(await screen.findByText(en['payout.adapterMock'])).toBeTruthy();
    expect(screen.getByText(en['payout.momo'])).toBeTruthy();
  });

  it('the organisation prints the TIN and when it was last checked', () => {
    renderInScheme(seat(<OrganisationScreen />, 'landlord'), scheme);
    expect(screen.getByText('104 738 291')).toBeTruthy();
    expect(screen.getByText(en['org.tinChecked'])).toBeTruthy();
  });

  it('staff shows every state at once, revoked included', async () => {
    renderInScheme(seat(<StaffScreen />, 'landlord'), scheme);
    await waitFor(() => expect(screen.getByText('Solange Uwimana')).toBeTruthy());
    // Two seats are working, which is what makes "{count} working now" worth
    // printing — so this is `getAllByText`, deliberately.
    expect(screen.getAllByText(en['staff.state.active'])).toHaveLength(2);
    expect(screen.getByText(en['staff.state.invited'])).toBeTruthy();
    // A revoked seat stays on the list: the audit question is who USED to have
    // access, which a list that removed the row cannot answer.
    expect(screen.getByText(en['staff.state.suspended'])).toBeTruthy();
  });

  it('the subscription says what the plan includes, not only what it costs', () => {
    renderInScheme(seat(<SubscriptionScreen />, 'landlord'), scheme);
    expect(screen.getByText(en['plan.growth'])).toBeTruthy();
    expect(screen.getByText(en['plan.rraFiling'])).toBeTruthy();
    expect(screen.getByText(en['subscription.adapterMock'])).toBeTruthy();
  });

  it('reveal credits leads with the log, which is the security control', () => {
    renderInScheme(seat(<RevealCreditsScreen />, 'broker'), scheme);
    expect(screen.getByText(en['credits.logTitle'])).toBeTruthy();
    expect(screen.getByText(en['credits.retentionNote'])).toBeTruthy();
  });

  it('personal details prints what a stranger sees beside what you typed', () => {
    renderInScheme(seat(<PersonalDetailsScreen />, 'tenant'), scheme);
    expect(screen.getByText(ME.name)).toBeTruthy();
    // F-S12 §6, made checkable rather than promised.
    expect(screen.getByText('Samuel K.')).toBeTruthy();
  });

  it('security lists the devices and marks the one that cannot be revoked', async () => {
    renderInScheme(seat(<SecurityScreen />, 'tenant'), scheme);
    await waitFor(() => expect(screen.getByText('iPhone 13 · Injishi')).toBeTruthy());
    expect(screen.getByText(en['security.thisDevice'])).toBeTruthy();
    expect(screen.getByText(en['security.revokeAll'])).toBeTruthy();
  });

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

  it('sign out names how many workspaces it is leaving', () => {
    renderInScheme(seat(<SignOutSheet />, 'landlord'), scheme);
    // Five seats, one parked: the sentence counts the switchable ones.
    expect(screen.getByText(fill('signOut.scope', { count: 4 }))).toBeTruthy();
    expect(screen.getByText(en['signOut.confirm'])).toBeTruthy();
  });

  it('creating a workspace prints the URL rather than promising a screen', () => {
    renderInScheme(seat(<CreateWorkspaceSheet />, 'tenant'), scheme);
    expect(screen.getByText(ONBOARDING_URL)).toBeTruthy();
    expect(screen.getByText(en['createWorkspace.needTin'])).toBeTruthy();
  });
});

/* ------------------------------------------------------- the RW catalogue */

describe('the Kinyarwanda catalogue', () => {
  it('renders Account for every seat with rw active and no English left', () => {
    for (const surface of ['guest', 'tenant', 'landlord', 'broker', 'work'] as const) {
      const view = renderInScheme(seat(<Account />, surface), 'light', { locale: 'rw' });
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

    renderInScheme(seat(<SignOutSheet />, 'landlord'), 'light', { locale: 'rw' });
    expect(
      screen.getByText(rw['signOut.scope'].replace('{count}', '4')),
    ).toBeTruthy();
  });
});
