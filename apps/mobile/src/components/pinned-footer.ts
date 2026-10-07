/**
 * What is pinned to the bottom of the screen, so a toast can sit above it.
 *
 * `Toast` and `UndoBar` used to sit at one fixed offset, `insets.bottom + 78`,
 * chosen to clear a tab bar. Any screen that pinned an action bar of its own
 * put that bar inside the toast's band: on the device rig a toast slid in
 * behind Work's "Take next" (mobile audit 2026-10-05, WK-14 and XC-05), and
 * the toast is often the only line that says a write failed. So a pinned
 * footer declares its height here, and both floaters rise above the tallest.
 *
 * **Mounted, not focused.** A footer on a screen under the one in front, or on
 * a tab that stays mounted, still counts. That can only lift a toast higher
 * than it strictly needs to be, never lower, and it keeps the kit free of
 * navigation hooks, which screen tests render without.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const pinned = new Map<number, number>();
const listeners = new Set<() => void>();
let nextId = 1;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function tallestPinned(): number {
  let tallest = 0;
  for (const height of pinned.values()) tallest = Math.max(tallest, height);
  return tallest;
}

/**
 * The tab bar's content height, above the home indicator inset. One source for
 * `app/(tabs)/_layout.tsx`, which draws the bar, and for any footer that sits on
 * top of it and has to say how far from the screen's edge its own top is. Work
 * gets the taller bar (frame W1: gloved, one handed).
 */
export function tabBarContentHeight(work: boolean): number {
  if (Platform.OS === 'ios') return work ? 62 : 54;
  return work ? 72 : 64;
}

/**
 * Declare a footer pinned to the bottom of the screen for as long as it is
 * mounted. `height` is how far its TOP sits above the screen's bottom edge, the
 * home indicator inset (and a tab bar under it) included. Zero removes it.
 */
export function usePinnedFooter(height: number): void {
  const id = useRef(0);
  if (id.current === 0) id.current = nextId++;

  useEffect(() => {
    const key = id.current;
    if (height > 0) pinned.set(key, height);
    else pinned.delete(key);
    emit();
    return () => {
      pinned.delete(key);
      emit();
    };
  }, [height]);
}

/**
 * How far above the bottom edge the tallest pinned footer reaches; 0 for none.
 * An external store read, so a footer registered before this subscribed (its
 * effect ran first) is still seen.
 */
export function usePinnedFooterHeight(): number {
  return useSyncExternalStore(subscribe, tallestPinned, tallestPinned);
}

/** Tests only: forget every footer. */
export function resetPinnedFooters(): void {
  pinned.clear();
  emit();
}
