import type { Beneficiary } from '../../payments/domain/payment-port';

/**
 * PSF's own account, as the GTBank payout needs it (073-gtbank-payments):
 * a name, an ID, a phone and the destination, all from configuration. Null
 * until every part is set, in which case the fee is held for PSF and the
 * caller logs that rather than sending money to half an address.
 *
 * - `PSF_PAYOUT_DESTINATION`: `momo` or `bank`.
 * - `PSF_PAYOUT_REF`: the MoMo number (nine national digits) or the account number.
 * - `PSF_PAYOUT_BANK_CODE`: the bank, for `bank`.
 * - `PSF_PAYOUT_NAME`, `PSF_PAYOUT_ID_NUMBER`, `PSF_PAYOUT_PHONE`: who holds it.
 */
export function psfPayee(get: (key: string) => string | undefined): Beneficiary | null {
  const kind = get('PSF_PAYOUT_DESTINATION');
  const ref = get('PSF_PAYOUT_REF')?.trim();
  const fullName = get('PSF_PAYOUT_NAME')?.trim();
  const idNumber = get('PSF_PAYOUT_ID_NUMBER')?.trim();
  const phone = get('PSF_PAYOUT_PHONE')?.trim();
  if (!ref || !fullName || !idNumber || !phone) return null;
  const base = { fullName, idType: 'national_id' as const, idNumber, phone };
  if (kind === 'momo') {
    const msisdn = ref.replace(/\D/g, '').replace(/^250/, '').replace(/^0/, '');
    const prefix = msisdn.slice(0, 2);
    const network = prefix === '78' || prefix === '79' ? 'mtn_momo' : prefix === '72' || prefix === '73' ? 'airtel_money' : null;
    if (!network || msisdn.length !== 9) return null;
    return { ...base, destination: { kind: 'mobile_money', network, msisdn } };
  }
  if (kind === 'bank') {
    const bankCode = get('PSF_PAYOUT_BANK_CODE')?.trim();
    if (!bankCode) return null;
    return { ...base, destination: { kind: 'bank', bankCode, accountNumber: ref } };
  }
  return null;
}
