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
export const DISTRICT_LETTERS: Readonly<Record<number, { letters: string; name: string }>> = {
    // Kigali City
    101: { letters: "NRG", name: "Nyarugenge" },
    102: { letters: "GAS", name: "Gasabo" },
    103: { letters: "KIC", name: "Kicukiro" },
    // Southern Province
    201: { letters: "NZA", name: "Nyanza" },
    202: { letters: "GIS", name: "Gisagara" },
    203: { letters: "NRU", name: "Nyaruguru" },
    204: { letters: "HUY", name: "Huye" },
    205: { letters: "NMG", name: "Nyamagabe" },
    206: { letters: "RUH", name: "Ruhango" },
    207: { letters: "MUH", name: "Muhanga" },
    208: { letters: "KAM", name: "Kamonyi" },
    // Western Province
    301: { letters: "KAR", name: "Karongi" },
    302: { letters: "RUT", name: "Rutsiro" },
    303: { letters: "RUB", name: "Rubavu" },
    304: { letters: "NBH", name: "Nyabihu" },
    305: { letters: "NGR", name: "Ngororero" },
    306: { letters: "RUS", name: "Rusizi" },
    307: { letters: "NMS", name: "Nyamasheke" },
    // Northern Province
    401: { letters: "RUL", name: "Rulindo" },
    402: { letters: "GAK", name: "Gakenke" },
    403: { letters: "MUS", name: "Musanze" },
    404: { letters: "BUR", name: "Burera" },
    405: { letters: "GIC", name: "Gicumbi" },
    // Eastern Province
    501: { letters: "RWA", name: "Rwamagana" },
    502: { letters: "NGT", name: "Nyagatare" },
    503: { letters: "GAT", name: "Gatsibo" },
    504: { letters: "KAY", name: "Kayonza" },
    505: { letters: "KIR", name: "Kirehe" },
    506: { letters: "NGM", name: "Ngoma" },
    507: { letters: "BUG", name: "Bugesera" },
};
/**
 * The letters a district's codes start with.
 *
 * A district outside the national table (a test database's invented one) falls
 * back to the first three letters of its name, so issuing a code never fails
 * on geography, and the fallback is the same rule the table follows.
 */
export function districtLetters(districtId: number, districtName: string | null): string {
    const known = DISTRICT_LETTERS[districtId];
    if (known)
        return known.letters;
    const fromName = (districtName ?? "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    return fromName.padEnd(3, "X");
}
/** The digits a code carries at least: `KIC0001`, and `KIC10000` past 9999. */
export const BUSINESS_CODE_DIGITS = 4;
/** A district's letters and its nth business, as the code is written. */
export function formatBusinessCode(letters: string, n: number): string {
    return `${letters}${String(n).padStart(BUSINESS_CODE_DIGITS, "0")}`;
}
/** A code as people type it, or null when it is not one: `kic 0001` → `KIC0001`. */
export function normalizeBusinessCode(raw: string): string | null {
    const compact = raw.replace(/[\s-]/g, "").toUpperCase();
    return /^[A-Z]{3}\d{4,}$/.test(compact) ? compact : null;
}
