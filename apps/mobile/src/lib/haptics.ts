import { Platform } from "react-native";

/**
 * The app's three haptics (mobile spec 0002, D-r): a selection tick, a success buzz and an error
 * buzz. Nothing else buzzes; a plain press stays silent.
 *
 * Android uses `performAndroidHapticsAsync`, which goes through the view and so obeys Touch
 * feedback; iOS's selection and notification calls obey System Haptics. The tick is `Clock_Tick`,
 * which every Android version has; confirm and reject need Android 11, and below it they fail
 * quietly.
 *
 * The module loads on first use, inside a try: a development build made before expo-haptics, the
 * web preview and an emulator without a vibrator all get silence, never an error.
 */
type HapticsModule = typeof import("expo-haptics");

let module: HapticsModule | null | undefined;

function load(): HapticsModule | null {
  if (module === undefined) {
    try {
      module = require("expo-haptics") as HapticsModule;
    } catch {
      module = null;
    }
  }
  return module;
}

function fire(android: (h: HapticsModule) => Promise<void>, other: (h: HapticsModule) => Promise<void>) {
  const h = load();
  if (!h) return;
  try {
    (Platform.OS === "android" ? android(h) : other(h)).catch(() => {});
  } catch {
    // A native module missing from this build throws before it returns a promise.
  }
}

export const haptic = {
  /** A choice moved: a chip, a segment, a toggle. */
  selection: () =>
    fire(
      (h) => h.performAndroidHapticsAsync(h.AndroidHaptics.Clock_Tick),
      (h) => h.selectionAsync(),
    ),
  /** Something the person did has worked. */
  success: () =>
    fire(
      (h) => h.performAndroidHapticsAsync(h.AndroidHaptics.Confirm),
      (h) => h.notificationAsync(h.NotificationFeedbackType.Success),
    ),
  /** Something the person did has failed. */
  error: () =>
    fire(
      (h) => h.performAndroidHapticsAsync(h.AndroidHaptics.Reject),
      (h) => h.notificationAsync(h.NotificationFeedbackType.Error),
    ),
};
