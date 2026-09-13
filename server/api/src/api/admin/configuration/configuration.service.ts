import {
  AdminConfiguration,
  AdminFeeSchedule,
  AdminRegistrationFee,
  type AppendRegistrationFeeRequest,
} from '@injishi/contracts';
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';

import {
  auditEvents,
  configEntries,
  districts,
  featureFlags,
  placementFees,
  registrationFees,
  subscriptionPlans,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The console's Configuration section: what the platform is set to, and what
 * it charges.
 *
 * Both screens read EFFECTIVE-DATED, VERSIONED tables and neither collapses
 * them to "the current value". That is deliberate and it is the whole reason
 * these tables have a `version` and an `effective_from`: a fee change INSERTS a
 * row, the charged amount is locked onto the invoice at charge time (D8), and
 * so the history is the record of what somebody actually paid. A service that
 * returned only the newest row per key would hand the console a screen that
 * cannot answer "what was the rate in March", which is the only question anyone
 * asks a fee catalog under dispute.
 *
 * Both reads sit behind `admin.config.view` (ADR-049), which every staff role
 * holds. The one write here, the fee append, is `admin.fee.edit`.
 */
@Injectable()
export class ConfigurationAdminService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * `GET /api/v1/admin/configuration` — the settings and the flags.
   *
   * `effectiveFrom` is coalesced to `created_at` on BOTH tables. The columns
   * are nullable (`config_entries.effective_from`,
   * `feature_flags.effective_from`) while the contract declares the field
   * non-null, and the honest fallback is the row's own birth: a setting with no
   * stated start date took effect when it was written, which is what every
   * reader of a null already assumes. Widening the contract to nullable instead
   * would push that same assumption into every consumer, restated four times.
   *
   * `value` crosses as `unknown` because the column is `jsonb` and its shape
   * differs per `configType`. The console renders an editor rather than
   * pretending to know, and this service does not parse a blob it has no schema
   * for.
   *
   * Flags resolve their district's NAME here rather than in the browser. The
   * console would otherwise need the whole district table to render one label,
   * and `feature_flags.district_id` carries no foreign key, so the join is LEFT:
   * a flag naming a district that no longer exists still appears, with a null
   * name. Dropping it would hide a live flag because of a bad reference.
   */
  async configuration(): Promise<AdminConfiguration> {
    const entries = await this.db
      .select({
        id: configEntries.id,
        configType: configEntries.configType,
        value: configEntries.value,
        version: configEntries.version,
        effectiveFrom: configEntries.effectiveFrom,
        effectiveTo: configEntries.effectiveTo,
        lockedOnUse: configEntries.lockedOnUse,
        reversible: configEntries.reversible,
        lastActorUserId: configEntries.lastActorUserId,
        createdAt: configEntries.createdAt,
      })
      .from(configEntries)
      // Grouped by what the setting IS, newest version of each first: the
      // screen is read as "tax rate, and what it used to be".
      .orderBy(asc(configEntries.configType), desc(configEntries.version));

    const flags = await this.db
      .select({
        id: featureFlags.id,
        key: featureFlags.key,
        value: featureFlags.value,
        scope: featureFlags.scope,
        districtId: featureFlags.districtId,
        districtName: districts.name,
        effectiveFrom: featureFlags.effectiveFrom,
        version: featureFlags.version,
        createdAt: featureFlags.createdAt,
      })
      .from(featureFlags)
      .leftJoin(districts, eq(districts.id, featureFlags.districtId))
      .orderBy(asc(featureFlags.key), desc(featureFlags.version));

    return AdminConfiguration.parse({
      entries: entries.map((e) => ({
        id: e.id,
        configType: e.configType,
        value: e.value,
        version: e.version,
        // Nullable column, non-null contract: a setting with no stated start
        // date took effect when it was written.
        effectiveFrom: (e.effectiveFrom ?? e.createdAt).toISOString(),
        effectiveTo: e.effectiveTo?.toISOString() ?? null,
        lockedOnUse: e.lockedOnUse,
        reversible: e.reversible,
        lastActorUserId: e.lastActorUserId,
      })),
      flags: flags.map((f) => ({
        id: f.id,
        key: f.key,
        value: f.value,
        scope: f.scope,
        districtId: f.districtId,
        districtName: f.districtName,
        // Same coalesce, same reason, other table.
        effectiveFrom: (f.effectiveFrom ?? f.createdAt).toISOString(),
        version: f.version,
      })),
    });
  }

  /**
   * `GET /api/v1/admin/configuration/fees` — what the platform charges.
   *
   * Three reads, and the third is a SUMMARY rather than a list on purpose:
   * placement fees are a broker fact, not a catalog fact, and the individual
   * fees belong to the broker section. The counts and totals are here so a
   * finance staffer can see what the current placement rate is producing
   * without leaving the page they are editing rates on.
   *
   * `placement_fee_status` is `pending | disbursed` — there is no `paid`. The
   * summary's `paidCount` and `paidRwf` are the `disbursed` rows; the enum is
   * the spelling and the contract's field name is the console's wording, and
   * they are mapped here rather than either one being changed to match.
   *
   * Both money aggregates coalesce to 0, twice over: `sum()` returns NULL over
   * no rows, and `placement_fees.amount_rwf` is itself nullable, so a fee row
   * written without an amount contributes nothing rather than poisoning the
   * total to NULL. They are cast to text and read back through `Number` because
   * `sum()` over `bigint` comes back as a string from the driver — reading it
   * as a number without the cast is how a total silently becomes `"0"` and
   * fails the contract's `z.number()`.
   */
  /**
   * Append a registration fee, and record who did it (ADR-049, AC-R9, AC-G10).
   *
   * **An insert, never an update.** The catalogue is effective dated so that a
   * price change is a NEW row: `currentFee` reads the newest row whose moment has
   * passed, and every registration already created keeps the amount locked on
   * its invoice. Editing a row in place would silently re-date a price somebody
   * was already quoted.
   *
   * **A moment in the past is refused with 422**, against the server clock. A
   * retroactive fee would make an invoice already issued disagree with the
   * catalogue that produced it. Sending no `effectiveFrom` means now, which is
   * also how a caller avoids being refused by the milliseconds its own request
   * took to arrive.
   *
   * The fee row and its audit row are one transaction: a price that changed with
   * nobody's name on it is the one kind of catalogue edit nobody can explain.
   */
  async appendRegistrationFee(input: {
    actorUserId: string;
    request: AppendRegistrationFeeRequest;
  }): Promise<AdminRegistrationFee> {
    const now = new Date();
    const effectiveFrom = input.request.effectiveFrom
      ? new Date(input.request.effectiveFrom)
      : now;
    if (effectiveFrom.getTime() < now.getTime()) {
      throw new UnprocessableEntityException({
        code: 'effective_from_in_past',
        message:
          'A fee cannot take effect in the past. Choose a moment from now on, or leave it empty to start now.',
      });
    }

    return this.db.transaction(async (tx) => {
      const [fee] = await tx
        .insert(registrationFees)
        .values({
          businessType: input.request.businessType,
          amountRwf: input.request.amountRwf,
          effectiveFrom,
        })
        .returning({
          id: registrationFees.id,
          businessType: registrationFees.businessType,
          amountRwf: registrationFees.amountRwf,
          currency: registrationFees.currency,
          effectiveFrom: registrationFees.effectiveFrom,
          active: registrationFees.active,
        });
      if (!fee) throw new Error('Registration fee insert returned no row.');

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: fee.id,
        eventType: 'admin.fee.appended',
        payloadDiff: {
          registrationFee: {
            businessType: fee.businessType,
            amountRwf: Number(fee.amountRwf),
            effectiveFrom: fee.effectiveFrom.toISOString(),
          },
        } as never,
        reason: input.request.reason,
      });

      return AdminRegistrationFee.parse({
        id: fee.id,
        businessType: fee.businessType,
        amountRwf: Number(fee.amountRwf),
        currency: fee.currency,
        effectiveFrom: fee.effectiveFrom.toISOString(),
        active: fee.active,
      });
    });
  }

  async fees(): Promise<AdminFeeSchedule> {
    const fees = await this.db
      .select({
        id: registrationFees.id,
        businessType: registrationFees.businessType,
        amountRwf: registrationFees.amountRwf,
        currency: registrationFees.currency,
        effectiveFrom: registrationFees.effectiveFrom,
        active: registrationFees.active,
      })
      .from(registrationFees)
      .orderBy(
        asc(registrationFees.businessType),
        desc(registrationFees.effectiveFrom),
      );

    const plans = await this.db
      .select({
        id: subscriptionPlans.id,
        code: subscriptionPlans.code,
        name: subscriptionPlans.name,
        tier: subscriptionPlans.tier,
        priceRwf: subscriptionPlans.priceRwf,
        currency: subscriptionPlans.currency,
        billingPeriod: subscriptionPlans.billingPeriod,
        roomCountLimit: subscriptionPlans.roomCountLimit,
        effectiveFrom: subscriptionPlans.effectiveFrom,
        active: subscriptionPlans.active,
      })
      .from(subscriptionPlans)
      // `tier` is nullable, so it cannot be the sole sort key without leaving
      // the unranked plans in whatever order the heap hands back.
      .orderBy(asc(subscriptionPlans.tier), asc(subscriptionPlans.code));

    const [summary] = await this.db
      .select({
        pendingCount: sql<number>`count(*) filter (where ${placementFees.status} = 'pending')::int`,
        pendingRwf: sql<string>`coalesce(sum(${placementFees.amountRwf}) filter (where ${placementFees.status} = 'pending'), 0)::text`,
        paidCount: sql<number>`count(*) filter (where ${placementFees.status} = 'disbursed')::int`,
        paidRwf: sql<string>`coalesce(sum(${placementFees.amountRwf}) filter (where ${placementFees.status} = 'disbursed'), 0)::text`,
        // The tag that rides alongside the amounts. Null over an empty table,
        // where 'RWF' is the column's own default rather than a currency this
        // service picked.
        currency: sql<string | null>`max(${placementFees.currency})`,
      })
      .from(placementFees);

    return AdminFeeSchedule.parse({
      registrationFees: fees.map((f) => ({
        id: f.id,
        businessType: f.businessType,
        // Nullable column, non-null contract. Coalesced rather than dropped:
        // a catalog row with no amount is a data defect a staffer must SEE, and
        // hiding it would leave the fee screen quietly incomplete.
        amountRwf: f.amountRwf ?? 0,
        currency: f.currency,
        // NOT NULL on this table, unlike the two config tables above, because
        // a price with no start date cannot be locked onto an invoice.
        effectiveFrom: f.effectiveFrom.toISOString(),
        active: f.active,
      })),
      subscriptionPlans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        tier: p.tier,
        // `price_rwf` is nullable; same reasoning as the fee amount above.
        priceRwf: p.priceRwf ?? 0,
        currency: p.currency,
        billingPeriod: p.billingPeriod,
        // Null means UNLIMITED here, which is a different statement from a
        // limit of zero — so it is passed through, never coalesced.
        roomCountLimit: p.roomCountLimit,
        effectiveFrom: p.effectiveFrom?.toISOString() ?? null,
        active: p.active,
      })),
      placementFeeSummary: {
        pendingCount: summary?.pendingCount ?? 0,
        pendingRwf: Number(summary?.pendingRwf ?? 0),
        paidCount: summary?.paidCount ?? 0,
        paidRwf: Number(summary?.paidRwf ?? 0),
        currency: summary?.currency ?? 'RWF',
      },
    });
  }
}
