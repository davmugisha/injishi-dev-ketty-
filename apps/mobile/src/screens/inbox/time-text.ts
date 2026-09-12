/**
 * The relative stamp as TEXT, which is the half that needs the locale.
 *
 * `./relative-time.ts` is pure and returns message keys so it can be tested
 * without a provider. This is the thin layer that turns one into a string, and
 * it is separate for one reason worth naming: past four weeks there is no key
 * at all and the answer is a formatted DATE, which needs `Intl` and the active
 * language rather than the catalogue.
 *
 * `Intl.DateTimeFormat` is available in Hermes with the full ICU that Expo 54
 * ships, and `expo-localization` is already a dependency the app reads its
 * locale from. `rw` falls back to `rw-RW` and, where the runtime has no data
 * for it, to the runtime's own default — a month abbreviated in the wrong
 * language is still a date a reader can act on, where a crash is not.
 */
import type { Locale } from '@/i18n/messages';
import type { Translate } from '@/i18n/i18n';
import { dayLabel, relativeTime } from './relative-time';

const TAG: Record<Locale, string> = { en: 'en-GB', rw: 'rw-RW' };

/** "Jul 01" — the frame's own form for anything older than four weeks. */
export function shortDate(at: number, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(TAG[locale], { day: '2-digit', month: 'short' }).format(
      new Date(at),
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' }).format(
      new Date(at),
    );
  }
}

/** "2h", "1d", "Jul 01". What a thread row and a notification row print. */
export function timeText(at: number, now: number, t: Translate, locale: Locale): string {
  const relative = relativeTime(at, now);
  return relative ? t(relative.key, relative.params) : shortDate(at, locale);
}

/** "Today", "Yesterday", "14 Jul". What a day separator prints. */
export function dayText(at: number, now: number, t: Translate, locale: Locale): string {
  const label = dayLabel(at, now);
  return 'key' in label ? t(label.key) : shortDate(label.date, locale);
}
