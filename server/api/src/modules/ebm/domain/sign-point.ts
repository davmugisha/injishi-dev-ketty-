/**
 * WHEN A STAY'S SALE IS DECLARED (ADR-050 D-a).
 *
 * `booking` is what the platform has always done: a confirmed booking is signed
 * as a sale (`NS`) the moment it is confirmed, weeks before the guest arrives,
 * and the bill they run up during the stay carries no fiscal document at all.
 *
 * `checkout` is the design this ADR moves to: confirmation raises a PROFORMA
 * (`PS`), which is the RRA specification's own advance receipt, and closing the
 * bill signs the one `NS`. Signing both would declare the room twice.
 *
 * This is a STRANGLER SWITCH and therefore debt. It exists so the old path and
 * the new one can run side by side during cutover, and it should be deleted
 * once the cutover is proven. `bookings.ebm_sign_at` stays, because that is the
 * record of which rule each booking was confirmed under.
 */
export type SignPoint = 'booking' | 'checkout';

/** Today's behaviour, so an unset variable changes nothing at runtime. */
export const DEFAULT_SIGN_POINT: SignPoint = 'booking';

/** The DI token. Resolved once, at boot, like every other fiscal setting. */
export const EBM_SIGN_POINT = Symbol('EBM_SIGN_POINT');

/**
 * Read `EBM_SIGN_AT` once.
 *
 * Unset means `booking`. An UNRECOGNISED value throws rather than defaulting,
 * for the reason `VSDC_ADAPTER_MODE` does: `EBM_SIGN_AT=Checkout ` quietly
 * falling back to `booking` is a deployment that signs every room twice while
 * every screen says the cutover is done.
 *
 * Nothing downstream reads this again. `EbmSaleTrigger` stamps the answer onto
 * the booking at confirmation and every later step reads the STAMP, because a
 * booking confirmed under `checkout` (a `PS`, no `NS`) and checked out after a
 * rollback would otherwise produce no `NS` ever: money taken, nothing declared.
 */
export function resolveSignPoint(
  env: Record<string, string | undefined> = process.env,
): SignPoint {
  const raw = (env.EBM_SIGN_AT ?? DEFAULT_SIGN_POINT).trim().toLowerCase();
  if (raw === 'booking' || raw === 'checkout') return raw;
  throw new Error(
    `EBM_SIGN_AT must be "booking" or "checkout", got "${raw}".`,
  );
}

/**
 * Which rule a given booking was confirmed under, read from its stamp.
 *
 * A row written before ADR-050 carries no stamp, and every one of those was
 * confirmed under the old rule and ALREADY has its room declared as an `NS`.
 * So an absent stamp reads `booking`, which is the answer that cannot declare
 * the same room a second time. Migration A backfills the column to match; this
 * is the belt to that migration's braces.
 */
export function signPointOf(stamped: string | null | undefined): SignPoint {
  return stamped === 'checkout' ? 'checkout' : 'booking';
}

/**
 * Which rule the GUEST'S receipt for a booking is drawn under (ADR-050 AC-1).
 *
 * The stamp, when there is one. With no stamp, the one case that differs from
 * `signPointOf` is a request still waiting for its host: it is stamped under
 * this process's rule the moment it is approved (the flag is read once per
 * process), so its guest is shown the document they will still be holding
 * afterwards, rather than a sale receipt that turns into a proforma on
 * approval. Any other unstamped row reads `booking`, as `signPointOf` says.
 */
export function receiptSignPoint(
  stamped: string | null | undefined,
  status: string,
  processRule: SignPoint,
): SignPoint {
  if (!stamped && status === 'pending_approval') return processRule;
  return signPointOf(stamped);
}
