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
/** The digits an OLD code carries at least: `KIC0001`, and `KIC10000` past 9999. */
export const BUSINESS_CODE_DIGITS = 4;
/** The old format (until 2026-11-02): a district's letters and its nth business. Codes issued so far keep it. */
export function formatBusinessCode(letters: string, n: number): string {
    return `${letters}${String(n).padStart(BUSINESS_CODE_DIGITS, "0")}`;
}
/**
 * THE CODE FROM 2026-11-02 (the owner's decision): `GIS-4K7Q-92`. The district's
 * letters, four random characters, and two check characters. About a million
 * codes a district, never handed out in order (so nobody counts a district's
 * businesses by them), and a mistyped character or two swapped ones are caught
 * by the check. The characters leave out 0/O and 1/I, which people misread.
 */
export const BUSINESS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CHECK_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** The two check characters of a district's letters and a four-character body. */
export function businessCodeCheck(letters: string, body: string): string {
    // A weighted sum, mod a prime under 32²: each place weighs differently, so a swap changes the sum.
    let sum = 0;
    [...`${letters}${body}`].forEach((c, i) => {
        sum += (CHECK_CHARS.indexOf(c) + 1) * (2 * i + 3);
    });
    const n = sum % 1021;
    return `${BUSINESS_CODE_ALPHABET[Math.floor(n / 32)]}${BUSINESS_CODE_ALPHABET[n % 32]}`;
}
/** A new code for a district, from four random bytes (the server passes `crypto.randomBytes`). */
export function newBusinessCode(letters: string, random: (n: number) => Uint8Array): string {
    const body = [...random(4)].map((b) => BUSINESS_CODE_ALPHABET[b % 32]).join("");
    return `${letters}-${body}-${businessCodeCheck(letters, body)}`;
}
/**
 * A code as people type it, in either format, or null when it is not one:
 * `kic 0001` → `KIC0001`, `gis4k7q92` → `GIS-4K7Q-92` (its check must hold).
 */
export function normalizeBusinessCode(raw: string): string | null {
    const compact = raw.replace(/[\s-]/g, "").toUpperCase();
    if (/^[A-Z]{3}\d{4,}$/.test(compact)) return compact;
    const m = /^([A-Z]{3})([2-9A-HJ-NP-Z]{4})([2-9A-HJ-NP-Z]{2})$/.exec(compact);
    if (m && businessCodeCheck(m[1]!, m[2]!) === m[3]) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
}
