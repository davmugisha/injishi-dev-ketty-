/**
 * The rentals background jobs' queues (blueprint 2.6), named now so the names
 * are fixed before their processors land (WP 1.5b to 5.3). Each is its own
 * BullMQ queue, because retry policy, backoff and job id semantics are per
 * queue, and a scheduler's policy is per queue too. The names live with every
 * other queue in `shared/queues/queues.module.ts` and are registered there;
 * nothing consumes them yet, so a job added early waits rather than being
 * dropped.
 *
 *   RentCycle            hourly: raise charges 7 days ahead, start signed leases on their
 *                        start date, move leases to ending, flag leases past their end
 *   RentReminders        hourly, sends 08:00 to 18:00 Kigali: upcoming, due, overdue
 *   PaymentSettlement    every minute, plus webhook jobs keyed by the idempotency key
 *   Payouts              when a payment succeeds (job id = payout id), with backoff
 *   LeaseDocuments       after the second signature: the signed PDF, stored and emailed
 *   RentalsHousekeeping  hourly: expire invitations and codes, filing and tax nudges
 *   GuestRouting         on registration, plus hourly: routes waiting for a leader
 *   BrokerPlans          hourly: renewals, grace, expiry, scheduled plan changes
 */
import { RENTALS_QUEUES } from '../../../shared/queues/queues.module';

export { RENTALS_QUEUES };
export type RentalsQueue = (typeof RENTALS_QUEUES)[keyof typeof RENTALS_QUEUES];
