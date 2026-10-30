import { Global, Logger, Module, type Provider } from '@nestjs/common';

import { isWorkerProcess } from '../../../shared/process/process-role';
import { DeclarationPlanService } from './application/declaration-plan.service';
import { EbmConnectionService } from './application/ebm-connection.service';
import { EbmEmissionService } from './application/ebm-emission.service';
import { EbmReceiptService } from './application/ebm-receipt.service';
import { EbmSaleTrigger } from './application/ebm-sale-trigger.service';
import { EBM_LIVE, type EbmLive } from './domain/ebm-live';
import { EBM_SIGN_POINT, resolveSignPoint } from './domain/sign-point';
import { VSDC_PORT } from './domain/vsdc-port';
import { EbmApiClient } from './infrastructure/ebm-api.client';
import { EbmBookingRepository } from './infrastructure/ebm-booking.repository';
import { EbmConnectionRepository } from './infrastructure/ebm-connection.repository';
import { EbmEmissionProcessor } from './infrastructure/ebm-emission.processor';
import { EbmEmissionRepository } from './infrastructure/ebm-emission.repository';
import { resolveEbmLiveConfig } from './infrastructure/ebm-live-config';
import { LiveVsdcSigner } from './infrastructure/live-vsdc.signer';
import { MockVsdcSigner } from './infrastructure/mock-vsdc.signer';

/**
 * RRA Electronic Billing Machine invoicing (C9, F-B13, ADR-041).
 *
 * The platform prints the receipt layout "Technical Specification of CIS for
 * VSDC, Ver.1.0" prescribes, and in live mode certifies each confirmed sale with
 * RRA through the taxpayer's own account at the Injishi EBM provider — once, from
 * a queue, recorded in `ebm_invoices` — and prints the VSDC's own answer.
 *
 * Two modes, chosen by `VSDC_ADAPTER_MODE` and never inferred:
 *
 * - `mock` (the default): `VSDC_PORT` is `MockVsdcSigner`, which fabricates the
 *   device fields on read and says so on the receipt. Nothing is sent, nothing
 *   is recorded, no account can be connected. `infrastructure/mock-vsdc.signer.ts`
 *   states in full what it fabricates.
 * - `live`: `VSDC_PORT` is `LiveVsdcSigner`, which reads the stored
 *   certification; `EbmSaleTrigger` records each confirmed sale; the worker's
 *   `EbmEmissionProcessor` certifies it. Boot refuses unless every `EBM_*`
 *   setting is present and sound (`ebm-live-config.ts`).
 */

function resolveMode(env: Record<string, string | undefined>): 'mock' | 'live' {
  const raw = (env.VSDC_ADAPTER_MODE ?? 'mock').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'mock') return 'mock';
  // Not defaulted quietly, for the same reason the payment seam refuses an
  // unreadable mode: "VSDC_ADAPTER_MODE=Live " silently falling back to mock is
  // a deployment issuing fabricated tax receipts while every screen says the
  // integration is on.
  throw new Error(
    `VSDC_ADAPTER_MODE must be "mock" or "live", got "${raw}".`,
  );
}

/**
 * The mode-dependent providers. Exported so the boot refusal can be tested
 * without re-importing the module under a different environment.
 *
 * Resolved when the module is DEFINED, not at the first receipt: a service that
 * starts, serves, and only reveals at the counter that it cannot sign has
 * already told a taxpayer their invoicing is live.
 */
export function buildEbmProviders(
  env: Record<string, string | undefined> = process.env,
  worker: boolean = isWorkerProcess(),
): Provider[] {
  /**
   * Read ONCE, here, and never again (ADR-050 D-a). Every later step reads the
   * stamp `EbmSaleTrigger` writes onto the booking, not this value, so flipping
   * the flag back cannot strand a booking that was confirmed under the new rule
   * with no sale ever declared.
   */
  const signPoint: Provider = {
    provide: EBM_SIGN_POINT,
    useValue: resolveSignPoint(env),
  };

  if (resolveMode(env) === 'live') {
    const config = resolveEbmLiveConfig(env);
    const live: EbmLive = { config, client: new EbmApiClient(config.api) };
    new Logger('EbmModule').log(
      `VSDC adapter: LIVE via ${config.api.baseUrl}; sales confirmed from ${config.liveSince.toISOString()} are certified with RRA.`,
    );
    return [
      signPoint,
      { provide: EBM_LIVE, useValue: live },
      { provide: VSDC_PORT, useClass: LiveVsdcSigner },
      ...(worker ? [EbmEmissionProcessor] : []),
    ];
  }

  new Logger('EbmModule').warn(
    'VSDC adapter: MOCK. Receipts carry fabricated SDC signatures and are NOT fiscal documents.',
  );
  return [
    signPoint,
    { provide: EBM_LIVE, useValue: null },
    { provide: VSDC_PORT, useClass: MockVsdcSigner },
  ];
}

/**
 * `@Global` for the same reason `DatabaseModule` is: there is one VSDC seam per
 * process, and a receipt is read from more than one surface. The guest reads it
 * from `BookingsController` today; the operator desk and the oversight console
 * both have a claim on the same document, and neither should have to restate
 * this module's import to print one. `EbmSaleTrigger` is exported for the
 * booking module, which records a sale when a booking confirms.
 *
 * `DeclarationPlanService` (what a close or an order is told about the business's
 * fiscal setup) is fiscal's too, and lives here since ADR-074 stage 4: the folio
 * (PMS) and order payment (Outlets) both read it, so neither product's module
 * owns it and neither has to import the other's.
 */
@Global()
@Module({
  providers: [
    ...buildEbmProviders(),
    EbmBookingRepository,
    EbmConnectionRepository,
    EbmEmissionRepository,
    EbmReceiptService,
    EbmConnectionService,
    EbmEmissionService,
    EbmSaleTrigger,
    DeclarationPlanService,
  ],
  exports: [
    EbmReceiptService,
    EbmConnectionService,
    EbmSaleTrigger,
    DeclarationPlanService,
    EbmEmissionRepository,
    EbmConnectionRepository,
    VSDC_PORT,
    EBM_LIVE,
    EBM_SIGN_POINT,
  ],
})
export class EbmModule {}
