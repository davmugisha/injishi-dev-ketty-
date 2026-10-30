import { Injectable, Logger } from '@nestjs/common';

import { EbmSaleTrigger } from '../../platform/fiscal/application/ebm-sale-trigger.service';
import {
  ServiceCatalogRepository,
  type SettleOutcome,
} from '../infrastructure/service-catalog.repository';
import { DeclarationPlanService } from '../../platform/fiscal/application/declaration-plan.service';

/**
 * THE MONEY SIDE OF A PAY NOW ORDER (ADR-050 D-n, D-p; AC-21, AC-24).
 *
 * Two rails reach a pay now order and both end here, so there is one
 * settlement and not two: cash marked by staff (`01`), and mobile money
 * settling on a handset (`06`), which the booking module's attempt service
 * polls and sweeps exactly as it does for a booking and then hands over.
 *
 * Settling moves the order to the board and declares its sale in ONE
 * transaction, under the order's own taxpayer, with that taxpayer's fiscal setup
 * resolved by `DeclarationPlanService` like every other sale. Exported from the
 * operations module; the booking module calls it, never the reverse, which is
 * the direction the two modules already depend in.
 */
@Injectable()
export class OrderPaymentService {
  private readonly log = new Logger(OrderPaymentService.name);

  constructor(
    private readonly catalog: ServiceCatalogRepository,
    private readonly plans: DeclarationPlanService,
    private readonly sales: EbmSaleTrigger,
  ) {}

  /**
   * The money landed. Idempotent: a second settlement by the same means
   * answers with the first, and a settlement of an order no longer waiting
   * (cancelled, failed, or paid the other way) is `not_pending`.
   */
  async settle(
    orderId: string,
    by: { method: '01' | '06'; markedByUserId: string | null; paymentAttemptId: string | null },
  ): Promise<SettleOutcome> {
    const order = await this.catalog.findOrder(orderId);
    if (!order) return { kind: 'not_pending', status: 'cancelled' };

    const outcome = await this.catalog.settlePayNow({
      orderId,
      paymentMethod: by.method,
      markedByUserId: by.markedByUserId,
      paymentAttemptId: by.paymentAttemptId,
      plan: await this.plans.forOrg(order.taxEntityOrgId),
    });

    // Best effort, after commit: a lost wake up costs one drain interval.
    if (outcome.kind === 'settled' && outcome.wake && outcome.emissionId) {
      await this.sales.wake(outcome.emissionId, 0);
    }
    if (outcome.kind === 'settled' && !outcome.replayed) {
      this.log.log(`Pay now order ${order.orderNumber} settled by ${by.method === '01' ? 'cash' : 'mobile money'}.`);
    }
    return outcome;
  }

  /** The money did not come. Only a still pending order moves, so a late failure never undoes a settlement. */
  async fail(orderId: string, reason: string): Promise<boolean> {
    return this.catalog.failPayNow(orderId, reason);
  }

  /** Name the attempt a pay now order is now waiting on. */
  async attach(orderId: string, paymentAttemptId: string): Promise<void> {
    await this.catalog.attachPaymentAttempt(orderId, paymentAttemptId);
  }
}
