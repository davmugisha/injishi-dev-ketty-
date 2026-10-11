/**
 * The eight Landlord screens, in both schemes, plus the writes end to end.
 *
 * The assertions are about behaviour a reader can see rather than about
 * styling, and they concentrate on the things this surface can get wrong in a
 * way nothing else would catch:
 *
 *   - **A claim the screen cannot back.** The rent roll is a real ledger, so it
 *     says what recording does (a ledger entry, no money moved) instead of
 *     calling itself a mock; its month comes from the rows, never a constant;
 *     and no action reports a message, a refund, a signature or a lease that
 *     did not happen (mobile audit 2026-10-05).
 *   - **A write that reports the render before it.** Every write here is
 *     forced to fail at least once, and the test asserts the screen stays put
 *     and says so. Branching on a status read after `await` toasted success
 *     over every one of those failures (gaps.md §0.3).
 *   - **A write that only moves the screen it was made on.** Every mutation
 *     goes through `useFixtureMutation` into the shared store, so the tests
 *     assert the ROW changed rather than that a toast appeared.
 *
 * The four list states are covered per list: the skeleton by its accessibility
 * label while the read is in flight, the empty by filtering to a state nothing
 * is in, the rows by their content, and the error by a read forced to fail.
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
import { ToastProvider, todayIso } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import type { MessageKey, Translate } from '@/i18n/i18n';
import { ApiError } from '@/lib/api';
import { MUTATION_LATENCY_MS, readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import * as landlordData from '@/data/landlord';
import {
  LEASES_KEY,
  RENT_ROLL_KEY,
  REPAIRS_KEY,
  applyFileRepair,
  dayStamp,
  newestPerLease,
  periodLabel,
  rentTotals,
  rollPeriodLabel,
  seedLeases,
  seedRentRoll,
  seedRepairs,
  shortMoney,
  type LandlordLease,
  type PendingPlacement,
  type RentRow,
  type RepairTicket,
} from '@/data/landlord';
import { ME } from '@/data/personas';

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
    // `periodMonth` is what an API row carries and the record sheet needs.
    return readFixture(RENT_ROLL_KEY, seedRentRoll()).map((r: { periodMonth?: string }) => ({
      ...r,
      periodMonth: r.periodMonth ?? '2026-08-01',
    }));
  }),
  /**
   * Stands where `POST /ops/leases/:id/rent` is. It writes the store the
   * mocked roll reads, so "the row moved" is still asserted on the roll's own
   * source rather than on a toast.
   */
  recordPaymentHandler: jest.fn(async (intent: { leaseId: string }) => {
    const { readFixture, writeFixture } = require('@/data/use-fixture-mutation');
    const { RENT_ROLL_KEY, seedRentRoll, applyRecordPayment } = require('@/data/landlord');
    writeFixture(
      RENT_ROLL_KEY,
      applyRecordPayment(readFixture(RENT_ROLL_KEY, seedRentRoll()), { leaseId: intent.leaseId, on: 'Aug 04' }),
    );
    return { status: 'ok' };
  }),
}));

const queries = jest.requireMock('@/queries/landlord') as {
  fetchRentRoll: jest.Mock;
  recordPaymentHandler: jest.Mock;
};
const recordPaymentHandler = queries.recordPaymentHandler;

/**
 * Who is holding the phone, as `useMyIdentity` reports it. Mutable so a test
 * can be a named account, an unnamed one or one still loading; reset to "no
 * name on file" before every test, which is also what an unsigned render gets.
 */
const NO_NAME = { name: '', initials: '', phone: '', fromServer: false, pending: false };
const mockIdentity = { ...NO_NAME };
jest.mock('@/queries/profile', () => ({
  ...jest.requireActual('@/queries/profile'),
  useMyIdentity: () => mockIdentity,
}));

/**
 * Both providers are real. Every landlord screen reads the active workspace for
 * its eyebrow, and several of them raise a toast — a toast that never mounts is
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

/** The English catalogue as a `Translate`, for the pure helpers. */
const tEn: Translate = (key: MessageKey, values = {}) => fill(key, values);

/** The fixture roll's month, named the way the screen names it. */
const AUGUST = `${en['calendar.m8']} 2026`;
const OCTOBER = `${en['calendar.m10']} 2026`;

/** Today, stamped the way a signature or a settlement is. */
const todayStamp = () => dayStamp(todayIso(), tEn);

/** Lets a fixture write (300ms) land, inside `act`. */
const settleWrite = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
  });

/**
 * Two leases over two months, one of them part paid: what a real workspace's
 * roll returns once the server bills more than one month. Newest first, as the
 * server sorts it.
 */
const MULTI_MONTH: RentRow[] = [
  {
    leaseId: 'lease-b',
    initials: 'CM',
    name: 'Chantal Mukamana',
    unit: 'C1',
    amount: 410000,
    paidAmount: 150000,
    state: 'overdue',
    days: 3,
    periodMonth: '2026-10-01',
  },
  {
    leaseId: 'lease-a',
    initials: 'EH',
    name: 'Eric Habimana',
    unit: 'B1',
    amount: 520000,
    paidAmount: 0,
    state: 'due',
    on: '28 Oct',
    periodMonth: '2026-10-01',
  },
  {
    leaseId: 'lease-a',
    initials: 'EH',
    name: 'Eric Habimana',
    unit: 'B1',
    amount: 520000,
    paidAmount: 520000,
    state: 'paid',
    on: '03 Sep',
    periodMonth: '2026-09-01',
  },
];

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  Object.assign(mockIdentity, NO_NAME);
  resetFixtures();
});

/**
 * A write started by one test lands 300ms later, which is after the next test
 * has mounted. Clearing the store before that write arrives does not stop it:
 * it writes the OLD test's value into the NEW test's store, halfway through. So
 * the flush comes first and the reset after it. Spies come off here too, so a
 * test that forced a failure cannot fail the next one.
 */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 60));
  });
  jest.restoreAllMocks();
  resetFixtures();
});

/* ─────────────────────────────────────────────────── The cold read ──── */

/**
 * `useFixture` warms a key for the rest of the session on its first read, which
 * is the point — a query cache behaves the same way, and re-skeletoning a
 * screen you navigated back to would be wrong. It also means the skeleton can
 * only be observed ONCE per key per file, so these cases live here rather
 * than inside the `describe.each` blocks below, and they have to run first.
 *
 * Each also asserts the header states no zero while it waits: "All · 0" over a
 * list still loading is a count of nothing, stated as a fact (LL-12).
 */
describe('A list that has not been read yet', () => {
  it('skeletons the rent roll rather than showing an empty one', () => {
    renderInScheme(asLandlord(<RentRoll />), 'light');
    expect(
      screen.getByLabelText(fill('state.loadingList', { label: en['landlord.rent.listLabel'] })),
    ).toBeTruthy();
  });

  it('skeletons the leases, with chips that count nothing yet', () => {
    renderInScheme(asLandlord(<LandlordLeases />), 'light');
    expect(
      screen.getByLabelText(fill('state.loadingList', { label: en['landlord.leases.listLabel'] })),
    ).toBeTruthy();
    expect(screen.getByText(en['landlord.leases.filterAll'])).toBeTruthy();
    expect(screen.queryByText(`${en['landlord.leases.filterAll']} · 0`)).toBeNull();
    expect(screen.queryByText(`${en['landlord.leases.filterDraft']} · 0`)).toBeNull();
  });

  it('skeletons the maintenance list, with no summary and no counts yet', () => {
    renderInScheme(asLandlord(<Maintenance />), 'light');
    expect(
      screen.getByLabelText(
        fill('state.loadingList', { label: en['landlord.repairs.listLabel'] }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/0 open/)).toBeNull();
    expect(screen.getByText(en['landlord.repairs.filterOpen'])).toBeTruthy();
    expect(screen.queryByText(`${en['landlord.repairs.filterOpen']} · 0`)).toBeNull();
  });
});

/* ───────────────────────────────────────────────── R1 · R2 Rent roll ──── */

describe.each(SCHEMES)('Rent roll in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());

  it('says what the ledger is before it prints a single figure, and calls it no mock', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    expect(screen.getByText(en['landlord.rent.footnote'])).toBeTruthy();
    expect(screen.queryByText(/mock adapter/i)).toBeNull();
    await settled();
    expect(screen.queryByText(/mock adapter/i)).toBeNull();
  });

  it('draws R1’s three tiles, and the month the ROWS are about', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    // Every fixture row is billed for August, so the roll says August, read
    // off the rows rather than out of a constant.
    expect(screen.getAllByText(AUGUST).length).toBeGreaterThan(0);
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
        fill('landlord.rent.progressLabel', { month: AUGUST, percent: TOTALS.percent }),
      ),
    ).toBeTruthy();
  });

  it('puts Record on every row that is owed, and no Remind on any row', async () => {
    renderInScheme(asLandlord(<RentRoll />), scheme);
    await settled();
    // Two due plus one overdue carry Record; the four paid rows carry nothing.
    expect(screen.getAllByText(en['landlord.rent.record'])).toHaveLength(3);
    // Remind toasted an SMS that was never sent (LL-09).
    expect(screen.queryByText('Remind')).toBeNull();
    expect(screen.queryByText(/by SMS/)).toBeNull();
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
      screen.getByText(fill('landlord.rent.emptyOverdueBody', { month: AUGUST })),
    ).toBeTruthy();
  });
});

describe('The rent roll on real, multi-month data', () => {
  const settled = () =>
    waitFor(() => expect(screen.getByText(/Chantal Mukamana/)).toBeTruthy());

  it('draws one row per lease, its newest month, and counts leases rather than rows', async () => {
    writeFixture(RENT_ROLL_KEY, MULTI_MONTH);
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await settled();

    // Eric was billed twice; the roll is about his newest month only.
    expect(screen.getAllByText(/Eric Habimana/)).toHaveLength(1);
    expect(screen.getByText(`${en['landlord.rent.filterAll']} · 2`)).toBeTruthy();
    expect(
      screen.getByText(fill('landlord.rent.billedCount', { count: 2, month: OCTOBER })),
    ).toBeTruthy();
    // September is history, so nothing on the screen is about it.
    expect(screen.queryByText(`${en['calendar.m9']} 2026`)).toBeNull();
  });

  it('shows a part-paid month at what is still owed, and counts what came in', async () => {
    writeFixture(RENT_ROLL_KEY, MULTI_MONTH);
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await settled();

    expect(screen.getByText(en['landlord.rent.chipPartPaid'])).toBeTruthy();
    // The row, as a screen reader hears it: month, standing, and what is OWED.
    expect(
      screen.getByLabelText(
        fill('landlord.rent.openRow', {
          name: 'Chantal Mukamana',
          unit: 'C1',
          month: OCTOBER,
          status: `${en['status.rent.overdue']}, ${en['landlord.rent.chipPartPaid']}`,
          amount: 'RWF 260,000',
        }),
      ),
    ).toBeTruthy();
    // Collected counts the 150,000 already in; overdue is the 260,000 left.
    expect(screen.getByText(shortMoney(150000))).toBeTruthy();
    expect(screen.getByText(shortMoney(260000))).toBeTruthy();
    expect(screen.getByText(shortMoney(520000))).toBeTruthy();
  });

  it('names the month on Record, and records against that month', async () => {
    writeFixture(RENT_ROLL_KEY, MULTI_MONTH);
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await settled();

    fireEvent.press(
      screen.getByLabelText(
        fill('landlord.rent.recordA11y', { name: 'Chantal Mukamana', unit: 'C1', month: OCTOBER }),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/record-payment',
      params: { leaseId: 'lease-b', periodMonth: '2026-10-01' },
    });
  });

  it('says so when the rows span months, rather than naming one of them', async () => {
    writeFixture(RENT_ROLL_KEY, MULTI_MONTH.filter((r) => r.leaseId === 'lease-b').concat([
      { ...MULTI_MONTH[2], state: 'due', paidAmount: 0 },
    ]));
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await settled();
    expect(
      screen.getByText(
        fill('landlord.rent.monthRange', { from: `${en['calendar.m9']} 2026`, to: OCTOBER }),
      ),
    ).toBeTruthy();
  });

  it('prints no figure, legend or count while the roll is loading', () => {
    queries.fetchRentRoll.mockImplementationOnce(() => new Promise(() => {}));
    renderInScheme(asLandlord(<RentRoll />), 'light');

    expect(
      screen.getByLabelText(fill('state.loadingList', { label: en['landlord.rent.listLabel'] })),
    ).toBeTruthy();
    expect(screen.getByText(en['landlord.rent.filterAll'])).toBeTruthy();
    expect(screen.queryByText(`${en['landlord.rent.filterAll']} · 0`)).toBeNull();
    expect(screen.queryByText(`${en['landlord.rent.filterOverdue']} · 0`)).toBeNull();
    expect(screen.queryByText(en['landlord.rent.collected'])).toBeNull();
    expect(screen.queryByText(en['landlord.rent.nothingLate'])).toBeNull();
    expect(screen.queryByText(/leases billed/)).toBeNull();
  });

  it('reads a refusal as the server’s answer, with no Retry to ask again', async () => {
    queries.fetchRentRoll.mockImplementationOnce(async () => {
      throw new ApiError('refused', 'This business is still being registered.', 403);
    });
    renderInScheme(asLandlord(<RentRoll />), 'light');

    expect(await screen.findByText('This business is still being registered.')).toBeTruthy();
    expect(screen.getByText(en['landlord.rent.refusedTitle'])).toBeTruthy();
    expect(screen.queryByText(en['state.retry'])).toBeNull();
  });

  it('keeps Retry for a roll that could not be reached', async () => {
    queries.fetchRentRoll.mockImplementationOnce(async () => {
      throw new ApiError('failed', 'We could not reach Injishi.');
    });
    renderInScheme(asLandlord(<RentRoll />), 'light');

    expect(await screen.findByText(en['state.errorTitle'])).toBeTruthy();
    expect(screen.getByText(en['state.retry'])).toBeTruthy();
  });

  it('names the workspace in the eyebrow and no town', async () => {
    renderInScheme(asLandlord(<RentRoll />), 'light');
    await waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());
    expect(screen.queryByText(/Kicukiro/)).toBeNull();
  });
});

/* ───────────────────────────────────────── R1's sheet · Record payment ──── */

describe('Recording a payment', () => {
  /**
   * Put the roll in the store before the sheet reads it.
   *
   * The sheet reads the rent roll's own query now, and the mocked query reads
   * this store. A test that asserts a write moved a row should be the thing
   * that decides what the row was, instead of inheriting it from whichever
   * test happened to run first.
   */
  beforeEach(() => {
    writeFixture(RENT_ROLL_KEY, seedRentRoll());
    recordPaymentHandler.mockClear();
  });

  it('records the outstanding amount for the named month, with one UUID key', async () => {
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    await waitFor(() => expect(screen.getByText(new RegExp(OVERDUE.name))).toBeTruthy());

    // The disclosure is on the sheet before the button is.
    expect(screen.getByText(en['landlord.record.warnTitle'])).toBeTruthy();
    expect(screen.getByText(en['landlord.record.warnBody'])).toBeTruthy();
    // The month is the row's own.
    expect(screen.getByText(fill('landlord.record.amount', { month: AUGUST }))).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText(en['landlord.record.confirm']));
    });

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(recordPaymentHandler).toHaveBeenCalledTimes(1);
    const [intent, context] = recordPaymentHandler.mock.calls[0];
    expect(intent).toEqual({
      workspaceId: 'de300000-0000-4000-8000-000000000202',
      leaseId: OVERDUE.leaseId,
      periodMonth: '2026-08-01',
      amountRwf: OVERDUE.amount,
    });
    // The server refuses anything but a UUID Idempotency-Key.
    expect(context.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const rows = readFixture<RentRow[]>(RENT_ROLL_KEY, seedRentRoll());
    expect(rows.find((r) => r.leaseId === OVERDUE.leaseId)?.state).toBe('paid');
  });

  it('records only what is still owed on a part-paid month', async () => {
    writeFixture(
      RENT_ROLL_KEY,
      seedRentRoll().map((r) => (r.leaseId === OVERDUE.leaseId ? { ...r, paidAmount: 50000 } : r)),
    );
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    await waitFor(() => expect(screen.getByText(new RegExp(OVERDUE.name))).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText(en['landlord.record.confirm']));
    });
    await waitFor(() => expect(recordPaymentHandler).toHaveBeenCalledTimes(1));
    expect(recordPaymentHandler.mock.calls[0][0].amountRwf).toBe(OVERDUE.amount - 50000);
  });

  it('names no month and no amount while the roll is still loading', () => {
    queries.fetchRentRoll.mockImplementationOnce(() => new Promise(() => {}));
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    expect(screen.getByText(en['state.loading'])).toBeTruthy();
    expect(screen.queryByText(/Outstanding for/)).toBeNull();
    expect(screen.queryByText(new RegExp(AUGUST))).toBeNull();
  });

  it('shows the server\'s refusal and stays open rather than claiming success', async () => {
    recordPaymentHandler.mockImplementationOnce(async () => ({
      status: 'refused',
      message: 'That month is already settled.',
    }));
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    await waitFor(() => expect(screen.getByText(new RegExp(OVERDUE.name))).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText(en['landlord.record.confirm']));
    });

    await waitFor(() => expect(screen.getByText('That month is already settled.')).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('reads a refused roll as the server’s answer, with no Retry', async () => {
    queries.fetchRentRoll.mockImplementationOnce(async () => {
      throw new ApiError('refused', 'You cannot record rent in this workspace.', 403);
    });
    renderInScheme(asLandlord(<RecordPayment leaseId={OVERDUE.leaseId} />), 'light');
    expect(await screen.findByText('You cannot record rent in this workspace.')).toBeTruthy();
    expect(screen.queryByText(en['state.retry'])).toBeNull();
  });

  it('reads back on the roll as paid once the write has landed', async () => {
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
    expect(recordPaymentHandler).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────────────────────────────────── R3 · Leases ──── */

describe.each(SCHEMES)('Leases in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(/Eric T\./)).toBeTruthy());

  it('puts the lease waiting on the landlord at the top, with the one action that does something', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    // The draft is the only row carrying an action.
    expect(screen.getByText(en['landlord.leases.actionSign'])).toBeTruthy();
    // Renewal is out of the release, and its button toasted an offer that was
    // never sent (LL-16).
    expect(screen.queryByText('Send renewal offer')).toBeNull();
  });

  it('offers no nudge on a lease waiting for its tenant, because nothing would be sent', async () => {
    writeFixture(
      LEASES_KEY,
      seedLeases().map((l) =>
        l.id === JOSIANE.id
          ? { ...l, state: 'pending_signature' as const, action: 'nudge' as const }
          : l,
      ),
    );
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    expect(screen.queryByText('Nudge tenant to sign')).toBeNull();
    expect(screen.queryByText(/reminder sent/i)).toBeNull();
  });

  it('narrows on a unit as readily as on a name', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.changeText(screen.getByLabelText(en['landlord.leases.search']), 'B1');
    expect(screen.getByText(/Grace M\./)).toBeTruthy();
    expect(screen.queryByText(/Eric T\./)).toBeNull();
  });

  it('gives the clear-search control a 44pt target', async () => {
    renderInScheme(asLandlord(<LandlordLeases />), scheme);
    await settled();
    fireEvent.changeText(screen.getByLabelText(en['landlord.leases.search']), 'B1');
    // An 18pt glyph plus 13 each side (LL-24).
    expect(screen.getAllByLabelText(en['landlord.leases.clearSearch'])[0].props.hitSlop).toBe(13);
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
    // In the reader's words, not the developer's (XC-16).
    expect(screen.queryByText(/prototype/i)).toBeNull();
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

  it('names no technician when the assign did not save, and says so', async () => {
    jest.spyOn(landlordData, 'applyAssign').mockImplementation(() => {
      throw new Error('the store refused');
    });
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

    expect(screen.getByText(fill('landlord.repairs.assignFailed', { ref: 'T-204' }))).toBeTruthy();
    expect(
      screen.queryByText(fill('landlord.repairs.assignedToast', { ref: 'T-204', name: 'Innocent M.' })),
    ).toBeNull();
    const tickets = readFixture<RepairTicket[]>(REPAIRS_KEY, seedRepairs());
    expect(tickets.find((k) => k.ref === 'T-204')?.state).toBe('open');
  });

  /**
   * A ticket written to THIS store shows. Not the tenant hand-off: a tenant's
   * report writes `residence.tickets`, which this tab does not read, so the
   * hand-off is broken today (mobile audit LL-08, cross-area). This test used
   * to be titled as though it proved the hand-off.
   */
  it('shows a ticket written to the landlord’s repairs store, with a minted reference', async () => {
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

/* ──────────────────────────────── a read that fails on the four sub-screens */

/**
 * LL-21: lease detail, contract, caution and filing each used to fall through
 * to "That lease is not here" when the read failed, which tells the reader the
 * record is gone. Each now says the read failed and offers the retry.
 */
describe('A lease read that fails', () => {
  const failingRead = () => {
    const retry = jest.fn();
    jest.spyOn(landlordData, 'useLandlordRead').mockReturnValue({
      status: 'error',
      data: undefined,
      error: new Error('read failed'),
      retry,
    });
    return retry;
  };

  it.each([
    ['the lease detail', () => <LandlordLeaseDetail id={ERIC.id} />],
    ['the contract', () => <LandlordContract leaseId={ERIC.id} />],
    ['the caution', () => <LandlordCaution leaseId={ERIC.id} />],
    ['the filing', () => <LandlordFiling leaseId={ERIC.id} />],
  ])('shows %s as a failed read with a retry, not as a missing lease', (_name, ui) => {
    const retry = failingRead();
    renderInScheme(asLandlord(ui()), 'light');

    expect(screen.getByText(en['state.errorTitle'])).toBeTruthy();
    expect(
      screen.getByText(fill('state.errorBody', { label: en['landlord.leaseLabel'] })),
    ).toBeTruthy();
    expect(screen.queryByText(en['landlord.notFoundTitle'])).toBeNull();
    fireEvent.press(screen.getByText(en['state.retry']));
    expect(retry).toHaveBeenCalled();
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

  it('names the latest charge by its own month, not by a fixed one', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id={ERIC.id} />), scheme);
    await settled();
    expect(screen.getByText(en['landlord.lease.latestRent'])).toBeTruthy();
    // Waited for, not read straight away: the roll is its own cold fixture
    // read, and it used to be warm only because the record-payment sheet read
    // the same key earlier in this file. That sheet reads the API query now.
    await waitFor(() =>
      expect(
        screen.getByText(`${AUGUST} · ${fill('landlord.rent.chipPaid', { date: 'Aug 01' })}`),
      ).toBeTruthy(),
    );
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

  it('offers no Message button and no mock chip, neither of which led anywhere true', async () => {
    renderInScheme(asLandlord(<LandlordLeaseDetail id={ERIC.id} />), scheme);
    await settled();
    // Message opened a thread by the lease's id, on a route closed to a
    // landlord (LL-16). Nothing here moves money, so no payments chip (LL-13).
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.queryByText(/mock adapter/i)).toBeNull();
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/thread/[threadId]' }),
    );
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
  const opened = () =>
    waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());

  it('holds the primary shut until there is ink on the pad', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), scheme);
    await opened();
    expect(screen.getByLabelText(en['landlord.contract.blocked'])).toBeTruthy();
    expect(screen.queryByLabelText(en['landlord.contract.confirm'])).toBeNull();
  });

  it('prints the consequence under the button, and promises nothing that does not happen', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), scheme);
    await opened();
    expect(
      screen.getByText(fill('landlord.contract.consequence', { tenant: JOSIANE.tenant })),
    ).toBeTruthy();
    // No copy is sent, stored for seven years or filed with RRA (LL-04), and
    // the two controls that only toasted "not wired" are gone (XC-16).
    expect(screen.queryByText(/RRA/)).toBeNull();
    expect(screen.queryByText(/7 years/)).toBeNull();
    expect(screen.queryByText('Read the full contract')).toBeNull();
    expect(screen.queryByText('Download the contract')).toBeNull();
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
    await opened();
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

describe('Who signs as landlord', () => {
  const opened = () =>
    waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());

  it('is the person holding the phone, by the name the server holds', async () => {
    Object.assign(mockIdentity, { name: 'Aline Uwera', initials: 'AU', fromServer: true });
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await opened();
    expect(screen.getByText(fill('landlord.contract.landlord', { name: 'Aline Uwera' }))).toBeTruthy();
    expect(screen.queryByText(new RegExp(ME.name))).toBeNull();
  });

  it('is "Name not added yet" for an account with no name, never the fixture persona', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await opened();
    expect(
      screen.getByText(fill('landlord.contract.landlord', { name: en['identity.unnamed'] })),
    ).toBeTruthy();
    expect(screen.queryByText(new RegExp(ME.name))).toBeNull();
  });

  it('is the role alone while the name is still loading', async () => {
    Object.assign(mockIdentity, { pending: true });
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await opened();
    expect(screen.getByText(en['landlord.contract.landlordRole'])).toBeTruthy();
  });
});

describe('Signing as landlord', () => {
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

  const inkAndSign = async () => {
    await waitFor(() => expect(screen.getByText(en['landlord.contract.agreement'])).toBeTruthy());
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
  };

  it('moves the lease to pending signature, stamped today, and toasts', async () => {
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await inkAndSign();

    const leases = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases());
    const signed = leases.find((l) => l.id === JOSIANE.id);
    expect(signed?.state).toBe('pending_signature');
    // Today, not the fixtures' fixed "4 Aug 2026" (LL-04).
    expect(signed?.landlordSignedOn).toBe(todayStamp());
    // The row's action follows the state: it is now the tenant who is late.
    expect(signed?.action).toBe('nudge');
    expect(
      screen.getByText(fill('landlord.contract.done', { tenant: JOSIANE.tenant })),
    ).toBeTruthy();
    expect(mockBack).toHaveBeenCalled();
  });

  it('stays on the contract, and claims nothing, when the signature does not save', async () => {
    jest.spyOn(landlordData, 'applyLandlordSignature').mockImplementation(() => {
      throw new Error('the store refused');
    });
    renderInScheme(asLandlord(<LandlordContract leaseId={JOSIANE.id} />), 'light');
    await inkAndSign();

    expect(screen.getByText(en['write.failedTitle'])).toBeTruthy();
    expect(screen.getByText(en['write.failedLegalBody'])).toBeTruthy();
    expect(
      screen.queryByText(fill('landlord.contract.done', { tenant: JOSIANE.tenant })),
    ).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    const lease = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases()).find(
      (l) => l.id === JOSIANE.id,
    );
    expect(lease?.state).toBe('draft');
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

  it('never calls it a security deposit, and promises no mobile money', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), scheme);
    await settled();
    expect(screen.queryByText(/security deposit/i)).toBeNull();
    expect(screen.queryByText(/mobile money/i)).toBeNull();
    expect(screen.getByText(en['landlord.caution.escrowNote'])).toBeTruthy();
  });
});

describe('Settling a caution', () => {
  const opened = () =>
    waitFor(() => expect(screen.getByText(en['landlord.caution.held'])).toBeTruthy());
  const refundedToast = fill('landlord.caution.refundedToast', {
    amount: `RWF ${DIANE.caution.amount.toLocaleString('en-US')}`,
    tenant: DIANE.tenant,
  });
  const dianeNow = () =>
    readFixture<LandlordLease[]>(LEASES_KEY, seedLeases()).find((l) => l.id === DIANE.id);

  it('refunds in full, writes `refunded` stamped today, and names the amount in the toast', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await opened();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.caution.refundAction']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    expect(dianeNow()?.caution.state).toBe('refunded');
    expect(dianeNow()?.caution.settledOn).toBe(todayStamp());
    expect(screen.getByText(refundedToast)).toBeTruthy();
  });

  it('reports no refund when the write did not save, and keeps the caution held', async () => {
    jest.spyOn(landlordData, 'applyCautionSettlement').mockImplementation(() => {
      throw new Error('the store refused');
    });
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await opened();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.caution.refundAction']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    expect(screen.getByText(en['write.failedMoneyBody'])).toBeTruthy();
    expect(screen.queryByText(refundedToast)).toBeNull();
    expect(dianeNow()?.caution.state ?? 'held').toBe('held');
  });

  it('will not settle a deduction without the reason the tenant reads', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await opened();
    fireEvent.press(screen.getByLabelText(en['landlord.caution.deductAction']));

    expect(screen.getByText(en['landlord.caution.sheetBody'])).toBeTruthy();
    // An amount with no reason is exactly the case the sheet is here to stop.
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.caution.amount']}, RWF`), '40000');
    expect(screen.getByLabelText(en['landlord.caution.sheetBlocked'])).toBeTruthy();
  });

  const confirmDeduction = () =>
    screen.getByLabelText(
      fill('landlord.caution.sheetConfirmA11y', {
        amount: 'RWF 40,000',
        returns: 'RWF 240,000',
        tenant: DIANE.tenant,
      }),
    );

  const typeDeduction = () => {
    fireEvent.press(screen.getByLabelText(en['landlord.caution.deductAction']));
    fireEvent.changeText(
      screen.getByLabelText(en['landlord.caution.reason']),
      'Repaint the bedroom wall',
    );
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.caution.amount']}, RWF`), '40000');
  };

  it('records the deduction and the reason, and forfeits only that part', async () => {
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await opened();
    typeDeduction();

    await act(async () => {
      fireEvent.press(confirmDeduction());
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    expect(dianeNow()?.caution.state).toBe('forfeited');
    expect(dianeNow()?.caution.deductions).toEqual([
      { label: 'Repaint the bedroom wall', amount: 40000 },
    ]);
  });

  it('keeps a failed deduction on its sheet, where pressing again retries the deduction', async () => {
    jest.spyOn(landlordData, 'applyCautionSettlement').mockImplementationOnce(() => {
      throw new Error('the store refused');
    });
    renderInScheme(asLandlord(<LandlordCaution leaseId={DIANE.id} />), 'light');
    await opened();
    typeDeduction();

    await act(async () => {
      fireEvent.press(confirmDeduction());
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    // Still on the sheet, with the failure and the figures the landlord typed.
    expect(screen.getByText(en['landlord.caution.sheetBody'])).toBeTruthy();
    expect(screen.getByLabelText(en['landlord.caution.reason']).props.value).toBe(
      'Repaint the bedroom wall',
    );
    expect(screen.getByText(en['write.failedMoneyBody'])).toBeTruthy();
    expect(screen.queryByText(/Settlement recorded/)).toBeNull();
    // The screen behind it offers no Retry that would refund in full instead.
    expect(screen.queryByText(en['write.retry'])).toBeNull();

    await act(async () => {
      fireEvent.press(confirmDeduction());
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });
    expect(dianeNow()?.caution.state).toBe('forfeited');
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

  it('says a lease with no second signature is not filed, and promises no filing', async () => {
    renderInScheme(asLandlord(<LandlordFiling leaseId={JOSIANE.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.filing.pendingTitle'])).toBeTruthy());
    expect(screen.getByText(en['landlord.filing.pendingBody'])).toBeTruthy();
    expect(screen.getByText(en['landlord.filing.stepAwaiting'])).toBeTruthy();
    expect(screen.getByText(en['landlord.filing.adapterWaiting'])).toBeTruthy();
    // Nothing files from Injishi today (LL-15).
    expect(screen.queryByText(/files itself/)).toBeNull();
  });

  it('surfaces a failure, with no retry or download that would do nothing', async () => {
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
    expect(screen.getByText('Channel refused')).toBeTruthy();
    // "Retry the filing" toasted a retry that was never queued, and
    // "Download" toasted that an adapter was "not wired" (XC-16).
    expect(screen.queryByText('Retry the filing')).toBeNull();
    expect(screen.queryByText('Download filed contract')).toBeNull();
  });

  it('states the two business rules a landlord must not get wrong', async () => {
    renderInScheme(asLandlord(<LandlordFiling leaseId={ERIC.id} />), scheme);
    await waitFor(() => expect(screen.getByText(en['landlord.filing.note'])).toBeTruthy());
  });
});

/* ───────────────────────────────────────────── R6 · Register tenant ──── */

/** A broker's hand-off, as FL19 will deliver one. Only ever stubbed. */
const HANDED_OVER: PendingPlacement = {
  broker: landlordData.THIRD_PARTY_BROKER,
  fee: 140000,
  tenantName: 'A. Tenant',
  tenantPhone: '788 000 001',
  tenantNationalId: '1199000000000001',
  unit: 'Unit B2',
  unitType: '2-bedroom',
  rent: 280000,
  caution: 280000,
};

describe.each(SCHEMES)('Register tenant in the %s scheme', (scheme) => {
  it('opens empty: no stranger’s name, phone, ID or broker fee', () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    expect(screen.getByLabelText(en['landlord.new.name']).props.value).toBe('');
    expect(screen.getByLabelText(`${en['landlord.new.phone']}, RW +250`).props.value).toBe('');
    expect(screen.getByLabelText(en['landlord.new.nid']).props.value).toBe('');
    expect(screen.queryByText(en['landlord.new.placementFeeLabel'])).toBeNull();
    expect(screen.queryByText(/Liliane/)).toBeNull();
    // The consequence names "the tenant" until one is typed.
    expect(
      screen.getByText(
        fill('landlord.new.consequence', { name: en['landlord.new.theTenant'] }),
      ),
    ).toBeTruthy();
    // Blank, and therefore blocked, with the reason on the button.
    expect(screen.getByLabelText(en['landlord.new.blocked'])).toBeTruthy();
    // The unit selector still defaults to the first vacant unit, so the
    // landlord is never asked to pick from nothing.
    expect(screen.getByLabelText('Unit B2, 2-bedroom')).toBeTruthy();
  });

  it('names the broker and the fee when a placement IS handed over', () => {
    // FL20 path B. No hand-off exists yet, so the banner path is reached only
    // by stubbing one; it has to keep rendering for the day FL19 lands.
    jest.spyOn(landlordData, 'readPendingPlacement').mockReturnValue(HANDED_OVER);
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    expect(
      screen.getByText(
        fill('landlord.new.placementTitle', { broker: landlordData.THIRD_PARTY_BROKER }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(en['landlord.new.placementFeeLabel'])).toBeTruthy();
  });

  it('offers only units with no live lease on them', () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    expect(screen.getByLabelText('Unit B2, 2-bedroom')).toBeTruthy();
    // A2 is Eric T.'s and must not be offered a second tenant.
    expect(screen.queryByLabelText(/^Unit A2/)).toBeNull();
  });

  it('blocks the primary and names each bad field once you have tried', () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    fireEvent.press(screen.getByLabelText(en['landlord.new.blocked']));
    expect(screen.getByText(en['landlord.new.nameError'])).toBeTruthy();
  });

  it('rejects a national ID that is not sixteen digits', () => {
    renderInScheme(asLandlord(<RegisterTenant />), scheme);
    fireEvent.changeText(screen.getByLabelText(en['landlord.new.nid']), '119948');
    fireEvent.press(screen.getByLabelText(en['landlord.new.blocked']));
    expect(screen.getByText(en['landlord.new.nidError'])).toBeTruthy();
  });
});

describe('Creating a lease', () => {
  const typeTenant = async () => {
    fireEvent.changeText(screen.getByLabelText(en['landlord.new.name']), 'Ange Uwase');
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.new.phone']}, RW +250`), '788 123 456');
    fireEvent.changeText(screen.getByLabelText(en['landlord.new.nid']), '1199880012345678');
    fireEvent.changeText(screen.getByLabelText(`${en['landlord.new.rent']}, RWF`), '380000');
    await waitFor(() => expect(screen.getByLabelText(en['landlord.new.create'])).toBeTruthy());
  };

  it('writes a draft from what the landlord typed and hands off to its contract', async () => {
    renderInScheme(asLandlord(<RegisterTenant />), 'light');
    await typeTenant();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.new.create']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    const leases = readFixture<LandlordLease[]>(LEASES_KEY, seedLeases());
    const created = leases[0];
    expect(leases).toHaveLength(seedLeases().length + 1);
    expect(created.tenant).toBe('Ange Uwase');
    expect(created.unit).toBe('Unit B2');
    expect(created.rent).toBe(380000);
    // FL20 step 1 creates a DRAFT. The tenant hears nothing until step 3.
    expect(created.state).toBe('draft');
    // Nobody placed this tenant, so no broker and no fee are on the lease.
    expect(created.placement).toBeUndefined();

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/lease/[leaseId]/contract',
      params: { leaseId: created.id },
    });
  });

  it('stays on the form with everything typed, and claims nothing, when the create does not save', async () => {
    jest.spyOn(landlordData, 'applyCreateLease').mockImplementation(() => {
      throw new Error('the store refused');
    });
    renderInScheme(asLandlord(<RegisterTenant />), 'light');
    await typeTenant();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['landlord.new.create']));
      await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 40));
    });

    expect(screen.getByText(en['write.failedTitle'])).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText(/created for Ange Uwase/)).toBeNull();
    expect(screen.getByLabelText(en['landlord.new.name']).props.value).toBe('Ange Uwase');
    expect(readFixture<LandlordLease[]>(LEASES_KEY, seedLeases())).toHaveLength(
      seedLeases().length,
    );
  });
});

/* ───────────────────────────────────────── the rent roll's arithmetic ──── */

describe('The rent roll’s arithmetic', () => {
  it('keeps each lease’s newest month, whatever order the rows arrive in', () => {
    const rows = newestPerLease([...MULTI_MONTH].reverse());
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.leaseId === 'lease-a')?.periodMonth).toBe('2026-10-01');
  });

  it('counts money in and money owed, and counts leases rather than rows', () => {
    const totals = rentTotals(newestPerLease(MULTI_MONTH));
    // Collected is what came in, part payments included.
    expect(totals.collected).toBe(150000);
    expect(totals.collectedCount).toBe(1);
    // Owed is what is still owed, not the whole charge.
    expect(totals.overdue).toBe(260000);
    expect(totals.due).toBe(520000);
    expect(totals.leases).toBe(2);
    expect(totals.billed).toBe(930000);
  });

  it('names a month from its parts, in the reader’s language', () => {
    expect(periodLabel('2026-10-01', tEn)).toBe(OCTOBER);
    expect(periodLabel(undefined, tEn)).toBeUndefined();
    expect(periodLabel('not a month', tEn)).toBeUndefined();
  });

  it('names one month when the rows agree and a range when they do not', () => {
    expect(rollPeriodLabel(newestPerLease(MULTI_MONTH), tEn)).toBe(OCTOBER);
    expect(rollPeriodLabel([MULTI_MONTH[0], MULTI_MONTH[2]], tEn)).toBe(
      fill('landlord.rent.monthRange', { from: `${en['calendar.m9']} 2026`, to: OCTOBER }),
    );
    expect(rollPeriodLabel([], tEn)).toBeUndefined();
  });

  it('dates a payment on Kigali’s calendar, whatever zone the phone is in', () => {
    const { toRentRow } = jest.requireActual('@/queries/landlord') as typeof import('@/queries/landlord');
    const row = toRentRow({
      id: '00000000-0000-4000-8000-000000000001',
      leaseId: '00000000-0000-4000-8000-000000000002',
      unitLabel: 'B1',
      tenantName: 'Eric Habimana',
      periodMonth: '2026-10-01',
      amountRwf: 520000,
      paidAmountRwf: 520000,
      status: 'paid',
      dueDate: '2026-10-05',
      // 23:30 UTC on the 4th is 01:30 on the 5th in Kigali.
      paidAt: '2026-10-04T23:30:00.000Z',
    });
    expect(row.on).toBe(
      new Date(Date.UTC(2026, 9, 5)).toLocaleDateString('en-GB', {
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC',
      }),
    );
    expect(row.periodMonth).toBe('2026-10-01');
    expect(row.paidAmount).toBe(520000);
  });
});
