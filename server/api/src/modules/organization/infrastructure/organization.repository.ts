import type {
  Domain,
  OrgRegistrationStatus,
  RegistrationBusinessType,
  RegistrationRejectionReason,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lte } from 'drizzle-orm';

import {
  auditEvents,
  districts,
  oboRegistrations,
  orgCertificates,
  orgRegistrationReviews,
  orgMemberships,
  orgs,
  registrationFees,
  sectors,
  subscriptionInvoices,
  tinVerifications,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** A TIN that already belongs to another org (KYB dedup, F-S03 §9). */
export class DuplicateTinError extends Error {
  constructor() {
    super('An organization with this TIN already exists.');
  }
}

/** No effective fee row for this business type — nothing can be quoted. */
export class MissingFeeError extends Error {
  constructor(readonly businessType: RegistrationBusinessType) {
    super(`No registration fee is configured for ${businessType}.`);
  }
}

export interface CreateOrgRow {
  legalName: string;
  domain: Domain;
  rdbEntityGroup: string | null;
  accommodationClass: string | null;
  accommodationClassOther: string | null;
  residenceClass: string | null;
  tourismLicenseNumber: string | null;
  chamberOfTourismMember: boolean;
  psfMember: boolean;
  eacStarGrade: number | null;
  tin: string | null;
  upi: string | null;
  districtId: number | null;
  sectorId: number | null;
  addressText: string | null;
  ownerUserId: string;
  businessType: RegistrationBusinessType;
  /** Set only when the registrant is acting for someone else (FL02). */
  obo: {
    intendedOwnerName: string;
    intendedOwnerNationalId: string | null;
    intendedOwnerEmail: string | null;
  } | null;
  certificates: {
    kind:
      | 'rdb_grade'
      | 'tourism_license'
      | 'tax_clearance'
      | 'fire_safety'
      | 'health_inspection'
      | 'other';
    kindOther: string | null;
    objectKey: string;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
  }[];
}

export interface CreatedOrg {
  orgId: string;
  workspaceId: string;
  invoiceId: string;
  amountDueRwf: number;
}

/**
 * The only place that touches Drizzle for organizations.
 *
 * Registration is a multi-table commitment — org, workspace, owner membership,
 * certificates and the fee invoice all describe one act — so it is written in
 * one transaction. A half-created registration would leave a person owning a
 * business with no workspace to watch it from, or an org with no bill.
 */
@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The fee in force right now for this business type (§8.3a).
   *
   * Newest effective row wins, and the amount is returned to be LOCKED onto the
   * invoice by the caller (D8): a later price change must never rewrite what
   * someone already paid.
   */
  async currentFee(
    businessType: RegistrationBusinessType,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ amountRwf: registrationFees.amountRwf })
      .from(registrationFees)
      .where(
        and(
          eq(registrationFees.businessType, businessType),
          eq(registrationFees.active, true),
          lte(registrationFees.effectiveFrom, new Date()),
        ),
      )
      .orderBy(desc(registrationFees.effectiveFrom))
      .limit(1);
    return row?.amountRwf ?? null;
  }

  /**
   * Create the registration at `pending_payment`, with its bill (D23).
   *
   * The invoice is written here rather than on payment because `pending_payment`
   * is a state that OWES something: without the row there is nothing for the
   * registrant to settle and nothing for the partial-unique to protect.
   */
  async createRegistration(input: CreateOrgRow): Promise<CreatedOrg> {
    const amountDueRwf = await this.currentFee(input.businessType);
    if (amountDueRwf === null) throw new MissingFeeError(input.businessType);

    if (input.tin) {
      const [clash] = await this.db
        .select({ id: orgs.id })
        .from(orgs)
        .where(eq(orgs.tin, input.tin))
        .limit(1);
      if (clash) throw new DuplicateTinError();
    }

    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(orgs)
        .values({
          legalName: input.legalName,
          domain: input.domain,
          rdbEntityGroup: input.rdbEntityGroup,
          accommodationClass: input.accommodationClass,
          accommodationClassOther: input.accommodationClassOther,
          residenceClass: input.residenceClass,
          tourismLicenseNumber: input.tourismLicenseNumber,
          chamberOfTourismMember: input.chamberOfTourismMember,
          psfMember: input.psfMember,
          eacStarGrade: input.eacStarGrade,
          tin: input.tin,
          upi: input.upi,
          districtId: input.districtId,
          sectorId: input.sectorId,
          addressText: input.addressText,
          registrationStatus: 'pending_payment',
        })
        .returning({ id: orgs.id });
      if (!org) throw new Error('Org insert returned no row.');

      // The workspace exists from the first moment, pending and powerless: the
      // registrant opens it to watch the pipeline (F-S03 §6). Permissions come
      // from `permissionsForWorkspace`, which returns nothing until `active`.
      const [workspace] = await tx
        .insert(workspaces)
        .values({ kind: 'business', orgId: org.id })
        .returning({ id: workspaces.id });
      if (!workspace) throw new Error('Workspace insert returned no row.');

      await tx.insert(orgMemberships).values({
        orgId: org.id,
        userId: input.ownerUserId,
        orgRole: 'owner',
      });

      if (input.certificates.length > 0) {
        await tx.insert(orgCertificates).values(
          input.certificates.map((c) => ({ orgId: org.id, ...c })),
        );
      }

      if (input.obo) {
        // `payout_locked` and `claim_status` take their defaults on purpose:
        // registrant_held and locked is what an unclaimed OBO registration IS,
        // and restating a default here is a second place for it to drift.
        await tx.insert(oboRegistrations).values({
          orgId: org.id,
          registrantUserId: input.ownerUserId,
          intendedOwnerName: input.obo.intendedOwnerName,
          intendedOwnerNationalId: input.obo.intendedOwnerNationalId,
          intendedOwnerEmail: input.obo.intendedOwnerEmail,
        });
      }

      const [invoice] = await tx
        .insert(subscriptionInvoices)
        .values({
          orgId: org.id,
          invoiceKind: 'registration_fee',
          // Locked at charge time (D8). A later catalog edit does not reach it.
          amountRwf: amountDueRwf,
          status: 'pending',
          idempotencyKey: `registration_fee:${org.id}`,
        })
        .returning({ id: subscriptionInvoices.id });
      if (!invoice) throw new Error('Invoice insert returned no row.');

      return {
        orgId: org.id,
        workspaceId: workspace.id,
        invoiceId: invoice.id,
        amountDueRwf,
      };
    });
  }

  /**
   * Settle the registration fee and advance the org, in one transaction.
   *
   * Conditional on BOTH the invoice still being pending and the org still being
   * at `pending_payment`, so a duplicated payment callback cannot advance an org
   * twice or bill it twice. Returns false when the guard did not match, which
   * the caller reads as "already done", not as a failure.
   */
  async settleRegistrationFee(orgId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const paid = await tx
        .update(subscriptionInvoices)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(
            eq(subscriptionInvoices.orgId, orgId),
            eq(subscriptionInvoices.invoiceKind, 'registration_fee'),
            eq(subscriptionInvoices.status, 'pending'),
          ),
        )
        .returning({ id: subscriptionInvoices.id });
      if (paid.length === 0) return false;

      const advanced = await tx
        .update(orgs)
        .set({ registrationStatus: 'submitted', updatedAt: new Date() })
        .where(
          and(
            eq(orgs.id, orgId),
            eq(orgs.registrationStatus, 'pending_payment'),
          ),
        )
        .returning({ id: orgs.id });
      return advanced.length > 0;
    });
  }

  /** Record one RRA check. Append-only: a retry is a new row, never an update. */
  async recordTinCheck(input: {
    orgId: string;
    tin: string;
    result: 'pending' | 'verified' | 'failed';
    latencyMs: number;
    adapterMode: 'mock' | 'live';
    raw: unknown;
  }): Promise<void> {
    await this.db.insert(tinVerifications).values({
      orgId: input.orgId,
      tin: input.tin,
      result: input.result,
      latencyMs: input.latencyMs,
      adapterMode: input.adapterMode,
      rawResponse: input.raw as never,
    });
  }

  /**
   * Move an org, refusing unless it is still where the caller thought it was.
   *
   * The `from` guard is the concurrency control: two officers acting at once,
   * or a retried job, cannot double-advance a registration. The domain decides
   * WHICH move is legal; this decides that it happens exactly once.
   */
  async advance(
    orgId: string,
    from: OrgRegistrationStatus,
    to: OrgRegistrationStatus,
  ): Promise<boolean> {
    const rows = await this.db
      .update(orgs)
      .set({ registrationStatus: to, updatedAt: new Date() })
      .where(and(eq(orgs.id, orgId), eq(orgs.registrationStatus, from)))
      .returning({ id: orgs.id });
    return rows.length > 0;
  }

  async findById(orgId: string): Promise<
    | {
        id: string;
        legalName: string;
        domain: Domain;
        accommodationClass: string | null;
        tin: string | null;
        districtId: number | null;
        status: OrgRegistrationStatus;
        workspaceId: string | null;
        amountDueRwf: number | null;
        invoiceId: string | null;
        createdAt: Date;
      }
    | null
  > {
    const [row] = await this.db
      .select({
        id: orgs.id,
        legalName: orgs.legalName,
        domain: orgs.domain,
        accommodationClass: orgs.accommodationClass,
        tin: orgs.tin,
        districtId: orgs.districtId,
        status: orgs.registrationStatus,
        workspaceId: workspaces.id,
        amountDueRwf: subscriptionInvoices.amountRwf,
        invoiceId: subscriptionInvoices.id,
        createdAt: orgs.createdAt,
      })
      .from(orgs)
      .leftJoin(workspaces, eq(workspaces.orgId, orgs.id))
      .leftJoin(
        subscriptionInvoices,
        and(
          eq(subscriptionInvoices.orgId, orgs.id),
          eq(subscriptionInvoices.invoiceKind, 'registration_fee'),
          eq(subscriptionInvoices.status, 'pending'),
        ),
      )
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Record one gate decision AND move the org, in one transaction (D25).
   *
   * The two are one act. A recorded decision that did not move the org would
   * leave an officer certain they had approved a business that is still
   * waiting; a move with no recorded decision would break the one success
   * criterion F-S03 §5 states outright — zero orgs live without an approver's
   * recorded decision.
   *
   * The `from` guard on the update is the concurrency control, exactly as in
   * `advance()`: two officers acting at once cannot both move the same org, and
   * the loser gets `false` rather than a second review row against a state that
   * has already changed.
   */
  async recordReviewAndAdvance(input: {
    orgId: string;
    stage: 'tin_verified' | 'field_verified';
    decision: 'passed' | 'rejected';
    to: OrgRegistrationStatus;
    decidedByUserId: string;
    oversightRole: 'business_field_verifier' | 'business_approver';
    governmentBodyCode: string;
    governmentTitle: string | null;
    reasonCode: RegistrationRejectionReason | null;
    notes: string | null;
    /** The org's district, copied onto the audit row for district reporting. */
    districtId: number | null;
    /**
     * Carry `approved` straight on to `active` in this same transaction.
     *
     * Two updates rather than one jump from `field_verified`, because the state
     * machine declares `approved` and `activated` as separate legal moves and
     * bypassing one of them would make the machine a description rather than
     * the rule. Atomic either way: D21 as retimed by D23 requires that the
     * approver's decision and the activation cannot be observed apart.
     */
    thenActivate?: boolean;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(orgs)
        .set({ registrationStatus: input.to, updatedAt: new Date() })
        .where(
          and(
            eq(orgs.id, input.orgId),
            eq(orgs.registrationStatus, input.stage),
          ),
        )
        .returning({ id: orgs.id });
      if (moved.length === 0) return false;

      await tx.insert(orgRegistrationReviews).values({
        orgId: input.orgId,
        stage: input.stage,
        decision: input.decision,
        decidedByUserId: input.decidedByUserId,
        oversightRole: input.oversightRole,
        governmentBodyCode: input.governmentBodyCode,
        governmentTitle: input.governmentTitle,
        reasonCode: input.reasonCode,
        notes: input.notes,
      });

      // F-S03 §10: every gate transition writes an audit row carrying the
      // acting officer, their body and their title. Written HERE rather than by
      // a listener, so an audit gap and a state change cannot be separated by a
      // crash between them.
      await tx.insert(auditEvents).values({
        actorUserId: input.decidedByUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: `registration.${input.stage}.${input.decision}`,
        payloadDiff: {
          from: input.stage,
          to: input.to,
          oversightRole: input.oversightRole,
          governmentBodyCode: input.governmentBodyCode,
          governmentTitle: input.governmentTitle,
        } as never,
        reason: input.reasonCode,
        districtId: input.districtId,
      });

      if (input.thenActivate && input.to === 'approved') {
        await tx
          .update(orgs)
          .set({ registrationStatus: 'active', updatedAt: new Date() })
          .where(
            and(eq(orgs.id, input.orgId), eq(orgs.registrationStatus, 'approved')),
          );
      }

      return true;
    });
  }

  /** Is this person on this org at all? The check every registrant route owes. */
  async isMember(orgId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)),
      )
      .limit(1);
    return row !== undefined;
  }

  /**
   * Who took the field verification that this org is standing on?
   *
   * The latest PASSED review at the field verification gate. Latest rather than
   * only, because a rejected registration resubmits and gets verified again —
   * and it is the verification the approver is acting on that separation of
   * duties cares about, not one from a previous round.
   */
  async latestFieldVerifierId(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: orgRegistrationReviews.decidedByUserId })
      .from(orgRegistrationReviews)
      .where(
        and(
          eq(orgRegistrationReviews.orgId, orgId),
          eq(orgRegistrationReviews.stage, 'tin_verified'),
          eq(orgRegistrationReviews.decision, 'passed'),
        ),
      )
      .orderBy(desc(orgRegistrationReviews.decidedAt))
      .limit(1);
    return row?.userId ?? null;
  }

  /** The most recent rejection, which is what a rejected workspace renders. */
  async latestRejection(orgId: string): Promise<{
    reasonCode: RegistrationRejectionReason | null;
    notes: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        reasonCode: orgRegistrationReviews.reasonCode,
        notes: orgRegistrationReviews.notes,
      })
      .from(orgRegistrationReviews)
      .where(
        and(
          eq(orgRegistrationReviews.orgId, orgId),
          eq(orgRegistrationReviews.decision, 'rejected'),
        ),
      )
      .orderBy(desc(orgRegistrationReviews.decidedAt))
      .limit(1);
    return row ?? null;
  }

  /** Every decision taken on this org, oldest first. The pipeline's history. */
  async reviewsFor(orgId: string): Promise<
    {
      stage: 'tin_verified' | 'field_verified';
      decision: 'passed' | 'rejected';
      oversightRole: 'business_field_verifier' | 'business_approver';
      governmentBodyCode: string;
      governmentTitle: string | null;
      reasonCode: RegistrationRejectionReason | null;
      notes: string | null;
      decidedAt: Date;
    }[]
  > {
    const rows = await this.db
      .select({
        stage: orgRegistrationReviews.stage,
        decision: orgRegistrationReviews.decision,
        oversightRole: orgRegistrationReviews.oversightRole,
        governmentBodyCode: orgRegistrationReviews.governmentBodyCode,
        governmentTitle: orgRegistrationReviews.governmentTitle,
        reasonCode: orgRegistrationReviews.reasonCode,
        notes: orgRegistrationReviews.notes,
        decidedAt: orgRegistrationReviews.decidedAt,
      })
      .from(orgRegistrationReviews)
      .where(eq(orgRegistrationReviews.orgId, orgId))
      .orderBy(orgRegistrationReviews.decidedAt);
    return rows as never;
  }

  /**
   * Is this org held by an OBO registrant who is still waiting on a claim?
   *
   * The one reason `approved` does not activate immediately (F-S03 §8): the
   * business is approved, but the person holding it is not its owner, so it
   * waits payout-locked until the owner claims.
   */
  async isAwaitingOwnerClaim(orgId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: oboRegistrations.id })
      .from(oboRegistrations)
      .where(
        and(
          eq(oboRegistrations.orgId, orgId),
          eq(oboRegistrations.claimStatus, 'registrant_held'),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /**
   * The businesses waiting at one gate, inside one officer's region.
   *
   * Scope is applied as a WHERE clause, not as a filter over a full list: an
   * out of region business must be UNREACHABLE, not merely unlisted (the
   * boundary rule behind `withinScope`). A country grant adds no predicate, a
   * province grant matches through `districts.province_id`, and a district
   * grant matches the district itself.
   */
  async findQueue(input: {
    stage: OrgRegistrationStatus;
    districtIds: number[] | null;
  }): Promise<
    {
      orgId: string;
      legalName: string;
      domain: Domain;
      accommodationClass: string | null;
      tin: string | null;
      upi: string | null;
      districtId: number | null;
      districtName: string | null;
      sectorName: string | null;
      addressText: string | null;
      status: OrgRegistrationStatus;
      waitingSince: Date;
    }[]
  > {
    // An empty allow-list is a real answer: a province grant covering no
    // district reaches nothing. `inArray(x, [])` is what says that in SQL.
    const scope =
      input.districtIds === null
        ? undefined
        : inArray(orgs.districtId, input.districtIds);

    const rows = await this.db
      .select({
        orgId: orgs.id,
        legalName: orgs.legalName,
        domain: orgs.domain,
        accommodationClass: orgs.accommodationClass,
        tin: orgs.tin,
        upi: orgs.upi,
        districtId: orgs.districtId,
        districtName: districts.name,
        sectorName: sectors.name,
        addressText: orgs.addressText,
        status: orgs.registrationStatus,
        waitingSince: orgs.updatedAt,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .where(and(eq(orgs.registrationStatus, input.stage), scope))
      .orderBy(orgs.updatedAt);
    return rows;
  }

  /** The districts inside a province, for a province-scoped grant. */
  async districtIdsInProvince(provinceId: number): Promise<number[]> {
    const rows = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(eq(districts.provinceId, provinceId));
    return rows.map((r) => r.id);
  }

  /** The province a district sits in, for a scope check on a single org. */
  async provinceIdForDistrict(districtId: number): Promise<number | null> {
    const [row] = await this.db
      .select({ provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.id, districtId))
      .limit(1);
    return row?.provinceId ?? null;
  }
}
