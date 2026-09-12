/**
 * `useFixtureMutation` — the write half of the data layer.
 *
 * The thing worth testing is not that a value changes; it is that the change is
 * **visible to a reader on another screen**. Half the prototype's toasts claim
 * exactly that ("the front desk sees it live"), and a write kept in one
 * screen's local state is a write nobody else ever sees — which is what this
 * hook exists to prevent.
 *
 * The store is module-level on purpose, so `resetFixtures()` runs between tests
 * or one test's write leaks into the next.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText, View } from 'react-native';
import {
  MUTATION_LATENCY_MS,
  onFixtureChange,
  readFixture,
  resetFixtures,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
} from './use-fixture-mutation';

afterEach(() => resetFixtures());

describe('the fixture store', () => {
  it('falls through to the file fixture until something is written', () => {
    expect(readFixture('rooms', ['seed'])).toEqual(['seed']);
    writeFixture('rooms', ['written']);
    expect(readFixture('rooms', ['seed'])).toEqual(['written']);
  });

  it('tells every listener which key changed, and only that key', () => {
    const seen: string[] = [];
    const off = onFixtureChange((key) => seen.push(key));
    writeFixture('rooms', 1);
    writeFixture('tasks', 2);
    off();
    writeFixture('rooms', 3);
    expect(seen).toEqual(['rooms', 'tasks']);
  });

  it('puts every key back when reset, so one test cannot leak into the next', () => {
    writeFixture('rooms', ['written']);
    resetFixtures();
    expect(readFixture('rooms', ['seed'])).toEqual(['seed']);
  });
});

/** A reader and a writer of the same key, mounted side by side. */
function Board() {
  const rooms = useFixtureValue<string[]>('rooms', () => ['301']);
  const add = useFixtureMutation<string[], string>(
    'rooms',
    (current, room) => [...current, room],
    () => ['301'],
  );

  return (
    <View>
      <RNText testID="rooms">{rooms.join(',')}</RNText>
      <RNText testID="status">{add.status}</RNText>
      <RNText testID="add" onPress={() => void add.mutate('302')}>
        add
      </RNText>
    </View>
  );
}

describe('useFixtureMutation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts idle and seeds the reader from the file fixture', () => {
    render(<Board />);
    expect(screen.getByTestId('rooms').props.children).toBe('301');
    expect(screen.getByTestId('status').props.children).toBe('idle');
  });

  it('goes through saving before it lands, so a pending state is real', async () => {
    render(<Board />);
    act(() => {
      screen.getByTestId('add').props.onPress();
    });
    // Still in flight: a screen that forgot to disable its button while saving
    // is visibly wrong here rather than on the day the network arrives.
    expect(screen.getByTestId('status').props.children).toBe('saving');

    await act(async () => {
      jest.advanceTimersByTime(MUTATION_LATENCY_MS);
    });
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('done'));
  });

  it('re-renders a reader of the same key, not just the writer', async () => {
    render(<Board />);
    act(() => {
      screen.getByTestId('add').props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTATION_LATENCY_MS);
    });
    // The point of the whole hook: the write reached a reader.
    await waitFor(() => expect(screen.getByTestId('rooms').props.children).toBe('301,302'));
  });

  it('applies the change to what is in the store, not to the seed', async () => {
    writeFixture('rooms', ['301', '302']);
    render(<Board />);
    act(() => {
      screen.getByTestId('add').props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTATION_LATENCY_MS);
    });
    await waitFor(() =>
      expect(screen.getByTestId('rooms').props.children).toBe('301,302,302'),
    );
  });

  it('drops a write that was in flight when the store was reset', async () => {
    // The twin of the test below, and the reason it is not a contradiction: a
    // write outlives its own SCREEN, because navigating away mid-save must not
    // silently drop a save. It must not outlive a RESET, because a reset is a
    // test saying the store is empty again. When it did, a toggle fired at the
    // end of one test landed in the next one and that test failed on an
    // ordering it never set up — only under load, only when the timer lost the
    // race to `afterEach`.
    render(<Board />);
    act(() => {
      screen.getByTestId('add').props.onPress();
    });
    resetFixtures();
    await act(async () => {
      jest.advanceTimersByTime(MUTATION_LATENCY_MS);
    });

    expect(readFixture<string[]>('rooms', ['301'])).toEqual(['301']);
    // And the writer is not left claiming it is still saving.
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('idle'));
  });

  it('lands the write even when the writer unmounted mid-flight', async () => {
    const view = render(<Board />);
    act(() => {
      screen.getByTestId('add').props.onPress();
    });
    view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(MUTATION_LATENCY_MS);
    });
    // Navigating away must not silently drop a save. Only the writer's own
    // status is lost, because there is nobody left to show it to.
    expect(readFixture<string[]>('rooms', ['301'])).toEqual(['301', '302']);
  });
});
