import { Logger, Module, type Provider } from '@nestjs/common';

import { DisbursementDispatcher } from './application/disbursement-dispatcher.service';
import { MoneyQueueService } from './application/money-queue.service';
import { PaymentCompensationService } from './application/payment-compensation.service';
import { PaymentOutcomes } from './application/payment-outcomes';
import { RefundsOwedService } from './application/refunds-owed.service';
import { GUARDED_PAYMENT_PORT, PAYMENT_PORT, type PaymentPort } from './domain/payment-port';
import {
  PAYMENT_SEAM_SETTINGS,
  PaymentSeam,
  type PaymentSeamMode,
  type PaymentSeamSettings,
  resolvePaymentSeam,
  resolveSeamMode,
} from './domain/payment-seam';
import { GuardedPaymentPort } from './infrastructure/guarded-payment.port';
import { MockPaymentAdapter } from './infrastructure/mock-payment.adapter';
import { MoneyQueueRepository } from './infrastructure/money-queue.repository';
import { OffPaymentAdapter } from './infrastructure/off-payment.adapter';
import { PayeeIdentityRepository } from './infrastructure/payee-identity.repository';
import { PaymentTransactionsRepository } from './infrastructure/payment-transactions.repository';
import { RecordedPaymentPort } from './infrastructure/recorded-payment.port';

/**
 * The payment seam (F-S08, ADR-020, 073-gtbank-payments).
 *
 * `PAYMENT_PORT` is three layers, outermost first:
 * - `RecordedPaymentPort` writes every instruction to the bank record before it
 *   is sent (073 AC-9), and refuses a purpose that is not live (AC-2);
 * - `GuardedPaymentPort` puts a ceiling on every call and a breaker after
 *   repeated failures (review 2.1), so a stalled provider costs a fast 503;
 * - the bound adapter: mock, off, or the live one once it is registered.
 *
 * A refund or guest release through the port is written as a refund OWED
 * (`RefundsOwedService`) and sent later by `DisbursementDispatcher`, which
 * alone holds the guarded port beneath the writer (`GUARDED_PAYMENT_PORT`).
 */

/** The live adapter, once one exists. Null until then, and boot refuses. */
const LIVE_ADAPTER: (new () => PaymentPort) | null = null;

/** What `PAYMENT_ADAPTER_MODE` may say. Kept under its old names for callers. */
export type PaymentAdapterSetting = PaymentSeamMode;
export const resolveMode = resolveSeamMode;

function adapterClass(settings: PaymentSeamSettings): new () => PaymentPort {
  const log = new Logger('PaymentsModule');
  if (settings.mode === 'off') {
    // Production until a provider is signed (booking audit, 2026-09-13): the
    // compose file used to leave this unset, which meant mock, which meant a
    // real database recording imaginary money as captured.
    log.warn('Payment adapter: OFF, every charge is refused');
    return OffPaymentAdapter;
  }
  if (settings.mode === 'live') {
    if (!LIVE_ADAPTER) {
      // Fails at boot, not at the first booking (ADR-020 AC-7). A service that
      // starts, serves, and only reveals at checkout that it cannot take money
      // has already told guests their reservation is real.
      throw new Error(
        'PAYMENT_ADAPTER_MODE=live but no live payment adapter is registered. ' +
          'Register one in payments.module.ts, or run with mode "mock".',
      );
    }
    log.log(
      `Payment adapter: live (guarded), live purposes: ${[...settings.livePurposes].join(', ') || 'none'}`,
    );
    return LIVE_ADAPTER;
  }
  log.log('Payment adapter: mock, guarded (F-S08 not yet live)');
  return MockPaymentAdapter;
}

const RAW_ADAPTER = Symbol('RAW_PAYMENT_ADAPTER');

function paymentProviders(): Provider[] {
  // Read once, at boot: an unreadable setting stops the process here.
  const settings = resolvePaymentSeam(process.env);
  return [
    { provide: PAYMENT_SEAM_SETTINGS, useValue: settings },
    PaymentSeam,
    PaymentTransactionsRepository,
    PayeeIdentityRepository,
    PaymentOutcomes,
    RefundsOwedService,
    { provide: RAW_ADAPTER, useClass: adapterClass(settings) },
    {
      provide: GUARDED_PAYMENT_PORT,
      inject: [RAW_ADAPTER],
      useFactory: (inner: PaymentPort): PaymentPort =>
        new GuardedPaymentPort(inner, {
          timeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS ?? 8_000),
          breakAfter: Number(process.env.PAYMENT_BREAK_AFTER ?? 5),
          coolOffMs: Number(process.env.PAYMENT_COOL_OFF_MS ?? 30_000),
        }),
    },
    {
      provide: PAYMENT_PORT,
      inject: [GUARDED_PAYMENT_PORT, PaymentTransactionsRepository, PaymentSeam, RefundsOwedService],
      useFactory: (
        guarded: PaymentPort,
        record: PaymentTransactionsRepository,
        seam: PaymentSeam,
        refunds: RefundsOwedService,
      ): PaymentPort => new RecordedPaymentPort(guarded, record, seam, refunds),
    },
    DisbursementDispatcher,
    MoneyQueueRepository,
    MoneyQueueService,
  ];
}

@Module({
  providers: [...paymentProviders(), PaymentCompensationService],
  exports: [
    PAYMENT_PORT,
    PaymentCompensationService,
    PaymentSeam,
    PaymentTransactionsRepository,
    PayeeIdentityRepository,
    PaymentOutcomes,
    RefundsOwedService,
    DisbursementDispatcher,
    // The money queue (073-gtbank-payments AC-15, AC-19 to AC-21), for the admin finance routes.
    MoneyQueueService,
  ],
})
export class PaymentsModule {}
