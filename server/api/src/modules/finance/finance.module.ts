import { Module } from '@nestjs/common';

import { PaymentsModule } from '../pay/payments.module';
import { OwnerDashboardService } from './application/owner-dashboard.service';
import { OwnerDashboardRepository } from './infrastructure/owner-dashboard.repository';

/**
 * Injishi Finance's server half (ADR-074 stage 6): the owner's figures, which the
 * Finance overview reads. They are sums over the folio, booking and payment rows
 * the other products write; Finance reads them and never writes another
 * product's records (ADR-074, Dependencies between products).
 *
 * Until stage 6 these sat in `OperationsModule`, which imported `PaymentsModule`
 * for them alone. Here they import it themselves, for the `PaymentSeam` the
 * dashboard reads, and `OperationsModule` imports no module at all.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named.
 */
@Module({
  imports: [PaymentsModule],
  providers: [
    // The owner's figures (dashboard, revenue by day, performance by branch).
    OwnerDashboardRepository,
    OwnerDashboardService,
  ],
  exports: [
    // For OpsOwnerDashboardController, OpsReportsController and the revenue
    // controller in PublicApiModule.
    OwnerDashboardService,
  ],
})
export class FinanceModule {}
