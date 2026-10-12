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
/** The digits a code carries at least: `KIC0001`, and `KIC10000` past 9999. */
export declare const BUSINESS_CODE_DIGITS = 4;
/** A district's letters and its nth business, as the code is written. */
export declare function formatBusinessCode(letters: string, n: number): string;
/** A code as people type it, or null when it is not one: `kic 0001` → `KIC0001`. */
export declare function normalizeBusinessCode(raw: string): string | null;
//# sourceMappingURL=business-code.d.ts.map