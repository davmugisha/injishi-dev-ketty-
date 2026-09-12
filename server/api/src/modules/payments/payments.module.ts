import { Logger, Module, type Provider } from '@nestjs/common';

import { PaymentCompensationService } from './application/payment-compensation.service';
import { type AdapterMode, PAYMENT_PORT, type PaymentPort } from './domain/payment-port';
import { GuardedPaymentPort } from './infrastructure/guarded-payment.port';
import { MockPaymentAdapter } from './infrastructure/mock-payment.adapter';

/**
 * The payment seam (F-S08, ADR-020).
 *
 * Whichever adapter is bound, it is served through `GuardedPaymentPort`
 * (review 2.1): a ceiling on every call and a breaker after repeated
 * failures, so a stalled provider costs a fast 503 and not the pool.
 */

/** The live adapter, once one exists. Null until then, and boot refuses. */
const LIVE_ADAPTER: (new () => PaymentPort) | null = null;

function resolveMode(): AdapterMode {
  const raw = (process.env.PAYMENT_ADAPTER_MODE ?? 'mock').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'mock') return 'mock';
  // An unreadable mode is not defaulted quietly. "PAYMENT_ADAPTER_MODE=Live "
  // silently falling back to mock is a production deployment taking imaginary
  // money while every screen says it worked.
  throw new Error(
    `PAYMENT_ADAPTER_MODE must be "mock" or "live", got "${raw}".`,
  );
}

function adapterClass(): new () => PaymentPort {
  const mode = resolveMode();
  if (mode === 'live') {
    if (!LIVE_ADAPTER) {
      // Fails at boot, not at the first booking (ADR-020 AC-7). A service that
      // starts, serves, and only reveals at checkout that it cannot take money
      // has already told guests their reservation is real.
      throw new Error(
        'PAYMENT_ADAPTER_MODE=live but no live payment adapter is registered. ' +
          'Register one in payments.module.ts, or run with mode "mock".',
      );
    }
    new Logger('PaymentsModule').log('Payment adapter: live (guarded)');
    return LIVE_ADAPTER;
  }
  new Logger('PaymentsModule').log(
    'Payment adapter: mock, guarded (F-S08 not yet live)',
  );
  return MockPaymentAdapter;
}

const RAW_ADAPTER = Symbol('RAW_PAYMENT_ADAPTER');

function paymentProviders(): Provider[] {
  return [
    { provide: RAW_ADAPTER, useClass: adapterClass() },
    {
      provide: PAYMENT_PORT,
      inject: [RAW_ADAPTER],
      useFactory: (inner: PaymentPort): PaymentPort =>
        new GuardedPaymentPort(inner, {
          timeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS ?? 8_000),
          breakAfter: Number(process.env.PAYMENT_BREAK_AFTER ?? 5),
          coolOffMs: Number(process.env.PAYMENT_COOL_OFF_MS ?? 30_000),
        }),
    },
  ];
}

@Module({
  providers: [...paymentProviders(), PaymentCompensationService],
  exports: [PAYMENT_PORT, PaymentCompensationService],
})
export class PaymentsModule {}
