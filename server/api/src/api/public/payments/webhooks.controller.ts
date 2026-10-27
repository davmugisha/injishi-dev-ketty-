import { Controller, HttpCode, Logger, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PaymentSettlementService } from '../../../modules/rentals/application/payment-settlement.service';
import { RentalsMoneyQueue } from '../../../modules/rentals/infrastructure/rentals-money.queue';

/** The slice of the request a callback needs: its headers and the raw bytes the signature covers. */
interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

/** The providers a callback may name. The mock is the only one until a gateway is chosen. */
const PROVIDERS = new Set(['mock']);

/**
 * Gateway callbacks → POST /api/v1/payments/webhooks/:provider (blueprint
 * 2.5; WP 1.6b). Public: a provider holds no session. The signature is
 * checked by the payment adapter (through the settlement service, so this
 * controller needs nothing but the rentals module) against the RAW body (`rawBody: true` on the Nest
 * application), and an event that does not parse is answered 202 with
 * nothing done, so a stranger posting here changes nothing and a provider is
 * not asked to retry. A parsed event becomes one PaymentSettlement job keyed
 * by the provider's event id, so a replay is the same job; the settlement
 * itself is guarded on the payment still being pending.
 */
@Controller({ path: 'payments/webhooks', version: '1' })
@SkipThrottle()
export class PaymentWebhooksController {
  private readonly log = new Logger(PaymentWebhooksController.name);

  constructor(
    private readonly settlement: PaymentSettlementService,
    private readonly queue: RentalsMoneyQueue,
  ) {}

  @Post(':provider')
  @HttpCode(202)
  async receive(@Param('provider') provider: string, @Req() request: WebhookRequest): Promise<{ received: boolean; queued: boolean }> {
    if (!PROVIDERS.has(provider)) throw new NotFoundException('Unknown payment provider.');
    const raw = request.rawBody ?? Buffer.alloc(0);
    const event = this.settlement.parseCallback(provider, request.headers, raw);
    if (!event) {
      this.log.warn(`callback for ${provider} ignored: not signed by the provider, or not readable`);
      return { received: true, queued: false };
    }
    const queued = await this.queue.webhook(event);
    return { received: true, queued };
  }
}
