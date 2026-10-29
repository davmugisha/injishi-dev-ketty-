/**
 * How much of an identifier a screen may see. One rule, one definition.
 *
 * Show the last four characters and hide the rest; hide a short value whole,
 * because showing three of four characters is not masking.
 *
 * WHY THIS IS SHARED RATHER THAN LOCAL. It was local, twice. `/me/profile`
 * carried a module-private `maskDocument`, and the admin console's user
 * directory restated the same rule character-for-character because it could not
 * import one that carried no `export`. Two copies of a disclosure rule is one
 * copy waiting to be loosened: whichever is weaker becomes the real boundary,
 * and nothing fails when they drift apart. A person's document would simply
 * show more of itself on one screen than on another, and no test would notice.
 *
 * NONE OF THIS IS A SECURITY BOUNDARY BY ITSELF. Masking limits what a reader
 * can copy out of a page they were already allowed to open. `SessionGuard`,
 * `WorkspaceGuard` and `StaffGuard` decide whether they may open it.
 */

/** The masking character. One definition so the two screens cannot differ. */
const HIDDEN = '•';

/** How many trailing characters stay readable. */
const VISIBLE_TAIL = 4;

/**
 * Mask an identifier, showing only its tail.
 *
 * A value of four characters or fewer is hidden entirely rather than partially:
 * at that length the visible tail IS the value.
 */
export function maskIdentifier(value: string): string {
  if (value.length <= VISIBLE_TAIL) return HIDDEN.repeat(value.length);
  return `${HIDDEN.repeat(VISIBLE_TAIL)}${value.slice(-VISIBLE_TAIL)}`;
}

/**
 * Mask an identifier that may be absent, preserving the difference.
 *
 * Null in, null out. "This person has no document on file" and "this person has
 * one we will not show you" are different facts, and rendering the first as a
 * row of dots makes it unreadable. An empty or whitespace-only value is treated
 * as absent for the same reason.
 */
export function maskOptionalIdentifier(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return maskIdentifier(trimmed);
}

/**
 * An email address with most of its name hidden, for "we sent a code to …"
 * and an invitation page: `samuel@injishi.com` → `sa••••@injishi.com`. The
 * domain stays readable, so the person can tell which mailbox to open.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  const name = email.slice(0, at);
  const domain = email.slice(at);
  if (name.length <= 2) return `${name[0] ?? ''}••${domain}`;
  return `${name.slice(0, 2)}${HIDDEN.repeat(Math.min(name.length - 2, 6))}${domain}`;
}
