import type { TrainingVerification } from '@injishi/contracts';

/**
 * The verification cache, as a seam (AC-16).
 *
 * A public endpoint anybody may scan needs to be cheap, and a certificate that
 * has just been withdrawn must stop reading valid on the very next load. Those
 * two pull against each other, and the resolution the ADR fixes is a short TTL
 * plus an explicit purge on revocation rather than a longer TTL and a wait.
 *
 * WHY A PORT RATHER THAN A `Map` INLINE. The adapter wired today keeps entries
 * in process memory, which is correct and complete on ONE API instance and is
 * the honest limit of it: with two instances, a revocation handled by one
 * purges only its own copy, so the other can still answer from cache until its
 * entry expires. That is a real hole in AC-16's "never serving a stale status
 * after a withdrawal", and it is bounded by `TRAINING_VERIFY_CACHE_TTL_SECONDS`
 * (60 by default) rather than unbounded.
 *
 * Closing it properly means a shared store, and Redis is already in this
 * stack. It is a seam and not a `Map` so that swapping the adapter is one
 * provider in `training.module.ts` and no change to any caller. Whoever scales
 * the API past one instance owes that adapter; the existing throttler carries
 * exactly the same caveat in its own header, so this is a known shape of
 * limitation here rather than a new one.
 */

export const VERIFICATION_CACHE = Symbol('VERIFICATION_CACHE');

export interface VerificationCache {
  get(token: string): Promise<TrainingVerification | undefined>;
  set(token: string, value: TrainingVerification): Promise<void>;
  /** Called by revocation. Must make the next read miss. */
  purge(token: string): Promise<void>;
}
