/**
 * The five obligations of the payment state machine, as tests.
 *
 * `benchmarks.md` §4 and `data-seam.md` §4 both list them, and every one of
 * them is a rule about what the app may NOT claim. That is why they are tested
 * here rather than through a screen: each is a property of the machine, and a
 * test that presses a button proves only that one screen happens to obey it
 * today.
 *
 * The failure each one prevents is a real one, and they are not symmetrical:
 * claiming failure about a payment that succeeded costs a support call, and
 * claiming success about a payment that did not costs a booking nobody paid
 * for. The machine is built to be wrong in neither direction, which means it
 * has to be allowed to say it does not know.
 */
import {
  PROMPT_WINDOW_MS,
  begin,
  confirm,
  expire,
  forget,
  get,
  isOpen,
  isSettled,
  openAttempts,
  put,
  recheck,
  refuse,
  resetAttempts,
  settle,
  type PaymentAttempt,
} from './payment-attempt';

const T0 = 1_700_000_000_000;

const anAttempt = (over: Partial<PaymentAttempt> = {}): PaymentAttempt => ({
  ...begin({ token: 'tok-1', handset: '0788123456', rail: 'momo', amountRwf: 45000, now: T0 }),
  ...over,
});

beforeEach(() => resetAttempts());

describe('obligation 2 — `unknown` is the default, not an error', () => {
  it('moves a stale prompt to `unknown`, never to `refused` or `expired`', () => {
    const stale = expire(anAttempt(), T0 + PROMPT_WINDOW_MS + 1);
    expect(stale.state).toBe('unknown');
    expect(stale.reason).toBe('pay.stillConfirming');
  });

  it('leaves a prompt inside its window alone', () => {
    const fresh = expire(anAttempt(), T0 + PROMPT_WINDOW_MS - 1);
    expect(fresh.state).toBe('prompting');
  });

  it('never re-opens a settled attempt, however long ago it settled', () => {
    // The guest paid an hour ago and the app is cold-starting now. A machine
    // that expired terminal states would show them a timeout for a booking
    // they already hold.
    for (const settled of [
      confirm(anAttempt(), 'MP-240817-0031'),
      refuse(anAttempt(), 'pay.insufficientFunds'),
    ]) {
      expect(expire(settled, T0 + PROMPT_WINDOW_MS * 100)).toEqual(settled);
    }
  });
});

describe('obligation 3 — only a callback produces `confirmed`', () => {
  it('carries a reference it was given rather than one it made up', () => {
    const done = confirm(anAttempt(), 'MP-240817-0031');
    expect(done.state).toBe('confirmed');
    expect(done.reference).toBe('MP-240817-0031');
  });

  it('has no other transition that reaches `confirmed`', () => {
    // `refuse`, `expire` and `recheck` are the whole of the rest of the API.
    // If a sixth transition is ever added, this is where it has to justify
    // itself.
    expect(refuse(anAttempt(), 'pay.refusedByCustomer').state).toBe('refused');
    expect(expire(anAttempt(), T0 + PROMPT_WINDOW_MS + 1).state).toBe('unknown');
    expect(recheck(anAttempt()).state).toBe('unknown');
  });

  it('leaves the reference null in every state but `confirmed`', () => {
    expect(anAttempt().reference).toBeNull();
    expect(refuse(anAttempt(), 'pay.promptExpired').reference).toBeNull();
    expect(recheck(anAttempt()).reference).toBeNull();
  });
});

describe('obligation 4 — the reference is the deliverable', () => {
  it('is what `isSettled` is asking about, and nothing else counts', () => {
    expect(isSettled(confirm(anAttempt(), 'MP-1'))).toBe(true);
    expect(isSettled(anAttempt())).toBe(false);
    expect(isSettled(recheck(anAttempt()))).toBe(false);
    expect(isSettled(refuse(anAttempt(), 'pay.refusedByCustomer'))).toBe(false);
    expect(isSettled(null)).toBe(false);
  });
});

describe('obligation 5 — every terminal state names its next action', () => {
  it('carries a reason key on every state a guest has to act on', () => {
    expect(refuse(anAttempt(), 'pay.insufficientFunds').reason).toBe('pay.insufficientFunds');
    expect(expire(anAttempt(), T0 + PROMPT_WINDOW_MS + 1).reason).toBe('pay.stillConfirming');
    expect(recheck(anAttempt()).reason).toBe('pay.stillConfirming');
    // `confirmed` is the one state with nothing to fix, so it clears the reason
    // rather than leaving the last failure's words under a success.
    expect(confirm(refuse(anAttempt(), 'pay.insufficientFunds'), 'MP-1').reason).toBeNull();
  });
});

describe('the idempotency token — ADR-020 D-c', () => {
  it('seeds the outcome, so a retry of ONE press cannot roll a different answer', () => {
    const a = anAttempt({ token: 'same-token' });
    const b = anAttempt({ token: 'same-token' });
    expect(settle(a, 'MP-1').state).toBe(settle(b, 'MP-1').state);
  });

  it('gives two different presses two independent outcomes', () => {
    // AC-14: two DIFFERENT tokens for the same room and nights must both be
    // able to succeed — the family booking two rooms of one type.
    const states = new Set(
      ['t-1', 't-2', 't-3', 't-4', 't-5', 't-6', 't-7', 't-8'].map(
        (token) => settle(anAttempt({ token }), 'MP-1').state,
      ),
    );
    expect(states.size).toBeGreaterThan(1);
  });

  it('models `unknown` as a real outcome rather than an exception', () => {
    // data-seam.md §4 calls unknown "the commonest real case". A fixture where
    // every payment confirms teaches the team that the happy path is the normal
    // path, and on this rail it is not.
    const outcomes = Array.from({ length: 200 }, (_, i) =>
      settle(anAttempt({ token: `tok-${i}` }), 'MP-1').state,
    );
    expect(outcomes.filter((s) => s === 'confirmed').length).toBeGreaterThan(0);
    expect(outcomes.filter((s) => s !== 'confirmed').length).toBeGreaterThan(0);
    expect(new Set(outcomes)).toContain('unknown');
  });
});

describe('the journal', () => {
  it('holds an attempt across a read, which is what surviving a kill means', () => {
    put(anAttempt({ token: 'tok-live' }));
    expect(get('tok-live')?.state).toBe('prompting');
  });

  it('counts an open attempt as open until it settles', () => {
    put(anAttempt({ token: 'tok-open' }));
    expect(openAttempts().map((a) => a.token)).toEqual(['tok-open']);

    put(confirm(get('tok-open')!, 'MP-9'));
    expect(openAttempts()).toEqual([]);
    // Still in the journal, though: a confirmed payment the guest has not been
    // shown is a payment they will make again.
    expect(get('tok-open')?.state).toBe('confirmed');
  });

  it('forgets only when told, not when the attempt settles', () => {
    put(confirm(anAttempt({ token: 'tok-seen' }), 'MP-9'));
    expect(get('tok-seen')).not.toBeNull();
    forget('tok-seen');
    expect(get('tok-seen')).toBeNull();
  });

  it('treats a live attempt as un-resubmittable', () => {
    expect(isOpen(anAttempt())).toBe(true);
    expect(isOpen(recheck(anAttempt()))).toBe(true);
    expect(isOpen(confirm(anAttempt(), 'MP-1'))).toBe(false);
    expect(isOpen(refuse(anAttempt(), 'pay.refusedByCustomer'))).toBe(false);
    expect(isOpen(null)).toBe(false);
  });
});
