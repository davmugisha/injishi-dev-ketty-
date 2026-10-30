import { networkForMsisdn, type PaymentInstrument } from '@injishi/contracts';

/**
 * The mobile money instrument a PSF fee is charged to, from the applicant's
 * phone. GTBank's one time fee carries its payer (073-gtbank-payments), where
 * the PSF path used to pass the phone alongside and drop it. Null when the
 * number is not a Rwandan MTN or Airtel line, which no rail can prompt.
 */
export function psfInstrument(phoneE164: string | null | undefined): PaymentInstrument | null {
  const national = (phoneE164 ?? '').replace(/\D/g, '').replace(/^250/, '').replace(/^0/, '');
  if (!/^\d{9}$/.test(national)) return null;
  const network = networkForMsisdn(national);
  return network ? { kind: 'mobile_money', network, msisdn: national } : null;
}

/** What the person is told when their number cannot be prompted. */
export const PSF_NO_INSTRUMENT_MESSAGE =
  'Give an MTN or Airtel mobile money number to pay the PSF membership fee.';
