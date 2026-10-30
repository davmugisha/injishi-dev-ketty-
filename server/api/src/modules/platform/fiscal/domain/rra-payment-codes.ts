import type { PaymentMethod } from '@injishi/contracts';

/**
 * RRA's means of payment codes (ADR-050 D-p, §4 k).
 *
 * Pure data, in the fiscal domain, so the ONE table that says how money moved
 * is not retyped beside each place that sends a receipt. Every `payment` and
 * `deposit` line on a folio carries one, and the close refuses a payment line
 * without it: a receipt that cannot say how it was paid is not a receipt.
 *
 * `02` (credit) has no `PaymentMethod` behind it on purpose. It is not a way a
 * guest pays; it is what a TENANT outlet declares at fulfilment, because the
 * host has collected the guest's money and has not yet paid the tenant. Slice 4
 * is the only caller, and it names the constant rather than mapping to it.
 */
export const RRA_PAYMENT_CASH = '01';
export const RRA_PAYMENT_CREDIT = '02';
export const RRA_PAYMENT_CARD = '05';
export const RRA_PAYMENT_MOBILE_MONEY = '06';

const BY_METHOD: Readonly<Record<PaymentMethod, string>> = {
  cash: RRA_PAYMENT_CASH,
  card: RRA_PAYMENT_CARD,
  mobile_money: RRA_PAYMENT_MOBILE_MONEY,
};

/** The code for a way a guest actually paid. Total over `PaymentMethod`, so
 *  adding a rail to that union fails this file's typecheck rather than writing
 *  a receipt with an empty means of payment. */
export function rraPaymentCode(method: PaymentMethod): string {
  return BY_METHOD[method];
}
