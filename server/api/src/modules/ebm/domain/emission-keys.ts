/**
 * The idempotency keys of `ebm_invoices`: one key per fiscal document.
 *
 * Pure, in the domain, because two modules mint them: the sale trigger for a
 * booking and the folio close for a bill. A key retyped beside each would be
 * two chances to declare one sale twice.
 */

/**
 * One document per booking per label.
 *
 * The label is part of the key because under ADR-050 a booking can raise TWO
 * documents over its life: a `PS` at confirmation and, if the room is ever
 * signed at booking time, an `NS`. Keying on the booking alone would make the
 * second a no-op replay of the first.
 */
export function emissionKeyFor(
  bookingId: string,
  label: 'NS' | 'PS' = 'NS',
): string {
  return `ebm:booking:${bookingId}:${label}`;
}

/** One `NS` per folio. Each folio sequence is its own row, so its own key. */
export function folioEmissionKeyFor(folioId: string): string {
  return `ebm:folio:${folioId}:NS`;
}

/**
 * One `NS` per pay now order, raised when its money settles (ADR-050 D-n).
 * A second settlement of the same order, from a replayed cash mark or a poll
 * racing the sweep, is a no-op rather than a second declaration.
 */
export function orderEmissionKeyFor(serviceOrderId: string): string {
  return `ebm:outlet_order:${serviceOrderId}:NS`;
}
