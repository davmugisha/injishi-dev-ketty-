"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonName = exports.PersonEmail = void 0;
exports.suggestEmailFix = suggestEmailFix;
exports.emailTypoMessage = emailTypoMessage;
exports.checkEmailTypo = checkEmailTypo;
exports.normaliseIdNumber = normaliseIdNumber;
exports.idNumberProblem = idNumberProblem;
exports.defaultIdKind = defaultIdKind;
exports.comparableName = comparableName;
exports.sameName = sameName;
const zod_1 = require("zod");
// ===========================================================================
// People on a lease: their email, their ID document, their name
// ===========================================================================
// --- Obvious email typos ------------------------------------------------------
//
// A lease invitation sent to `alice@demo.injishi.con` reaches nobody, and the
// landlord only learns that when the tenant asks where it went. These are the
// slips that are almost never meant: a `.con` for `.com`, `gmial` for
// `gmail`. The form offers the fix in one tap, and the API refuses the address
// unless the person says it is right (`confirmEmail: true`), because a real
// address can end in `.cm` (Cameroon) or `.co` (Colombia).
//
// Small and fixed on purpose: a spelling corrector that guesses at every
// domain would "fix" addresses that were fine.
/** Endings that are a slip for `.com`. */
const TLD_FIXES = {
    con: "com",
    cm: "com",
    comm: "com",
    ocm: "com",
    cmo: "com",
    vom: "com",
    xom: "com",
    coom: "com",
};
/** Mail providers whose address is always `.com`: their `.co` is a slip too. */
const DOT_COM_PROVIDERS = new Set(["gmail", "yahoo", "outlook", "hotmail", "icloud"]);
/** Misspelt provider names. */
const DOMAIN_FIXES = {
    gmial: "gmail",
    gmai: "gmail",
    gamil: "gmail",
    gmal: "gmail",
    gnail: "gmail",
    gmaill: "gmail",
    yaho: "yahoo",
    yahooo: "yahoo",
    yhoo: "yahoo",
    hotmial: "hotmail",
    hotmal: "hotmail",
    hotmai: "hotmail",
    homail: "hotmail",
    outlok: "outlook",
    outloo: "outlook",
    otlook: "outlook",
    iclod: "icloud",
    icoud: "icloud",
};
/**
 * The address as it was probably meant, or null when nothing looks wrong.
 *
 * `alice@demo.injishi.con` → `alice@demo.injishi.com`;
 * `aline@gmial.com` → `aline@gmail.com`; `aline@gmail.co` → `aline@gmail.com`.
 */
function suggestEmailFix(email) {
    const clean = email.trim().toLowerCase();
    const at = clean.lastIndexOf("@");
    if (at <= 0 || at === clean.length - 1)
        return null;
    const local = clean.slice(0, at);
    const labels = clean.slice(at + 1).split(".");
    if (labels.length < 2 || labels.some((l) => l === ""))
        return null;
    const fixed = [...labels];
    const tld = fixed[fixed.length - 1];
    const name = fixed[fixed.length - 2];
    const provider = DOMAIN_FIXES[name] ?? name;
    fixed[fixed.length - 2] = provider;
    if (TLD_FIXES[tld])
        fixed[fixed.length - 1] = TLD_FIXES[tld];
    else if (tld === "co" && fixed.length === 2 && DOT_COM_PROVIDERS.has(provider))
        fixed[fixed.length - 1] = "com";
    const next = `${local}@${fixed.join(".")}`;
    return next === clean ? null : next;
}
/** The sentence a form and the API both say about a likely typo. */
function emailTypoMessage(suggestion) {
    return `Check the email. Did you mean ${suggestion}?`;
}
/** An email address, trimmed and lower cased. The typo guard runs where `confirmEmail` is known. */
exports.PersonEmail = zod_1.z
    .string({ required_error: "Enter an email address.", invalid_type_error: "Enter an email address." })
    .trim()
    .toLowerCase()
    .email("Enter an email address.")
    .max(254, "That email address is too long.");
/** Add the typo issue at `path` unless the person confirmed the address. */
function checkEmailTypo(email, confirmed, ctx, path) {
    if (!email || confirmed)
        return;
    const fix = suggestEmailFix(email);
    if (fix)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: emailTypoMessage(fix), path });
}
// --- ID documents ---------------------------------------------------------------
/** Spaces, dashes and dots out, letters upper case: how a document number is stored. */
function normaliseIdNumber(value) {
    return value.replace(/[\s.-]/g, "").toUpperCase();
}
/**
 * Why a document number is not one, or null when it is. A Rwandan national ID
 * is 16 digits; a passport number is 5 to 20 letters and digits.
 */
function idNumberProblem(kind, value) {
    const v = normaliseIdNumber(value);
    if (kind === "national_id")
        return /^\d{16}$/.test(v) ? null : "A Rwandan ID number has 16 digits.";
    return /^[A-Z0-9]{5,20}$/.test(v) ? null : "A passport number is 5 to 20 letters or digits.";
}
/** The document a number is read as when nobody said: an ID for a Rwandan, a passport otherwise. */
function defaultIdKind(nationality) {
    return nationality === "RW" ? "national_id" : "passport";
}
// --- Names --------------------------------------------------------------------------
/** A person's full name as a form takes it. */
exports.PersonName = zod_1.z
    .string({ required_error: "Enter the full name.", invalid_type_error: "Enter the full name." })
    .trim()
    .min(2, "Enter the full name.")
    .max(120, "That name is too long.");
/**
 * A name reduced to what a person means by it: accents, case and spacing
 * dropped. `  Aimée   UWERA ` and `Aimee Uwera` are the same name.
 */
function comparableName(name) {
    return name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}
/**
 * Does a typed signature match the name the contract states? Case, spacing
 * and accents may differ; anything else may not (`Aline U.` is not
 * `Aline Uwera`).
 */
function sameName(typed, expected) {
    const a = comparableName(typed);
    return a.length > 0 && a === comparableName(expected);
}
//# sourceMappingURL=identity.js.map