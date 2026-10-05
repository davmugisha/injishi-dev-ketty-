/**
 * What one person leaves on the phone, cleared when their session ends.
 *
 * Sign out used to clear the token and the query cache and nothing else, so the
 * next person to sign in on the same phone inherited the previous one's queued
 * writes (drained under the new token), their MoMo number in the payment
 * journal, and every in-memory edit the fixture store held (mobile audit
 * 2026-10-05, SA-19 and GK-27). Shared phones are normal at a front desk.
 *
 * Called by `session.tsx` on an explicit sign out and on a server-revoked
 * session alike. The stored seat (domain and surface) is cleared by
 * `DomainProvider`, which owns it, when it sees the session end.
 */
import { clearAttempts } from '@/data/payment-attempt';
import { resetFixtures } from '@/data/use-fixture-mutation';
import { dropAll } from '@/data/write-queue';

export function clearPersonState(): void {
  dropAll();
  clearAttempts();
  resetFixtures();
}
