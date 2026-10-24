import {
  payoutDestinationWords,
  type MomoNetwork,
  type PayoutAccountInput,
  type PayoutAccountKind,
} from '@injishi/contracts';

/**
 * One payout account's details as written, one kind's fields set and the
 * others null (ported from feat/rentals' `detailsOf`). The bank account number
 * is here in the clear only on its way to the cipher; the row keeps its
 * ciphertext and last four digits.
 */
export interface PayoutAccountDetails {
  kind: PayoutAccountKind;
  accountName: string;
  bankName: string | null;
  accountNumber: string | null;
  momoNetwork: MomoNetwork | null;
  momoPhone: string | null;
  merchantCode: string | null;
}

export function detailsOf(body: PayoutAccountInput): PayoutAccountDetails {
  const none = { bankName: null, accountNumber: null, momoNetwork: null, momoPhone: null, merchantCode: null };
  if (body.kind === 'bank') {
    const bankName = body.bankName === 'Other' ? (body.otherBankName?.trim() || 'Other') : body.bankName;
    return { ...none, kind: 'bank', accountName: body.accountName, bankName, accountNumber: body.accountNumber };
  }
  if (body.kind === 'momo') {
    return { ...none, kind: 'momo', accountName: body.accountName, momoNetwork: body.momoNetwork, momoPhone: body.momoPhone };
  }
  return { ...none, kind: 'momo_pay', accountName: body.accountName, merchantCode: body.merchantCode };
}

/** The last four digits of a bank account number. */
export function last4(accountNumber: string): string {
  return accountNumber.slice(-4);
}

/**
 * Do two sets of details send money to the same place? Same kind, and the
 * same bank and number, MoMo number, or merchant code. The name on it does
 * not matter: the money lands in the same account.
 */
export function sameDestination(a: PayoutAccountDetails, b: PayoutAccountDetails): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bank') return a.bankName === b.bankName && a.accountNumber === b.accountNumber;
  if (a.kind === 'momo') return a.momoPhone === b.momoPhone;
  return a.merchantCode === b.merchantCode;
}

/**
 * Where an account sends money, masked: "Bank of Kigali ••••5678",
 * "MTN MoMo 078•••••456", "MoMo Pay 12••56". A bank account is masked from
 * its last four digits alone, so the words never need the ciphertext opened.
 */
export function destinationOf(account: {
  kind: PayoutAccountKind;
  bankName: string | null;
  accountLast4?: string | null;
  momoNetwork: MomoNetwork | null;
  momoPhone: string | null;
  merchantCode: string | null;
}): string {
  if (account.kind === 'bank') {
    return `${account.bankName ?? 'Bank'} ••••${account.accountLast4 ?? ''}`;
  }
  return payoutDestinationWords(account);
}
