"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACT_MAX_INPUT = void 0;
exports.redactText = redactText;
const phone_1 = require("./phone");
/**
 * Crash report redaction (ADR-063, "The patterns").
 *
 * `redactText` is the one definition of what personal data looks like inside
 * free text, shared by the phone's crash reporter and the API's `beforeSend`.
 * It runs on error messages and trail entries before they leave the process,
 * so a name, an email, a phone number, an ID, a token or a sign in code that
 * reached an error string never reaches Sentry.
 *
 * Fourteen rows apply in order, each to the output of the one before. Order is
 * load bearing: a query string goes before the email row so `?email=` is cut
 * whole, a UUID becomes `:id` before the long run row could call it a token,
 * and phone numbers go before the plain digit rows so a spaced number is named
 * as a phone, not as three short numbers. The contracts tests pin the exact
 * placeholder for every row.
 *
 * Pure, synchronous and total: it never throws, and on an internal failure it
 * returns a placeholder rather than the text it could not clean.
 *
 * No regex here uses a lookbehind. The phone runs this under Hermes, and a
 * pattern the engine cannot compile would throw when the module loads, which
 * is the one place the crash reporter must never fail.
 */
/** The most characters `redactText` reads. Everything after is dropped first. */
exports.REDACT_MAX_INPUT = 2000;
/** What `redactText` returns when it cannot clean a string. */
const UNREADABLE = "[redacted]";
/**
 * Where a path token may start: the start of the string, or after a space, a
 * quote, a bracket, `=`, `,` or `:`. Keeps `and/or?` in prose from reading as
 * a path while catching `GET /api/x?q=1` and `"/api/x?q=1"`.
 */
const TOKEN_START = "(^|[\\s\"'(\\[=,:])";
/** Between two digits of a phone number: up to three separator characters. */
const SEP = `${phone_1.RW_PHONE_SEPARATOR.source}{0,3}`;
/** `n` more digits, each optionally preceded by separators. */
function digitsWithSeparators(n) {
    return `(?:${SEP}\\d){${n}}`;
}
/** `7`, separators, `8` — every prefix spelled so it can be split by spacing. */
const RW_PREFIXES = phone_1.RW_MOBILE_PREFIXES.map((prefix) => prefix.split("").join(SEP)).join("|");
/**
 * A Rwandan mobile number in any spelling a person writes: an optional
 * `+250`, `250` or `0` (`%2B` read as `+`, a leading bracket allowed), then a
 * prefix from `RW_MOBILE_PREFIXES` and seven more digits. The separators after
 * the country code belong to it, so a bare number does not swallow the space
 * in front of it.
 */
const RW_MOBILE = `(?:\\(?(?:(?:\\+|%2B)?250|0)${SEP})?(?:${RW_PREFIXES})${digitsWithSeparators(7)}`;
/** Any `+` number of 9 to 15 digits, for a foreign phone. */
const ANY_PLUS_NUMBER = `(?:\\+|%2B)\\d${digitsWithSeparators("8,14")}`;
/** The fourteen rows, in the order the spec fixes. */
const ROWS = [
    // 1. A query string or fragment, in a URL or a path token. A `?` or `#` in
    //    prose stays, so "Why did it fail? See #4" survives.
    [/(https?:\/\/[^\s?#]*)[?#]\S*/gi, "$1"],
    [new RegExp(`${TOKEN_START}(\\/[^\\s?#]*)[?#]\\S*`, "g"), "$1$2"],
    // 2. A file on the phone: a URI, or a bare app sandbox path.
    [/(?:file|content|ph):\/\/\S*/gi, "[local file]"],
    [new RegExp(`${TOKEN_START}(?:\\/data\\/|\\/storage\\/|\\/sdcard\\/|\\/var\\/mobile\\/|\\/private\\/var\\/)\\S*`, "g"), "$1[local file]"],
    // 3. A Drizzle query error's parameter list, to the end of the string.
    [/params:[\s\S]*$/, "params: [redacted]"],
    // 4. The value a Postgres message quotes at its end.
    [/((?:invalid input syntax for type|invalid input value for enum)[^:\n]*:\s*|out of range:\s*)"[^\n]*"/gi, '$1"[value]"'],
    // 5. A bearer credential.
    [/\bBearer\s+\S+/gi, "Bearer [redacted]"],
    // 6. A JWT.
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[token]"],
    // 7. A signed session token: 32 characters, a dot, a URL encoded signature.
    [/\b[A-Za-z0-9]{32}\.[A-Za-z0-9%+/=_-]{20,}/g, "[token]"],
    // 8. A UUID, the shape of every id in this platform.
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ":id"],
    // 9. An email address, `%40` read as `@`.
    [/[A-Za-z0-9._%+-]+(?:@|%40)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi, "[email]"],
    // 10. A phone number: Rwandan in any spelling, or any `+` number.
    [new RegExp(`(^|\\D)(?:${RW_MOBILE}|${ANY_PLUS_NUMBER})(?!\\d)`, "gi"), "$1[phone]"],
    // 11. 13 to 19 digits, single spaces allowed between them: a national ID
    //     (16) or a card number (13 to 19).
    [/(^|\D)\d(?: ?\d){12,18}(?!\d)/g, "$1[number]"],
    // 12. Exactly nine digits: a TIN.
    [/(^|\D)\d{9}(?!\d)/g, "$1[number]"],
    // 13. Exactly six digits, whatever touches them: a sign in code.
    [/(^|\D)\d{6}(?!\d)/g, "$1[code]"],
    // 14. A long random run. A SQL identifier (lowercase and `_` only) stays,
    //     so a constraint name in a database error is still readable.
    [/[A-Za-z0-9_-]{32,}/g, (run) => (/^[a-z_]+$/.test(run) ? run : "[token]")],
];
/**
 * `text` with every pattern above applied, cut to `REDACT_MAX_INPUT`
 * characters first. Anything that is not a string returns an empty string.
 */
function redactText(text) {
    if (typeof text !== "string")
        return "";
    try {
        let out = text.slice(0, exports.REDACT_MAX_INPUT);
        for (const [pattern, replacement] of ROWS) {
            pattern.lastIndex = 0;
            out = typeof replacement === "string"
                ? out.replace(pattern, replacement)
                : out.replace(pattern, replacement);
        }
        return out;
    }
    catch {
        return UNREADABLE;
    }
}
//# sourceMappingURL=redaction.js.map