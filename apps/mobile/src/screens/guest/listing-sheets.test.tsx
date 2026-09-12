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
 */
import { act, screen } from '@testing-library/react-native';
import { computeBreakdown } from '@injishi/contracts';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { DEFAULT_SEARCH, SEARCH_KEY } from '@/data/search';
import { draftKey, EMPTY_DRAFT, type BookingDraft } from '@/data/booking-draft';
import { moneyText } from './listing-format';
import { ListingAmenitiesSheet } from './listing-amenities-sheet';
import { ListingPolicySheet } from './listing-policy-sheet';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const KIVU = 'kivu-serena-suite';
const RUSIZI = 'rusizi-river-lodge';
const DATES = { start: '2026-09-04', end: '2026-09-07' };

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
  it('states the chosen room’s tier, in words', () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-balcony-double', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);
    expect(screen.getByText(en['listing.tier.moderate'])).toBeTruthy();
    expect(screen.getByText(en['listing.tierBody.moderate'])).toBeTruthy();
  });

  it('refuses to state a tier before a room is chosen', () => {
    // The tier belongs to the Room type. Showing the first room's terms as if
    // they were the property's is the misleading default this avoids.
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);
    expect(screen.getByText(en['listing.policyNoRoom'])).toBeTruthy();
    expect(screen.queryByTestId('policy-non-refundable')).toBeNull();
  });

  it('prints the two promises that do not depend on the tier', () => {
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);
    expect(screen.getByLabelText(en['listing.policyLocked'])).toBeTruthy();
    expect(screen.getByLabelText(en['listing.policyHostCancels'])).toBeTruthy();
  });
});

describe('the money in the policy sheet', () => {
  const scheme = SCHEMES[0];

  it('is the contract’s arithmetic, not a lookalike', () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);

    const expected = computeBreakdown({
      nightlyRateRwf: 145000,
      nights: 3,
      nonRefundable: false,
    });
    expect(screen.getByText(expected.accommodationRwf.toLocaleString('en-US'))).toBeTruthy();
    expect(screen.getByText(expected.grossRwf.toLocaleString('en-US'))).toBeTruthy();
  });

  it('quotes one night, and says so, until there are dates', () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);

    expect(screen.getByText(en['listing.policyOneNight'])).toBeTruthy();
    expect(
      screen.getByText(`${moneyText(145000)} × ${en['calendar.oneNight']}`),
    ).toBeTruthy();
  });

  it('shows no discount line while the standard rate is taken', () => {
    // A zero line for a discount nobody took reads as an offer that failed.
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);
    expect(screen.queryByText(en['listing.policyDiscount'])).toBeNull();
  });

  it('applies the contract discount when the switch goes on', () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, scheme);

    act(() => screen.getByTestId('policy-non-refundable').props.onClick?.());

    expect(draft(KIVU).nonRefundable).toBe(true);
    const discounted = computeBreakdown({
      nightlyRateRwf: 145000,
      nights: 3,
      nonRefundable: true,
    });
    expect(discounted.nonRefundableDiscountRwf).toBeGreaterThan(0);
    expect(screen.getByText(en['listing.policyDiscount'])).toBeTruthy();
    expect(screen.getByText(discounted.grossRwf.toLocaleString('en-US'))).toBeTruthy();
  });
});

describe('a room that does not sell a non-refundable rate', () => {
  const scheme = SCHEMES[0];

  it('disables the switch and names the room, rather than hiding it', () => {
    writeFixture(draftKey(RUSIZI), { roomTypeId: 'rusizi-family-room', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={RUSIZI} />, scheme);

    const toggle = screen.getByTestId('policy-non-refundable');
    expect(toggle.props.accessibilityState.disabled).toBe(true);
    expect(
      screen.getByText(
        en['listing.policyIneligible'].replace('{room}', 'River Family Room'),
      ),
    ).toBeTruthy();
  });

  it('cannot be switched on even if something else wrote the draft', () => {
    writeFixture(draftKey(RUSIZI), { roomTypeId: 'rusizi-family-room', nonRefundable: true });
    renderInScheme(<ListingPolicySheet id={RUSIZI} />, scheme);
    // The sheet renders the standard rate: the room's own eligibility wins
    // over whatever the draft happens to hold.
    expect(screen.queryByText(en['listing.policyDiscount'])).toBeNull();
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders the policy sheet in RW', () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    renderInScheme(<ListingPolicySheet id={KIVU} />, SCHEMES[0], { locale: 'rw' });
    expect(screen.getByText(rw['listing.tier.flexible'])).toBeTruthy();
    expect(screen.getByText(rw['listing.policyNonRefundableTitle'])).toBeTruthy();
    expect(screen.getByLabelText(rw['listing.policyLocked'])).toBeTruthy();
  });
});
