/**
 * The saved set.
 *
 * Two things are worth asserting and neither is "the value changed":
 *
 *   - **The heart flips before the write lands.** `useFixtureMutation`
 *     simulates 300ms, and a heart that waited it out would feel broken. The
 *     optimistic record is the whole reason this hook is more than a one-liner,
 *     so it is tested at the moment where it matters: after the tap and before
 *     the store agrees.
 *   - **Two screens see one set.** Explore, this page and the Saved tab all
 *     write the same heart, and a per-screen copy is what the shared key
 *     exists to prevent. Two hooks mounted side by side stand in for two
 *     screens.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText, View } from 'react-native';
import { resetFixtures, writeFixture } from './use-fixture-mutation';
import { SAVED_KEY, SEEDED_SAVED, useSavedStays } from './saved';

afterEach(() => resetFixtures());

/** Two readers of the same set, and one of them writes. */
function TwoScreens() {
  const explore = useSavedStays();
  const detail = useSavedStays();

  return (
    <View>
      <RNText testID="explore">{explore.isSaved('kivu-sunbird-suite') ? 'on' : 'off'}</RNText>
      <RNText testID="detail">{detail.isSaved('kivu-sunbird-suite') ? 'on' : 'off'}</RNText>
      <RNText testID="ids">{explore.ids.join(',')}</RNText>
      <RNText testID="toggle" onPress={() => detail.toggle('kivu-sunbird-suite')}>
        toggle
      </RNText>
    </View>
  );
}

describe('the saved set', () => {
  it('reads through to whatever the store holds, over the seed', () => {
    writeFixture(SAVED_KEY, ['musanze-volcano-cabin']);
    render(<TwoScreens />);
    expect(screen.getByTestId('ids').props.children).toBe('musanze-volcano-cabin');
    expect(screen.getByTestId('detail').props.children).toBe('off');
  });

  /**
   * Session 6 gave the set a seed. The two assertions below used to read
   * `'kivu-sunbird-suite'` and `''`, which were the whole store when it started
   * empty; they are now the seed plus or minus that one id, which is the same
   * claim written against a store that has something in it. The seed itself is
   * asserted here rather than inlined into each, so adding a stay to
   * `SEEDED_SAVED` does not fail three tests.
   */
  const withKivu = [...SEEDED_SAVED, 'kivu-sunbird-suite'].join(',');
  const seeded = SEEDED_SAVED.join(',');

  it('opens with the seeded set, including the unpublished stay AC-10 needs', () => {
    render(<TwoScreens />);
    expect(screen.getByTestId('ids').props.children).toBe(seeded);
    expect(SEEDED_SAVED).toContain('virunga-tea-retreat');
    // The three ids this file toggles must never be seeded, or a save here
    // would silently become an unsave.
    expect(SEEDED_SAVED).not.toContain('kivu-sunbird-suite');
    expect(SEEDED_SAVED).not.toContain('kigali-cbd-loft');
    expect(SEEDED_SAVED).not.toContain('musanze-volcano-cabin');
  });

  it('fills the heart immediately, before the write has landed', () => {
    render(<TwoScreens />);
    act(() => {
      screen.getByTestId('toggle').props.onPress();
    });
    // No `waitFor`: the point is that this is true synchronously, while the
    // 300ms mutation is still in flight.
    expect(screen.getByTestId('detail').props.children).toBe('on');
  });

  it('lands the write, so a second screen sees it too', async () => {
    render(<TwoScreens />);
    act(() => {
      screen.getByTestId('toggle').props.onPress();
    });
    await waitFor(() => expect(screen.getByTestId('ids').props.children).toBe(withKivu));
    expect(screen.getByTestId('explore').props.children).toBe('on');
  });

  it('unsaves back to the seed rather than leaving a hole in the list', async () => {
    render(<TwoScreens />);
    act(() => {
      screen.getByTestId('toggle').props.onPress();
    });
    await waitFor(() => expect(screen.getByTestId('ids').props.children).toBe(withKivu));

    act(() => {
      screen.getByTestId('toggle').props.onPress();
    });
    expect(screen.getByTestId('detail').props.children).toBe('off');
    await waitFor(() => expect(screen.getByTestId('ids').props.children).toBe(seeded));
  });

  it('reports the state it moved to, so a caller can pick its toast', async () => {
    const moves: boolean[] = [];

    function Probe() {
      const saved = useSavedStays();
      return (
        <RNText testID="go" onPress={() => moves.push(saved.toggle('kigali-cbd-loft'))}>
          go
        </RNText>
      );
    }

    render(<Probe />);
    act(() => {
      screen.getByTestId('go').props.onPress();
    });
    await waitFor(() => expect(moves).toEqual([true]));

    act(() => {
      screen.getByTestId('go').props.onPress();
    });
    await waitFor(() => expect(moves).toEqual([true, false]));
  });
});
