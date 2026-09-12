/**
 * One press of confirm, named (ADR-020 D-c).
 *
 * The browser mints a uuid per press and reuses it on every retry of that
 * press. The server derives the charge's idempotency key from it, so a request
 * that succeeded slowly — which from here is indistinguishable from one that
 * failed — is recognised as the same intent instead of charged again.
 *
 * `crypto.randomUUID` needs a secure context, and a page served over plain
 * http on anything but localhost does not have one. There it is simply
 * `undefined`, which would throw at the worst possible moment: the press of a
 * button that takes money. `crypto.getRandomValues` has no such restriction, so
 * the fallback builds the same shape from it.
 *
 * The value is only ever a deduplication key. It is not a secret and it is not
 * a credential: the server scopes it by workspace and reads a booking back by
 * this key AND the signed-in guest, so a guessed one surfaces nothing.
 */
export function mintAttemptToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Version 4, variant 10xx — the two bits a validator actually checks.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
