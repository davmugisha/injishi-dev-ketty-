import type { ChargeType, PaymentMethod } from '@injishi/contracts';

/**
 * Where a folio line lands in the book (ADR-016, slice 2).
 *
 * This file is the whole chart of accounts as far as the application is
 * concerned: which named bucket each kind of money event is recorded against,
 * and with what sign. The rows themselves ship by migration (phase 2, D-e), so
 * a ledger write on a fresh database cannot fail for a missing account (AC-13).
 *
 * SINGLE SIDED (D-b). One entry per money event, no balancing pair. A perfect
 * double entry book written after the fact is not possible, and a thin one
 * written from the first charge is. The second side is an addition later, not a
 * rewrite, which is why four accounts are deliberately absent below.
 *
 * WRITTEN AT POST TIME, ONCE (D-f). A charge posts its account when it posts;
 * a payment posts cash when it is taken. Settlement never posts revenue a
 * second time. This REVERSES what §14.5 said, and the reversal is stated out
 * loud because building settlement to §14's wording later would double count
 * every shilling of revenue in the system.
 */

/** A revenue charge takes its account from the department it credits. */
const REVENUE_ACCOUNT_BY_CATEGORY: Readonly<Record<string, string>> = {
  rooms: 'REVENUE_ROOMS',
  fnb: 'REVENUE_FNB',
  spa_recreation: 'REVENUE_SPA_RECREATION',
  other_operated: 'REVENUE_OTHER_OPERATED',
  misc_income: 'REVENUE_MISC_INCOME',
};

/**
 * The three charge types that are revenue, and therefore the three that must
 * name a revenue centre department (AC-1). Everything else credits a fixed
 * account and needs no department at all.
 */
const REVENUE_CHARGE_TYPES = new Set<ChargeType>(['room', 'service_order', 'pos']);

/** Everything that is not revenue maps by its own type, not by a department. */
const ACCOUNT_BY_CHARGE_TYPE: Readonly<Partial<Record<ChargeType, string>>> = {
  tax: 'TAX_PAYABLE',
  service_charge: 'SERVICE_CHARGE',
  discount: 'DISCOUNTS_ALLOWED',
  adjustment: 'ADJUSTMENTS',
  refund: 'REFUNDS_PAID',
};

/** Which cash account the money actually arrived in. */
const CASH_ACCOUNT_BY_METHOD: Readonly<Record<PaymentMethod, string>> = {
  mobile_money: 'CASH_MOBILE_MONEY',
  card: 'CASH_CARD',
  cash: 'CASH_ON_HAND',
};

/** A charge that moves cash rather than recording what was earned. */
const CASH_CHARGE_TYPES = new Set<ChargeType>(['payment', 'deposit']);

export function isRevenueChargeType(chargeType: ChargeType): boolean {
  return REVENUE_CHARGE_TYPES.has(chargeType);
}

/**
 * `folio_post` for a charge, `folio_settle` for money moving.
 *
 * Both values were added to `ledger_txn_kind` by migration phase 2 (D-o).
 * Before that no folio event was representable at all: `transaction_id` is NOT
 * NULL on every entry, and the enum on the transaction it points at had no
 * value that described a guest bill. That was the second hard stop under this
 * layer and it hid one join away from the obvious one.
 */
export function ledgerKindFor(
  chargeType: ChargeType,
): 'folio_post' | 'folio_settle' {
  return CASH_CHARGE_TYPES.has(chargeType) || chargeType === 'refund'
    ? 'folio_settle'
    : 'folio_post';
}

/**
 * The account code a folio line records against.
 *
 * Returns null only when the caller has handed in something the maps above do
 * not cover, which the folio service treats as a refusal rather than posting a
 * charge with no entry behind it. A charge with no ledger entry is exactly the
 * hole this layer exists to close.
 */
export function accountCodeFor(input: {
  chargeType: ChargeType;
  departmentCategory?: string | null;
  method?: PaymentMethod | null;
}): string | null {
  if (CASH_CHARGE_TYPES.has(input.chargeType)) {
    return input.method ? CASH_ACCOUNT_BY_METHOD[input.method] : null;
  }
  if (REVENUE_CHARGE_TYPES.has(input.chargeType)) {
    return input.departmentCategory
      ? (REVENUE_ACCOUNT_BY_CATEGORY[input.departmentCategory] ?? null)
      : null;
  }
  return ACCOUNT_BY_CHARGE_TYPE[input.chargeType] ?? null;
}
