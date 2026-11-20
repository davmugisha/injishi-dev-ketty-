import { Module } from '@nestjs/common';

import { PosCustomerService } from './application/pos-customer.service';
import { PosExpenseService } from './application/pos-expense.service';
import { PosFloorService } from './application/pos-floor.service';
import { PosKitchenService } from './application/pos-kitchen.service';
import { PosMenuPhotoService } from './application/pos-menu-photo.service';
import { PosMobilePaymentService } from './application/pos-mobile-payment.service';
import { PosOrderService } from './application/pos-order.service';
import { PosPaymentService } from './application/pos-payment.service';
import { PosReadService } from './application/pos-read.service';
import { PosReportService } from './application/pos-report.service';
import { PosShiftService } from './application/pos-shift.service';
import { PosStockService } from './application/pos-stock.service';
import { PosTableOrderService } from './application/pos-table-order.service';
import { PosVenueService } from './application/pos-venue.service';
import { MailerModule } from '../mailer/mailer.module';
import { StorageModule } from '../storage/storage.module';
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
  // A menu item's own photo is stored through the storage seam (PosMenuPhotoService).
  // A receipt the customer asks for by email goes through the mailer seam (PosMobilePaymentService).
  imports: [StorageModule, MailerModule],
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
    PosVenueService,
    PosCustomerService,
    PosMenuPhotoService,
    // Table QR self-service ordering (migration 0156).
    PosTableOrderService,
    // Mobile money paid from the customer's phone, confirmed by the cashier by hand (no provider contacted).
    PosMobilePaymentService,
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
    PosVenueService,
    PosCustomerService,
    PosMenuPhotoService,
    PosTableOrderService,
    PosMobilePaymentService,
  ],
})
export class PosModule {}
