/**
 * The two platform reaches the trip screens make: open the maps app, and put a
 * string on the clipboard.
 *
 * Both are isolated here rather than inlined, because both are the kind of call
 * that behaves differently on three platforms and would otherwise be written
 * three times with two of them subtly wrong.
 *
 * ## Directions
 *
 * `expo-linking` opens the platform's own maps app, and the URL is per platform
 * because the schemes genuinely differ:
 *
 *   - **iOS** `maps://` is Apple Maps' scheme. `daddr` is the destination and
 *     `q` is the label the pin carries.
 *   - **Android** `geo:` is the OS-level intent, so whichever maps app the
 *     person actually uses answers it — hard-coding Google Maps' own URL would
 *     be choosing for them.
 *   - **web** the `https://` form, which is the only one a browser can follow.
 *
 * The coordinates lead and the name follows as a label, never the other way
 * round. A search for "Lake Kivu Suite" finds whatever the maps provider thinks
 * that is; the pin the property actually gave us is the pin the guest wants.
 *
 * ## Clipboard, and the dependency this session did not add
 *
 * **`expo-clipboard` is the right module for this and is NOT installed.** It is
 * not in Session 0's dependency list and this session's prompt does not name
 * one, and the rule is to say so rather than add it — so this is a shim, and it
 * is the one piece of Session 5 that should be deleted rather than kept.
 *
 * It reaches for `navigator.clipboard` first, which is what the web export
 * runs on, and falls back to React Native's own `Clipboard`. That fallback is
 * deprecated — RN prints a warning naming its removal — and it is accessed
 * through a namespace import so the deprecation getter fires on use rather than
 * on import, and so a build where the export has finally gone returns
 * `undefined` instead of throwing at module scope.
 *
 * `copyText` returns whether it worked, and every caller shows a different
 * toast for the two answers. A copy control that says "Copied" when nothing was
 * copied is worse than one that admits it, because the guest walks to a door
 * with an empty clipboard.
 */
import { Platform } from 'react-native';
import * as ReactNative from 'react-native';
import * as Linking from 'expo-linking';

export interface Destination {
  lat: number;
  lng: number;
  /** The pin's label. The property's name, as the guest knows it. */
  label: string;
}

/** The maps URL for the platform this is running on. Exported for its test. */
export function directionsUrl(to: Destination, platform: string = Platform.OS): string {
  const pin = `${to.lat},${to.lng}`;
  const label = encodeURIComponent(to.label);
  if (platform === 'ios') return `maps://?daddr=${pin}&q=${label}`;
  if (platform === 'android') return `geo:${pin}?q=${pin}(${label})`;
  return `https://www.google.com/maps/dir/?api=1&destination=${pin}`;
}

/**
 * Opens the maps app. Resolves to whether it opened.
 *
 * A device with no maps app at all is a real state — a stripped Android build,
 * a web view with no handler — and it must not surface as an unhandled
 * rejection. The caller toasts instead, with the address still on screen to
 * copy by hand.
 */
export async function openDirections(to: Destination): Promise<boolean> {
  try {
    await Linking.openURL(directionsUrl(to));
    return true;
  } catch {
    return false;
  }
}

/** The deprecated RN export, reached lazily. See the header. */
interface LegacyClipboard {
  setString(value: string): void;
}

function legacyClipboard(): LegacyClipboard | undefined {
  return (ReactNative as unknown as { Clipboard?: LegacyClipboard }).Clipboard;
}

/** Puts `value` on the clipboard. Resolves to whether it landed. */
export async function copyText(value: string): Promise<boolean> {
  const web = (globalThis as { navigator?: { clipboard?: { writeText(v: string): Promise<void> } } })
    .navigator?.clipboard;
  if (web) {
    try {
      await web.writeText(value);
      return true;
    } catch {
      // A browser that refuses the write outside a user gesture. Fall through
      // rather than reporting a success nobody got.
    }
  }

  const legacy = legacyClipboard();
  if (!legacy) return false;
  try {
    legacy.setString(value);
    return true;
  } catch {
    return false;
  }
}
