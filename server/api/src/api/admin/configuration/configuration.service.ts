import {
  AdminConfiguration,
  AdminFeeSchedule,
  AdminRegistrationFee,
  type AppendRegistrationFeeRequest,
  type CreatePsfAssociationRequest,
  type CreatePsfClusterRequest,
  type CreatePsfTierRequest,
  type PsfAssociation,
  type PsfCatalogue,
  type PsfCluster,
  type PsfTier,
  type UpdatePsfTierRequest,
  type UpsertPsfAssociationRequest,
  type UpsertPsfClusterRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';

import {
  auditEvents,
  configEntries,
  districts,
  featureFlags,
  placementFees,
  psfAssociations,
  psfClusters,
  psfMembershipTiers,
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
 * Both reads sit behind `admin.config.view` (ADR-053), which every staff role
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
   * Append a registration fee, and record who did it (ADR-053, AC-R9, AC-G10).
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
  // --- PSF membership tiers (ADR-056 AC-19) ---------------------------------

  /** Every tier, retired ones included, in the order the form shows them. */
  async psfTiers(): Promise<PsfTier[]> {
    const rows = await this.db
      .select()
      .from(psfMembershipTiers)
      .orderBy(asc(psfMembershipTiers.sortOrder), asc(psfMembershipTiers.code));
    return rows.map(toPsfTier);
  }

  /** A new tier. Its code is permanent: applications and memberships name it. */
  async createPsfTier(input: { actorUserId: string; request: CreatePsfTierRequest }): Promise<PsfTier> {
    const { reason, code, ...fields } = input.request;
    return this.db.transaction(async (tx) => {
      const [clash] = await tx
        .select({ code: psfMembershipTiers.code })
        .from(psfMembershipTiers)
        .where(eq(psfMembershipTiers.code, code))
        .limit(1);
      if (clash) throw new ConflictException('A tier with that code already exists. Edit it instead.');
      const [row] = await tx
        .insert(psfMembershipTiers)
        .values({ code, ...tierColumns(fields), updatedByUserId: input.actorUserId })
        .returning();
      if (!row) throw new Error('PSF tier insert returned no row.');
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_tier.created',
        payloadDiff: { psfTier: toPsfTier(row) } as never,
        reason,
      });
      return toPsfTier(row);
    });
  }

  /**
   * Edit a tier. Retiring one (`active: false`) takes it off the form and out
   * of an officer's choices, while every application and membership that
   * names it keeps reading it.
   */
  async updatePsfTier(input: {
    actorUserId: string;
    code: string;
    request: UpdatePsfTierRequest;
  }): Promise<PsfTier> {
    const { reason, ...fields } = input.request;
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(psfMembershipTiers)
        .where(eq(psfMembershipTiers.code, input.code))
        .limit(1);
      if (!before) throw new NotFoundException('No PSF tier has that code.');
      const [row] = await tx
        .update(psfMembershipTiers)
        .set({ ...tierColumns(fields), updatedByUserId: input.actorUserId, updatedAt: new Date() })
        .where(eq(psfMembershipTiers.code, input.code))
        .returning();
      if (!row) throw new Error('PSF tier update returned no row.');
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_tier.updated',
        payloadDiff: { before: toPsfTier(before), after: toPsfTier(row) } as never,
        reason,
      });
      return toPsfTier(row);
    });
  }

  // --- PSF's sector catalogue (the PSF path) -----------------------------------

  /**
   * Every cluster with every association, retired ones included, in the order
   * the forms show them. The registration form reads the active ones only
   * (`GET /psf/catalogue`).
   */
  async psfCatalogue(): Promise<PsfCatalogue> {
    const [clusters, associations] = await Promise.all([
      this.db.select().from(psfClusters).orderBy(asc(psfClusters.sortOrder), asc(psfClusters.code)),
      this.db.select().from(psfAssociations).orderBy(asc(psfAssociations.sortOrder), asc(psfAssociations.nameEn)),
    ]);
    return {
      clusters: clusters.map((c) =>
        toPsfCluster(c, associations.filter((a) => a.clusterCode === c.code)),
      ),
    };
  }

  /** A new cluster. Its code is permanent: associations, and so businesses, hang off it. */
  async createPsfCluster(input: { actorUserId: string; request: CreatePsfClusterRequest }): Promise<PsfCatalogue> {
    const { reason, code, ...fields } = input.request;
    await this.db.transaction(async (tx) => {
      const [clash] = await tx.select({ code: psfClusters.code }).from(psfClusters).where(eq(psfClusters.code, code)).limit(1);
      if (clash) throw new ConflictException('A cluster with that code already exists. Edit it instead.');
      const [row] = await tx
        .insert(psfClusters)
        .values({ code, ...clusterColumns(fields), updatedByUserId: input.actorUserId })
        .returning();
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_cluster.created',
        payloadDiff: { psfCluster: row } as never,
        reason,
      });
    });
    return this.psfCatalogue();
  }

  /**
   * Edit a cluster. Retiring one takes it, and every association in it, off
   * the registration form; the businesses already filed under it keep reading it.
   */
  async updatePsfCluster(input: {
    actorUserId: string;
    code: string;
    request: UpsertPsfClusterRequest;
  }): Promise<PsfCatalogue> {
    const { reason, ...fields } = input.request;
    await this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(psfClusters).where(eq(psfClusters.code, input.code)).limit(1);
      if (!before) throw new NotFoundException('No PSF cluster has that code.');
      const [row] = await tx
        .update(psfClusters)
        .set({ ...clusterColumns(fields), updatedByUserId: input.actorUserId, updatedAt: new Date() })
        .where(eq(psfClusters.code, input.code))
        .returning();
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_cluster.updated',
        payloadDiff: { before, after: row } as never,
        reason,
      });
    });
    return this.psfCatalogue();
  }

  /** A new association, in an existing cluster. Its code is permanent: businesses name it. */
  async createPsfAssociation(input: {
    actorUserId: string;
    request: CreatePsfAssociationRequest;
  }): Promise<PsfCatalogue> {
    const { reason, code, ...fields } = input.request;
    await this.db.transaction(async (tx) => {
      const [clash] = await tx
        .select({ code: psfAssociations.code })
        .from(psfAssociations)
        .where(eq(psfAssociations.code, code))
        .limit(1);
      if (clash) throw new ConflictException('An association with that code already exists. Edit it instead.');
      await this.assertCluster(tx, fields.clusterCode);
      const [row] = await tx
        .insert(psfAssociations)
        .values({ code, ...associationColumns(fields), updatedByUserId: input.actorUserId })
        .returning();
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_association.created',
        payloadDiff: { psfAssociation: row } as never,
        reason,
      });
    });
    return this.psfCatalogue();
  }

  /** Edit an association, or move it to another cluster. */
  async updatePsfAssociation(input: {
    actorUserId: string;
    code: string;
    request: UpsertPsfAssociationRequest;
  }): Promise<PsfCatalogue> {
    const { reason, ...fields } = input.request;
    await this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(psfAssociations).where(eq(psfAssociations.code, input.code)).limit(1);
      if (!before) throw new NotFoundException('No PSF association has that code.');
      await this.assertCluster(tx, fields.clusterCode);
      const [row] = await tx
        .update(psfAssociations)
        .set({ ...associationColumns(fields), updatedByUserId: input.actorUserId, updatedAt: new Date() })
        .where(eq(psfAssociations.code, input.code))
        .returning();
      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.psf_association.updated',
        payloadDiff: { before, after: row } as never,
        reason,
      });
    });
    return this.psfCatalogue();
  }

  /** The cluster an association names must exist, refused at its field when not. */
  private async assertCluster(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    clusterCode: string,
  ): Promise<void> {
    const [cluster] = await tx.select({ code: psfClusters.code }).from(psfClusters).where(eq(psfClusters.code, clusterCode)).limit(1);
    if (!cluster) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['clusterCode'], message: 'Pick a cluster from the list.' }],
      });
    }
  }

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

/** A cluster row, with its associations, as the admin console reads it. */
function toPsfCluster(
  row: typeof psfClusters.$inferSelect,
  associations: (typeof psfAssociations.$inferSelect)[],
): PsfCluster {
  return {
    code: row.code,
    nameEn: row.nameEn,
    nameRw: row.nameRw,
    description: row.description,
    sortOrder: row.sortOrder,
    active: row.active,
    associations: associations.map(toPsfAssociation),
    subsectors: [],
  };
}

function toPsfAssociation(row: typeof psfAssociations.$inferSelect): PsfAssociation {
  return {
    code: row.code,
    clusterCode: row.clusterCode,
    nameEn: row.nameEn,
    acronym: row.acronym,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function clusterColumns(
  f: Omit<UpsertPsfClusterRequest, 'reason'>,
): Omit<typeof psfClusters.$inferInsert, 'code' | 'updatedByUserId'> {
  return {
    nameEn: f.nameEn,
    nameRw: f.nameRw ?? null,
    description: f.description ?? null,
    sortOrder: f.sortOrder,
    active: f.active,
  };
}

function associationColumns(
  f: Omit<UpsertPsfAssociationRequest, 'reason'>,
): Omit<typeof psfAssociations.$inferInsert, 'code' | 'updatedByUserId'> {
  return {
    clusterCode: f.clusterCode,
    nameEn: f.nameEn,
    acronym: f.acronym ?? null,
    sortOrder: f.sortOrder,
    active: f.active,
  };
}

/** A tier row as the admin console reads it. */
function toPsfTier(row: typeof psfMembershipTiers.$inferSelect): PsfTier {
  return {
    code: row.code,
    family: row.family,
    nameEn: row.nameEn,
    nameRw: row.nameRw,
    priceKind: row.priceKind,
    annualFeeRwf: row.annualFeeRwf,
    annualFeeMinRwf: row.annualFeeMinRwf,
    annualFeeMaxRwf: row.annualFeeMaxRwf,
    benefitsEn: row.benefitsEn,
    benefitsRw: row.benefitsRw,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

/**
 * A tier's columns from a request. The whole price travels together: the
 * three price columns only mean something as a set, and the database CHECK
 * (`psf_membership_tiers_price_shape`) refuses a half written one.
 */
function tierColumns(
  f: Omit<CreatePsfTierRequest, 'code' | 'reason'>,
): Omit<typeof psfMembershipTiers.$inferInsert, 'code' | 'updatedByUserId'> {
  return {
    family: f.family,
    nameEn: f.nameEn,
    nameRw: f.nameRw ?? null,
    priceKind: f.priceKind,
    annualFeeRwf: f.annualFeeRwf ?? null,
    annualFeeMinRwf: f.annualFeeMinRwf ?? null,
    annualFeeMaxRwf: f.annualFeeMaxRwf ?? null,
    benefitsEn: f.benefitsEn,
    benefitsRw: f.benefitsRw ?? null,
    sortOrder: f.sortOrder,
    active: f.active,
  };
}
