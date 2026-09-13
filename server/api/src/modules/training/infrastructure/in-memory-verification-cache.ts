import type { TrainingVerification } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';

import {
  TRAINING_CONFIG,
  type TrainingConfig,
} from '../domain/training-config';
import type { VerificationCache } from '../domain/verification-cache';

/**
 * The verification cache, in this process's memory.
 *
 * See `domain/verification-cache.ts` for why this is behind a port and what
 * the single-instance limit is. This file is only the mechanism.
 *
 * TWO THINGS IT DOES THAT A BARE `Map` WOULD NOT:
 *
 * - It bounds itself. A public endpoint keyed on an attacker-supplied token is
 *   an unbounded-growth invitation: a script walking through invented tokens
 *   would otherwise add a `Map` entry per guess and exhaust the heap, turning
 *   a cache into the denial of service it was added to prevent. `MAX_ENTRIES`
 *   caps it and the oldest insert is dropped first.
 * - It caches the UNKNOWN answer too, deliberately. Those are the cheap reads
 *   to serve and the expensive ones to look up, and not caching them would
 *   mean the only requests reaching the database are the ones a prober sends.
 */

/**
 * 10,000 entries.
 *
 * A verification answer is a small flat object, so this is a few megabytes at
 * worst, and it is far more real certificates than will exist for years. The
 * number matters only as a ceiling.
 */
const MAX_ENTRIES = 10_000;

interface Entry {
  readonly value: TrainingVerification;
  readonly expiresAtMs: number;
}

@Injectable()
export class InMemoryVerificationCache implements VerificationCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    @Inject(TRAINING_CONFIG) private readonly config: TrainingConfig,
  ) {}

  async get(token: string): Promise<TrainingVerification | undefined> {
    const hit = this.entries.get(token);
    if (!hit) return undefined;

    if (hit.expiresAtMs <= Date.now()) {
      // Dropped on read rather than by a timer. A sweep would need an interval
      // that keeps the process alive and would buy nothing: an expired entry
      // that nobody reads costs one map slot until eviction reaches it.
      this.entries.delete(token);
      return undefined;
    }

    return hit.value;
  }

  async set(token: string, value: TrainingVerification): Promise<void> {
    if (this.entries.size >= MAX_ENTRIES && !this.entries.has(token)) {
      // A `Map` iterates in insertion order, so the first key is the oldest
      // insert. Oldest-first rather than least-recently-used because every
      // entry expires within a minute anyway, which makes recency almost
      // meaningless here and a second data structure pure cost.
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(token, {
      value,
      expiresAtMs: Date.now() + this.config.verifyCacheTtlSeconds * 1_000,
    });
  }

  async purge(token: string): Promise<void> {
    this.entries.delete(token);
  }
}
