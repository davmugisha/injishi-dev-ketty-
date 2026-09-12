/**
 * Reduced motion.
 *
 * The rule, from the design brief §7.6: **reduced motion removes the travel,
 * never the feedback.** A press state, a selection state, a loading state and
 * an error state must all still be visible when motion is off — so what drops
 * is `translate`, and what stays is `opacity` and colour.
 *
 * `AccessibilityInfo` answers asynchronously and can change while the app is
 * open (iOS Settings is a swipe away), so this subscribes rather than reading
 * once at start-up.
 *
 * `MOTION_MS` used to be the web coverflow's own duration, carried across by
 * hand "because `tokens.ts` emits no mobile motion tokens". It does now
 * ([ADR-046](../../../injishi.context/dox/adrs/046-motion-and-state-vocabulary.md)):
 * `motionMs` is authored in `@injishi/design-tokens` and read by both
 * platforms, so this file no longer holds a number of its own. The VALUE is
 * unchanged — `travel` is 320ms, which is what this was — so nothing on screen
 * moves differently; what changed is that moving it moves both platforms.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { motionMs } from '@injishi/design-tokens';

/**
 * Full travel duration — the scale's `travel` step, the one that means
 * "something crossing the screen". Reduced motion collapses it to
 * `MOTION_MS_REDUCED`.
 */
export const MOTION_MS = motionMs.travel;
/** Not zero: the state change still has to register, it just does not travel. */
export const MOTION_MS_REDUCED = 1;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (!cancelled) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduced;
}
