/**
 * Avatar helpers for the logged-in user (F-S01 / F-S12).
 *
 * A user has no uploaded photo by default, so the avatar is generated from
 * their name/email: up to two initials. When the user has an image (e.g.
 * linked Google), callers render that instead.
 *
 * This file once also carried a deterministic tone ramp (`AVATAR_TONES`,
 * `AVATAR_TONE_TOKENS`, `toneFor`) so each avatar got a stable background from
 * the sanctioned Ink+green classes. No caller ever used it — every avatar in
 * the shell and both account screens takes its colour from the surrounding
 * markup — so it has been removed rather than left as a mechanism that looks
 * live. Bring it back from git history if per-user tones are wanted.
 */

/** Up to two uppercase initials from a display name, falling back to email. */
export function initialsFrom(
  name?: string | null,
  email?: string | null,
): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    if (parts.length >= 2) {
      const last = parts[parts.length - 1] ?? "";
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }
    return first.slice(0, 2).toUpperCase();
  }
  const local = (email ?? "").split("@")[0] ?? "";
  return (local.slice(0, 2) || "U").toUpperCase();
}

/** A human display name: the name if set, else a tidied email local-part. */
export function displayNameFrom(
  name?: string | null,
  email?: string | null,
): string {
  const n = (name ?? "").trim();
  if (n) return n;
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "You";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
