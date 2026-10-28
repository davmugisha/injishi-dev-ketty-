import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the phone asks for less motion (Android: Remove animations; iOS: Reduce Motion), live
 * (mobile spec 0002, D-ab). One subscription for the whole app: it reads the setting once, then
 * follows `reduceMotionChanged`, so turning it on or off takes effect without a restart. Until the
 * first read answers, it says no.
 *
 * The root layout turns it into HeroUI's `animation="disable-all"`, and every pressable shows the
 * `pressed` colour instead of moving (D-q).
 */
let reduceMotion = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (value === reduceMotion) return;
  reduceMotion = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    AccessibilityInfo.isReduceMotionEnabled().then(set, () => {});
    AccessibilityInfo.addEventListener("reduceMotionChanged", set);
  }
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => reduceMotion;

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
