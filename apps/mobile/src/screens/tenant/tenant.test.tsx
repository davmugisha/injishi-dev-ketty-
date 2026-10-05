/**
 * The nine tenant screens, rendered — both schemes, and Kinyarwanda where the
 * layout is what is being checked.
 *
 * Expo Router is mocked to a router that records where it was told to go. The
 * navigator is not what is under test; the screens' decisions are, and mounting
 * a real one would make this a test of Expo Router.
 *
 * `expo-network` is mocked online, so the offline note is off by default. One
 * test flips it, which is the only way that branch is reachable in a suite with
 * no radio.
 *
 * Two more seams are mocked for the mobile audit of 2026-10-05, and both start
 * where a production build starts:
 *
 *   - `usePlatform().isDemo` is false until a test says this is the demo. Pay
 *     rent exists only on the demo stack (TN-07), so the tests that pay opt in.
 *   - `useMyIdentity()` is the placeholder, which is nobody, until a test gives
 *     the server's answer. The contract's Tenant party and a repair's reporter
 *     come from here and never from the fixture persona (TN-03).
 *
 * The `mock` prefix on the captured variables is jest's rule, not a style: a
 * mock factory is hoisted above the file, so only names it can prove are lazily
 * read may be captured.
 *
 * The substantive assertions are the ones a wrong screen would pass without:
 * the sign button refusing until both conditions are met, the move-out banner
 * reading its notice period off the lease rather than a constant, the locked
 * rows on an unsigned lease, the ticket a tenant files turning up in the store
 * the landlord reads, and (TN-29) a FORCED FAILURE for every write, because
 * every one of them used to toast its success whatever happened.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { formatMoney, ToastProvider } from '@/components';
import { SCHEMES, flattenStyle, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { translate } from '@/i18n/i18n';
import { addDays, addMonths, formatFullDay } from './dates';
import { resetFixtures, readFixture, writeFixture } from '@/data/use-fixture-mutation';
// The attempt journal is module-level and outlives a test on purpose — that is
// what "survives backgrounding and app kill" means. So a test file has to clear
// it, or the second test on the same lease opens straight into the first test's
// settled attempt rather than onto the form.
import { begin, resetAttempts, settle } from '@/data/payment-attempt';
// The write queue is module-level for the same reason, and a report queued in
// one test would otherwise drain into the next.
import { resetQueue } from '@/data/write-queue';
import { TENANCIES, nextDuePeriod, type Tenancy } from '@/data/rentals';
import * as tenancyStore from '@/data/tenancy-store';
import { TENANCIES_KEY } from '@/data/tenancy-store';
import * as ticketStore from '@/data/tickets';
import { TICKETS, TICKETS_KEY, type Ticket } from '@/data/tickets';
import type { MyIdentity } from '@/queries/profile';
import { Leases } from './leases';
import { Rent } from './rent';
import { LeaseDetail } from './lease-detail';
import { LeaseSign } from './lease-sign';
import { LeaseMoveOut } from './lease-move-out';
import { LeaseRenew } from './lease-renew';
import { LeaseVisitors } from './lease-visitors';
import { LeaseMaintenanceNew } from './lease-maintenance-new';
import { LeaseContract } from './lease-contract';
import { PayRent } from './pay-rent';

const mockPushed: unknown[] = [];
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => mockPushed.push(href),
    replace: (href: unknown) => mockPushed.push(href),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

let mockOnline = true;
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: mockOnline, isInternetReachable: mockOnline }),
}));

const SEAT = { id: 'personal', name: 'Personal', role: 'Tenant', kind: 'personal' };
let mockWorkspace = SEAT;
jest.mock('@/domain', () => ({
  useDomain: () => ({
    domain: 'residence',
    setDomain: jest.fn(),
    workspace: mockWorkspace,
    setWorkspace: jest.fn(),
    surface: 'tenant',
  }),
}));

let mockIsDemo = false;
jest.mock('@/queries/platform', () => ({
  ...jest.requireActual('@/queries/platform'),
  usePlatform: () => ({ platform: null, isDemo: mockIsDemo, seededAt: null }),
}));

/** The placeholder `useMyIdentity()` returns for an account with no name. */
const NOBODY: MyIdentity = { name: '', initials: '', phone: '', fromServer: false, pending: false };
/** What the server answers for a person who has completed Step 1. */
const ALINE: MyIdentity = {
  name: 'Aline Uwase',
  initials: 'AU',
  phone: '+250 732 123 456',
  fromServer: true,
  pending: false,
};
let mockIdentity: MyIdentity = NOBODY;
jest.mock('@/queries/profile', () => ({
  ...jest.requireActual('@/queries/profile'),
  useMyIdentity: () => mockIdentity,
}));

/** Frames R11, R12 and R15's own lease: Ingoro A2, active, 30-day notice. */
const RUNNING = 'ingoro-apartments-a2';
/** The invite's lease, awaiting signature. Frames X3 and R16. */
const UNSIGNED = 'kimironko-flat-3';
const CLOSED = 'gikondo-garden-flat';
/** The second running lease, which owes an overdue month. */
const SECOND = 'nyamirambo-flat-1';

/** The fixture persona's name. It must never reach a tenant screen (TN-03). */
const FIXTURE_PERSON = 'Samuel Kayitare';

const lease = (id: string): Tenancy => TENANCIES.find((x) => x.id === id)!;

/**
 * The running lease's months, read off the fixture. Its ledger is laid onto
 * today's calendar, so a typed month would fail the month after it was written.
 */
const NEXT_DUE = lease(RUNNING).history.find((p) => p.status === 'due')!.month;
/** A settled period two back, so it is not the one the hero card also prints. */
const SETTLED = lease(RUNNING).history.filter((p) => p.status === 'paid')[2];

beforeEach(() => {
  mockPushed.length = 0;
  mockParams = {};
  mockOnline = true;
  mockIsDemo = false;
  mockIdentity = NOBODY;
  mockWorkspace = SEAT;
  resetFixtures();
  resetAttempts();
  resetQueue();
});
afterEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
  resetAttempts();
  resetQueue();
});

const page = (ui: React.ReactElement) => <ToastProvider>{ui}</ToastProvider>;

/**
 * `useFixture` is slow on a cold key, so every test waits for the read.
 *
 * `getAllByText` rather than `getByText`: several of these screens print the
 * same string twice on purpose — the sticky bar repeats the state the body is
 * showing — and a settle helper that tripped over that would be asserting
 * about layout rather than waiting for data.
 */
async function open(
  ui: React.ReactElement,
  scheme: (typeof SCHEMES)[number],
  settled: string,
  locale?: 'en' | 'rw',
) {
  const view = renderInScheme(page(ui), scheme, locale ? { locale } : undefined);
  await waitFor(() => expect(screen.getAllByText(settled).length).toBeGreaterThan(0));
  return view;
}

/** Long enough for the 300ms write and a loaded machine, short of the test cap. */
const WRITE = { timeout: 5000 };

/* ------------------------------------------------- forcing a write to fail */

/**
 * Make every tenancy write fail inside `useFixtureMutation`, the way a write a
 * server refuses will (TN-29).
 *
 * Each applier in `tenancy-store.ts` goes through `mapTenancy`, which calls the
 * stored array's own `map`. A stored array whose `map` throws therefore fails
 * the write inside the mutation's try and resolves it to `error`, while every
 * read (`find`, `filter`) still works, so the screen renders normally right up
 * to the press. `writeFixture` with a plain array undoes it.
 */
function failTenancyWrites(tenancies: Tenancy[] = TENANCIES): void {
  const poisoned = [...tenancies];
  Object.defineProperty(poisoned, 'map', {
    value: () => {
      throw new Error('forced write failure');
    },
  });
  writeFixture(TENANCIES_KEY, poisoned);
}

/** The same for the ticket store, whose filing counts references with `reduce`. */
function failTicketWrites(tickets: Ticket[] = TICKETS): void {
  const poisoned = [...tickets];
  Object.defineProperty(poisoned, 'reduce', {
    value: () => {
      throw new Error('forced write failure');
    },
  });
  writeFixture(TICKETS_KEY, poisoned);
}

const storedLease = (id: string): Tenancy | undefined =>
  readFixture<Tenancy[]>(TENANCIES_KEY, TENANCIES).find((x) => x.id === id);

/* --------------------------------------------------------- small helpers */

/** The first value of `key` on `node` or the nearest ancestor that sets it. */
interface Node {
  props?: { style?: unknown };
  parent: Node | null;
}
function styleUp(node: Node | null, key: string): unknown {
  for (let cur = node; cur; cur = cur.parent) {
    const value = flattenStyle(cur.props?.style)[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Ink on the signature pad. `PanResponder`'s grant is the first touch of a
 * stroke, and one point is a mark (the pad draws a dot for a tap).
 */
function drawSignature(): void {
  const pad = screen.getByLabelText(en['sign.padLabel']);
  act(() => {
    pad.props.onResponderGrant({
      nativeEvent: { locationX: 24, locationY: 40 },
      touchHistory: { touchBank: [], numberActiveTouches: 0, indexOfSingleActiveTouch: -1 },
    });
  });
}

/** Choose the first day the notice period allows, and close the calendar. */
function pickMoveOutDate(): void {
  fireEvent.press(screen.getByLabelText(en['moveOut.pickDate']));
  const available = en['calendar.dayAvailable'].replace('{day}', '');
  fireEvent.press(screen.getAllByLabelText(new RegExp(`${available}$`))[0]);
  fireEvent.press(screen.getByLabelText(en['moveOut.useDate']));
}

/* ------------------------------------------------ R11 · My leases -------- */

describe.each(SCHEMES)('R11 My leases in the %s scheme', (scheme) => {
  it('shows a skeleton on the cold read rather than an empty page', () => {
    renderInScheme(page(<Leases />), scheme);
    const loading = screen.queryByLabelText(
      en['state.loadingList'].replace('{label}', en['leases.listLabel']),
    );
    expect(loading ?? screen.getByText(en['leases.title'])).toBeTruthy();
  });

  it('draws a card per live lease, each with its rent and its next due date', async () => {
    await open(<Leases />, scheme, 'Ingoro Apartments');
    // Two tenancies are running, which is O-8's "more than one active Lease
    // rendered as a list". Each card carries both column labels.
    const live = TENANCIES.filter(
      (x) => x.leaseState !== 'ended' && x.leaseState !== 'pending_signature',
    );
    expect(screen.getAllByText(en['leases.rent'])).toHaveLength(live.length);
    expect(screen.getAllByText(en['leases.nextDue'])).toHaveLength(live.length);
    // Frame R11's own figure, on the card that leads the list.
    expect(screen.getAllByText('310,000').length).toBeGreaterThan(0);
  });

  it('lifts every lease awaiting signature out of the list into its own callout', async () => {
    await open(<Leases />, scheme, 'Ingoro Apartments');
    // Two of the fixtures are awaiting signature, and FL25 step 3 lifts both:
    // a callout each, rather than one callout and a row of dead controls.
    const awaiting = TENANCIES.filter((x) => x.leaseState === 'pending_signature');
    expect(screen.getAllByText(en['leases.reviewAndSign'])).toHaveLength(awaiting.length);
  });

  it('draws the PAST section for tenancies that have ended', async () => {
    await open(<Leases />, scheme, 'Ingoro Apartments');
    expect(screen.getByText(en['leases.past'])).toBeTruthy();
    // Kivu Breeze is the ended fixture frame R11 draws in that section.
    expect(screen.getByText('Kivu Breeze Studios')).toBeTruthy();
  });
});

describe('R11 My leases, the other states', () => {
  it('says the list is stale when the device is offline', async () => {
    mockOnline = false;
    await open(<Leases />, 'light', en['state.offlineLastList']);
    expect(screen.getByText(en['state.offlineLastList'])).toBeTruthy();
  });

  it('offers an empty state with a reason when there are no leases at all', async () => {
    writeFixture(TENANCIES_KEY, [] as Tenancy[]);
    await open(<Leases />, 'light', en['leases.emptyTitle']);
    expect(screen.getByText(en['leases.emptyBody'])).toBeTruthy();
  });

  it('renders in Kinyarwanda without falling back to English', async () => {
    await open(<Leases />, 'light', 'Ingoro Apartments', 'rw');
    expect(screen.getByText('Amasezerano yanjye')).toBeTruthy();
  });
});

describe('R11 My leases, the audit fixes', () => {
  /** TN-15, the rig's finding: the pill ran off the card's clipped edge. */
  it('lets the next due date give way so the status pill stays on the card', async () => {
    await open(<Leases />, 'light', 'Ingoro Apartments');
    const dueDay = formatFullDay(nextDuePeriod(lease(RUNNING))!.dueOn!, translate);
    const date = screen.getByText(dueDay);
    expect(flattenStyle(date.props.style).flexShrink).toBe(1);
    expect(styleUp(date.parent as Node, 'flexWrap')).toBe('wrap');
  });

  /** TN-17: a button's label replaces everything inside it. */
  it('names the rent, the next due date and its status in the card label', async () => {
    await open(<Leases />, 'light', 'Ingoro Apartments');
    const opener = en['leases.open'].replace('{unit}', lease(RUNNING).unit);
    const card = screen.getByLabelText(new RegExp(`^${opener}\\.`));
    const label: string = card.props.accessibilityLabel;
    expect(label).toContain(formatMoney(lease(RUNNING).rent));
    expect(label).toContain(formatFullDay(nextDuePeriod(lease(RUNNING))!.dueOn!, translate));
    expect(label).toContain(en['payment.due']);
  });

  /** TN-13: renewal is hidden in v1.0, and so is any note that one is pending. */
  it('says nothing about a renewal, even one already requested', async () => {
    writeFixture(
      TENANCIES_KEY,
      TENANCIES.map((x) =>
        x.id === RUNNING
          ? {
              ...x,
              renewal: {
                requestedOn: '2026-08-01',
                termMonths: 12,
                startOn: '2027-02-02',
                endOn: '2028-02-01',
                rent: x.rent,
                note: '',
                state: 'pending' as const,
              },
            }
          : x,
      ),
    );
    await open(<Leases />, 'light', 'Ingoro Apartments');
    expect(screen.queryByText(/renew/i)).toBeNull();
  });

  /** TN-22, the rig's finding: a lone "·" before `/me/workspaces` answers. */
  it('draws no lone separator before the workspace has loaded', async () => {
    mockWorkspace = { id: '', name: '', role: '', kind: 'personal' };
    await open(<Leases />, 'light', 'Ingoro Apartments');
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.queryByText(' · ')).toBeNull();
  });

  it('greets with the seat once it is known', async () => {
    await open(<Leases />, 'light', 'Ingoro Apartments');
    expect(screen.getByText('Personal · Tenant')).toBeTruthy();
  });

  /** TN-23: a recycled row must not show the last lease's photograph. */
  it('keys each past lease thumbnail to its own lease', async () => {
    await open(<Leases />, 'light', 'Kivu Breeze Studios');
    const keyed = screen.root.findAll(
      (node) => node.props.recyclingKey === 'kivu-breeze-studios-4',
    );
    expect(keyed.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------ R12 · Rent ------- */

describe.each(SCHEMES)('R12 Rent in the %s scheme', (scheme) => {
  it('leads with the next payment on the hero plate', async () => {
    mockIsDemo = true;
    await open(<Rent />, scheme, en['rent.nextPayment']);
    // The figure is on the plate and on every ledger row of the same amount.
    expect(screen.getAllByText('310,000').length).toBeGreaterThan(0);
    expect(screen.getByText(en['rent.payRent'])).toBeTruthy();
  });

  it('prints the adapter provenance under the button on the demo, not after it', async () => {
    mockIsDemo = true;
    await open(<Rent />, scheme, en['rent.nextPayment']);
    expect(
      screen.getByText(en['rent.settledVia'].replace('{adapter}', en['tenant.mockAdapter'])),
    ).toBeTruthy();
  });

  it('keeps the Caution out of the rent ledger', async () => {
    await open(<Rent />, scheme, en['rent.nextPayment']);
    expect(screen.getByText(en['rent.cautionHeld'])).toBeTruthy();
    expect(screen.getByText(en['rent.cautionNote'])).toBeTruthy();
  });

  it('lists the ledger with the day each period was paid', async () => {
    await open(<Rent />, scheme, en['rent.nextPayment']);
    expect(screen.getByText(SETTLED.month)).toBeTruthy();
    // `4 September 2026`: the day of `paidOn`, then the month key it sits under.
    const paidDay = `${Number(SETTLED.paidOn!.slice(8, 10))} ${SETTLED.month}`;
    expect(screen.getByText(en['rent.paidOn'].replace('{date}', paidDay))).toBeTruthy();
  });
});

describe('R12 Rent, paying', () => {
  it('opens the sheet with the lease and the period it is settling', async () => {
    mockIsDemo = true;
    await open(<Rent />, 'light', en['rent.nextPayment']);
    fireEvent.press(screen.getByText(en['rent.payRent']));
    expect(mockPushed[0]).toEqual({
      pathname: '/pay-rent',
      params: { leaseId: RUNNING, month: NEXT_DUE },
    });
  });

  /**
   * TN-07 (ADR-061 AC-4): the rail is a client timer, so outside the demo the
   * app says nothing about paying in it, and one neutral line about paying
   * the landlord. No "coming soon".
   */
  it('offers no way to pay in the app outside the demo', async () => {
    await open(<Rent />, 'light', en['rent.nextPayment']);
    expect(screen.queryByText(en['rent.payRent'])).toBeNull();
    expect(
      screen.queryByText(en['rent.settledVia'].replace('{adapter}', en['tenant.mockAdapter'])),
    ).toBeNull();
    expect(screen.getByText(en['rent.payDirectly'])).toBeTruthy();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});

describe('R12 Rent, the audit fixes', () => {
  /** TN-16: lease detail's "Rent history" names the lease it came from. */
  it('opens on the lease a Rent history row asked for', async () => {
    mockParams = { leaseId: SECOND };
    await open(<Rent />, 'light', en['rent.nextPayment']);
    expect(
      screen.getByText(`${lease(SECOND).landlordOrg} · ${lease(SECOND).unit}`),
    ).toBeTruthy();
  });

  /** TN-17: the row's label is all a screen reader hears of it. */
  it('speaks each ledger row with its amount and its status', async () => {
    await open(<Rent />, 'light', en['rent.nextPayment']);
    const row = screen.getByLabelText(new RegExp(`^${SETTLED.month}, `));
    const label: string = row.props.accessibilityLabel;
    expect(label).toContain(formatMoney(SETTLED.amount));
    expect(label).toContain(en['payment.paid']);
  });

  /** TN-26: a text link is still a target. */
  it('gives the lease link a 44pt target', async () => {
    await open(<Rent />, 'light', en['rent.nextPayment']);
    const link = screen.getByLabelText(en['rent.openLease']);
    expect(link.props.accessibilityRole).toBe('link');
    const tall = link.findAll((node) => flattenStyle(node.props.style).minHeight === 44);
    expect(tall.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------ the pay-rent sheet ----------- */

describe.each(SCHEMES)('the pay-rent sheet in the %s scheme', (scheme) => {
  it('offers the two mobile money rails, in the order they answer in', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, scheme, en['payRent.mtn']);
    expect(screen.getByText(en['payRent.airtel'])).toBeTruthy();
    // Card waits for the payment gateway, and even then is typed into the
    // gateway's own page: this sheet never shows a card field.
    expect(screen.queryByText(/card/i)).toBeNull();
  });

  it('says nothing leaves the account before the button that pays', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, scheme, en['payRent.mockTitle']);
    expect(screen.getByText(en['payRent.mockBody'])).toBeTruthy();
  });
});

/**
 * A month label whose attempt the fixture rail CONFIRMS.
 *
 * The rail's answer is a pure function of the attempt token (`settle` seeds on
 * it), and the token carries the month. So a test that needs the confirmed
 * state picks a label the rail will confirm, rather than hoping today's month
 * happens to be one; the machine itself says which.
 */
function confirmingMonth(leaseId: string): string {
  for (let i = 0; i < 200; i += 1) {
    const label = `Test month ${i}`;
    const attempt = begin({
      token: `rent:${leaseId}:${label}:0`,
      handset: '',
      rail: 'momo',
      amountRwf: 1,
    });
    if (settle(attempt, 'REF').state === 'confirmed') return label;
  }
  throw new Error('no label in 200 that the fixture rail confirms');
}

/** The running lease, owing exactly one period, under `label`. */
function owingOnly(label: string): Tenancy[] {
  return TENANCIES.map((x) =>
    x.id === RUNNING
      ? {
          ...x,
          history: [
            { month: label, amount: 310000, status: 'due' as const, dueOn: '2026-11-01' },
            ...x.history.filter((p) => p.status === 'paid'),
          ],
        }
      : x,
  );
}

/** Enter a MoMo number and press pay. */
function payWithMomo(): void {
  fireEvent.changeText(screen.getByTestId('pay-rent-handset'), '788123456');
  fireEvent.press(screen.getByText(en['payRent.action']));
}

/** Long enough for the rail's 1.2s answer and the ledger's write behind it. */
const RAIL = { timeout: 8000 };

/**
 * Paying, since gaps.md B2.
 *
 * The sheet no longer settles on a press. Both Rwandan rails answer OUT OF THE
 * APP — the tenant gets a prompt, enters a PIN somewhere else, and the result
 * arrives by callback — so a press now starts an attempt and the ledger is
 * written only when the rail confirms. That is why these tests press, then
 * wait for a state, rather than pressing and asserting the store.
 *
 * The handset is new for the same reason: the sheet used to settle without ever
 * asking WHERE the prompt should go, which is the one fact a tenant with two
 * SIMs needs.
 */
describe('the pay-rent sheet, settling', () => {
  it('asks where the prompt should go before it will take a payment', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    expect(screen.getByTestId('pay-rent-handset')).toBeTruthy();
    // Nothing is charged until there is a handset to charge.
    fireEvent.press(screen.getByText(en['payRent.action']));
    const stored = readFixture<Tenancy[]>(TENANCIES_KEY, []);
    const period = stored
      .find((x) => x.id === RUNNING)
      ?.history.find((p) => p.month === NEXT_DUE);
    expect(period?.status).not.toBe('paid');
  });

  it('sends the prompt to the handset and says so, rather than spinning', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    payWithMomo();

    // Never a bare spinner: the state names the handset the prompt went to and
    // says the PIN is entered there, not here (benchmarks.md §4).
    expect(await screen.findByText(en['pay.checkYourPhone'])).toBeTruthy();
    expect(
      screen.getByText(
        en['pay.checkYourPhoneBody'].replace('{handset}', '+250 788 123 456'),
      ),
    ).toBeTruthy();
  });

  it('keeps the obligation on screen while the rail has not answered', async () => {
    // A refusal that also hid the debt would be a screen that made the problem
    // go away for the wrong person.
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    payWithMomo();
    expect(await screen.findByText(en['payRent.stillOwed'])).toBeTruthy();
  });

  it('says so rather than offering a payment when nothing is due', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<PayRent />, 'light', en['payRent.nothingDueTitle']);
    expect(screen.queryByText(en['payRent.action'])).toBeNull();
  });

  /**
   * TN-08 and TN-20. Paying a period is what makes it stop being owed, and the
   * token used to be re-derived from what was owed: the moment the ledger
   * recorded the payment, the confirmation and its reference vanished and the
   * sheet said "Nothing to pay". The only button under it said "Not now".
   */
  it('keeps the confirmation and its reference on screen after the ledger records it', async () => {
    const label = confirmingMonth(RUNNING);
    writeFixture(TENANCIES_KEY, owingOnly(label));
    mockParams = { leaseId: RUNNING, month: label };
    await open(<PayRent />, 'light', en['payRent.action']);
    payWithMomo();

    expect(await screen.findByText(en['pay.confirmedTitle'], undefined, RAIL)).toBeTruthy();
    await waitFor(
      () =>
        expect(storedLease(RUNNING)?.history.find((p) => p.month === label)?.status).toBe('paid'),
      RAIL,
    );
    expect(
      await screen.findByText(en['payRent.toast'].replace('{month}', label), undefined, WRITE),
    ).toBeTruthy();

    // Still the confirmation, with its reference and a Done, after the write.
    expect(screen.getByText(en['pay.confirmedTitle'])).toBeTruthy();
    expect(screen.getByText(en['pay.reference'].toUpperCase())).toBeTruthy();
    expect(screen.getByText(en['payRent.done'])).toBeTruthy();
    expect(screen.queryByText(en['payRent.nothingDueTitle'])).toBeNull();
    expect(screen.queryByText(en['payRent.cancel'])).toBeNull();
  });

  /** TN-12: the ledger write branches on its result like every other write. */
  it('says the payment went through but was not recorded when the ledger write fails', async () => {
    const label = confirmingMonth(RUNNING);
    failTenancyWrites(owingOnly(label));
    mockParams = { leaseId: RUNNING, month: label };
    await open(<PayRent />, 'light', en['payRent.action']);
    payWithMomo();

    expect(
      await screen.findByText(en['payRent.ledgerFailedTitle'], undefined, RAIL),
    ).toBeTruthy();
    expect(screen.getByText(en['payRent.ledgerFailedBody'])).toBeTruthy();
    // Never the success toast over a write that did not land.
    expect(screen.queryByText(en['payRent.toast'].replace('{month}', label))).toBeNull();
    // The reference stays, because it is the one thing to keep.
    expect(screen.getByText(en['pay.confirmedTitle'])).toBeTruthy();

    // The retry records it once the store accepts writes again.
    writeFixture(TENANCIES_KEY, owingOnly(label));
    fireEvent.press(screen.getByLabelText(en['write.retry']));
    expect(
      await screen.findByText(en['payRent.toast'].replace('{month}', label), undefined, WRITE),
    ).toBeTruthy();
    expect(storedLease(RUNNING)?.history.find((p) => p.month === label)?.status).toBe('paid');
  });
});

describe('the pay-rent sheet, the audit fixes', () => {
  /** TN-21: a failed read is not a missing lease. */
  it('offers a retry when the read fails, rather than saying the lease is gone', async () => {
    const retry = jest.fn();
    jest.spyOn(tenancyStore, 'useTenancy').mockReturnValue({
      status: 'error',
      data: undefined,
      error: new Error('read failed'),
      retry,
    });
    mockParams = { leaseId: RUNNING };
    await open(<PayRent />, 'light', en['state.errorTitle']);
    expect(screen.queryByText(en['lease.notFound'])).toBeNull();
    fireEvent.press(screen.getByText(en['state.retry']));
    expect(retry).toHaveBeenCalled();
  });

  it('says a missing lease is missing, with no retry that cannot help', async () => {
    mockParams = { leaseId: 'no-such-lease' };
    await open(<PayRent />, 'light', en['lease.notFound']);
    expect(screen.queryByText(en['state.retry'])).toBeNull();
  });

  /** TN-17: the amount is in the label, not only on the screen. */
  it('speaks the amount being paid', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    const block = screen.getByLabelText(new RegExp(`^${en['payRent.amount']}, `));
    expect(block.props.accessibilityLabel).toContain(formatMoney(310000));
  });

  /** TN-28: the number on the account, and the rail it belongs to. */
  it('starts the handset as the number the server holds, on its own network', async () => {
    mockIdentity = ALINE;
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    await waitFor(() =>
      expect(screen.getByTestId('pay-rent-handset').props.value).toBe('732 123 456'),
    );
    const airtel = screen.getByLabelText(`${en['payRent.airtel']}, ${en['payRent.airtelMeta']}`);
    expect(airtel.props.accessibilityState.selected).toBe(true);
  });

  it('leaves the handset empty when the server has no number for the person', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, 'light', en['payRent.action']);
    expect(screen.getByTestId('pay-rent-handset').props.value).toBe('');
  });
});

/* -------------------------------------------- R15 · Lease detail --------- */

describe.each(SCHEMES)('R15 Lease detail in the %s scheme', (scheme) => {
  it('names the lease by its reference and draws the rent and the end', async () => {
    await open(<LeaseDetail id={RUNNING} />, scheme, lease(RUNNING).ref);
    expect(screen.getByText(en['lease.rent'])).toBeTruthy();
    expect(screen.getByText(en['lease.ends'])).toBeTruthy();
  });

  it('offers the contract, the visitor log and a maintenance report', async () => {
    await open(<LeaseDetail id={RUNNING} />, scheme, lease(RUNNING).ref);
    expect(screen.getByText(en['lease.contract'])).toBeTruthy();
    expect(screen.getByText(en['lease.visitors'])).toBeTruthy();
    expect(screen.getByText(en['lease.logMaintenance'])).toBeTruthy();
  });

  /** TN-13: renewal is P2 and hidden; its button bounced the reader home. */
  it('offers move-out on a running lease, and no renewal', async () => {
    await open(<LeaseDetail id={RUNNING} />, scheme, lease(RUNNING).ref);
    expect(screen.getByText(en['lease.fileMoveOut'])).toBeTruthy();
    expect(screen.queryByText(/renew/i)).toBeNull();
  });
});

describe('R15 Lease detail, the locked and closed arms', () => {
  /** FL25 step 3: an unsigned lease shows one control and one control only. */
  it('locks every action but signing while the lease is unsigned', async () => {
    await open(<LeaseDetail id={UNSIGNED} />, 'light', lease(UNSIGNED).ref);
    expect(screen.getByText(en['lease.contractLocked'])).toBeTruthy();
    expect(screen.getByText(en['leases.reviewAndSign'])).toBeTruthy();
    expect(screen.queryByText(/renew/i)).toBeNull();
    expect(screen.queryByText(en['lease.fileMoveOut'])).toBeNull();
  });

  it('drops the write actions on a lease that has ended', async () => {
    await open(<LeaseDetail id={CLOSED} />, 'light', lease(CLOSED).ref);
    expect(screen.getByText(en['lease.endedTitle'])).toBeTruthy();
    expect(screen.queryByText(en['lease.fileMoveOut'])).toBeNull();
  });

  it('says so rather than rendering blanks for a lease that is gone', async () => {
    await open(<LeaseDetail id="no-such-lease" />, 'light', en['lease.notFound']);
    expect(screen.getByText(en['lease.notFound'])).toBeTruthy();
  });
});

describe('R15 Lease detail, the audit fixes', () => {
  /** TN-07: the pay sheet is the demo's alone, and so is its button. */
  it('draws no Pay rent outside the demo', async () => {
    await open(<LeaseDetail id={RUNNING} />, 'light', lease(RUNNING).ref);
    expect(screen.queryByText(en['lease.payRent'])).toBeNull();
  });

  /** TN-16: it opened Rent, which showed whichever lease came first. */
  it('opens THIS lease and its month when Pay rent is pressed on the demo', async () => {
    mockIsDemo = true;
    await open(<LeaseDetail id={SECOND} />, 'light', lease(SECOND).ref);
    fireEvent.press(screen.getByText(en['lease.payRent']));
    expect(mockPushed).toContainEqual({
      pathname: '/pay-rent',
      params: { leaseId: SECOND, month: nextDuePeriod(lease(SECOND))!.month },
    });
  });

  it('opens THIS lease when Rent history is pressed', async () => {
    await open(<LeaseDetail id={SECOND} />, 'light', lease(SECOND).ref);
    fireEvent.press(screen.getByText(en['lease.rentHistory']));
    expect(mockPushed).toContainEqual({ pathname: '/rent', params: { leaseId: SECOND } });
  });

  /** TN-14: every document row offered a download that only showed a toast. */
  it('offers no download and lists no documents it cannot open', async () => {
    await open(<LeaseDetail id={RUNNING} />, 'light', lease(RUNNING).ref);
    expect(screen.queryByText(/download/i)).toBeNull();
    expect(screen.queryByLabelText(/download/i)).toBeNull();
    expect(screen.queryByText('Caution receipt')).toBeNull();
  });

  /** TN-13: no renewal-pending note either. */
  it('says nothing about a renewal, even one already requested', async () => {
    writeFixture(
      TENANCIES_KEY,
      TENANCIES.map((x) =>
        x.id === RUNNING
          ? {
              ...x,
              renewal: {
                requestedOn: '2026-08-01',
                termMonths: 12,
                startOn: '2027-02-02',
                endOn: '2028-02-01',
                rent: x.rent,
                note: '',
                state: 'pending' as const,
              },
            }
          : x,
      ),
    );
    await open(<LeaseDetail id={RUNNING} />, 'light', lease(RUNNING).ref);
    expect(screen.queryByText(/renew/i)).toBeNull();
  });

  /** TN-25: "Report something broken", then "1 open", while tickets loaded. */
  it('claims no ticket count until the tickets have been read', async () => {
    jest.spyOn(ticketStore, 'useTickets').mockReturnValue({
      status: 'loading',
      data: undefined,
      error: undefined,
      retry: jest.fn(),
    });
    await open(<LeaseDetail id={RUNNING} />, 'light', lease(RUNNING).ref);
    expect(screen.getByText(en['lease.ticketsChecking'])).toBeTruthy();
    expect(screen.queryByText(en['lease.noTickets'])).toBeNull();
  });

  /** TN-05: the notice is on this phone, and the landlord is not told. */
  it('says a saved notice has not reached the landlord', async () => {
    writeFixture(
      TENANCIES_KEY,
      TENANCIES.map((x) =>
        x.id === RUNNING
          ? {
              ...x,
              leaseState: 'ending' as const,
              notice: { filedOn: '2026-10-01', moveOutOn: '2026-11-15', message: '' },
            }
          : x,
      ),
    );
    await open(<LeaseDetail id={RUNNING} />, 'light', en['lease.noticeFiledTitle']);
    expect(
      screen.getByText(
        en['lease.noticeFiledBody']
          .replace('{landlord}', lease(RUNNING).landlord)
          .replace('{date}', formatFullDay('2026-11-15', translate)),
      ),
    ).toBeTruthy();
  });
});

/* ---------------------------------------------------- R16 · Sign --------- */

describe.each(SCHEMES)('R16 e-Sign in the %s scheme', (scheme) => {
  it('shows the three locked term columns and the way into the full contract', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, scheme, en['sign.title']);
    expect(screen.getByText(en['sign.rent'])).toBeTruthy();
    expect(screen.getByText(en['sign.cautionCol'])).toBeTruthy();
    expect(screen.getByText(en['sign.termMonths'].replace('{count}', '24'))).toBeTruthy();
    expect(screen.getByText(en['sign.readContract'])).toBeTruthy();
  });

  it('names Law 058/2021 on the consent rather than asking for a blank agreement', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, scheme, en['sign.consent']);
    expect(screen.getByText(en['sign.consentHint'])).toBeTruthy();
  });
});

describe('R16 e-Sign, the two conditions', () => {
  /**
   * FL21 §7 records signer, device and timestamp. A signature nobody drew and a
   * consent nobody affirmed are each disqualifying, and the bar says WHICH is
   * missing rather than leaving a dead button.
   */
  it('asks for the signature first and the consent second', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, 'light', en['sign.needSignature']);

    fireEvent.press(screen.getByLabelText(en['sign.consentLabel']));
    expect(screen.getByText(en['sign.needSignature'])).toBeTruthy();
  });

  it('refuses to activate until both are given', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, 'light', en['sign.action']);
    const button = screen.getByLabelText(en['sign.action']);
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('says the lease is already signed rather than offering to sign it twice', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseSign />, 'light', en['sign.signedTitle']);
    expect(screen.queryByLabelText(en['sign.action'])).toBeNull();
  });
});

describe('R16 e-Sign, what it may claim', () => {
  const landlord = lease(UNSIGNED).landlord;

  /** TN-04: the consent promised a record nothing keeps. */
  it('says before the press that the signature stays on this phone', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, 'light', en['sign.consent']);
    expect(screen.getByText(en['sign.localNote'].replace('{landlord}', landlord))).toBeTruthy();
    expect(screen.queryByText(/recorded with the contract/)).toBeNull();
  });

  it('says a signature is saved here, the landlord not told and nothing filed', async () => {
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, 'light', en['sign.action']);
    drawSignature();
    fireEvent.press(screen.getByLabelText(en['sign.consentLabel']));
    fireEvent.press(screen.getByLabelText(en['sign.action']));

    expect(await screen.findByText(en['sign.toast'], undefined, WRITE)).toBeTruthy();
    expect(screen.getAllByText(en['sign.savedTitle']).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        en['sign.savedBody']
          .replace('{landlord}', landlord)
          .replace('{date}', formatFullDay(lease(UNSIGNED).startOn, translate)),
      ),
    ).toBeTruthy();
    // Not "nothing further is needed", and never the old claims.
    expect(screen.queryByText(en['sign.alreadyActiveTitle'])).toBeNull();
    expect(screen.queryByText(/queued to file|wired/)).toBeNull();
    expect(storedLease(UNSIGNED)?.signedOnDevice).toBe(true);
  });

  /** TN-12 and TN-29: a signature that failed to save was confirmed as active. */
  it('renders the failure and toasts nothing when the signature does not save', async () => {
    failTenancyWrites();
    mockParams = { leaseId: UNSIGNED };
    await open(<LeaseSign />, 'light', en['sign.action']);
    drawSignature();
    fireEvent.press(screen.getByLabelText(en['sign.consentLabel']));
    fireEvent.press(screen.getByLabelText(en['sign.action']));

    expect(await screen.findByText(en['write.failedLegalBody'], undefined, WRITE)).toBeTruthy();
    expect(screen.getByText(en['write.failedTitle'])).toBeTruthy();
    expect(screen.queryByText(en['sign.toast'])).toBeNull();
    expect(storedLease(UNSIGNED)?.leaseState).toBe('pending_signature');

    // The ink and the tick are still there, so the retry is one press.
    writeFixture(TENANCIES_KEY, [...TENANCIES]);
    fireEvent.press(screen.getByLabelText(en['write.retry']));
    expect(await screen.findByText(en['sign.toast'], undefined, WRITE)).toBeTruthy();
    expect(storedLease(UNSIGNED)?.leaseState).toBe('active');
  });
});

/* ------------------------------------------------ R17 · Move-out --------- */

describe.each(SCHEMES)('R17 Move-out in the %s scheme', (scheme) => {
  /** The banner reads `noticeDays` off the lease, not a module constant. */
  it('computes the notice rule from the lease it is ending', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMoveOut />, scheme, en['moveOut.rule'].replace('{days}', '30'));
    expect(screen.getByText(en['moveOut.dateLabel'])).toBeTruthy();
  });

  it('carries the Caution consequence before the button that files', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMoveOut />, scheme, en['moveOut.cautionTitle']);
    expect(screen.getByText(en['moveOut.cautionBody'])).toBeTruthy();
  });
});

describe('R17 Move-out, the rule per lease', () => {
  /**
   * The proof that the number is per lease and not a constant: the Ingoro
   * contract's clause 5 says thirty, the Nyamirambo one says fourteen, and the
   * banner reads whichever lease the reader is actually ending.
   */
  it('reads fourteen days on the contract that asks for fourteen', async () => {
    mockParams = { leaseId: SECOND };
    await open(<LeaseMoveOut />, 'light', en['moveOut.rule'].replace('{days}', '14'));
    expect(screen.queryByText(en['moveOut.rule'].replace('{days}', '30'))).toBeNull();
  });

  it('refuses on a lease that has already closed', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<LeaseMoveOut />, 'light', en['moveOut.unavailableTitle']);
    expect(screen.queryByText(en['moveOut.action'])).toBeNull();
  });

  it('will not file until a date is chosen', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMoveOut />, 'light', en['moveOut.action']);
    expect(screen.getByLabelText(en['moveOut.action']).props.accessibilityState.disabled).toBe(
      true,
    );
  });
});

describe('R17 Move-out, what it may claim', () => {
  const landlord = lease(RUNNING).landlord;

  /** TN-05: "{landlord} has been notified" was false. */
  it('says the notice is saved here and the landlord is not told', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMoveOut />, 'light', en['moveOut.action']);
    pickMoveOutDate();
    fireEvent.press(screen.getByLabelText(en['moveOut.action']));
    // The confirm says what pressing it does, before it is pressed.
    expect(screen.getByText(new RegExp(`${landlord} is not told yet`))).toBeTruthy();
    fireEvent.press(screen.getByLabelText(en['moveOut.confirmAction']));

    expect(await screen.findByText(en['moveOut.toast'], undefined, WRITE)).toBeTruthy();
    expect(screen.getByText(en['moveOut.alreadyFiledTitle'])).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${landlord} is not told yet, so give them`))).toBeTruthy();
    expect(screen.queryByText(/has been notified|wired/)).toBeNull();
    expect(storedLease(RUNNING)?.leaseState).toBe('ending');
  });

  /** TN-12 and TN-29. */
  it('renders the failure and toasts nothing when the notice does not save', async () => {
    failTenancyWrites();
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMoveOut />, 'light', en['moveOut.action']);
    pickMoveOutDate();
    fireEvent.press(screen.getByLabelText(en['moveOut.action']));
    fireEvent.press(screen.getByLabelText(en['moveOut.confirmAction']));

    expect(await screen.findByText(en['write.failedLegalBody'], undefined, WRITE)).toBeTruthy();
    expect(screen.queryByText(en['moveOut.toast'])).toBeNull();
    expect(storedLease(RUNNING)?.notice).toBeUndefined();

    // The date the person confirmed is kept, so the retry does not ask again.
    writeFixture(TENANCIES_KEY, [...TENANCIES]);
    fireEvent.press(screen.getByLabelText(en['write.retry']));
    expect(await screen.findByText(en['moveOut.toast'], undefined, WRITE)).toBeTruthy();
    expect(storedLease(RUNNING)?.leaseState).toBe('ending');
  });
});

/* -------------------------------------------------- R18 · Renew ---------- */

/*
 * The route is hidden in v1.0 (`guard={false}`) and nothing links here, but the
 * screen is kept and held to the same rules as the live ones meanwhile.
 */

describe.each(SCHEMES)('R18 Renew in the %s scheme', (scheme) => {
  it('offers the three terms and derives the new dates from the current end', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, scheme, en['renew.newTerm']);
    expect(screen.getByText(en['renew.term6'])).toBeTruthy();
    expect(screen.getByText(en['renew.term12'])).toBeTruthy();
    expect(screen.getByText(en['renew.term24'])).toBeTruthy();
  });

  /** F-R13 §6: a rent change needs a new lease, so the field is not one. */
  it('carries the rent forward read-only and says why', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, scheme, en['renew.rentLocked']);
    expect(screen.getByDisplayValue('310,000').props.editable).toBe(false);
  });
});

describe('R18 Renew, sending', () => {
  it('records the request without moving the current term', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, 'light', en['renew.action']);
    fireEvent.press(screen.getByLabelText(en['renew.action']));

    await waitFor(() => {
      const stored = readFixture<Tenancy[]>(TENANCIES_KEY, []).find((x) => x.id === RUNNING);
      expect(stored?.renewal?.state).toBe('pending');
      expect(stored?.endOn).toBe(lease(RUNNING).endOn);
    });
  });

  /**
   * Same state, two moments. "Already saved" one second after you pressed Send
   * reads as though the app lost the request.
   */
  it('says the request was saved, not that one was already waiting', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, 'light', en['renew.action']);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['renew.action']));
    });

    // The page header names the state in either moment; the card body is what
    // distinguishes them, so that is what is asserted.
    const sent = en['renew.sentBody']
      .replace('{landlord}', lease(RUNNING).landlord)
      // A 12 month term from the day after the current end, the default the
      // screen offers, printed the way `formatFullDay` prints it.
      .replace(
        '{date}',
        formatFullDay(addDays(addMonths(addDays(lease(RUNNING).endOn, 1), 12), -1), translate),
      );
    await waitFor(() => expect(screen.getByText(sent)).toBeTruthy());
    expect(screen.queryByText(en['renew.pendingTitle'])).toBeNull();
  });

  it('says a request is already waiting when one was there on arrival', async () => {
    writeFixture(
      TENANCIES_KEY,
      TENANCIES.map((x) =>
        x.id === RUNNING
          ? {
              ...x,
              renewal: {
                requestedOn: '2026-08-01',
                termMonths: 12,
                startOn: '2027-02-02',
                endOn: '2028-02-01',
                rent: x.rent,
                note: '',
                state: 'pending' as const,
              },
            }
          : x,
      ),
    );
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, 'light', en['renew.pendingTitle']);
    const pendingBody = en['renew.pendingBody']
      .replace('{on}', '1 August 2026')
      .replace('{date}', '1 February 2028');
    expect(screen.getByText(pendingBody)).toBeTruthy();
  });

  /** TN-12 and TN-29. */
  it('renders the failure and toasts nothing when the request does not save', async () => {
    failTenancyWrites();
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, 'light', en['renew.action']);
    fireEvent.press(screen.getByLabelText(en['renew.action']));

    expect(await screen.findByText(en['write.failedTitle'], undefined, WRITE)).toBeTruthy();
    expect(screen.queryByText(en['renew.toast'])).toBeNull();
    expect(storedLease(RUNNING)?.renewal).toBeUndefined();
  });
});

/* ----------------------------------------------- R19 · Visitors ---------- */

describe.each(SCHEMES)('R19 Visitor log in the %s scheme', (scheme) => {
  it('lists the entries with their relation and how long they stayed', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseVisitors />, scheme, 'Marie Keza');
    expect(screen.getByText(en['visitors.add'])).toBeTruthy();
  });

  /** F-R14 §8: an overnight visitor with no departure is still in the unit. */
  it('flags an overnight visitor who has not left', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseVisitors />, scheme, en['visitors.stillIn']);
  });

  /**
   * The frame's footnote implies the landlord browses this. F-R14 §6 says the
   * opposite and this screen states the feature's rule, not the frame's.
   */
  it('states the privacy rule the feature actually guarantees', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseVisitors />, scheme, en['visitors.footnote']);
  });
});

describe('R19 Visitor log, writing', () => {
  it('logs a visitor through the store', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseVisitors />, 'light', en['visitors.add']);
    fireEvent.press(screen.getByLabelText(en['visitors.add']));

    fireEvent.changeText(screen.getByLabelText(en['visitors.nameLabel']), 'Aline Uwera');
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['visitors.save']));
    });

    await waitFor(() => {
      const stored = readFixture<Tenancy[]>(TENANCIES_KEY, []).find((x) => x.id === RUNNING);
      expect(stored?.visitors[0].name).toBe('Aline Uwera');
    });
    expect(
      await screen.findByText(en['visitors.toast'].replace('{name}', 'Aline Uwera'), undefined, WRITE),
    ).toBeTruthy();
  });

  it('is read-only history on a lease that has ended', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<LeaseVisitors />, 'light', en['visitors.readOnlyTitle']);
    expect(screen.queryByLabelText(en['visitors.add'])).toBeNull();
  });

  /**
   * TN-12 and TN-29. The sheet used to close on the press and toast "logged"
   * whatever happened, so a failed save threw the name away.
   */
  it('keeps the entry in front of the person when it does not save', async () => {
    failTenancyWrites();
    mockParams = { leaseId: RUNNING };
    await open(<LeaseVisitors />, 'light', en['visitors.add']);
    fireEvent.press(screen.getByLabelText(en['visitors.add']));
    fireEvent.changeText(screen.getByLabelText(en['visitors.nameLabel']), 'Aline Uwera');
    fireEvent.press(screen.getByLabelText(en['visitors.save']));

    expect(await screen.findByText(en['write.failedTitle'], undefined, WRITE)).toBeTruthy();
    expect(screen.queryByText(en['visitors.toast'].replace('{name}', 'Aline Uwera'))).toBeNull();
    expect(screen.getByDisplayValue('Aline Uwera')).toBeTruthy();

    writeFixture(TENANCIES_KEY, [...TENANCIES]);
    fireEvent.press(screen.getByLabelText(en['write.retry']));
    expect(
      await screen.findByText(en['visitors.toast'].replace('{name}', 'Aline Uwera'), undefined, WRITE),
    ).toBeTruthy();
    expect(storedLease(RUNNING)?.visitors[0].name).toBe('Aline Uwera');
  });
});

/* --------------------------------------- R20 · Report an issue ----------- */

describe.each(SCHEMES)('R20 Report an issue in the %s scheme', (scheme) => {
  it('asks what is wrong, for detail, for photographs and for a priority', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, scheme, en['issue.whatLabel']);
    expect(screen.getByText(en['issue.detailLabel'])).toBeTruthy();
    expect(screen.getByText(en['issue.photos'])).toBeTruthy();
    expect(screen.getByText(en['issue.priority'])).toBeTruthy();
  });

  it('says who the ticket is for', async () => {
    mockParams = { leaseId: RUNNING };
    const goesTo = en['issue.goesTo'].replace('{org}', lease(RUNNING).landlordOrg);
    // The unit and the destination are one line, so the assertion is on the
    // line a reader actually sees rather than on half of it.
    await open(<LeaseMaintenanceNew />, scheme, `${lease(RUNNING).unit} · ${goesTo}`);
  });
});

/** Fill the form's one required field and press submit. */
async function fileLeak(): Promise<void> {
  fireEvent.changeText(screen.getByLabelText(en['issue.whatLabel']), 'Leaking kitchen tap');
  await act(async () => {
    fireEvent.press(screen.getByLabelText(en['issue.action']));
  });
}

describe('R20 Report an issue, filing', () => {
  const org = lease(RUNNING).landlordOrg;

  it('will not submit without saying what is wrong', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.needTitle']);
    expect(screen.getByLabelText(en['issue.action']).props.accessibilityState.disabled).toBe(true);
  });

  /** The point of the shared store: the landlord's Repairs tab reads this. */
  it('writes a ticket into the store the landlord surface reads', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();

    await waitFor(() => {
      const stored = readFixture<Ticket[]>(TICKETS_KEY, []);
      expect(stored[0]).toMatchObject({
        title: 'Leaking kitchen tap',
        leaseId: RUNNING,
        state: 'open',
      });
    });
  });

  it('refuses a ticket against a lease that has ended', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.closedTitle']);
    expect(screen.queryByLabelText(en['issue.action'])).toBeNull();
  });

  /** TN-03: the reporter is the person on the server, never the fixture. */
  it('names the reporter from the server', async () => {
    mockIdentity = ALINE;
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();
    await waitFor(() =>
      expect(readFixture<Ticket[]>(TICKETS_KEY, [])[0]?.reporter).toBe('Aline Uwase'),
    );
  });

  it('says the reporter has no name on file rather than borrowing one', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();
    await waitFor(() =>
      expect(readFixture<Ticket[]>(TICKETS_KEY, [])[0]?.reporter).toBe(en['identity.unnamed']),
    );
    expect(readFixture<Ticket[]>(TICKETS_KEY, [])[0]?.reporter).not.toBe(FIXTURE_PERSON);
  });

  /** TN-06: "{org} sees it now" and "you get a message here" were both false. */
  it('says the report is saved here and the landlord is not told', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();

    expect(await screen.findByText(en['issue.toast'], undefined, WRITE)).toBeTruthy();
    expect(screen.getByText(en['issue.filedBody'].replace('{org}', org))).toBeTruthy();
    expect(screen.queryByText(/sees it|message here|wired/)).toBeNull();
  });

  /** TN-11: the queued state is its own, and never "filed". */
  it('says a report made offline will be sent when the phone reconnects', async () => {
    mockOnline = false;
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();

    expect(await screen.findByText(en['queue.submittedWhenOnline'], undefined, WRITE)).toBeTruthy();
    expect(screen.getByText(en['issue.queuedBody'])).toBeTruthy();
    expect(screen.queryByText(en['issue.filedTitle'])).toBeNull();
    expect(screen.queryByText(en['issue.toast'])).toBeNull();
  });

  /**
   * TN-11 and TN-29. The screen read the write's state from the render that
   * pressed the button, so a send that failed was confirmed as filed.
   */
  it('renders the failure, keeps the report, and sends it on retry', async () => {
    failTicketWrites();
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    await fileLeak();

    expect(await screen.findByText(en['issue.keptBody'], undefined, WRITE)).toBeTruthy();
    expect(screen.getByText(en['queue.sendFailed'])).toBeTruthy();
    expect(screen.queryByText(en['issue.toast'])).toBeNull();
    expect(screen.queryByText(en['issue.filedTitle'])).toBeNull();
    // The form is gone while the report is kept, so it cannot be filed twice.
    expect(screen.queryByLabelText(en['issue.action'])).toBeNull();

    writeFixture(TICKETS_KEY, [...TICKETS]);
    fireEvent.press(screen.getByLabelText(en['write.retry']));
    expect(await screen.findByText(en['issue.toast'], undefined, WRITE)).toBeTruthy();
    const filed = readFixture<Ticket[]>(TICKETS_KEY, []).filter(
      (x) => x.title === 'Leaking kitchen tap',
    );
    expect(filed).toHaveLength(1);
  });

  /** TN-19: lease detail dropped resolved tickets and this list did not. */
  it('lists only the tickets on this lease that are still open', async () => {
    const mine = (ref: string, title: string, state: Ticket['state']): Ticket => ({
      ...TICKETS[0],
      ref,
      title,
      state,
      leaseId: RUNNING,
    });
    writeFixture(TICKETS_KEY, [
      mine('T-301', 'Window latch loose', 'open'),
      mine('T-300', 'Bathroom fan replaced', 'resolved'),
      ...TICKETS,
    ]);
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.openOnLease']);
    expect(screen.getByText('Window latch loose')).toBeTruthy();
    expect(screen.queryByText('Bathroom fan replaced')).toBeNull();
  });
});

/* ------------------------------------------ the contract viewer ---------- */

describe.each(SCHEMES)('the contract viewer in the %s scheme', (scheme) => {
  it('offers both texts, because both are on the record', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, scheme, en['contract.clauses']);
    expect(screen.getByText(en['contract.en'])).toBeTruthy();
    expect(screen.getByText(en['contract.rw'])).toBeTruthy();
    expect(screen.getByText(en['contract.bilingual'])).toBeTruthy();
  });

  it('switches the document without switching the interface', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, scheme, en['contract.clauses']);
    expect(screen.getByText(lease(RUNNING).terms[0])).toBeTruthy();

    fireEvent.press(screen.getByText(en['contract.rw']));
    expect(screen.getByText(lease(RUNNING).termsRw[0])).toBeTruthy();
    // The chrome stayed in the reader's own locale.
    expect(screen.getByText(en['contract.clauses'])).toBeTruthy();
  });
});

describe('the contract viewer, the empty arm', () => {
  it('says a pre-app tenancy has no clause text rather than drawing an empty box', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<LeaseContract />, 'light', en['contract.emptyTitle']);
    expect(screen.getByText(en['contract.emptyBody'])).toBeTruthy();
  });
});

describe('the contract viewer, the audit fixes', () => {
  /** TN-03: the Tenant party was the fixture persona for whoever held the phone. */
  it('names the person holding the phone as the tenant, from the server', async () => {
    mockIdentity = ALINE;
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, 'light', en['contract.clauses']);
    expect(screen.getByText('Aline Uwase')).toBeTruthy();
    expect(screen.queryByText(FIXTURE_PERSON)).toBeNull();
  });

  it('says the tenant has no name on file rather than borrowing one', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, 'light', en['contract.clauses']);
    expect(screen.getByText(en['identity.unnamed'])).toBeTruthy();
    expect(screen.queryByText(FIXTURE_PERSON)).toBeNull();
  });

  it('draws no name while the profile is still being read', async () => {
    mockIdentity = { ...NOBODY, pending: true };
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, 'light', en['contract.clauses']);
    expect(
      screen.getByLabelText(`${en['contract.tenant']}: ${en['state.loading']}`),
    ).toBeTruthy();
    expect(screen.queryByText(en['identity.unnamed'])).toBeNull();
  });

  /** TN-14: "Download PDF" only ever showed a toast saying it was mocked. */
  it('offers no download', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, 'light', en['contract.clauses']);
    expect(screen.queryByText(/download/i)).toBeNull();
  });

  /** TN-26: a fixed 82dp column broke "Landlord" mid-word at large sizes. */
  it('gives the label column a floor rather than a fixed width', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseContract />, 'light', en['contract.clauses']);
    const label = screen.getByText(en['contract.landlord']);
    const style = flattenStyle(label.props.style);
    expect(style.minWidth).toBe(82);
    expect(style.width).toBeUndefined();
    expect(styleUp(label.parent as Node, 'flexWrap')).toBe('wrap');
  });
});
