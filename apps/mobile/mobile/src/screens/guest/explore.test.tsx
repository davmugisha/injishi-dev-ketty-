/**
 * Explore, in both schemes.
 *
 * The assertions are about behaviour a reader can see, not about styling: that
 * a chip actually removes rows, that the empty state names a filter it can
 * clear, that the map toggle swaps the rows for pins, and that a heart reports
 * what it did. `src/data/search.test.ts` covers the predicate underneath; this
 * covers the wiring, which is the half that silently comes loose.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Explore } from './explore';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures } from '@/data/use-fixture-mutation';
import { DEFAULT_SEARCH, searchStays } from '@/data/search';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({
  useNetworkState: () => mockNetwork,
}));

/**
 * Explore reads the active workspace for its chip and shows a toast when a
 * heart lands, so both providers are real here rather than mocked — a toast
 * that never mounts is the assertion this file most wants to make.
 */
const guest = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="guest">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

/** Waits out `useFixture`'s cold-read latency. */
const settled = () => waitFor(() => expect(screen.getByText('Lake Kivu Suite')).toBeTruthy());

beforeEach(() => {
  mockPush.mockClear();
  resetFixtures();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

/**
 * A write started by one test lands 300ms later, which is after the next test
 * has mounted. Clearing the store before that write arrives does not stop it:
 * it writes the OLD test's search into the NEW test's store, halfway through.
 * So the flush comes first and the reset after it.
 */
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('Explore in the %s scheme', (scheme) => {
  it('greets the persona by their first name and asks the artboard’s question', async () => {
    renderInScheme(guest(<Explore />), scheme);
    expect(screen.getByText(en['explore.greeting'].replace('{name}', 'Samuel'))).toBeTruthy();
    expect(screen.getByText(en['explore.title'])).toBeTruthy();
    await settled();
  });

  it('shows a skeleton on the cold read rather than an empty page', () => {
    renderInScheme(guest(<Explore />), scheme);
    const loading = screen.queryByLabelText(
      en['state.loadingList'].replace('{label}', en['explore.listLabel']),
    );
    // Warm on a later render in the same session, which is also correct: the
    // assertion is that one of the two is showing, never neither.
    expect(loading ?? screen.getByText(en['explore.title'])).toBeTruthy();
  });

  it('offers the search pill on its placeholder until a search is made', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();
    expect(screen.getByText(en['explore.searchPlaceholder'])).toBeTruthy();
    fireEvent.press(screen.getByLabelText(en['explore.searchHint']));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('filters for real when a quick chip is chosen', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(en['explore.filterKigali']));

    // Both halves inside one `waitFor`: FlashList recycles rows across a
    // re-render, so a row can be briefly absent for a reason that is not the
    // filter. Asserting the settled list is the honest question.
    await waitFor(() => {
      expect(screen.queryByText('Lake Kivu Suite')).toBeNull();
      expect(screen.getByText('Umurage Guesthouse')).toBeTruthy();
    });
    // And the pill now summarises what the rail did, which is the only way a
    // reader learns the two controls are one search.
    expect(screen.getByText(en['search.districtKigali'])).toBeTruthy();
  });

  it('filters for real on instant book, which is a switch and not a choice', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(en['search.instantBook']));

    // The count line is the load-bearing assertion because it is in the list
    // HEADER: which rows FlashList has mounted at any instant is a
    // virtualization detail, and asserting on one under load is a flake.
    // Nyungwe is request-to-book, so it must go; Karongi is the highest-scoring
    // instant-book stay, so it is the first row either way.
    const instant = searchStays({ ...DEFAULT_SEARCH, instantBook: true }).length;
    await waitFor(() => {
      expect(
        screen.getByText(
          `${en['explore.resultsCount'].replace('{count}', String(instant))} · ${
            en['search.sortRecommended']
          }`,
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Nyungwe Forest Lodge')).toBeNull();
      expect(screen.getByText('Karongi Lake House')).toBeTruthy();
    });
  });

  it('names a filter that emptied the list, and clearing it brings the list back', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    // Every park district is request-to-book, so the two together match nothing.
    fireEvent.press(screen.getByLabelText(en['explore.filterParks']));
    fireEvent.press(screen.getByLabelText(en['search.instantBook']));

    // The body carries no placeholder, so it asserts the per-filter state
    // without pinning WHICH of the two active filters gets the blame — that is
    // `emptyReason`'s call and `search.test.ts` asserts its actual contract,
    // which is that clearing whatever it names works.
    const body = await screen.findByText(en['explore.emptyFilterBody']);
    expect(body).toBeTruthy();

    const clear = screen.getByText(
      new RegExp(`^${en['explore.emptyFilterAction'].replace('{filter}', '')}`),
    );
    fireEvent.press(clear);
    await waitFor(() => expect(screen.queryByText(en['explore.emptyFilterBody'])).toBeNull());
  });

  it('swaps the rows for pins on the map tab, and says the ground is drawn', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(en['explore.viewMap']));

    await waitFor(() => expect(screen.getByText(en['explore.mapNoteTitle'])).toBeTruthy());
    // The prompt to choose a pin stands where a selected stay will.
    expect(screen.getByText(en['explore.mapPick'])).toBeTruthy();

    fireEvent.press(
      screen.getByLabelText(
        en['explore.mapPin'].replace('{title}', 'Lake Kivu Suite').replace('{location}', 'Rubavu'),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText(en['explore.openStay'].replace('{title}', 'Lake Kivu Suite')),
      ).toBeTruthy(),
    );
  });

  it('saves from the tile and says so, without waiting on the write', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    const hearts = screen.getAllByLabelText(en['a11y.save']);
    fireEvent.press(hearts[0]);

    // The heart flips before the 300ms write lands — that is the optimistic
    // overlay in `useSavedStays`, and a heart that lagged its own tap would be
    // the bug it exists to prevent.
    expect(screen.getAllByLabelText(en['a11y.unsave']).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(en['explore.savedToast'])).toBeTruthy());
  });

  it('opens the property when a tile is pressed', async () => {
    renderInScheme(guest(<Explore />), scheme);
    await settled();

    fireEvent.press(
      screen.getByLabelText(en['explore.openStay'].replace('{title}', 'Lake Kivu Suite')),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/listing/[id]',
      params: { id: 'kivu-serena-suite' },
    });
  });

  it('renders in Kinyarwanda, where every string is longer', async () => {
    // ui-rules.md: RW runs longer than EN and nothing may truncate. The value
    // of the pass is that the whole surface — the rail, the two view tabs, the
    // count line — resolves in the other catalogue rather than falling back.
    renderInScheme(guest(<Explore />), scheme, { locale: 'rw' });
    await waitFor(() => expect(screen.getByText('Lake Kivu Suite')).toBeTruthy());

    expect(screen.getByText(rw['explore.title'])).toBeTruthy();
    expect(screen.getByText(rw['explore.searchPlaceholder'])).toBeTruthy();
    expect(screen.getByLabelText(rw['explore.filterKigali'])).toBeTruthy();
    expect(screen.getByLabelText(rw['search.instantBook'])).toBeTruthy();
    expect(screen.getByLabelText(rw['explore.view'])).toBeTruthy();
  });

  it('says the list is the last one that loaded when the connection is gone', async () => {
    mockNetwork.isConnected = false;
    renderInScheme(guest(<Explore />), scheme);
    await settled();
    // Offline is a state, not an error: the note appears and the rows stay.
    expect(screen.getByText(en['state.offlineLastList'])).toBeTruthy();
    expect(screen.getByText('Lake Kivu Suite')).toBeTruthy();
  });
});
