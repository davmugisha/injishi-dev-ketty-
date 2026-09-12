import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveRedisConnection } from './redis.config';

/**
 * Canonical queue names (architecture.md "Backend Worker Queues").
 * Jobs must be idempotent; compliance/money jobs queue, never skip.
 */
export const QUEUES = {
  email: 'Email',
  notification: 'Notification',
  checkoutReminder: 'CheckoutReminder',
  guestReviewLifecycle: 'GuestReviewLifecycle',
  bookingLifecycle: 'BookingLifecycle',
  photoOrphanSweep: 'PhotoOrphanSweep',
  /** ADR-016: posts one room charge per night per in-house stay (AC-15). */
  nightAudit: 'NightAudit',
  /**
   * ADR-020 D-d: chases a money instruction the seam did not confirm — a
   * compensating refund that itself failed, or a capture the provider accepted
   * and never settled. Job id is the idempotency key of the operation it
   * chases, so BullMQ deduplicates a job the same way the port deduplicates a
   * call, and nothing is ever dropped.
   */
  paymentCompensation: 'PaymentCompensation',
  /**
   * ADR-041: certifies one confirmed sale with RRA through the taxpayer's EBM
   * account. One attempt per job — whether to try again is the
   * `ebm_invoices` row's decision, never BullMQ's, because a blind retry of a
   * send that timed out can declare a stay twice.
   */
  ebmEmission: 'EbmEmission',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      // BullMQ's default prefix, `bull`, in every stack. Each stack has a Redis
      // of its own (ADR-043), so the prefix no longer separates anything and a
      // second one would only strand jobs queued before a change of name.
      useFactory: (config: ConfigService) => ({
        connection: resolveRedisConnection({
          redisUrl: config.get<string>('REDIS_URL'),
          redisHost: config.get<string>('REDIS_HOST'),
          redisPort: config.get<string>('REDIS_PORT'),
        }),
      }),
    }),
    BullModule.registerQueue(
      ...Object.values(QUEUES).map((name) => ({ name })),
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
