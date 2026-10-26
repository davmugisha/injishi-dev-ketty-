import {
  ASYNC_PAYMENT_METHODS,
  type PosPaymentMethod,
  type PosPaymentStatus,
  type SimulatedOutcome,
} from '@injishi/contracts';

/**
 * WHERE A POS PAYMENT IS ANSWERED (POS spec §5, §9).
 *
 * A port, so a certified provider adapter can replace the demo one later
 * without the order or shift code noticing. Only the demo adapter exists, and
 * it is the only one this module can be wired with: it opens no socket, reads
 * no credential and contacts no MTN, Airtel, card scheme or bank. Its answer
 * is whatever the cashier asked it to simulate.
 */
export interface PosPaymentAnswer {
  status: Extract<PosPaymentStatus, 'pending' | 'successful' | 'failed'>;
  /** Sanitized, for the payment's event trail. Never a credential or a real reference. */
  note: string;
  failureReason: string | null;
}

export interface PosPaymentPort {
  /** The first answer, when the payment is taken. */
  start(method: PosPaymentMethod, outcome: SimulatedOutcome): PosPaymentAnswer;
  /** The answer to a pending payment, when the simulated callback arrives. */
  resolve(method: PosPaymentMethod, outcome: 'success' | 'failure' | 'timeout'): {
    status: Extract<PosPaymentStatus, 'successful' | 'failed' | 'expired'>;
    note: string;
    failureReason: string | null;
  };
}

export const POS_PAYMENT_PORT = Symbol('POS_PAYMENT_PORT');

const PROVIDER: Record<PosPaymentMethod, string> = {
  cash: 'cash drawer',
  mtn_momo: 'demo MTN MoMo',
  airtel_money: 'demo Airtel Money',
  card: 'demo card terminal',
  bank_transfer: 'demo bank',
  voucher: 'voucher book',
  customer_credit: 'customer account',
};

/**
 * The demo adapter. Cash and vouchers settle at once: there is no one to ask.
 * Every other method answers as told, and a mobile money or bank payment
 * asked for `success` still passes through `pending` first, the way a real
 * prompt to the payer's phone would, so the screen's wait state is exercised.
 */
export class DemoPaymentSimulator implements PosPaymentPort {
  start(method: PosPaymentMethod, outcome: SimulatedOutcome): PosPaymentAnswer {
    const who = PROVIDER[method];
    if (method === 'cash' || method === 'voucher') {
      return { status: 'successful', note: `Recorded at the ${who}.`, failureReason: null };
    }
    if (outcome === 'failure') {
      return {
        status: 'failed',
        note: `Simulated: the ${who} declined.`,
        failureReason: method === 'card' ? 'Simulated decline: card not accepted.' : 'Simulated decline: insufficient balance.',
      };
    }
    if (outcome === 'pending' || outcome === 'timeout' || ASYNC_PAYMENT_METHODS.includes(method)) {
      return { status: 'pending', note: `Simulated: waiting for the ${who} to answer.`, failureReason: null };
    }
    return { status: 'successful', note: `Simulated: the ${who} approved.`, failureReason: null };
  }

  resolve(method: PosPaymentMethod, outcome: 'success' | 'failure' | 'timeout'): ReturnType<PosPaymentPort['resolve']> {
    const who = PROVIDER[method];
    if (outcome === 'success') {
      return { status: 'successful' as const, note: `Simulated: the ${who} confirmed.`, failureReason: null };
    }
    if (outcome === 'timeout') {
      return {
        status: 'expired' as const,
        note: `Simulated: the ${who} did not answer in time.`,
        failureReason: 'Simulated timeout: the payer did not approve.',
      };
    }
    return {
      status: 'failed' as const,
      note: `Simulated: the ${who} declined.`,
      failureReason: 'Simulated decline.',
    };
  }
}

/** `+250788123456` -> `+250 7•• ••• 456`: enough to tell two payers apart, no more. */
export function maskPhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return `+${digits.slice(0, 3)} ${digits[3] ?? ''}•• ••• ${digits.slice(-3)}`;
}
