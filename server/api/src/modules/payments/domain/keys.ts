/**
 * Every idempotency key the booking engine sends across the payment seam,
 * spelled once (review 4.2).
 *
 * The rule the keys encode: an operation that reverses another derives its key
 * FROM the original's rather than reusing it. Equal keys were a real bug — an
 * adapter that scopes its memory by key alone answers the refund with the
 * capture it was meant to reverse, reports success, and leaves the money
 * captured. Derived keys replay THEIR OWN operation and nothing else.
 */

const VOID_PREFIX = 'void:';

export function captureKeyFor(workspaceId: string, attemptToken: string): string {
  return `${workspaceId}:booking-capture:${attemptToken}`;
}

/** One press of pay on a registration's fee (073-gtbank-payments AC-16). */
export function registrationFeeKeyFor(workspaceId: string, attemptToken: string): string {
  return `${workspaceId}:registration-fee:${attemptToken}`;
}

/** The refund of a registration fee paid a second time, derived from its collection's key. */
export function feeDuplicateKeyFor(collectionKey: string): string {
  return `fee-duplicate:${collectionKey}`;
}

export function refundKeyFor(captureKey: string): string {
  return `refund:${captureKey}`;
}

export function voidKeyFor(captureKey: string): string {
  return `${VOID_PREFIX}${captureKey}`;
}

/** The capture a void job was queued against. Inverse of `voidKeyFor`. */
export function captureKeyOfVoid(voidKey: string): string | null {
  return voidKey.startsWith(VOID_PREFIX) ? voidKey.slice(VOID_PREFIX.length) : null;
}

/**
 * The key a release runs under, derived from the capture's when the escrow
 * row recorded one, and from the row itself for rows written before the seam
 * existed. Both the decline path and the expiry sweep call this, so a release
 * that lands from either replays rather than running twice.
 */
export function releaseKeyFor(escrow: {
  idempotencyKey: string | null;
  workspaceId: string;
  escrowId: string;
}): string {
  return escrow.idempotencyKey
    ? `escrow-release:${escrow.idempotencyKey}`
    : `${escrow.workspaceId}:escrow-release:${escrow.escrowId}`;
}
