import type {
  WaitlistSignupInput,
  WaitlistSignupResult,
  WaitlistUnsubscribeResult,
} from '@injishi/contracts';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { waitlistSignups } from '../../../database/drizzle/waitlist';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';
import { WAITLIST_WELCOME_JOB } from './waitlist-mail';

/**
 * Storing a waitlist signup, and letting somebody leave (ADR-048).
 *
 * Two behaviours here are load-bearing and neither is an implementation
 * detail, so both are spelled out rather than left to read off the code.
 */
@Injectable()
export class WaitlistService {
  private readonly log = new Logger(WaitlistService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @InjectQueue(QUEUES.waitlistEmail) private readonly welcome: Queue,
  ) {}

  /**
   * Store one signup, or report that this address was already stored.
   *
   * THE CONFLICT DOES THE WORK, not a read before the write. `lower(email)` is
   * unique, so the insert either creates the row or creates nothing, and which
   * one happened is read off whether a row came back. Checking first and then
   * inserting would leave a window in which two simultaneous submissions of the
   * same address both pass the check and both try to write, and one of them
   * would then fail on the constraint anyway (AC-10).
   *
   * The owner columns are written as null for a traveller rather than left
   * undefined, so the `waitlist_owner_complete` constraint sees exactly the
   * shape the contract promised.
   */
  async join(input: WaitlistSignupInput): Promise<WaitlistSignupResult> {
    const owner = input.audience === 'owner' ? input : null;

    const [created] = await this.db
      .insert(waitlistSignups)
      .values({
        audience: input.audience,
        email: input.email,
        fullName: input.fullName,
        phone: input.phone ?? null,
        businessName: owner?.businessName ?? null,
        districtId: owner?.districtId ?? null,
        propertyType: owner?.propertyType ?? null,
        sizeBand: owner?.sizeBand ?? null,
        marketingOptIn: input.marketingOptIn,
      })
      .onConflictDoNothing()
      .returning({
        id: waitlistSignups.id,
        unsubscribeToken: waitlistSignups.unsubscribeToken,
      });

    if (created) {
      await this.queueWelcome(created.id);
      return { id: created.id, alreadyJoined: false };
    }

    // Nothing was written, so the address is already on the list. The id is
    // returned for shape only: it is not a capability, and the unsubscribe
    // link is keyed on a different, separately random token.
    const [existing] = await this.db
      .select({ id: waitlistSignups.id })
      .from(waitlistSignups)
      .where(sql`lower(${waitlistSignups.email}) = ${input.email}`)
      .limit(1);

    return { id: existing?.id ?? '', alreadyJoined: true };
  }

  /**
   * Raise the welcome note, and never let it fail the signup (AC-11).
   *
   * THE ROW IS ALREADY COMMITTED when this runs, so a queue that is down must
   * not turn a stored signup into a failed submission. The visitor did
   * everything right and their details are safe; telling them otherwise would
   * invite them to submit again, which the mailbox throttle would then refuse.
   * So this swallows, logs, and returns.
   *
   * `jobId` is the signup id, which makes the send idempotent at the queue:
   * two jobs for one row deduplicate into one, so nobody is welcomed twice.
   *
   * NO COLON IN IT. BullMQ 5 refuses a custom id containing `:` unless it splits
   * into exactly three parts, and the catch below would swallow that refusal on
   * every signup. `waitlist-welcome:<id>` did exactly that: nobody was welcomed.
   */
  private async queueWelcome(signupId: string): Promise<void> {
    try {
      await this.welcome.add(
        WAITLIST_WELCOME_JOB,
        { signupId },
        {
          jobId: `waitlist-welcome-${signupId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
        },
      );
    } catch (error) {
      this.log.error(
        `Waitlist signup ${signupId} was stored but its welcome could not be queued.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Take somebody off the list, and say nothing about whether they were on it.
   *
   * The token is treated as an OPAQUE LOOKUP KEY and its shape is never
   * validated (AC-12): a malformed token, an unknown one and one already spent
   * all reach the same answer, because any difference between them tells a
   * stranger whether an address is stored. That is also why this returns a
   * literal `ok` rather than a count.
   *
   * The row is updated, never deleted. A deleted row would be re-signed-up by
   * the next import and the person would be mailed again, which is the one
   * thing unsubscribing has to guarantee cannot happen.
   */
  async unsubscribe(token: string): Promise<WaitlistUnsubscribeResult> {
    // A token that is not even a well-formed uuid must not reach Postgres as a
    // uuid comparison: that is a 22P02 error, which is a 500, which is a
    // different answer for a malformed token than for an unknown one.
    if (!UUID_SHAPE.test(token)) return { ok: true };

    await this.db
      .update(waitlistSignups)
      .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(waitlistSignups.unsubscribeToken, token),
          isNull(waitlistSignups.unsubscribedAt),
        ),
      );

    return { ok: true };
  }
}

/**
 * Not validation, and deliberately not exposed as such. This only keeps a
 * malformed token from reaching Postgres as a uuid comparison, which would
 * raise a type error and answer 500 where every other token answers `ok`. The
 * caller is told nothing either way.
 */
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
