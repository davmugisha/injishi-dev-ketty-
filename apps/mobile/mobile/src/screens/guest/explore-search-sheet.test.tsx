/**
 * The search sheet, in both schemes.
 *
 * What is worth asserting here is the draft: that nothing reaches Explore until
 * Search is pressed, that the footer counts the draft rather than the committed
 * search, that Clear all is safe because it only touches the draft, and that
 * the steppers stop where the inventory does. A sheet that wrote through on
 * every keystroke would pass a render test and still be wrong.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ExploreSearchSheet } from './explore-search-sheet';
import { ToastProvider } from '@/components';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, readFixture, resetFixtures } from '@/data/use-fixture-mutation';
import {
  DEFAULT_SEARCH,
  PARTY_MAX,
  SEARCH_KEY,
  billableGuests,
  searchStays,
  type StaySearch,
} from '@/data/search';
import { EXPLORABLE_STAYS } from '@/data/stays';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));

const sheet = (ui: ReactElement) => <ToastProvider>{ui}</ToastProvider>;

/** What the store holds, which is what Explore would read. */
const committed = () => readFixture<StaySearch>(SEARCH_KEY, DEFAULT_SEARCH);

const showAll = en['search.applyCount'].replace('{count}', String(EXPLORABLE_STAYS.length));

beforeEach(() => {
  mockBack.mockClear();
  resetFixtures();
});

/**
 * A write started by one test lands 300ms later, which is after the next test
 * has mounted. Clearing the store before that write arrives does not stop it:
 * it writes the OLD test's draft into the NEW test's store, halfway through.
 * So the flush comes first and the reset after it.
 */
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('the search sheet in the %s scheme', (scheme) => {
  it('draws Where, When and Who, in the artboard’s order', () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);
    expect(screen.getByText(en['search.title'])).toBeTruthy();
    expect(screen.getByText(en['search.where'])).toBeTruthy();
    expect(screen.getByText(en['search.when'])).toBeTruthy();
    expect(screen.getByText(en['search.who'])).toBeTruthy();
    expect(screen.getByText(en['search.refine'])).toBeTruthy();
  });

  it('says out loud that the dates narrow nothing', () => {
    // The consequence printed where it happens rather than discovered later.
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);
    expect(screen.getByText(en['search.whenNote'])).toBeTruthy();
  });

  it('counts the whole catalogue before anything is narrowed', () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);
    expect(screen.getByText(showAll)).toBeTruthy();
  });

  it('counts the DRAFT, and commits nothing until Search is pressed', async () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);

    fireEvent.press(screen.getByLabelText(en['search.instantBook']));

    const expected = searchStays({ ...DEFAULT_SEARCH, instantBook: true }).length;
    await waitFor(() =>
      expect(
        screen.getByText(en['search.applyCount'].replace('{count}', String(expected))),
      ).toBeTruthy(),
    );
    // Explore still sees the untouched search: the sheet is a draft.
    expect(committed().instantBook).toBe(false);

    fireEvent.press(screen.getByText(en['search.applyCount'].replace('{count}', String(expected))));
    await waitFor(() => expect(committed().instantBook).toBe(true));
    expect(mockBack).toHaveBeenCalled();
  });

  it('stops the party where the largest room in the catalogue stops', async () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);

    const label = en['search.increment'].replace('{label}', en['search.adults']);
    // Re-queried each time on purpose: a node captured before the press holds
    // the handler from THAT render, so a loop over one reference would add the
    // same guest again and again and the cap would never be reached.
    // Two adults by default; press well past the ceiling and it must not pass it.
    for (let i = 0; i < PARTY_MAX + 4; i += 1) {
      fireEvent.press(screen.getByLabelText(label));
    }

    await waitFor(() => expect(screen.getByText(en['search.partyAtCap'])).toBeTruthy());
    expect(
      screen.getByLabelText(
        en['search.stepperValue'].replace('{label}', en['search.adults']).replace('{count}', String(PARTY_MAX)),
      ),
    ).toBeTruthy();
  });

  it('does not count an infant against the room, so the cap does not move', async () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);

    const addInfant = screen.getByLabelText(
      en['search.increment'].replace('{label}', en['search.infants']),
    );
    fireEvent.press(addInfant);
    fireEvent.press(addInfant);

    // Two infants and the default two adults is still a party of two rooms-wise,
    // so the result count is unchanged.
    await waitFor(() => expect(screen.getByText(showAll)).toBeTruthy());
    expect(billableGuests({ adults: 2, children: 0, infants: 2 })).toBe(2);
  });

  it('clears the draft without touching what Explore is showing', async () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);

    fireEvent.press(screen.getByLabelText(en['search.instantBook']));
    fireEvent.press(screen.getByText(en['search.clearAll']));

    await waitFor(() => expect(screen.getByText(showAll)).toBeTruthy());
    expect(committed()).toEqual(DEFAULT_SEARCH);
  });

  it('offers no filter with nothing behind it', () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);
    // Every class chip prints its own count, and a zero-count facet never
    // reaches the sheet — the rule `apps/web` had to learn twice.
    expect(screen.getByText(`${en['search.classHotel']} · 1`)).toBeTruthy();
    expect(screen.queryByText(en['search.classOther'])).toBeNull();
  });

  it('renders in Kinyarwanda, where every string is longer', () => {
    // The sheet is the densest surface in the slice: four section headings, a
    // month grid, three stepper rows and four chip groups. If anything is going
    // to overflow under the longer catalogue, it is this.
    renderInScheme(sheet(<ExploreSearchSheet />), scheme, { locale: 'rw' });
    expect(screen.getByText(rw['search.title'])).toBeTruthy();
    expect(screen.getByText(rw['search.where'])).toBeTruthy();
    expect(screen.getByText(rw['search.whenNote'])).toBeTruthy();
    expect(screen.getByText(rw['search.adults'])).toBeTruthy();
    expect(screen.getByText(rw['search.clearAll'])).toBeTruthy();
  });

  it('says nothing matches rather than lying about a count', async () => {
    renderInScheme(sheet(<ExploreSearchSheet />), scheme);

    fireEvent.press(screen.getByText(`${en['search.classTentedCamp']} · 1`));
    fireEvent.press(screen.getByText(en['search.bandUnder100k']));

    await waitFor(() => expect(screen.getByText(en['search.applyNone'])).toBeTruthy());
  });
});
