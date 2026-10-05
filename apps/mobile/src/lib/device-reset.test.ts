/**
 * What one person leaves on a shared phone, cleared when their session ends.
 *
 * Sign out used to clear the token and the query cache and nothing else, so
 * the next person to sign in inherited the previous one's queued writes
 * (drained under the new token), their MoMo number in the payment journal, and
 * every in-memory edit (mobile audit 2026-10-05, SA-19 and GK-27). These run
 * against the real modules, because the point is that the state is GONE, not
 * that three functions were called.
 */
import { clearPersonState } from './device-reset';
import {
  enqueue,
  hasHandler,
  readQueue,
  registerHandler,
  resetQueue,
} from '@/data/write-queue';
import { begin, get, put, resetAttempts } from '@/data/payment-attempt';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';

afterEach(() => {
  resetQueue();
  resetAttempts();
  resetFixtures();
});

describe('clearPersonState', () => {
  it('drops the queued writes, the payment journal and every in-memory edit', () => {
    enqueue({
      id: 'record-payment-1',
      kind: 'recordPayment',
      payload: { leaseId: 'lease-1', month: '2026-10' },
      label: 'Rent, October',
    });
    put(begin({ token: 'attempt-1', handset: '0788123456', rail: 'mtn', amountRwf: 310_000 }));
    writeFixture('account.personal', { name: 'The previous person' });

    clearPersonState();

    expect(readQueue()).toHaveLength(0);
    // The journal held the payer's handset number.
    expect(get('attempt-1')).toBeNull();
    expect(readFixture('account.personal', null)).toBeNull();
  });

  it('keeps the queue working for whoever signs in next', () => {
    registerHandler('recordPayment', async () => ({ status: 'sent' }) as never);

    clearPersonState();

    // The handlers are the app's, not the person's: dropping them would leave
    // the next person's offline writes with nothing to send them.
    expect(hasHandler('recordPayment')).toBe(true);
  });
});
