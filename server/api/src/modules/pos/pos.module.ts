import { Module } from '@nestjs/common';

import { PosFloorService } from './application/pos-floor.service';
import { PosKitchenService } from './application/pos-kitchen.service';
import { PosOrderService } from './application/pos-order.service';
import { PosPaymentService } from './application/pos-payment.service';
import { PosReadService } from './application/pos-read.service';
import { PosShiftService } from './application/pos-shift.service';
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
    { provide: POS_PAYMENT_PORT, useClass: DemoPaymentSimulator },
  ],
  exports: [PosReadService, PosFloorService, PosOrderService, PosKitchenService, PosPaymentService, PosShiftService],
})
export class PosModule {}
