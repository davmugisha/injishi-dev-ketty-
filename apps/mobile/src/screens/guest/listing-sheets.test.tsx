/**
 * The two `formSheet` bodies behind the Property detail page.
 *
 * The policy sheet is the one that matters. It is where a guest agrees to
 * forfeit money, so three things have to be true and none of them is visible
 * from a screenshot:
 *
 *   - the arithmetic comes from `computeBreakdown` in `@injishi/contracts`,
 *     not from a lookalike in a screen (ADR-014 call 4);
 *   - the switch writes the draft the page behind it reads, or the sticky bar
 *     goes on quoting a rate the guest has just changed;
 *   - a room that does not sell a non-refundable rate gets a DISABLED switch
 *     with the reason, not a hidden one.
 *
 * Since the mobile audit of 2026-10-05 it also prices for the PARTY (GB-08):
 * the rate is per guest per night, and the sheet's total used to be half the
 * stepper's for the default two. And it reads through `useFixture` on the
 * page's key (GB-15), so these tests await the read like the amenities ones.
 */
import { act, screen, waitFor } from '@testing-library/react-native';
import { computeBreakdown } from '@injishi/contracts';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { DEFAULT_SEARCH, SEARCH_KEY, billableGuests } from '@/data/search';
import { draftKey, EMPTY_DRAFT, type BookingDraft } from '@/data/booking-draft';
import * as propertyDetail from '@/data/property-detail';
import { moneyText } from './listing-format';
import { ListingAmenitiesSheet } from './listing-amenities-sheet';
import { ListingPolicySheet } from './listing-policy-sheet';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const KIVU = 'kivu-sunbird-suite';
const RUSIZI = 'rusizi-river-lodge';
const DATES = { start: '2026-09-04', end: '2026-09-07' };
/** The default party: two adults, so two billable guests. */
const PARTY = billableGuests(DEFAULT_SEARCH.guests);

/**
 * The policy sheet, once its read has landed. It waits for something only a
 * LOADED sheet draws (the locked-tier promise, or the not-found sentence),
 * because the title is drawn by the skeleton too.
 */
async function openPolicy(id: string, scheme: (typeof SCHEMES)[number], locale?: 'en' | 'rw') {
  renderInScheme(<ListingPolicySheet id={id} />, scheme, locale ? { locale } : undefined);
  const catalogue = locale === 'rw' ? rw : en;
  await waitFor(() =>
    expect(
      screen.queryByLabelText(catalogue['listing.policyLocked']) ??
        screen.queryByText(catalogue['listing.notFoundBody']),
    ).toBeTruthy(),
  );
}

beforeEach(() => resetFixtures());
afterEach(() => resetFixtures());

const draft = (id: string): BookingDraft => readFixture(draftKey(id), EMPTY_DRAFT);

/**
 * The sheet reads through `useFixture` since gaps.md B7, so these await the
 * read rather than asserting on the first frame.
 *
 * That is not test friction, it is the point of the change. This route scored
 * zero on all five production properties precisely BECAUSE it read a module
 * synchronously and therefore had no loading, error or empty branch to write —
 * *"a branch that never renders is a branch that rots"*. A test that could
 * still assert synchronously would be a test proving the branches are absent.
 */
describe('the policy sheet, cold', () => {
  it('shows a skeleton before the policy, rather than an empty sheet (GB-15)', () => {
    // ONCE, for the same reason the amenities one below is: only the first
    // render of a key in a file is cold.
    renderInScheme(<ListingPolicySheet id={KIVU} />, 'light');
    expect(
      screen.getByLabelText(en['state.loadingList'].replace('{label}', en['listing.policy'])),
    ).toBeTruthy();
  });
});

describe('the amenities sheet, cold', () => {
  it('shows a skeleton before the list, rather than an empty sheet', () => {
    // ONCE, and outside the scheme loop. `useFixture` keeps its resolved keys
    // at module scope on purpose — "navigating back to a screen does not
    // re-skeleton it" — so only the first render of a key is cold, and asserting
    // the skeleton in both schemes would assert it against a warm cache in the
    // second. The skeleton is not a per-scheme fact; it is a per-key one.
    renderInScheme(<ListingAmenitiesSheet id={KIVU} />, 'light');
    expect(screen.getByLabelText(en['listing.amenitiesLoading'])).toBeTruthy();
  });
});

describe.each(SCHEMES)('the amenities sheet in the %s scheme', (scheme) => {
  it('lists every amenity, not just the ones the page previewed', async () => {
    renderInScheme(<ListingAmenitiesSheet id={KIVU} />, scheme);
    // The page shows five; this property lists eight.
    expect(await screen.findByText(en['listing.amenity.lakeView'])).toBeTruthy();
    expect(screen.getByText(en['listing.amenity.laundry'])).toBeTruthy();
    expect(screen.getByText(en['listing.amenity.parking'])).toBeTruthy();
  });

  it('says which property it is listing', async () => {
    renderInScheme(<ListingAmenitiesSheet id={KIVU} />, scheme);
    expect(
      await screen.findByText(
        en['listing.amenitiesSheetSubtitle'].replace('{property}', 'Lake Kivu Suite'),
      ),
    ).toBeTruthy();
  });

  it('names the property and the count for a screen reader', async () => {
    // The sheet is deep-linkable, so there is no page behind it to take the
    // property's name from. Arriving here through a link, the list has to say
    // what it belongs to itself.
    renderInScheme(<ListingAmenitiesSheet id={KIVU} />, scheme);
    expect(
      await screen.findByLabelText(
        en['listing.amenitiesA11y'].replace('{count}', '8').replace('{property}', 'Lake Kivu Suite'),
      ),
    ).toBeTruthy();
  });

  it('says so rather than opening empty on an id that resolves to nothing', async () => {
    renderInScheme(<ListingAmenitiesSheet id="no-such-property" />, scheme);
    expect(await screen.findByText(en['listing.notFoundBody'])).toBeTruthy();
  });
});

describe.each(SCHEMES)('the policy sheet in the %s scheme', (scheme) => {
  it('states the chosen room’s tier, in words', async () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-balcony-double', nonRefundable: false });
    await openPolicy(KIVU, scheme);
    expect(screen.getByText(en['listing.tier.moderate'])).toBeTruthy();
    expect(screen.getByText(en['listing.tierBody.moderate'])).toBeTruthy();
  });

  it('refuses to state a tier before a room is chosen', async () => {
    // The tier belongs to the Room type. Showing the first room's terms as if
    // they were the property's is the misleading default this avoids.
    await openPolicy(KIVU, scheme);
    expect(screen.getByText(en['listing.policyNoRoom'])).toBeTruthy();
    expect(screen.queryByTestId('policy-non-refundable')).toBeNull();
  });

  it('prints the two promises that do not depend on the tier', async () => {
    await openPolicy(KIVU, scheme);
    expect(screen.getByLabelText(en['listing.policyLocked'])).toBeTruthy();
    expect(screen.getByLabelText(en['listing.policyHostCancels'])).toBeTruthy();
  });

  it('gives a dead link a way out, as the amenities sheet does (GB-15)', async () => {
    await openPolicy('no-such-property', scheme);
    expect(screen.getByText(en['listing.notFoundBody'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['listing.policyDone'] })).toBeTruthy();
  });
});

describe('the policy sheet when the read fails', () => {
  it('says so, with a retry and a way out, and prints no raw server text (GB-15)', async () => {
    // A key no other test in this file has read, so the read is cold and goes
    // through `useFixture`'s failure branch.
    const spy = jest.spyOn(propertyDetail, 'getStayDetail').mockImplementation(() => {
      throw new Error('Property not found.');
    });
    try {
      renderInScheme(<ListingPolicySheet id="karongi-lake-house" />, SCHEMES[0]);
      await waitFor(() => expect(screen.getByText(en['listing.errorTitle'])).toBeTruthy());
      expect(screen.queryByText('Property not found.')).toBeNull();
      expect(screen.getByRole('button', { name: en['state.retry'] })).toBeTruthy();
      expect(screen.getByRole('button', { name: en['listing.policyDone'] })).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the money in the policy sheet', () => {
  const scheme = SCHEMES[0];

  it('is the contract’s arithmetic for the whole party, not a lookalike (GB-08)', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await openPolicy(KIVU, scheme);

    // Per guest per night: the default party of two pays twice what one does,
    // which is what the stepper and the server charge.
    const expected = computeBreakdown({
      nightlyRateRwf: 145000,
      nights: 3,
      nonRefundable: false,
      guests: PARTY,
    });
    expect(expected.accommodationRwf).toBe(145000 * 2 * 3);
    expect(screen.getByText(expected.accommodationRwf.toLocaleString('en-US'))).toBeTruthy();
    expect(screen.getByText(expected.grossRwf.toLocaleString('en-US'))).toBeTruthy();
    // And the line under it names the guests it multiplied by.
    expect(screen.getByText(`${moneyText(145000)} × 2 guests × 3 nights`)).toBeTruthy();
  });

  it('quotes one night for the party, and says so, until there are dates', async () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await openPolicy(KIVU, scheme);

    expect(screen.getByText(en['listing.policyOneNight'])).toBeTruthy();
    expect(
      screen.getByText(`${moneyText(145000)} × 2 guests × ${en['calendar.oneNight']}`),
    ).toBeTruthy();
  });

  it('shows no discount line while the standard rate is taken', async () => {
    // A zero line for a discount nobody took reads as an offer that failed.
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await openPolicy(KIVU, scheme);
    expect(screen.queryByText(en['listing.policyDiscount'])).toBeNull();
  });

  it('applies the contract discount when the switch goes on', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await openPolicy(KIVU, scheme);

    act(() => screen.getByTestId('policy-non-refundable').props.onClick?.());

    expect(draft(KIVU).nonRefundable).toBe(true);
    const discounted = computeBreakdown({
      nightlyRateRwf: 145000,
      nights: 3,
      nonRefundable: true,
      guests: PARTY,
    });
    expect(discounted.nonRefundableDiscountRwf).toBeGreaterThan(0);
    expect(screen.getByText(en['listing.policyDiscount'])).toBeTruthy();
    expect(screen.getByText(discounted.grossRwf.toLocaleString('en-US'))).toBeTruthy();
  });
});

describe('a room that does not sell a non-refundable rate', () => {
  const scheme = SCHEMES[0];

  it('disables the switch and names the room, rather than hiding it', async () => {
    writeFixture(draftKey(RUSIZI), { roomTypeId: 'rusizi-family-room', nonRefundable: false });
    await openPolicy(RUSIZI, scheme);

    const toggle = screen.getByTestId('policy-non-refundable');
    expect(toggle.props.accessibilityState.disabled).toBe(true);
    expect(
      screen.getByText(
        en['listing.policyIneligible'].replace('{room}', 'River Family Room'),
      ),
    ).toBeTruthy();
  });

  it('cannot be switched on even if something else wrote the draft', async () => {
    writeFixture(draftKey(RUSIZI), { roomTypeId: 'rusizi-family-room', nonRefundable: true });
    await openPolicy(RUSIZI, scheme);
    // The sheet renders the standard rate: the room's own eligibility wins
    // over whatever the draft happens to hold.
    expect(screen.queryByText(en['listing.policyDiscount'])).toBeNull();
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders the policy sheet in RW', async () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await openPolicy(KIVU, SCHEMES[0], 'rw');
    expect(screen.getByText(rw['listing.tier.flexible'])).toBeTruthy();
    expect(screen.getByText(rw['listing.policyNonRefundableTitle'])).toBeTruthy();
    expect(screen.getByLabelText(rw['listing.policyLocked'])).toBeTruthy();
  });
});
