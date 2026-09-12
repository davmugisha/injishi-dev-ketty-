/**
 * The eight Landlord screens, in both schemes, plus the three writes end to end.
 *
 * The assertions are about behaviour a reader can see rather than about
 * styling, and they concentrate on the two things this surface can get wrong in
 * a way nothing else would catch:
 *
 *   - **A mocked success looking like a real one.** Recording a payment has to
 *     stamp the row `Paid · mock` and say so in the toast, and the adapter chip
 *     has to be on the screen before the figures are. Those are three separate
 *     assertions on purpose: they are three separate places the honesty can
 *     fall out, and the product rule (`ui-rules.md` § Adapter Awareness) needs
 *     all three.
 *   - **A write that only moves the screen it was made on.** Every mutation
 *     here goes through `useFixtureMutation` into the shared store, so the
 *     rent-roll test asserts the ROW changed rather than that a toast appeared,
 *     and the contract test asserts the LEASE changed state rather than that
 *     the button was pressable.
 *
 * The four list states are covered per list: the skeleton by its accessibility
 * label while the read is in flight, the empty by filtering to a state nothing
 * is in, the rows by their content. The error branch is written in every screen
 * and is unreachable without a throwing fixture, which is the same position
 * every other list in this app is in.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { RentRoll } from './rent-roll';
import { LandlordLeases } from './leases';
import { Maintenance } from './maintenance';
import { RegisterTenant } from './register-tenant';
import { LandlordLeaseDetail } from './lease-detail';
import { LandlordContract } from './contract';
import { LandlordCaution } from './caution';
import { LandlordFiling } from './filing';
import { RecordPayment } from './record-payment';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import {
  MUTATION_LATENCY_MS,
  readFixture,
  resetFixtures,
  writeFixture,
} from '@/data/use-fixture-mutation';
import { FIXTURE_LATENCY_MS } from '@/data/use-fixture';
import * as landlordData from '@/data/landlord';
import {
  LEASES_KEY,
  RENT_PERIOD,
  RENT_ROLL_KEY,
  REPAIRS_KEY,
  applyFileRepair,
  rentTotals,
  seedLeases,
  seedRentRoll,
  seedRepairs,
  shortMoney,
  type LandlordLease,
  type RentRow,
  type RepairTicket,
} from '@/data/landlord';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));

/**
 * The rent roll reads the API now (ADR-038 child 0 task 9), so these two mocks
 * stand where the network is.
 *
 * The workspace is fixed rather than resolved, because `WorkspaceProvider`
 * fetches `/me/workspaces` and none of these tests is about that call. What
 * they need from it is the one thing the rent roll asks for: an id, so the
 * query is enabled and its key is stable.
 */
jest.mock('@/workspace', () => {
  const state = {
    workspaces: [],
    active: null,
    activeWorkspaceId: 'de300000-0000-4000-8000-000000000202',
    permissions: [],
    twoFactor: { required: false, verified: true },
    isResolving: false,
    error: null,
    switchTo: jest.fn(async () => true),
    refetch: jest.fn(),
  };
  // Both accessors answer from ONE object. `DomainProvider` reads the optional
  // form (see `useOptionalWorkspace`) and the screens read the throwing one, so
  // a mock that supplied only one of them would leave the provider above these
  // screens holding `undefined` and crash on mount rather than fail on an
  // assertion.
  return { useWorkspace: () => state, useOptionalWorkspace: () => state };
});

/**
 * The query reads the fixture STORE rather than a constant.
 *
 * That is what keeps the "record a payment, then read it back on the roll"
 * tests meaningful: they write through `writeFixture` and re-render expecting
 * the roll to have moved. Answering from a frozen copy of the seed would make
 * both of them pass while proving nothing. When child 1 rebinds the landlord
 * writes to real mutations, this mock is what it replaces.
 */
jest.mock('@/queries/landlord', () => ({
  fetchRentRoll: jest.fn(async () => {
    const { readFixture } = require('@/data/use-fixture-mutation');
    const { RENT_ROLL_KEY, seedRentRoll } = require('@/data/landlord');
    return readFixture(RENT_ROLL_KEY, seedRentRoll());
  }),
}));

/**
 * Both providers are real. Every landlord screen reads the active workspace for
 * its eyebrow, and three of them raise a toast — a toast that never mounts is
 * one of the assertions this file most wants to make.
 */
const asLandlord = (ui: ReactElement) => (
  <DomainProvider initial="residence" initialSurface="landlord">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

/** Frame R1's own figures, derived rather than transcribed. */
const TOTALS = rentTotals(seedRentRoll());

const ERIC = seedLeases().find((l) => l.id === 'l-0142') as LandlordLease;
const DIANE = seedLeases().find((l) => l.id === 'l-0129') as LandlordLease;
const JOSIANE = seedLeases().find((l) => l.id === 'l-0176') as LandlordLease;
const OVERDUE = seedRentRoll().find((r) => r.state === 'overdue') as RentRow;

const fill = (key: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce<string>(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    en[key as keyof typeof en],
  );

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  resetFixtures();
});

/**
 * A write started by one test lands 300ms later, which is after the next test
 * has mounted. Clearing the store before that write arrives does not stop it:
 * it writes the OLD test's value into the NEW test's store, halfway through. So
 * the flush comes first and the reset after it.
 */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 60));
  });
  resetFixtures();
});

/* ─────────────────────────────────────────────────── The cold read ──── */

/**
 * `useFixture` warms a key for the rest of the session on its first read, which
 * is the point — a query cache behaves the same way, and re-skeletoning a
 * screen you navigated back to would be wrong. It also means the skeleton can
 * only be observed ONCE per key per file, so these three cases live here rather
 * than inside the `describe.each` blocks below, and they have to run first.
 */
describe('A list that has not been read yet', () => {
  it('skeletons the rent roll rather than showing an empty one', () => {
    renderInScheme(asLandlord(<RentRoll />), 'light');
    expect(
      screen.getByLabelText(fill('state.loadingList', { label: en['landlord.rent.listLabel'] })),
    ).toBeTruthy();
  });

  it('skeletons the leases', () => {
    renderInScheme(asLandlord(<LandlordLeases />), 'light');
    expect(
      screen.getByLabelText(fill('state.loadingList', { label: en['landlord.leases.listLabel'] })),
    ).toBeTruthy();
  });

  it('skeletons the maintenance list', () => {
    renderInScheme(asLandlord(<Maintenance />), 'light');
    expect(
      screen.getByLabelText(
        fill('state.loadingList', { label: en['landlord.repairs.listLabel'] }),
      ),
    ).toBeTruthy();
  });
});

/* ───────────────────────────────────────────────── R1 · R2 Rent roll ──── */

describe.each(SCHEMES)('Rent roll in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());

  it('admits the adapter is mocked before it prints a single figure', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    expect(screen.getByText(en['landlord.mockAdapter'])).toBeTruthy();
    expect(screen.getByText(en['landlord.rent.footnote'])).toBeTruthy();
    await settled();
  });

  it('draws R1’s three tiles and the month they are about', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    // The month is the screen's own, so it is on the first frame.
    expect(screen.getByText(RENT_PERIOD)).toBeTruthy();
    // The figures are not. Since ADR-038 child 0 they are totalled from rows
    // that arrive over the network, so they land with the rows and not before —
    // which is exactly why the adapter chip test above asserts the chip is up
    // BEFORE any figure is: that ordering is now real rather than incidental.
    await settled();
    // 1.24M collected · 380K due · 120K overdue — frame R1, to the digit.
    expect(screen.getByText(shortMoney(TOTALS.collected))).toBeTruthy();
    expect(screen.getByText(shortMoney(TOTALS.due))).toBeTruthy();
    expect(screen.getByText(shortMoney(TOTALS.overdue))).toBeTruthy();
  });

  it('reports the collection percentage to a reader who cannot see the bar', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    expect(
      screen.getByLabelText(
        fill('landlord.rent.progressLabel', { month: RENT_PERIOD, percent: TOTALS.percent }),
      ),
    ).toBeTruthy();
  });

  it('puts the action only on a row that needs one', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    // Two due plus one overdue carry Remind; the four paid rows carry nothing.
    expect(screen.getAllByText(en['landlord.rent.remind'])).toHaveLength(3);
    expect(screen.getAllByText(en['landlord.rent.record'])).toHaveLength(3);
  });

  it('toasts the reminder as a mock rather than as a sent message', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    fireEvent.press(
      screen.getByLabelText(fill('landlord.rent.remindA11y', { name: OVERDUE.name })),
    );
    expect(
      screen.getByText(fill('landlord.rent.reminderSent', { name: OVERDUE.name })),
    ).toBeTruthy();
  });

  it('gives an empty filter its own reason instead of a bare zero', async () => {
    // Nothing is overdue once the roll is fully settled.
    writeFixture(
      RENT_ROLL_KEY,
      seedRentRoll().map((r) => ({ ...r, state: 'paid' as const, on: 'Aug 01' })),
    );
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    fireEvent.press(screen.getByText(`${en['landlord.rent.filterOverdue']} · 0`));
    expect(screen.getByText(en['landlord.rent.emptyOverdueTitle'])).toBeTruthy();
    expect(
      screen.getByText(fill('landlord.rent.emptyOverdueBody', { month: RENT_PERIOD })),
    ).toBeTruthy();
  });
});

/* ───────────────────────────────────────── R1's sheet · Record payment ──── */

describe('Recording a payment', () => {
  /**
   * Put the roll in the store before the sheet writes to it.
   *
   * These two used to pass without this, because the rent roll screen read
   * through `useFixture`, which WARMS a key on first read — so by the time this
   * block ran, some earlier test had seeded the store as a side effect. Since
   * ADR-038 child 0 task 9 the roll comes from the API instead, that side effect
   * is gone, and the tests were relying on it: both fail on their own at the
   * commit before this one too, which is how the dependency came to light.
   *
   * Setting it up explicitly is the fix rather than the workaround. A test that
   * asserts a write moved a row should be the thing that decides what the row
   * was, instead of inheriting it from whichever test happened to run first.
   */
  beforeEach(() => {
    writeFixture(RENT_ROLL_KEY, seedRentRoll());
  });

  /**
   * Wait for the sheet to know which row it is about.
   *
   * `RecordPayment` still reads through `useFixture`, which resolves after
   * `FIXTURE_LATENCY_MS` unless the key is already warm — and `useFixture`
   * keeps its OWN warm set, which `writeFixture` above does not touch. Until it
   * settles, `row` is undefined and confirming records a payment against
   * nothing, silently.
   *
   * The roll used to warm that key as a side effect of an earlier test
   * rendering it. Task 9 moved the roll onto the API, so nothing warms it any
   * more and the wait has to be stated. Both of these tests fail on their own
   * at the commit before this one too, for the same reason.
   */
  const rowLoaded = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, FIXTURE_LATENCY_MS + 40));
    });

  it('stamps the row mock, in the store and not only on the screen', async () => {
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.record.confirm'])).toBeTruthy());
    await rowLoaded();

    // The disclosure is on the sheet before the button is.
    expect(screen.getByText(en['landlord.record.warnTitle'])).toBeTruthy();
    expect(screen.getByText(en['landlord.record.warnBody'])).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText(en['landlord.record.confirm']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const rows = readFixture<RentRow[]>(RENT_ROLL_KEY, seedRentRoll());
    const row = rows.find((r) => r.leaseId === OVERDUE.leaseId);
    expect(row?.state).toBe('paid');
    expect(row?.mock).toBe(true);
    expect(mockBack).toHaveBeenCalled();
  });

  it('reads back on the roll as “Paid · mock”, never as a settled payment', async () => {
    writeFixture(
      RENT_ROLL_KEY,
      seedRentRoll().map((r) =>
        r.leaseId === OVERDUE.leaseId ? { ...r, state: 'paid' as const, mock: true } : r,
      ),
    );
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());
    expect(screen.getByText(en['landlord.rent.chipPaidMock'])).toBeTruthy();
  });

  it('says so rather than writing to nothing when the row has gone', async () => {
    renderInScheme(asLandlord(<RecordPayment leaseId="not-a-lease" />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.record.goneTitle'])).toBeTruthy());
  });
});

/* ───────────────────────────────────────────────────────── R3 · Leases ──── */

describe.each(SCHEMES)('Leases in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());

  it('puts the lease waiting on the landlord at the top of the list', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    // The draft is the only row carrying the signing action.
    expect(screen.getByText(en['landlord.leases.actionSign'])).toBeTruthy();
    // …and the ending lease with no notice against it is the only renewal.
    expect(screen.getByText(en['landlord.leases.actionRenew'])).toBeTruthy();
  });

  it('offers no renewal on a lease that has already given notice', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.changeText(screen.getByLabelText(en['landlord.leases.search']), 'C1');
    expect(screen.getByText(/Diane I\./)).toBeTruthy();
    expect(screen.queryByText(en['landlord.leases.actionRenew'])).toBeNull();
  });

  it('narrows on a unit as readily as on a name', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.changeText(screen.getByLabelText(en['landlord.leases.search']), 'B1');
    expect(screen.getByText(/Grace M\./)).toBeTruthy();
    expect(screen.queryByText(/Eric T\./)).toBeNull();
  });

  it('tells a search miss apart from a state with nothing in it', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.changeText(screen.getByLabelText(en['landlord.leases.search']), 'zzzz');
    expect(screen.getByText(en['landlord.leases.emptySearchTitle'])).toBeTruthy();

    // Two controls carry this label on purpose — the field's own clear, and the
    // empty state's way out. Either does the job; the field's is the first.
    fireEvent.press(screen.getAllByLabelText(en['landlord.leases.clearSearch'])[0]);
    fireEvent.press(screen.getByText(`${en['landlord.leases.filterPending']} · 0`));
    expect(screen.getByText(en['landlord.leases.emptyPendingTitle'])).toBeTruthy();
  });

  it('routes the draft’s action into the contract rather than signing in place', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.press(screen.getByText(en['landlord.leases.actionSign']));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lease/[leaseId]/contract',
      params: { leaseId: JOSIANE.id },
    });
  });
});

/* ──────────────────────────────────────────────────── R4 · Maintenance ──── */

describe.each(SCHEMES)('Maintenance in the %s scheme', (scheme) => {
  const settled = () =>
    waitFor(() => expect(screen.getByText('Leaking kitchen tap')).toBeTruthy());

  it('says where a seeded ticket’s photographs are instead of borrowing one', async () => {
    renderInScheme(asLandlord(<Maintenance />), scheme);
    await settled();
    expect(
      screen.getByText(
        new RegExp(
          fill('landlord.repairs.photoCount', { count: 2, reporter: 'Diane I.' }).replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          ),
        ),
      ),
    ).toBeTruthy();
  });

  it('assigns a ticket into the store and toasts the technician by name', async () => {
    renderInScheme(asLandlord(<Maintenance />), scheme);
    await settled();

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          fill('landlord.repairs.assignA11y', { ref: 'T-204', title: 'Leaking kitchen tap' }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const tickets = readFixture<RepairTicket[]>(REPAIRS_KEY, seedRepairs());
    expect(tickets.find((k) => k.ref === 'T-204')?.state).toBe('assigned');
    expect(
      screen.getByText(fill('landlord.repairs.assignedToast', { ref: 'T-204', name: 'Innocent M.' })),
    ).toBeTruthy();
  });

  it('shows a ticket the tenant surface filed, which is the whole hand-off', async () => {
    // Exactly the call frame R20 (session 7) makes.
    writeFixture(
      REPAIRS_KEY,
      applyFileRepair(seedRepairs(), {
        title: 'Shower runs cold',
        unit: 'Unit A2',
        reporter: 'Eric T.',
        severity: 'urgent',
      }),
    );
    renderInScheme(asLandlord(<Maintenance />), scheme);
    await settled();
    expect(screen.getByText('Shower runs cold')).toBeTruthy();
    // Minted here, never by the caller, so two surfaces cannot collide.
    expect(screen.getByText('T-208')).toBeTruthy();
  });

  it('gives each empty filter its own reason', async () => {
    renderInScheme(asLandlord(<Maintenance />), scheme);
    await settled();
    fireEvent.press(screen.getByText(`${en['landlord.repairs.filterResolved']} · 1`));
    expect(screen.getByText('Gate motor jammed')).toBeTruthy();

    // Emptying the store leaves the reader ON the resolved filter, so the
    // reason they get is that filter's, not the generic one.
    writeFixture(REPAIRS_KEY, []);
    await waitFor(() =>
      expect(screen.getByText(en['landlord.repairs.emptyResolvedTitle'])).toBeTruthy(),
    );

    fireEvent.press(screen.getByText(`${en['landlord.repairs.filterAll']} · 0`));
    expect(screen.getByText(en['landlord.repairs.emptyAllTitle'])).toBeTruthy();
  });
});

/* ────────────────────────────────────────────────── R7 · Lease detail ──── */

describe.each(SCHEMES)('Lease detail, landlord seat, in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(ERIC.tenant)).toBeTruthy());

  it('indexes the four records rather than restating them', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id={ERIC.id} />), scheme);
    await settled();
    expect(screen.getByText(ERIC.ref)).toBeTruthy();
    expect(screen.getByText(en['landlord.lease.rowContract'])).toBeTruthy();
    expect(screen.getByText(en['landlord.lease.rowCaution'])).toBeTruthy();
    expect(screen.getByText(en['landlord.lease.rowFiling'])).toBeTruthy();
    expect(screen.getByText(en['landlord.lease.rowRent'])).toBeTruthy();
  });

  it('prints this month’s real standing rather than a next-due it does not hold', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id={ERIC.id} />), scheme);
    await settled();
    expect(
      screen.getByText(`${RENT_PERIOD} · ${fill('landlord.rent.chipPaid', { date: 'Aug 01' })}`),
    ).toBeTruthy();
  });

  it('opens the tenant’s visitor log read only, and says which seat is asking', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id={ERIC.id} />), scheme);
    await settled();
    fireEvent.press(
      screen.getByLabelText(fill('landlord.lease.visitorsA11y', { name: ERIC.tenant })),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lease/[leaseId]/visitors',
      params: { leaseId: ERIC.id, seat: 'landlord' },
    });
  });

  it('offers a way back rather than a dead end on a lease that is not here', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id="not-a-lease" />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.notFoundTitle'])).toBeTruthy());
    fireEvent.press(screen.getByText(en['landlord.backToLeases']));
    expect(mockReplace).toHaveBeenCalledWith('/leases');
  });
});

/* ──────────────────────────────────────────────── R8 · Contract & sign ──── */

describe.each(SCHEMES)('Contract in the %s scheme', (scheme) => {
  it('holds the primary shut until there is ink on the pad', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());
    expect(screen.getByLabelText(en['landlord.contract.blocked'])).toBeTruthy();
    expect(screen.queryByLabelText(en['landlord.contract.confirm'])).toBeNull();
  });

  it('prints the consequence under the button rather than after it', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());
    expect(
      screen.getByText(fill('landlord.contract.consequence', { tenant: JOSIANE.tenant })),
    ).toBeTruthy();
    expect(screen.getByText(en['landlord.contract.footnote'])).toBeTruthy();
  });

  it('draws the tenant as awaiting on a lease only the landlord has signed', async () => {
    writeFixture(
      LEASES_KEY,
      seedLeases().map((l) =>
        l.id === JOSIANE.id
          ? { ...l, state: 'pending_signature' as const, landlordSignedOn: '2 Aug 2026' }
          : l,
      ),
    );
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());
    expect(screen.getByText(en['landlord.contract.awaiting'])).toBeTruthy();
    expect(
      screen.getByText(fill('landlord.contract.signedOn', { date: '2 Aug 2026' })),
    ).toBeTruthy();
    // Nothing left to do here, so no primary and no pad.
    expect(screen.queryByLabelText(en['landlord.contract.blocked'])).toBeNull();
  });

  it('says the contract is immutable once both parties have signed', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={ERIC.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.contract.bothSigned'])).toBeTruthy());
  });
});

describe('Signing as landlord', () => {
  it('moves the lease to pending signature in the store, and toasts', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());

    // Ink the pad the way a finger does: down, then a drag past the pad's
    // 1.6pt minimum step. `touchHistory` is not optional — PanResponder reads
    // the centroid off it to build `gestureState` BEFORE it calls the pad's own
    // handler, and an event without one crashes inside `TouchHistoryMath`.
    const touch = (x: number, y: number) => ({
      nativeEvent: { locationX: x, locationY: y, touches: [], changedTouches: [] },
      touchHistory: {
        touchBank: [],
        numberActiveTouches: 0,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 0,
      },
    });

    const pad = screen.getByLabelText(en['sign.padLabel']);
    fireEvent(pad, 'responderGrant', touch(20, 90));
    fireEvent(pad, 'responderMove', touch(120, 100));

    await waitFor(() =>
      expect(screen.getByLabelText(en['landlord.contract.confirm'])).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.contract.confirm']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const leases = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases());
    const signed = leases.find((l) => l.id === JOSIANE.id);
    expect(signed?.state).toBe('pending_signature');
    expect(signed?.landlordSignedOn).toBeTruthy();
    // The row's action follows the state: it is now the tenant who is late.
    expect(signed?.action).toBe('nudge');
  });
});

/* ───────────────────────────────────────────────── R9 · Caution deposit ──── */

describe.each(SCHEMES)('Caution in the %s scheme', (scheme) => {
  const settled = () =>
    waitFor(() => expect(screen.getByText(en['landlord.caution.held'])).toBeTruthy());

  it('draws the move-out banner only where a notice has actually been filed', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), scheme);
    await settled();
    expect(screen.getByText(en['landlord.caution.noticeTitle'])).toBeTruthy();
  });

  it('refuses to settle a tenancy that is still running, and says why', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={ERIC.id} />), scheme);
    await settled();
    expect(screen.queryByText(en['landlord.caution.noticeTitle'])).toBeNull();
    expect(screen.getByText(en['landlord.caution.lockedNote'])).toBeTruthy();
  });

  it('never calls it a security deposit', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), scheme);
    await settled();
    expect(screen.queryByText(/security deposit/i)).toBeNull();
    expect(screen.getByText(en['landlord.caution.escrowNote'])).toBeTruthy();
  });
});

describe('Settling a caution', () => {
  it('refunds in full, writes `refunded`, and names the amount in the toast', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.caution.held'])).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.caution.refundAction']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const lease = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases()).find(
      (l) => l.id === DIANE.id,
    );
    expect(lease?.caution.state).toBe('refunded');
    expect(lease?.caution.settledOn).toBeTruthy();
  });

  it('will not settle a deduction without the reason the tenant reads', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.caution.held'])).toBeTruthy());
    fireEvent.press(screen.getByLabelText(en['landlord.caution.deductAction']));

    expect(screen.getByText(en['landlord.caution.sheetBody'])).toBeTruthy();
    // An amount with no reason is exactly the case the sheet is here to stop.
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.caution.amount']}, RWF`), '40000');
    expect(screen.getByLabelText(en['landlord.caution.sheetBlocked'])).toBeTruthy();
  });

  it('records the deduction and the reason, and forfeits only that part', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await waitFor(() => expect(screen.getByText(en['landlord.caution.held'])).toBeTruthy());
    fireEvent.press(screen.getByLabelText(en['landlord.caution.deductAction']));

    fireEvent.changeText(
      screen.getByLabelText(en['landlord.caution.reason']),
      'Repaint the bedroom wall',
    );
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.caution.amount']}, RWF`), '40000');

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          fill('landlord.caution.sheetConfirmA11y', {
            amount: 'RWF 40,000',
            returns: 'RWF 240,000',
            tenant: DIANE.tenant,
          }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const lease = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases()).find(
      (l) => l.id === DIANE.id,
    );
    expect(lease?.caution.state).toBe('forfeited');
    expect(lease?.caution.deductions).toEqual([
      { label: 'Repaint the bedroom wall', amount: 40000 },
    ]);
  });
});

/* ────────────────────────────────────────────────────── R10 · Filing ──── */

describe.each(SCHEMES)('Filing in the %s scheme', (scheme) => {
  it('leads with the acknowledgement and the clock it met', async () => {
    renderInScheme(asLandlord(<LandlordFiling leaseId={ERIC.id} />), scheme);
    // Twice, on purpose: the hero is the number a landlord copies out, and the
    // timeline is the record of when it arrived.
    await waitFor(() => expect(screen.getAllByText('RRA-2026-04412')).toHaveLength(2));
    expect(screen.getByText(en['landlord.filing.adapterMet'])).toBeTruthy();
    expect(
      screen.getByText(fill('landlord.filing.filedLine', { date: '14 Jan 2026', days: 2 })),
    ).toBeTruthy();
  });

  it('says a lease with no second signature is waiting rather than filed', async () => {
    renderInScheme(asLandlord(<LandlordFiling leaseId={JOSIANE.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.filing.pendingTitle'])).toBeTruthy());
    expect(screen.getByText(en['landlord.filing.stepAwaiting'])).toBeTruthy();
    expect(screen.getByText(en['landlord.filing.adapterWaiting'])).toBeTruthy();
  });

  it('surfaces a failure with its retry rather than dropping it silently', async () => {
    writeFixture(
      LEASES_KEY,
      seedLeases().map((l) =>
        l.id === ERIC.id
          ? {
              ...l,
              filing: { ...l.filing, state: 'failed' as const, failure: 'Channel refused' },
            }
          : l,
      ),
    );
    renderInScheme(asLandlord(<LandlordFiling leaseId={ERIC.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.filing.failedTitle'])).toBeTruthy());
    expect(screen.getByText(en['landlord.filing.failedBody'])).toBeTruthy();
    expect(screen.getByText(en['landlord.filing.retry'])).toBeTruthy();
    expect(screen.getByText('Channel refused')).toBeTruthy();
  });

  it('states the two business rules a landlord must not get wrong', async () => {
    renderInScheme(asLandlord(<LandlordFiling leaseId={ERIC.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.filing.note'])).toBeTruthy());
  });
});

/* ───────────────────────────────────────────── R6 · Register tenant ──── */

describe.each(SCHEMES)('Register tenant in the %s scheme', (scheme) => {
  it('names the broker and the fee before the lease exists', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    expect(
      screen.getByText(
        fill('landlord.new.placementTitle', { broker: landlordData.THIRD_PARTY_BROKER }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(en['landlord.new.placementFeeLabel'])).toBeTruthy();
  });

  it('opens blank with no banner when no broker placed the tenant', async () => {
    // FL20 path C. The banner is conditional, so the form has to render both
    // ways — and a form nobody has seen empty is a form with an unproven
    // empty state.
    const spy = jest.spyOn(landlordData, 'readPendingPlacement').mockReturnValue(null);
    try {
      renderInScheme(asLandlord(<RegisterTenant />), scheme);
      expect(screen.queryByText(en['landlord.new.placementFeeLabel'])).toBeNull();
      // Blank, and therefore blocked, with the reason on the button.
      expect(screen.getByLabelText(en['landlord.new.blocked'])).toBeTruthy();
      // The unit selector still defaults to the first vacant unit, so the
      // landlord is never asked to pick from nothing.
      expect(screen.getByLabelText('Unit B2, 2-bedroom')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('offers only units with no live lease on them', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    expect(screen.getByLabelText('Unit B2, 2-bedroom')).toBeTruthy();
    // A2 is Eric T.'s and must not be offered a second tenant.
    expect(screen.queryByLabelText(/^Unit A2/)).toBeNull();
  });

  it('blocks the primary and names each bad field once you have tried', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    fireEvent.changeText(screen.getByLabelText(en['landlord.new.name']), '');
    fireEvent.press(screen.getByLabelText(en['landlord.new.blocked']));
    expect(screen.getByText(en['landlord.new.nameError'])).toBeTruthy();
  });

  it('rejects a national ID that is not sixteen digits', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    fireEvent.changeText(screen.getByLabelText(en['landlord.new.nid']), '119948');
    fireEvent.press(screen.getByLabelText(en['landlord.new.blocked']));
    expect(screen.getByText(en['landlord.new.nidError'])).toBeTruthy();
  });
});

describe('Creating a lease', () => {
  it('writes a draft and hands off to its contract, which is where signing lives', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), 'light');
    await waitFor(() => expect(screen.getByLabelText(en['landlord.new.create'])).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.new.create']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const leases = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases());
    const created = leases[0];
    expect(leases).toHaveLength(seedLeases().length + 1);
    expect(created.tenant).toBe('Liliane Mukamurenzi');
    expect(created.unit).toBe('Unit B2');
    // FL20 step 1 creates a DRAFT. The tenant hears nothing until step 3.
    expect(created.state).toBe('draft');
    // Not this account's own brokerage: a placement fee between two seats of
    // one identity is not a fee. See the header of `src/data/landlord.ts`.
    expect(created.placement).toEqual({
      broker: landlordData.THIRD_PARTY_BROKER,
      fee: 140000,
    });
    expect(created.placement?.broker).not.toBe('Aline K.');

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/lease/[leaseId]/contract',
      params: { leaseId: created.id },
    });
  });
});
