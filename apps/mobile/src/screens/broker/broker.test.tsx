/**
 * The four Broker screens, in both schemes, plus the reveal end to end.
 *
 * The assertions are about behaviour a reader can see rather than about
 * styling: that the Directory is the only place a Residence unit appears, that
 * a landlord's digits are genuinely absent from the tree until a credit is
 * spent, that spending one moves the credit AND the log AND the placement list,
 * and that the chart reports its values to a reader who cannot see it.
 * `broker.test.ts` and `broker-search.test.ts` cover the maths underneath;
 * this covers the wiring, which is the half that silently comes loose.
 *
 * The reveal test is the one worth reading. It asserts a negative — that
 * `+250 788 512 044` is nowhere in the rendered tree beforehand — because the
 * screen's whole security posture is that the number is not on the device, and
 * a blur over the real digits would pass every positive assertion in this file.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Directory } from './directory';
import { UnitDetail } from './unit-detail';
import { UnitReveal } from './unit-reveal';
import { Placements } from './placements';
import { Earnings } from './earnings';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures } from '@/data/use-fixture-mutation';
import * as fixtureStore from '@/data/use-fixture-mutation';
import { dropAll } from '@/data/write-queue';
import {
  CREDITS_KEY,
  DIRECTORY_UNITS,
  PLACEMENTS_KEY,
  REVEALS_KEY,
  SEED_CREDITS,
  SEED_PLACEMENTS,
  SEED_REVEALS,
  countByBucket,
  getUnit,
  summariseEarnings,
  type Reveal,
} from '@/data/broker';
import { readFixture, writeFixture } from '@/data/use-fixture-mutation';
import type { Placement } from '@/data/broker';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

/**
 * Every Broker screen reads the active workspace for its chip and some of them
 * raise a toast, so both providers are real here rather than mocked — a toast
 * that never mounts is one of the assertions this file most wants to make.
 */
const asBroker = (ui: ReactElement) => (
  <DomainProvider initial="residence" initialSurface="broker">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

/**
 * Frame B22's unit. The seed already carries a placement on it, so its landlord
 * contact is REVEALED — which is what makes it the right unit for the "already
 * revealed" path and the wrong one for the masking assertions.
 */
const UMURAVA = getUnit('umurava-heights-b4')!;

/** A unit no seeded placement touches, so it opens genuinely un-revealed. */
const FRESH = getUnit('kivu-court-7')!;

/** How many units are free today. Derived, so a fixture edit moves the test. */
const VACANT_NOW = DIRECTORY_UNITS.filter((u) => u.vacancy.state === 'now').length;

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  resetFixtures();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
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
  // A reveal queued offline would drain in the NEXT test the moment it renders
  // online, and spend a credit in that test's store. Spies come off too.
  act(() => dropAll());
  jest.restoreAllMocks();
  resetFixtures();
});

/* --------------------------------------------------------------- cold reads */

/**
 * `useFixture` caches a resolved key for the LIFE OF THE MODULE, which is what
 * stops a screen re-skeletoning every time it is navigated back to. That makes
 * the loading branch reachable exactly once per key per test file, so it is
 * asserted here — first, before anything else renders — rather than inside the
 * per-scheme blocks, where the light run would warm every key for the dark one
 * and the dark assertion would be passing on a lie.
 */
describe('every list skeletons its first read rather than flashing an empty one', () => {
  const loading = (label: string) =>
    screen.getByLabelText(en['state.loadingList'].replace('{label}', label));

  /**
   * The device rig's finding (BR-06): while the directory loaded, the rail
   * read "Vacant now · 0" and "Vacant soon · 0", an empty market rather than a
   * slow one. The chips are drawn with no count until the read lands.
   */
  it('does it on the Directory, with no count on the rail yet', () => {
    renderInScheme(asBroker(<Directory />), 'light');
    expect(loading(en['directory.listLabel'])).toBeTruthy();
    expect(screen.getByLabelText(en['directory.chipVacantNow'])).toBeTruthy();
    expect(screen.queryByText(`${en['directory.chipVacantNow']} · 0`)).toBeNull();
    expect(screen.queryByText(`${en['directory.chipVacantSoon']} · 0`)).toBeNull();
  });

  it('does it on Placements, with no count on the tabs yet', () => {
    renderInScheme(asBroker(<Placements />), 'light');
    expect(loading(en['placements.listLabel'])).toBeTruthy();
    expect(screen.getByLabelText(en['placements.bucketActive'])).toBeTruthy();
    expect(screen.queryByLabelText(`${en['placements.bucketActive']}, 0`)).toBeNull();
    expect(screen.queryByLabelText(`${en['placements.bucketExpired']}, 0`)).toBeNull();
  });

  it('does it on Earnings', () => {
    renderInScheme(asBroker(<Earnings />), 'light');
    expect(loading(en['earnings.listLabel'])).toBeTruthy();
  });

  it('does it on the unit detail, shaped like the page rather than like a list', () => {
    renderInScheme(asBroker(<UnitDetail id={FRESH.id} />), 'light');
    expect(loading(en['unit.listLabel'])).toBeTruthy();
  });
});

/* ------------------------------------------------------------- B21 · Directory */

describe.each(SCHEMES)('Directory in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(UMURAVA.title)).toBeTruthy());

  it('says out loud that this inventory is private, which is the whole channel', async () => {
    renderInScheme(asBroker(<Directory />), scheme);
    expect(screen.getByText(en['directory.title'])).toBeTruthy();
    expect(screen.getByText(en['directory.privateNote'])).toBeTruthy();
    await settled();
  });

  it('draws the vacancy on the photograph and the fee under it', async () => {
    renderInScheme(asBroker(<Directory />), scheme);
    await settled();
    expect(screen.getAllByText(en['directory.vacantNow']).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(en['directory.feePercent'].replace('{percent}', '50')).length,
    ).toBeGreaterThan(0);
  });

  it('narrows the list from the rail and says how many are left', async () => {
    renderInScheme(asBroker(<Directory />), scheme);
    await settled();

    expect(
      screen.getByText(
        en['directory.resultsCount'].replace('{count}', String(DIRECTORY_UNITS.length)),
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText(`${en['directory.chipVacantNow']}, ${VACANT_NOW}`));
    await waitFor(() =>
      expect(
        screen.getByText(en['directory.resultsCount'].replace('{count}', String(VACANT_NOW))),
      ).toBeTruthy(),
    );
  });

  it('opens the unit rather than the Guest listing page', async () => {
    renderInScheme(asBroker(<Directory />), scheme);
    await settled();

    fireEvent.press(
      screen.getByLabelText(
        en['directory.cardSummary']
          .replace('{title}', UMURAVA.title)
          .replace('{place}', UMURAVA.district)
          .replace('{rent}', 'RWF 320,000')
          .replace('{vacancy}', en['directory.vacantNow']),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/directory/[unitId]',
      params: { unitId: UMURAVA.id },
    });
  });

  it('names the filter that emptied the list and offers to lift exactly that one', async () => {
    renderInScheme(asBroker(<Directory />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(en['directory.chipFilters']));
    fireEvent.press(await screen.findByText(`${en['directory.bedPlus'].replace('{count}', '4')} · 2`));
    fireEvent.press(screen.getByText('Gisozi · 1'));
    fireEvent.press(screen.getByText(en['directory.filtersApplyNone']));

    await waitFor(() =>
      expect(
        screen.getByText(
          en['directory.emptyFilterTitle'].replace('{filter}', en['directory.dimDistrict']),
        ),
      ).toBeTruthy(),
    );
  });

  it('says the list is the last one that loaded when the connection is gone', async () => {
    mockNetwork.isConnected = false;
    renderInScheme(asBroker(<Directory />), scheme);
    expect(screen.getByText(en['state.offlineLastList'])).toBeTruthy();
  });
});

/* ----------------------------------------------------------- B22 · Unit detail */

describe.each(SCHEMES)('Unit detail in the %s scheme', (scheme) => {
  const settled = () => waitFor(() => expect(screen.getByText(UMURAVA.title)).toBeTruthy());

  it('leads with the rent, the size and the three chips the frame draws', async () => {
    renderInScheme(asBroker(<UnitDetail id={UMURAVA.id} />), scheme);
    await settled();
    // Twice on purpose: the chip row and the terms card both state the tenure,
    // which is the frame's own layout.
    expect(screen.getAllByText(en['unit.tenureLong'])).toHaveLength(2);
    expect(
      screen.getAllByText(en['directory.feePercent'].replace('{percent}', '50')).length,
    ).toBeGreaterThan(0);
  });

  /**
   * The assertion this screen exists for. A blurred real number would pass
   * every other test in this file and leak on any device where the blur does
   * not render.
   */
  it('does not hold the landlord’s number anywhere in the tree before a reveal', async () => {
    renderInScheme(asBroker(<UnitDetail id={FRESH.id} />), scheme);
    await waitFor(() => expect(screen.getByText(FRESH.title)).toBeTruthy());
    expect(screen.queryByText(FRESH.landlord.phone)).toBeNull();
    expect(screen.queryByText(FRESH.landlord.email)).toBeNull();
    expect(screen.queryByText(FRESH.landlord.name)).toBeNull();
    expect(screen.getByText(en['unit.landlordMasked'])).toBeTruthy();
  });

  it('prints the credit balance under the button rather than behind it', async () => {
    renderInScheme(asBroker(<UnitDetail id={FRESH.id} />), scheme);
    await waitFor(() => expect(screen.getByText(FRESH.title)).toBeTruthy());
    expect(
      screen.getByText(en['unit.revealCreditsLeft'].replace('{count}', String(SEED_CREDITS))),
    ).toBeTruthy();
  });

  it('shows the contact and the log entry once the reveal has landed', async () => {
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), scheme);

    fireEvent.press(screen.getByText(en['reveal.confirm']));
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), { timeout: 4000 });

    screen.unmount();
    renderInScheme(asBroker(<UnitDetail id={FRESH.id} />), scheme);
    await waitFor(() => expect(screen.getByText(FRESH.title)).toBeTruthy());
    expect(screen.getByText(FRESH.landlord.phone)).toBeTruthy();
    expect(screen.getByText(en['unit.revealed'])).toBeTruthy();
  });

  it('offers no "Place a tenant", which opened a form a broker cannot open', async () => {
    renderInScheme(asBroker(<UnitDetail id={UMURAVA.id} />), scheme);
    await settled();
    // Umurava B4 carries a seeded placement, so the placement card is drawn.
    expect(screen.getByText(en['unit.sectionPlacement'])).toBeTruthy();
    expect(screen.queryByText('Place a tenant')).toBeNull();
    expect(mockPush).not.toHaveBeenCalledWith('/lease/new');
  });

  it('says a let unit cannot take a placement instead of offering one', async () => {
    renderInScheme(asBroker(<UnitDetail id="ingoro-apartments-b2" />), scheme);
    await waitFor(() => expect(screen.getByText(en['unit.leasedTitle'])).toBeTruthy());
    expect(screen.getByText(en['unit.leasedBody'])).toBeTruthy();
  });

  it('offers a way onward when the id resolves to nothing', async () => {
    renderInScheme(asBroker(<UnitDetail id="no-such-unit" />), scheme);
    await waitFor(() => expect(screen.getByText(en['unit.notFoundTitle'])).toBeTruthy());
    expect(screen.getByText(en['unit.notFoundAction'])).toBeTruthy();
  });
});

/* --------------------------------------------------------- B22 · the reveal */

describe.each(SCHEMES)('the reveal sheet in the %s scheme', (scheme) => {
  it('prints all three consequences before the press, not after it', () => {
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), scheme);
    expect(screen.getByText(en['reveal.body'])).toBeTruthy();
    expect(screen.getByText(en['reveal.logged'])).toBeTruthy();
    expect(
      screen.getByText(en['reveal.credits'].replace('{count}', String(SEED_CREDITS))),
    ).toBeTruthy();
    expect(screen.getByText(en['reveal.consequence'].replace('{days}', '30'))).toBeTruthy();
  });

  it('spends a credit, logs the reveal, opens a placement and says so', async () => {
    const placementsBefore = countByBucket(SEED_PLACEMENTS).active;
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), scheme);

    fireEvent.press(screen.getByText(en['reveal.confirm']));

    await waitFor(() => expect(screen.getByText(en['reveal.toast'])).toBeTruthy(), {
      timeout: 4000,
    });

    expect(readFixture<number>(CREDITS_KEY, SEED_CREDITS)).toBe(SEED_CREDITS - 1);

    const after = readFixture<Placement[]>(PLACEMENTS_KEY, SEED_PLACEMENTS);
    const opened = after.find((p) => p.unitId === FRESH.id);
    expect(opened).toBeDefined();
    // FL19 step 1: a reveal opens a LEAD. The tenant is named when the
    // placement is initiated, which is a later step.
    expect(opened?.client).toBeNull();
    expect(opened?.feeState).toBe('pending');
    expect(countByBucket(after).active).toBe(placementsBefore + 1);
    expect(mockBack).toHaveBeenCalled();
  });

  it('refuses rather than charging for a unit nobody can be placed into', () => {
    renderInScheme(asBroker(<UnitReveal id="ingoro-apartments-b2" />), scheme);
    expect(screen.getByText(en['reveal.unavailableTitle'])).toBeTruthy();
    expect(screen.queryByText(en['reveal.confirm'])).toBeNull();
  });

  it('explains a spent balance instead of disabling a button with no way out', () => {
    writeFixture(CREDITS_KEY, 0);
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), scheme);
    expect(screen.getByText(en['reveal.spentTitle'])).toBeTruthy();
    expect(screen.queryByText(en['reveal.confirm'])).toBeNull();
    // Nothing resets the balance, monthly or otherwise (BR-04).
    expect(screen.queryByText(/start of the month/)).toBeNull();
  });

  it('costs nothing to look at a contact that is already revealed', () => {
    renderInScheme(asBroker(<UnitReveal id={UMURAVA.id} />), scheme);
    // Umurava B4 carries a seeded placement, so its reveal is already logged.
    expect(screen.getByText(en['reveal.alreadyTitle'])).toBeTruthy();
    expect(screen.getByText(UMURAVA.landlord.phone)).toBeTruthy();
  });
});

/**
 * BR-02. The sheet used to read `failed` after the `await`, the value from the
 * render that pressed the button: a failed spend toasted "Contact revealed"
 * and closed, a retry that then landed was treated as failed, and offline it
 * toasted the same success over a reveal that was only queued.
 */
describe('a reveal that does not land at once', () => {
  it('claims no reveal when the spend fails, and a retry that lands is a reveal', async () => {
    // The spend reads the reveal log through the store's exported reader to
    // decide whether this unit is already paid for. The first such read
    // throws, which fails the spend and nothing else.
    const real = fixtureStore.readFixture;
    let thrown = false;
    jest.spyOn(fixtureStore, 'readFixture').mockImplementation(((key: string, fallback: unknown) => {
      if (key === REVEALS_KEY && !thrown) {
        thrown = true;
        throw new Error('the store refused');
      }
      return real(key, fallback);
    }) as typeof fixtureStore.readFixture);
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), 'light');

    fireEvent.press(screen.getByText(en['reveal.confirm']));
    await waitFor(() => expect(screen.getByText(en['reveal.failedTitle'])).toBeTruthy(), {
      timeout: 4000,
    });
    expect(screen.queryByText(en['reveal.toast'])).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(readFixture<number>(CREDITS_KEY, SEED_CREDITS)).toBe(SEED_CREDITS);
    expect(
      readFixture<Reveal[]>(REVEALS_KEY, SEED_REVEALS).some((r) => r.unitId === FRESH.id),
    ).toBe(false);

    fireEvent.press(screen.getByText(en['write.retry']));
    await waitFor(() => expect(screen.getByText(en['reveal.toast'])).toBeTruthy(), {
      timeout: 4000,
    });
    expect(mockBack).toHaveBeenCalled();
    // One credit for one exposure, the failed attempt included.
    expect(readFixture<number>(CREDITS_KEY, SEED_CREDITS)).toBe(SEED_CREDITS - 1);
  });

  it('says the contact is revealed when the phone reconnects, rather than that it was', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(asBroker(<UnitReveal id={FRESH.id} />), 'light');

    fireEvent.press(screen.getByText(en['reveal.confirm']));
    await waitFor(() => expect(screen.getByText(en['reveal.queued'])).toBeTruthy());
    expect(screen.queryByText(en['reveal.toast'])).toBeNull();
    expect(mockBack).toHaveBeenCalled();
    // Queued, not spent: nothing has been revealed yet.
    expect(readFixture<number>(CREDITS_KEY, SEED_CREDITS)).toBe(SEED_CREDITS);
  });
});

/* ------------------------------------------------------------ B23 · Placements */

describe.each(SCHEMES)('Placements in the %s scheme', (scheme) => {
  const counts = countByBucket(SEED_PLACEMENTS);
  const settled = () =>
    waitFor(() => expect(screen.getByText(/Claudine U\./)).toBeTruthy());

  it('counts each chip from the data rather than from a number in the frame', async () => {
    renderInScheme(asBroker(<Placements />), scheme);
    await settled();
    expect(screen.getByText(String(counts.active))).toBeTruthy();
    expect(screen.getByText(String(counts.signed))).toBeTruthy();
  });

  it('draws the arrow line, the state and the event on a live placement', async () => {
    renderInScheme(asBroker(<Placements />), scheme);
    await settled();
    expect(screen.getByText(en['placements.stateSigning'])).toBeTruthy();
    // Every live placement carries the same footer: the fee is a hope until the
    // lease activates, and one of them is exactly that.
    expect(screen.getAllByText(en['placements.feeOnSigning']).length).toBe(
      countByBucket(SEED_PLACEMENTS).active,
    );
  });

  it('counts an intent down in days rather than printing a fee it has not earned', async () => {
    renderInScheme(asBroker(<Placements />), scheme);
    await settled();
    expect(screen.getAllByText(en['placements.intentExpires']).length).toBeGreaterThan(0);
    expect(screen.getByText(en['placements.intentDays'].replace('{count}', '12'))).toBeTruthy();
  });

  it('files a lapsed intent under Expired and says no fee was earned', async () => {
    renderInScheme(asBroker(<Placements />), scheme);
    await settled();

    fireEvent.press(screen.getByText(en['placements.bucketExpired']));
    await waitFor(() =>
      expect(screen.getAllByText(en['placements.feeLapsed']).length).toBe(counts.expired),
    );
  });

  it('says WHY a fee earns where it does, because that is the whole rule', async () => {
    renderInScheme(asBroker(<Placements />), scheme);
    await settled();
    expect(screen.getByText(en['placements.note'])).toBeTruthy();
  });
});

/* -------------------------------------------------------------- B24 · Earnings */

describe.each(SCHEMES)('Earnings in the %s scheme', (scheme) => {
  const summary = summariseEarnings(SEED_PLACEMENTS);
  const settled = () =>
    waitFor(() =>
      expect(
        screen.getByText(en['earnings.heroLabel'].replace('{year}', String(summary.year))),
      ).toBeTruthy(),
    );

  it('says the figures are samples, in the reader’s words, on a screen that would otherwise look live', async () => {
    renderInScheme(asBroker(<Earnings />), scheme);
    expect(screen.getByText(en['earnings.mock'])).toBeTruthy();
    expect(screen.getByText(en['earnings.mockHint'])).toBeTruthy();
    // "Figures are fixtures. No payout adapter is wired yet." was developer
    // copy (BR-03, XC-16).
    expect(screen.queryByText(/fixture|wired/i)).toBeNull();
    await settled();
  });

  it('derives the hero from the same array the rows come from', async () => {
    renderInScheme(asBroker(<Earnings />), scheme);
    await settled();
    expect(
      screen.getByText(en['earnings.heroMeta'].replace('{count}', String(summary.signed))),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `${en['earnings.heroAverage']}, RWF ${summary.average.toLocaleString('en-US')}`,
      ),
    ).toBeTruthy();
  });

  /**
   * A bar chart drawn in plain views is invisible to a screen reader unless
   * every bar carries its own value. This is the assertion that keeps it so.
   */
  it('reports every bar’s month and amount to a reader who cannot see it', async () => {
    renderInScheme(asBroker(<Earnings />), scheme);
    await settled();

    const labelled = screen.getAllByLabelText(/:\s(RWF|nothing)/);
    expect(labelled).toHaveLength(6);
  });

  it('splits the fee rows into paid and pending, which is the only status here', async () => {
    renderInScheme(asBroker(<Earnings />), scheme);
    await settled();
    expect(screen.getByText(en['earnings.pendingSignature'])).toBeTruthy();
    expect(screen.getAllByText(/^Paid /).length).toBeGreaterThan(0);
    // No payout channel exists, so no row names one (BR-03).
    expect(screen.queryByText(/MoMo/)).toBeNull();
  });

  it('says Injishi takes no cut, and promises no payout that does not exist', async () => {
    renderInScheme(asBroker(<Earnings />), scheme);
    await settled();
    expect(screen.getByText(en['earnings.noCut'])).toBeTruthy();
    expect(screen.queryByText(/mobile money|disburse/i)).toBeNull();
  });
});

/* ------------------------------------------------------------ the RW pass */

/**
 * Every Broker screen under the Kinyarwanda catalogue.
 *
 * Two different failures this catches, and only one of them is about language:
 *
 *   - a key that exists in `en` and not in `rw` renders as the key itself, so
 *     asserting the RW string is what proves the pair is complete at the point
 *     the screen actually reads it;
 *   - RW runs materially longer than EN (`directory.searchPlaceholder` is
 *     roughly twice the width), so mounting the screens in it is what stresses
 *     the layouts the ui-rules "nothing truncates" line is about. A row that
 *     overflows still renders, so this cannot assert the geometry — what it
 *     asserts is that the long string is the one on screen, and the layouts
 *     that carry it were built to wrap rather than to clip.
 */
describe('the Kinyarwanda catalogue', () => {
  const inRw = (ui: ReactElement) => renderInScheme(asBroker(ui), 'light', { locale: 'rw' });

  it('carries the Directory, its longer placeholder included', async () => {
    inRw(<Directory />);
    expect(screen.getByText(rw['directory.title'])).toBeTruthy();
    expect(screen.getByText(rw['directory.searchPlaceholder'])).toBeTruthy();
    expect(screen.getByText(rw['directory.privateNote'])).toBeTruthy();
    await waitFor(() => expect(screen.getByText(UMURAVA.title)).toBeTruthy());
    expect(screen.getAllByText(rw['directory.vacantNow']).length).toBeGreaterThan(0);
  });

  it('carries the unit detail, and still withholds the number', async () => {
    inRw(<UnitDetail id={FRESH.id} />);
    await waitFor(() => expect(screen.getByText(FRESH.title)).toBeTruthy());
    expect(screen.getAllByText(rw['unit.tenureLong']).length).toBeGreaterThan(0);
    expect(screen.getByText(rw['unit.landlordMaskedHint'])).toBeTruthy();
    expect(screen.queryByText(FRESH.landlord.phone)).toBeNull();
  });

  it('carries the reveal sheet, consequences and all', () => {
    inRw(<UnitReveal id={FRESH.id} />);
    expect(screen.getByText(rw['reveal.title'])).toBeTruthy();
    expect(screen.getByText(rw['reveal.body'])).toBeTruthy();
    expect(screen.getByText(rw['reveal.confirm'])).toBeTruthy();
    expect(screen.getByText(rw['reveal.cancel'])).toBeTruthy();
  });

  it('carries Placements, including the chip labels and the fee footer', async () => {
    inRw(<Placements />);
    await waitFor(() => expect(screen.getByText(/Claudine U\./)).toBeTruthy());
    expect(screen.getByText(rw['placements.bucketActive'])).toBeTruthy();
    expect(screen.getByText(rw['placements.note'])).toBeTruthy();
    expect(screen.getAllByText(rw['placements.feeOnSigning']).length).toBeGreaterThan(0);
  });

  it('carries Earnings, the hero and the chart labels', async () => {
    const summary = summariseEarnings(SEED_PLACEMENTS);
    inRw(<Earnings />);
    await waitFor(() =>
      expect(
        screen.getByText(rw['earnings.heroLabel'].replace('{year}', String(summary.year))),
      ).toBeTruthy(),
    );
    expect(screen.getByText(rw['earnings.noCut'])).toBeTruthy();
    expect(screen.getByText(rw['earnings.chartThisMonth'])).toBeTruthy();
  });

  it('has no key this session left untranslated', () => {
    const mine = Object.keys(en).filter(
      (k) =>
        k.startsWith('directory.') ||
        k.startsWith('unit.') ||
        k.startsWith('reveal.') ||
        k.startsWith('placements.') ||
        k.startsWith('earnings.'),
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
      'reveal.failedTitle',
      'reveal.failedBody',
      'reveal.balanceBefore',
      'reveal.balanceAfter',
    ]);

    expect(mine.length).toBeGreaterThan(100);
    for (const key of mine) {
      expect(rw[key]).toBeTruthy();
      // ' (RW)' is the pack's marker for a string nobody had Kinyarwanda for.
      // The session's own carry none; phase 1's carry it on purpose.
      expect({ key, marked: rw[key].endsWith(' (RW)') }).toEqual({
        key,
        marked: PHASE_1.has(key),
      });
    }
  });
});
