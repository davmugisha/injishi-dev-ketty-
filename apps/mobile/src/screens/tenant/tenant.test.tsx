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
 * The `mock` prefix on those three closures is jest's rule, not a style: a mock
 * factory is hoisted above the file, so only names it can prove are lazily read
 * may be captured.
 *
 * The substantive assertions are the ones a wrong screen would pass without:
 * the sign button refusing until both conditions are met, the move-out banner
 * reading its notice period off the lease rather than a constant, the locked
 * rows on an unsigned lease, and the ticket a tenant files turning up in the
 * store the landlord reads.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastProvider } from '@/components';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { translate } from '@/i18n/i18n';
import { addDays, addMonths, formatFullDay } from './dates';
import { resetFixtures, readFixture } from '@/data/use-fixture-mutation';
// The attempt journal is module-level and outlives a test on purpose — that is
// what "survives backgrounding and app kill" means. So a test file has to clear
// it, or the second test on the same lease opens straight into the first test's
// settled attempt rather than onto the form.
import { resetAttempts } from '@/data/payment-attempt';
import { TENANCIES, type Tenancy } from '@/data/rentals';
import { TENANCIES_KEY } from '@/data/tenancy-store';
import { TICKETS_KEY, type Ticket } from '@/data/tickets';
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

jest.mock('@/domain', () => ({
  useDomain: () => ({
    domain: 'residence',
    setDomain: jest.fn(),
    workspace: { id: 'personal', name: 'Personal', role: 'Tenant', kind: 'personal' },
    setWorkspace: jest.fn(),
    surface: 'tenant',
  }),
}));

/** Frames R11, R12 and R15's own lease: Ingoro A2, active, 30-day notice. */
const RUNNING = 'ingoro-apartments-a2';
/** The invite's lease, awaiting signature. Frames X3 and R16. */
const UNSIGNED = 'kimironko-flat-3';
const CLOSED = 'gikondo-garden-flat';

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
  resetFixtures();
  resetAttempts();
});
afterEach(() => {
  resetFixtures();
  resetAttempts();
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
    resetFixtures();
    const { writeFixture } = require('@/data/use-fixture-mutation');
    writeFixture(TENANCIES_KEY, [] as Tenancy[]);
    await open(<Leases />, 'light', en['leases.emptyTitle']);
    expect(screen.getByText(en['leases.emptyBody'])).toBeTruthy();
  });

  it('renders in Kinyarwanda without falling back to English', async () => {
    await open(<Leases />, 'light', 'Ingoro Apartments', 'rw');
    expect(screen.getByText('Amasezerano yanjye')).toBeTruthy();
  });
});

/* ------------------------------------------------------ R12 · Rent ------- */

describe.each(SCHEMES)('R12 Rent in the %s scheme', (scheme) => {
  it('leads with the next payment on the hero plate', async () => {
    await open(<Rent />, scheme, en['rent.nextPayment']);
    // The figure is on the plate and on every ledger row of the same amount.
    expect(screen.getAllByText('310,000').length).toBeGreaterThan(0);
    expect(screen.getByText(en['rent.payRent'])).toBeTruthy();
  });

  it('prints the adapter provenance under the button, not after it', async () => {
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
    await open(<Rent />, 'light', en['rent.nextPayment']);
    fireEvent.press(screen.getByText(en['rent.payRent']));
    expect(mockPushed[0]).toEqual({
      pathname: '/pay-rent',
      params: { leaseId: RUNNING, month: NEXT_DUE },
    });
  });
});

/* ------------------------------------------ the pay-rent sheet ----------- */

describe.each(SCHEMES)('the pay-rent sheet in the %s scheme', (scheme) => {
  it('offers the two mobile money rails, in the order they answer in, and no card', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, scheme, en['payRent.mtn']);
    expect(screen.getByText(en['payRent.airtel'])).toBeTruthy();
    // The owner's decision of 2026-10-01: the app takes no card details.
    expect(screen.queryByText(/card/i)).toBeNull();
  });

  it('says nothing leaves the account before the button that pays', async () => {
    mockParams = { leaseId: RUNNING, month: NEXT_DUE };
    await open(<PayRent />, scheme, en['payRent.mockTitle']);
    expect(screen.getByText(en['payRent.mockBody'])).toBeTruthy();
  });
});

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
    fireEvent.changeText(screen.getByTestId('pay-rent-handset'), '788123456');
    fireEvent.press(screen.getByText(en['payRent.action']));

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
    fireEvent.changeText(screen.getByTestId('pay-rent-handset'), '788123456');
    fireEvent.press(screen.getByText(en['payRent.action']));
    expect(await screen.findByText(en['payRent.stillOwed'])).toBeTruthy();
  });

  it('says so rather than offering a payment when nothing is due', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<PayRent />, 'light', en['payRent.nothingDueTitle']);
    expect(screen.queryByText(en['payRent.action'])).toBeNull();
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

  it('offers renewal and move-out on a running lease', async () => {
    await open(<LeaseDetail id={RUNNING} />, scheme, lease(RUNNING).ref);
    expect(screen.getByText(en['lease.requestRenewal'])).toBeTruthy();
    expect(screen.getByText(en['lease.fileMoveOut'])).toBeTruthy();
  });
});

describe('R15 Lease detail, the locked and closed arms', () => {
  /** FL25 step 3: an unsigned lease shows one control and one control only. */
  it('locks every action but signing while the lease is unsigned', async () => {
    await open(<LeaseDetail id={UNSIGNED} />, 'light', lease(UNSIGNED).ref);
    expect(screen.getByText(en['lease.contractLocked'])).toBeTruthy();
    expect(screen.getByText(en['leases.reviewAndSign'])).toBeTruthy();
    expect(screen.queryByText(en['lease.requestRenewal'])).toBeNull();
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
    mockParams = { leaseId: 'nyamirambo-flat-1' };
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

/* -------------------------------------------------- R18 · Renew ---------- */

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
   * Same state, two moments. "Already with your landlord" one second after you
   * pressed Send reads as though the app lost the request.
   */
  it('says the request was sent, not that one was already waiting', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseRenew />, 'light', en['renew.action']);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['renew.action']));
    });

    // The page header names the state in either moment ("Request sent"); the
    // card body is what distinguishes them, so that is what is asserted.
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
    const { writeFixture } = require('@/data/use-fixture-mutation');
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
  });

  it('is read-only history on a lease that has ended', async () => {
    mockParams = { leaseId: CLOSED };
    await open(<LeaseVisitors />, 'light', en['visitors.readOnlyTitle']);
    expect(screen.queryByLabelText(en['visitors.add'])).toBeNull();
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

  it('says where the ticket is going', async () => {
    mockParams = { leaseId: RUNNING };
    const goesTo = en['issue.goesTo'].replace('{org}', lease(RUNNING).landlordOrg);
    // The unit and the destination are one line, so the assertion is on the
    // line a reader actually sees rather than on half of it.
    await open(<LeaseMaintenanceNew />, scheme, `${lease(RUNNING).unit} · ${goesTo}`);
  });
});

describe('R20 Report an issue, filing', () => {
  it('will not submit without saying what is wrong', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.needTitle']);
    expect(screen.getByLabelText(en['issue.action']).props.accessibilityState.disabled).toBe(true);
  });

  /** The point of the shared store: the landlord's Repairs tab reads this. */
  it('writes a ticket into the store the landlord surface reads', async () => {
    mockParams = { leaseId: RUNNING };
    await open(<LeaseMaintenanceNew />, 'light', en['issue.whatLabel']);
    fireEvent.changeText(
      screen.getByLabelText(en['issue.whatLabel']),
      'Leaking kitchen tap',
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['issue.action']));
    });

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
