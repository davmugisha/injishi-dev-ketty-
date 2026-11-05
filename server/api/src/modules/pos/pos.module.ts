import { Module } from '@nestjs/common';

import { PosExpenseService } from './application/pos-expense.service';
import { PosFloorService } from './application/pos-floor.service';
import { PosKitchenService } from './application/pos-kitchen.service';
import { PosOrderService } from './application/pos-order.service';
import { PosPaymentService } from './application/pos-payment.service';
import { PosReadService } from './application/pos-read.service';
import { PosReportService } from './application/pos-report.service';
import { PosShiftService } from './application/pos-shift.service';
import { PosStockService } from './application/pos-stock.service';
import { DemoPaymentSimulator, POS_PAYMENT_PORT } from './domain/payment-simulator';

/**
 * The bar and restaurant point of sale (POS spec, phase 1).
 *
 * The payment port is bound to the DEMO simulator and to nothing else: there
 * is no mode switch and no live adapter, so no environment variable can make
 * this module contact a provider. A certified adapter would be a new class
 * behind the same port, and a deliberate change to this file.
 */
@Module({
  providers: [
    PosReadService,
    PosFloorService,
    PosOrderService,
    PosKitchenService,
    PosPaymentService,
    PosShiftService,
    PosStockService,
    PosReportService,
    PosExpenseService,
    { provide: POS_PAYMENT_PORT, useClass: DemoPaymentSimulator },
  ],
  exports: [
    PosReadService,
    PosFloorService,
    PosOrderService,
    PosKitchenService,
    PosPaymentService,
    PosShiftService,
    PosStockService,
    PosReportService,
    PosExpenseService,
  ],
})
export class PosModule {}
