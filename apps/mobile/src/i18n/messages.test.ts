/**
 * Catalogue parity — the highest-value test in this suite.
 *
 * `messages.ts` types `rw` as `Record<MessageKey, string>`, so a missing key is
 * already a `tsc` error. This is here anyway, for the two failures the type
 * cannot see: a key present but empty, and a key present but left as the
 * English string. Both degrade silently — `t()` falls through EN before falling
 * back to the key, so a Kinyarwanda reader sees English and nothing reports it.
 */
import { catalogues, en, rw, LOCALES, type Locale, type MessageKey } from './messages';

const keys = Object.keys(en) as MessageKey[];

describe('the message catalogues', () => {
  it('ships exactly the locales the app offers', () => {
    expect(Object.keys(catalogues).sort()).toEqual(['en', 'rw']);
    expect(LOCALES.map((l) => l.value).sort()).toEqual(Object.keys(catalogues).sort());
  });

  it('has every EN key in RW', () => {
    const missing = keys.filter((k) => !(k in rw));
    expect(missing).toEqual([]);
  });

  it('has no RW key that EN does not have', () => {
    const extra = Object.keys(rw).filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it('has no blank message in either catalogue', () => {
    for (const locale of Object.keys(catalogues) as Locale[]) {
      const blank = keys.filter((k) => !catalogues[locale][k]?.trim());
      expect({ locale, blank }).toEqual({ locale, blank: [] });
    }
  });

  it('carries the same placeholders in both catalogues', () => {
    // `{name}` is positional and the RW sentence may reorder it, so the set is
    // what has to match, not the order. A dropped placeholder is a value that
    // never reaches the reader.
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const mismatched = keys.filter(
      (k) => placeholders(en[k]).join() !== placeholders(rw[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('speaks to the reader, never about how the app was built', () => {
    // Nineteen English values reached real screens saying "not wired", "this
    // build", "prototype" or "fixtures", or naming a seed persona or property
    // (mobile audit 2026-10-05, XC-16). Nothing stopped the next one. These
    // words describe the build to its builders; a person using the app can do
    // nothing with them.
    const builderWords =
      /\bnot (yet )?wired\b|\bwired yet\b|\bthis build\b|\bprototype\b|\bfixtures?\b|\bsession \d|\bframe [A-Z]\d|\bF-[A-Z]\d{2}\b|\bendpoint\b|\bSamuel\b|\bKayitare\b|\bAline K\b|\bUmurage\b/i;
    // Kept on purpose, each unreachable by a person using the app: the
    // `ComingSoon` stub no route renders (gaps.md X4, its deletion is the
    // owner's call), and the Diagnostics screen, which exists only in
    // development and tester builds (ADR-063 AC-7).
    const unreachable = (k: string) => k.startsWith('comingSoon.') || k.startsWith('diagnostics.');
    const offending = keys
      .filter((k) => !unreachable(k))
      .filter((k) => builderWords.test(en[k]))
      .map((k) => `${k}: ${en[k]}`);
    expect(offending).toEqual([]);
  });
});
