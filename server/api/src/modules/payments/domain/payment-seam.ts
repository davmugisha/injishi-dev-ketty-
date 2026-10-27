import { MobileMoneyNetwork, type PaymentInstrument, paymentRuleProblem } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { PAYMENT_PURPOSES, type PaymentPurpose } from './payment-port';

/**
 * What the payment seam is allowed to do on this stack, read ONCE at boot
 * (073-gtbank-payments, and its Assumed interim record).
 *
 * Until ADR-073's integration layer exists, this is the one reader of the
 * payment settings: `PAYMENT_ADAPTER_MODE` (as `payments.module.ts` has always
 * resolved it), the live purpose allowlist, the networks and limits clients
 * are told about, and the fee and settlement figures the bank record and the
 * funding check use. When `IntegrationRuntime` lands, `mode` moves there and
 * every caller keeps reading it from here.
 *
 * Every value refuses to boot when it cannot be read, never defaults quietly:
 * a typo in a money setting is a production incident, not a warning.
 */

export type PaymentSeamMode = 'off' | 'mock' | 'live';

/**
 * The card seam (073-gtbank-payments AC-24): no card provider is signed, so it
 * is off on every stack, and `/platform` says so. It becomes a setting with the
 * card provider's own child.
 */
export const CARD_PAYMENTS = 'off' as const;

export interface PaymentSeamSettings {
  mode: PaymentSeamMode;
  /** The provider key written on every bank row: `mock`, or `gtbank` under live. */
  provider: 'mock' | 'gtbank';
  /** Under `live`, the purposes whose collections may run (AC-2). */
  livePurposes: ReadonlySet<PaymentPurpose>;
  /** The networks a Request to Pay may go to (AC-23). */
  networks: readonly MobileMoneyNetwork[];
  /** The largest collection one prompt may ask for; null means no limit (AC-23). */
  maxCollectionRwf: number | null;
  /** The largest single disbursement; null means no limit (AC-14a). */
  maxDisbursementRwf: number | null;
  /** The collection fee estimate, in basis points of the amount (AC-14). */
  collectionFeeBps: number;
  /** The disbursement fee estimate to an account outside GTBank (AC-14). */
  disbursementFeeRwf: number;
  /** How long a settled collection waits before it funds a disbursement (AC-14). */
  settlementLagMinutes: number;
  /** After the stay (or the fee) how long a payer's number is kept for a refund (AC-10). */
  refundWindowDays: number;
}

export const PAYMENT_SEAM_SETTINGS = Symbol('PAYMENT_SEAM_SETTINGS');

const NETWORKS = MobileMoneyNetwork.options;

/** `PAYMENT_ADAPTER_MODE`: unset is `mock`, anything unreadable refuses to boot. */
export function resolveSeamMode(raw: string | undefined): PaymentSeamMode {
  const mode = (raw ?? 'mock').trim().toLowerCase();
  if (mode === 'live' || mode === 'mock' || mode === 'off') return mode;
  // "PAYMENT_ADAPTER_MODE=Live " silently falling back to mock is a production
  // deployment taking imaginary money while every screen says it worked.
  throw new Error(`PAYMENT_ADAPTER_MODE must be "mock", "live" or "off", got "${mode}".`);
}

function list(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  return raw.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
}

function wholeNumber(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number | null,
  { positive }: { positive: boolean },
): number | null {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0 || (positive && value === 0)) {
    throw new Error(`${name} must be a ${positive ? 'positive' : 'non negative'} whole number, got "${raw}".`);
  }
  return value;
}

/** Every payment setting, validated. Throws at boot on anything unreadable. */
export function resolvePaymentSeam(env: Record<string, string | undefined>): PaymentSeamSettings {
  const mode = resolveSeamMode(env.PAYMENT_ADAPTER_MODE);

  const livePurposes = new Set<PaymentPurpose>();
  for (const purpose of list(env.PAYMENT_LIVE_PURPOSES)) {
    if (!(PAYMENT_PURPOSES as readonly string[]).includes(purpose)) {
      throw new Error(
        `PAYMENT_LIVE_PURPOSES names "${purpose}", which is not one of ${PAYMENT_PURPOSES.join(', ')}.`,
      );
    }
    livePurposes.add(purpose as PaymentPurpose);
  }

  const networksRaw = list(env.GTBANK_RTP_NETWORKS);
  const networks = (networksRaw.length > 0 ? networksRaw : [...NETWORKS]).map((n) => {
    if (!(NETWORKS as readonly string[]).includes(n)) {
      throw new Error(`GTBANK_RTP_NETWORKS names "${n}", which is not one of ${NETWORKS.join(', ')}.`);
    }
    return n as MobileMoneyNetwork;
  });

  return {
    mode,
    provider: mode === 'live' ? 'gtbank' : 'mock',
    livePurposes,
    networks,
    maxCollectionRwf: wholeNumber(env, 'GTBANK_MAX_COLLECTION_RWF', null, { positive: true }),
    maxDisbursementRwf: wholeNumber(env, 'GTBANK_MAX_DISBURSEMENT_RWF', null, { positive: true }),
    collectionFeeBps: wholeNumber(env, 'GTBANK_COLLECTION_FEE_BPS', 0, { positive: false }) ?? 0,
    disbursementFeeRwf: wholeNumber(env, 'GTBANK_DISBURSEMENT_FEE_RWF', 0, { positive: false }) ?? 0,
    // The mock settles at once; GTBank's real figure is owed (one day until then).
    settlementLagMinutes:
      mode === 'live'
        ? (wholeNumber(env, 'GTBANK_SETTLEMENT_LAG_MINUTES', 1440, { positive: false }) ?? 1440)
        : 0,
    refundWindowDays: wholeNumber(env, 'PAYMENT_REFUND_WINDOW_DAYS', 30, { positive: true }) ?? 30,
  };
}

/** What a client may know about payments, for `/platform` (AC-2, AC-23). */
export interface PaymentRules {
  networks: MobileMoneyNetwork[];
  maxCollectionRwf: number | null;
  livePurposes: PaymentPurpose[];
}

/**
 * The seam's settings as a service, so callers ask a question rather than read
 * a variable: is money off for this purpose, what may a client be told.
 */
@Injectable()
export class PaymentSeam {
  constructor(@Inject(PAYMENT_SEAM_SETTINGS) readonly settings: PaymentSeamSettings) {}

  get mode(): PaymentSeamMode {
    return this.settings.mode;
  }

  get provider(): 'mock' | 'gtbank' {
    return this.settings.provider;
  }

  /**
   * The bound adapter's mode, as its rows carry it: the off adapter reads
   * `live` because it is not a mock (`OffPaymentAdapter`).
   */
  get adapterMode(): 'mock' | 'live' {
    return this.settings.mode === 'mock' ? 'mock' : 'live';
  }

  /**
   * Whether a purpose's collections are switched off: the whole seam is `off`,
   * or it is `live` and the purpose is not on the allowlist (AC-2). Under `mock`
   * every purpose runs, so the whole flow is walkable on a sample database.
   */
  isOffFor(purpose: PaymentPurpose): boolean {
    if (this.settings.mode === 'off') return true;
    if (this.settings.mode === 'live') return !this.settings.livePurposes.has(purpose);
    return false;
  }

  /** The rules `/platform` publishes. Under `mock`, every purpose counts as live. */
  rules(): PaymentRules {
    return {
      networks: [...this.settings.networks],
      maxCollectionRwf: this.settings.maxCollectionRwf,
      livePurposes:
        this.settings.mode === 'mock'
          ? [...PAYMENT_PURPOSES]
          : this.settings.mode === 'off'
            ? []
            : [...this.settings.livePurposes],
    };
  }

  /**
   * Why this collection cannot be taken under the published rules, or null
   * (AC-23, AC-24): a card while the card seam is off, a network the bank does
   * not prompt here, an amount above the collection limit. The same function
   * the forms call, so a refusal here is one the payer was already shown.
   */
  ruleProblem(amountRwf: number, instrument: PaymentInstrument): string | null {
    return paymentRuleProblem(
      { rules: this.rules(), cardPayments: CARD_PAYMENTS },
      amountRwf,
      instrument.kind === 'card' ? { kind: 'card' } : { kind: 'mobile_money', network: instrument.network },
    );
  }

  /** The collection fee estimate for an amount, rounded down to the franc. */
  collectionFeeFor(amountRwf: number): number {
    return Math.floor((amountRwf * this.settings.collectionFeeBps) / 10_000);
  }
}
