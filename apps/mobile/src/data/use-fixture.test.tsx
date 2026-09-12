/**
 * `useFixture` — the read a list screen waits on.
 *
 * The warm half of the cache is a module-level `Set`, which is exactly the
 * shared state that makes a suite order-dependent: a "cold key" test that runs
 * after a "warm key" test for the same key is not testing what it says it is.
 *
 * Every test here uses its own key instead. Re-importing the module in
 * isolation would also work, but `jest.isolateModules` gives the isolated copy
 * its own React, which is a second React in the same render and fails with
 * "Invalid hook call" — so the key is the seam, not the module.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFixture, FIXTURE_LATENCY_MS } from './use-fixture';

/**
 * A key nothing else in this file reads, so the read is genuinely cold.
 *
 * Call it ONCE per test and hold the result. Calling it inside the render
 * callback hands `useFixture` a new key on every render, which re-runs the
 * effect, which sets state, which renders again — the hook spins forever.
 */
let n = 0;
const coldKey = () => `fixture-test-${(n += 1)}`;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Let the latency elapse and React settle. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(FIXTURE_LATENCY_MS);
  });
}

describe('useFixture', () => {
  it('starts loading on a cold key and lands ready after the delay', async () => {
    const key = coldKey();
    const { result } = renderHook(() => useFixture(key, () => [1, 2, 3]));

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeUndefined();

    await settle();

    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.error).toBeUndefined();
  });

  it('skips the delay on a warm key, the way a query cache does', async () => {
    const key = coldKey();

    const first = renderHook(() => useFixture(key, () => [1]));
    await settle();
    expect(first.result.current.status).toBe('ready');
    first.unmount();

    // Navigating back to the screen: the key is warm now, so no second skeleton.
    const { result } = renderHook(() => useFixture(key, () => [1]));
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual([1]);
  });

  it('reports a read that throws, and keeps the error', async () => {
    const key = coldKey();
    const { result } = renderHook(() =>
      useFixture(key, () => {
        throw new Error('fixture exploded');
      }),
    );

    await settle();

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('fixture exploded');
    expect(result.current.data).toBeUndefined();
  });

  it('retry re-reads, so a transient failure can recover', async () => {
    const key = coldKey();
    let fail = true;
    const { result } = renderHook(() =>
      useFixture(key, () => {
        if (fail) throw new Error('first read failed');
        return ['recovered'];
      }),
    );

    await settle();
    expect(result.current.status).toBe('error');

    fail = false;
    act(() => result.current.retry());
    await settle();

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual(['recovered']);
  });

  it('does not resolve after the caller unmounts', async () => {
    const key = coldKey();
    const read = jest.fn(() => [1]);
    const { unmount } = renderHook(() => useFixture(key, read));
    unmount();

    await settle();

    // The effect's cleanup cancels the pending settle, so the read never runs
    // and no state update lands on an unmounted tree.
    expect(read).not.toHaveBeenCalled();
  });
});
