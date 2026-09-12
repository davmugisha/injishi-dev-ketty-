/**
 * The Unique Parcel Identifier rule — Rwanda's land parcel address.
 *
 * A UPI is five slash-separated groups that walk down the administrative tree:
 * `province / district / sector / cell / parcel`, as in `1/02/03/04/1234`. The
 * first four are fixed-width codes issued by the National Land Authority and the
 * fifth is the parcel's own number within its cell.
 *
 * This is DELIBERATELY STRICTER than `Upi` in `@injishi/contracts`, which only
 * asks for five runs of digits. The loose version accepts `1/2/3/4/5`, which is
 * not a UPI anybody's land title carries — it is a person typing the shape of
 * one — and a landlord who sends it gets rejected weeks later by an officer
 * holding the real title deed rather than in the second it takes to read this
 * message. Everything this accepts the contract also accepts, so nothing valid
 * here is refused on the way to the API.
 *
 * NO IMPORTS, AND NO NON-ERASABLE SYNTAX, for the same reason as
 * `rwanda-id.ts`: a verification script loads this module directly under Node's
 * type stripping, which erases annotations and will not emit code, so an enum,
 * a namespace, a decorator or a parameter property here would crash it.
 */

/** How many groups a UPI has. Five, one per level of the land hierarchy. */
export const UPI_GROUPS = 5;

/** What each group is called, in order, for a message that names the wrong one. */
const GROUP_NAMES = ["province", "district", "sector", "cell", "parcel"];

/**
 * The width each group must have.
 *
 * Province is one digit because Rwanda has five provinces; district, sector and
 * cell are two-digit codes padded with a leading zero, which is why `1/2/3/4/5`
 * is wrong and `1/02/03/04/1234` is right. The parcel runs from one to six
 * digits — a cell with a handful of plots and a cell in central Kigali are both
 * real.
 */
function groupPattern(index: number): RegExp {
  if (index === 0) return /^\d$/;
  if (index === UPI_GROUPS - 1) return /^\d{1,6}$/;
  return /^\d{2}$/;
}

/**
 * Why this value is not a UPI, or `null` when it is one.
 *
 * Spaces around the separators are tolerated — a UPI read off a title deed is
 * often typed `1 / 02 / 03 / 04 / 1234` — but nothing else is. A dash separator
 * in particular is refused rather than quietly repaired: the person is copying
 * a document, and silently rewriting what they copied is how a wrong parcel gets
 * registered against the right-looking string.
 */
export function upiError(value: string): string | null {
  const text = value.trim();
  if (text.length === 0) {
    return "Enter the UPI from your land title, like 1/02/03/04/1234.";
  }

  const normalised = text.replace(/\s*\/\s*/g, "/");
  if (/\s/.test(normalised)) {
    return "A UPI has no spaces inside it. It looks like 1/02/03/04/1234.";
  }

  const groups = normalised.split("/");
  if (groups.length !== UPI_GROUPS) {
    return `A UPI has ${UPI_GROUPS} parts separated by slashes — province, district, sector, cell and parcel — like 1/02/03/04/1234.`;
  }

  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    if (group.length === 0) {
      return `The ${GROUP_NAMES[i]} part of the UPI is missing.`;
    }
    if (!/^\d+$/.test(group)) {
      return `The ${GROUP_NAMES[i]} part of a UPI is digits only.`;
    }
    if (!groupPattern(i).test(group)) {
      return `The ${GROUP_NAMES[i]} part looks wrong: ${describeGroup(i)}. A UPI looks like 1/02/03/04/1234.`;
    }
  }

  return null;
}

/** The one normalised spelling, so two typings of one parcel are one string. */
export function normalizeUpi(value: string): string {
  return value.trim().replace(/\s*\/\s*/g, "/");
}

/** What a group is supposed to look like, said to a person rather than as a regex. */
function describeGroup(index: number): string {
  if (index === 0) return "the province is a single digit";
  if (index === UPI_GROUPS - 1) return "the parcel is 1 to 6 digits";
  return `the ${GROUP_NAMES[index]} is two digits, so write 03 rather than 3`;
}
