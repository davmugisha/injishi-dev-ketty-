/**
 * A business's code: its district's letters and a number, `KIC0001`.
 *
 * Given to a business when its registration fee is paid, numbered per district
 * in the order businesses registered there, and never changed afterwards, not
 * even when the business moves. It exists so PSF can find and filter the
 * businesses of a district at a glance, which is why the letters are the
 * district's own and the number counts within it.
 *
 * THE LETTERS are the first three of the district's name. Seven districts
 * start "Nya" and two start "Ngo", so those nine take letters from further into
 * the name instead (agreed with the owner on 2026-10-15): every code still says
 * which district it belongs to, and no two districts share letters.
 *
 * Keyed by the national district id (`districts.id`), which is fixed by the
 * national geography and never reused. The table lives here, in code, rather
 * than in a column: geography is seeded after migrations run, and a code the
 * server issues must not depend on whether a seed has run yet.
 */
export declare const DISTRICT_LETTERS: Readonly<Record<number, {
    letters: string;
    name: string;
}>>;
/**
 * The letters a district's codes start with.
 *
 * A district outside the national table (a test database's invented one) falls
 * back to the first three letters of its name, so issuing a code never fails
 * on geography, and the fallback is the same rule the table follows.
 */
export declare function districtLetters(districtId: number, districtName: string | null): string;
/** The digits an OLD code carries at least: `KIC0001`, and `KIC10000` past 9999. */
export declare const BUSINESS_CODE_DIGITS = 4;
/** The old format (until 2026-11-02): a district's letters and its nth business. Codes issued so far keep it. */
export declare function formatBusinessCode(letters: string, n: number): string;
/**
 * THE CODE FROM 2026-11-02 (the owner's decision): `GIS-4K7Q-92`. The district's
 * letters, four random characters, and two check characters. About a million
 * codes a district, never handed out in order (so nobody counts a district's
 * businesses by them), and a mistyped character or two swapped ones are caught
 * by the check. The characters leave out 0/O and 1/I, which people misread.
 */
export declare const BUSINESS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** The two check characters of a district's letters and a four-character body. */
export declare function businessCodeCheck(letters: string, body: string): string;
/** A new code for a district, from four random bytes (the server passes `crypto.randomBytes`). */
export declare function newBusinessCode(letters: string, random: (n: number) => Uint8Array): string;
/**
 * A code as people type it, in either format, or null when it is not one:
 * `kic 0001` → `KIC0001`, `gis4k7q92` → `GIS-4K7Q-92` (its check must hold).
 */
export declare function normalizeBusinessCode(raw: string): string | null;
//# sourceMappingURL=business-code.d.ts.map