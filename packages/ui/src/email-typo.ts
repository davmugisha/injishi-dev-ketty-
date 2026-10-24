/**
 * Obvious typos in an email address, for `EmailInput`: a `.con` for `.com`, `gmial` for `gmail`.
 *
 * The same rules as contracts' `suggestEmailFix` (`packages/contracts/src/rentals/identity.ts`), which the
 * API runs on a lease invitation and refuses unless the person confirmed the address
 * (`confirmEmail: true`). A copy, because the kit does not import contracts (zod 3 there, zod 4 in the
 * app); `tests/email-typo.test.ts` checks both give the same answer for every address it tries.
 *
 * Small and fixed on purpose: a corrector that guesses at every domain would "fix" addresses that were
 * fine, and a real address can end in `.cm` (Cameroon) or `.co` (Colombia), so the form only suggests.
 */

/** Endings that are a slip for `.com`. */
const TLD_FIXES: Readonly<Record<string, string>> = {
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
const DOMAIN_FIXES: Readonly<Record<string, string>> = {
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
 * `alice@demo.injishi.con` gives `alice@demo.injishi.com`; `aline@gmial.com` gives `aline@gmail.com`.
 */
export function suggestEmailFix(email: string): string | null {
  const clean = email.trim().toLowerCase();
  const at = clean.lastIndexOf("@");
  if (at <= 0 || at === clean.length - 1) return null;
  const local = clean.slice(0, at);
  const labels = clean.slice(at + 1).split(".");
  if (labels.length < 2 || labels.some((l) => l === "")) return null;

  const fixed = [...labels];
  const tld = fixed[fixed.length - 1];
  const name = fixed[fixed.length - 2];

  const provider = DOMAIN_FIXES[name] ?? name;
  fixed[fixed.length - 2] = provider;
  if (TLD_FIXES[tld]) fixed[fixed.length - 1] = TLD_FIXES[tld];
  else if (tld === "co" && fixed.length === 2 && DOT_COM_PROVIDERS.has(provider)) fixed[fixed.length - 1] = "com";

  const next = `${local}@${fixed.join(".")}`;
  return next === clean ? null : next;
}

/** The sentence the form and the API both say about a likely typo. */
export function emailTypoMessage(suggestion: string): string {
  return `Check the email. Did you mean ${suggestion}?`;
}

/** Shaped like an email address (one @, a dot in the domain, no spaces). The API's check is the strict one. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
}
