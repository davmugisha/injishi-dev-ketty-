import type {
  Domain,
  OrgRegistrationStatus,
  RegistrationBusinessType,
  RegistrationRejectionReason,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';

import { storedObjects } from '../../../database/drizzle/hospitality';
import {
  auditEvents,
  districts,
  oboRegistrations,
  orgCertificates,
  orgInvitations,
  orgRegistrationReviews,
  orgMemberships,
  orgs,
  oversightAssignments,
  properties,
  recordAccessLogs,
  registrationFees,
  sectors,
  subscriptionInvoices,
  tinVerifications,
  users,
  verifiedIdentities,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  claimInvitationExpiresAt,
  newClaimToken,
} from '../domain/owner-claim';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { insertPropertyWithListing } from '../../listing-setup/infrastructure/insert-property';
import {
  recordRegistrationEvent,
  type RegistrationMover,
} from './registration-events';
import {
  insertPsfApplication,
  insertSelfDeclaredMembership,
  type NewPsfApplication,
} from './psf-membership.repository';
import { pendingTinAttemptsSql } from './tin-recheck.sql';

/** A TIN that already belongs to another org (KYB dedup, F-S03 §9). */
export class DuplicateTinError extends Error {
  constructor() {
    super('An organization with this TIN already exists.');
  }
}

/** What the officer queue shows about a business beyond its own row. */
export interface QueueEvidence {
  onBehalfOf: boolean;
  certificates: { kind: string; kindOther: string | null; certificateNumber: string | null }[];
  registrantUserId: string | null;
  registrantName: string | null;
  intendedOwnerName: string | null;
  tinCheck: {
    result: 'pending' | 'verified' | 'failed';
    adapterMode: 'mock' | 'live';
    checkedAt: string;
  } | null;
}

/** No effective fee row for this business type — nothing can be quoted. */
export class MissingFeeError extends Error {
  constructor(readonly businessType: RegistrationBusinessType) {
    super(`No registration fee is configured for ${businessType}.`);
  }
}

/** Rolls a settle back when the org moved but no invoice was pending. */
class NothingToSettle extends Error {}

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
  /** D24, optional: the finest level of the address, or null when unanswered. */
  villageId: number | null;
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
  /**
   * The locations to write as `properties` rows in the create transaction
   * (ADR-054 AC-R2): the head office first, then each declared branch. Empty
   * for a residence, which registers no property.
   */
  branches: {
    name: string;
    sectorId: number;
    /** Derived from the sector by the service, never taken from the request. */
    districtId: number;
    street: string | null;
    isHeadOffice: boolean;
  }[];
  /**
   * A PSF membership application the registration carries (ADR-056 AC-6),
   * written in the create transaction through the one shared insert. Null
   * when the registrant did not apply.
   */
  psfApplication: Omit<NewPsfApplication, 'orgId'> | null;
  /** A Yes with a membership number (ADR-056 AC-7). Null otherwise. */
  psfMembershipNumber: string | null;
}

export interface CreatedOrg {
  orgId: string;
  workspaceId: string;
  invoiceId: string;
  amountDueRwf: number;
  /** True when this registration was made on behalf of someone (FL02). */
  obo: boolean;
  /**
   * The claim invitation written in the create transaction, for the caller to
   * mail AFTER it commits (ADR-053). Null for an owner registration, and for an
   * OBO one that gave no owner email, because there is nowhere to send it.
   */
  claimInvitation: {
    email: string;
    token: string;
    expiresAt: Date;
    intendedOwnerName: string;
  } | null;
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
  /**
   * Whether a business on the platform already holds this TIN. The same
   * question `createRegistration` asks before inserting, asked early so the
   * Business step can say so while the TIN is still editable.
   */
  async tinTaken(tin: string): Promise<boolean> {
    const [clash] = await this.db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.tin, tin))
      .limit(1);
    return Boolean(clash);
  }

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
          villageId: input.villageId,
          addressText: input.addressText,
          registrationStatus: 'pending_payment',
        })
        .returning({ id: orgs.id });
      if (!org) throw new Error('Org insert returned no row.');

      // The FIRST event, and the only one with no `from` (ADR-053, AC-R6). It is
      // what bounds the `pending_payment` wait, which nothing could measure
      // before because nothing recorded when the business arrived.
      await recordRegistrationEvent(tx, {
        orgId: org.id,
        from: null,
        to: 'pending_payment',
        mover: { trigger: 'registrant', actorUserId: input.ownerUserId },
      });

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

      // ADR-056: PSF membership, committed or rolled back with the business.
      if (input.psfApplication) {
        await insertPsfApplication(tx, { ...input.psfApplication, orgId: org.id });
      }
      if (input.psfMembershipNumber) {
        await insertSelfDeclaredMembership(tx, {
          orgId: org.id,
          membershipNumber: input.psfMembershipNumber,
          recordedByUserId: input.ownerUserId,
        });
      }

      // ADR-054 AC-R2: one property per location, in THIS transaction, so the
      // branches commit or roll back with the org. They go through the same
      // insert Setup uses, so each starts with a draft listing and seeded
      // departments exactly as a property added after approval does.
      for (const branch of input.branches) {
        await insertPropertyWithListing(tx, {
          orgId: org.id,
          workspaceId: workspace.id,
          name: branch.name,
          sectorId: branch.sectorId,
          districtId: branch.districtId,
          street: branch.street,
          isHeadOffice: branch.isHeadOffice,
        });
      }

      if (input.certificates.length > 0) {
        await tx.insert(orgCertificates).values(
          input.certificates.map((c) => ({ orgId: org.id, ...c })),
        );
      }

      let claimInvitation: CreatedOrg['claimInvitation'] = null;
      if (input.obo) {
        // The claim invitation, in the create transaction (ADR-053, AC-R1). A
        // registration that exists always has the invitation that lets its
        // owner reach it, and one that rolled back has none. It is MAILED by the
        // caller after commit, so a mail that fails cannot undo a registration.
        //
        // No email, no invitation: there is nowhere to send one. Such a
        // registration cannot be claimed until one is issued by hand.
        let claimInvitationId: string | null = null;
        const email = input.obo.intendedOwnerEmail;
        if (email) {
          const token = newClaimToken();
          const expiresAt = claimInvitationExpiresAt(new Date());
          const [invitation] = await tx
            .insert(orgInvitations)
            .values({
              orgId: org.id,
              email,
              orgRole: 'owner',
              purpose: 'obo_claim',
              token,
              expiresAt,
            })
            .returning({ id: orgInvitations.id });
          if (!invitation) throw new Error('Invitation insert returned no row.');
          claimInvitationId = invitation.id;
          claimInvitation = {
            email,
            token,
            expiresAt,
            intendedOwnerName: input.obo.intendedOwnerName,
          };
        }

        // `payout_locked` and `claim_status` take their defaults on purpose:
        // registrant_held and locked is what an unclaimed OBO registration IS,
        // and restating a default here is a second place for it to drift.
        await tx.insert(oboRegistrations).values({
          orgId: org.id,
          registrantUserId: input.ownerUserId,
          intendedOwnerName: input.obo.intendedOwnerName,
          intendedOwnerNationalId: input.obo.intendedOwnerNationalId,
          intendedOwnerEmail: input.obo.intendedOwnerEmail,
          claimInvitationId,
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
        obo: input.obo !== null,
        claimInvitation,
      };
    });
  }

  /**
   * The district each sector sits in, keyed by sector id. A sector that does
   * not exist is absent from the map, which the caller refuses.
   */
  async districtsForSectors(sectorIds: number[]): Promise<Map<number, number>> {
    if (sectorIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: sectors.id, districtId: sectors.districtId })
      .from(sectors)
      .where(inArray(sectors.id, [...new Set(sectorIds)]));
    return new Map(rows.map((r) => [r.id, r.districtId]));
  }

  /**
   * The name to show for a person: their verified legal name, else the name on
   * their account, else null. Never a document number or an email.
   */
  async displayNameFor(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({
        legalFullName: verifiedIdentities.legalFullName,
        name: users.name,
      })
      .from(users)
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row?.legalFullName?.trim() || row?.name?.trim() || null;
  }

  /**
   * Settle the registration fee and advance the org, in one transaction.
   *
   * Conditional on the org still being at `pending_payment` WITH an accepted
   * operator contract, and on the invoice still being pending, so a duplicated
   * payment callback cannot advance an org twice or bill it twice. Returns false
   * when a guard did not match, which the caller reads as "already done" or, when
   * the contract is still open, as the refusal it is.
   *
   * The contract condition is inside the statement rather than only checked
   * beforehand (ADR-053, AC-R13). Settling is the only door into `submitted`, so
   * this is what makes an officer's queue unreachable without an accepted
   * contract; a check before the write could lose a race to nothing, but a
   * condition on the write cannot.
   *
   * The org moves FIRST and the invoice second. The other way round, an org
   * refused on its contract would still have committed a paid invoice, because
   * returning from a transaction commits whatever it already wrote.
   */
  async settleRegistrationFee(
    orgId: string,
    actorUserId: string,
  ): Promise<boolean> {
    try {
      return await this.db.transaction(async (tx) => {
        const advanced = await tx
          .update(orgs)
          .set({ registrationStatus: 'submitted', updatedAt: new Date() })
          .where(
            and(
              eq(orgs.id, orgId),
              eq(orgs.registrationStatus, 'pending_payment'),
              isNotNull(orgs.contractVersion),
            ),
          )
          .returning({ id: orgs.id });
        if (advanced.length === 0) return false;

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
        // An org at `pending_payment` with no pending invoice is not a state any
        // writer produces. Undo the move rather than submit a business nobody paid
        // for.
        if (paid.length === 0) throw new NothingToSettle();

        // The registrant paying is what moved it. When a real payment callback
        // replaces this stand in, the mover becomes `system` in the same line.
        await recordRegistrationEvent(tx, {
          orgId,
          from: 'pending_payment',
          to: 'submitted',
          mover: { trigger: 'registrant', actorUserId },
        });
        return true;
      });
    } catch (error) {
      if (error instanceof NothingToSettle) return false;
      throw error;
    }
  }

  /**
   * Record the operator contract acceptance, once (ADR-053, AC-R8).
   *
   * One conditional update: it writes only while no acceptance is recorded and
   * the org is still at `pending_payment`. So a double press, a retried request
   * or a press that lands after paying cannot move `contract_accepted_at`, and
   * the first acceptance is the one that stands. Returns whether this call wrote.
   */
  async acceptContract(input: {
    orgId: string;
    userId: string;
    contractVersion: string;
  }): Promise<boolean> {
    const rows = await this.db
      .update(orgs)
      .set({
        contractVersion: input.contractVersion,
        contractAcceptedAt: new Date(),
        contractAcceptedByUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orgs.id, input.orgId),
          eq(orgs.registrationStatus, 'pending_payment'),
          isNull(orgs.contractVersion),
        ),
      )
      .returning({ id: orgs.id });
    return rows.length > 0;
  }

  /**
   * Whether this org's payouts are locked on an unclaimed or unverified owner.
   * Null when nobody registered it on behalf of anyone (ADR-053, AC-R1).
   */
  async payoutLockedFor(orgId: string): Promise<boolean | null> {
    const [row] = await this.db
      .select({ payoutLocked: oboRegistrations.payoutLocked })
      .from(oboRegistrations)
      .where(eq(oboRegistrations.orgId, orgId))
      .limit(1);
    return row?.payoutLocked ?? null;
  }

  /**
   * Every business held on an unanswered RRA check, and its attempt count
   * (ADR-053, AC-R5). Read through `pendingTinAttemptsSql`, the one definition
   * admin's stalled flag also reads.
   */
  async pendingTinRechecks(): Promise<
    { orgId: string; attempts: number; lastCheckedAt: Date | null }[]
  > {
    type Row = {
      org_id: string;
      attempts: number;
      last_checked_at: string | Date | null;
    };
    const result = await this.db.execute<Row>(
      sql`select * from (${pendingTinAttemptsSql()}) as pending`,
    );
    // node-postgres puts the rows on `.rows`; some drivers return the array.
    const rows: Row[] = Array.isArray(result)
      ? result
      : ((result as { rows?: Row[] }).rows ?? []);

    return rows.map((r) => ({
      orgId: r.org_id,
      attempts: Number(r.attempts),
      lastCheckedAt:
        r.last_checked_at === null ? null : new Date(r.last_checked_at),
    }));
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
    mover: RegistrationMover,
  ): Promise<boolean> {
    // A transaction now, where it used to be one bare UPDATE: the move and its
    // event row are one act (ADR-053, AC-R6), and a crash between two separate
    // statements would leave a status nobody can say how long it has held.
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(orgs)
        .set({ registrationStatus: to, updatedAt: new Date() })
        .where(and(eq(orgs.id, orgId), eq(orgs.registrationStatus, from)))
        .returning({ id: orgs.id });
      if (rows.length === 0) return false;

      await recordRegistrationEvent(tx, { orgId, from, to, mover });
      return true;
    });
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
        contractVersion: string | null;
        contractAcceptedAt: Date | null;
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
        contractVersion: orgs.contractVersion,
        contractAcceptedAt: orgs.contractAcceptedAt,
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

      await recordRegistrationEvent(tx, {
        orgId: input.orgId,
        from: input.stage,
        to: input.to,
        mover: { trigger: 'officer', actorUserId: input.decidedByUserId },
      });

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
        const activated = await tx
          .update(orgs)
          .set({ registrationStatus: 'active', updatedAt: new Date() })
          .where(
            and(eq(orgs.id, input.orgId), eq(orgs.registrationStatus, 'approved')),
          )
          .returning({ id: orgs.id });
        // Two moves, two rows. The approver's decision is what activates the
        // business, so the second row names the same officer rather than the
        // system: nothing automatic happened in between.
        if (activated.length > 0) {
          await recordRegistrationEvent(tx, {
            orgId: input.orgId,
            from: 'approved',
            to: 'active',
            mover: { trigger: 'officer', actorUserId: input.decidedByUserId },
          });
        }
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
  /**
   * Does this person hold a live role in this business? (ADR-053, AC-G3)
   *
   * The act-time half of the conflict of interest rule. The grant-time check
   * refuses an appointment to somebody who already holds an org role inside the
   * scope, and it CANNOT cover this direction: a person granted first can acquire
   * the role afterwards, by being added to a business a week later.
   *
   * Asked regardless of scope. An officer may not gate their own business even if
   * it somehow sits outside the region they cover, because the objection is the
   * interest, not the geography.
   */
  async holdsOrgRole(orgId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.status, 'active'),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

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
   * The branches each org declared, keyed by org id (ADR-054 AC-R4).
   *
   * Active branches only, head office first then by name, with the district
   * name so an officer sees where each one is. One query for the whole queue
   * rather than one per row.
   */
  async branchesForOrgs(
    orgIds: string[],
  ): Promise<Map<string, { name: string; districtName: string | null; isHeadOffice: boolean }[]>> {
    const byOrg = new Map<string, { name: string; districtName: string | null; isHeadOffice: boolean }[]>();
    if (orgIds.length === 0) return byOrg;
    const rows = await this.db
      .select({
        orgId: properties.orgId,
        name: properties.name,
        districtName: districts.name,
        isHeadOffice: properties.isHeadOffice,
      })
      .from(properties)
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(and(inArray(properties.orgId, orgIds), isNull(properties.archivedAt)))
      .orderBy(desc(properties.isHeadOffice), properties.name);
    for (const { orgId, ...branch } of rows) {
      const list = byOrg.get(orgId) ?? [];
      list.push(branch);
      byOrg.set(orgId, list);
    }
    return byOrg;
  }

  /**
   * What each queued business declared beyond its own row: the certificates
   * it attached (metadata, never the file), whether an agent registered it for
   * its owner, who registered it, and the newest RRA answer on record
   * (ADR-059, ADR-060). One read per concern for the whole page, like
   * `branchesForOrgs`.
   */
  async queueEvidenceFor(orgIds: string[]): Promise<Map<string, QueueEvidence>> {
    const out = new Map<string, QueueEvidence>();
    if (orgIds.length === 0) return out;
    for (const id of orgIds) {
      out.set(id, {
        onBehalfOf: false,
        certificates: [],
        registrantUserId: null,
        registrantName: null,
        intendedOwnerName: null,
        tinCheck: null,
      });
    }

    const certificates = await this.db
      .select({
        orgId: orgCertificates.orgId,
        kind: orgCertificates.kind,
        kindOther: orgCertificates.kindOther,
        certificateNumber: orgCertificates.certificateNumber,
      })
      .from(orgCertificates)
      .where(inArray(orgCertificates.orgId, orgIds))
      .orderBy(orgCertificates.createdAt);
    for (const { orgId, ...certificate } of certificates) {
      out.get(orgId)?.certificates.push(certificate);
    }

    const obo = await this.db
      .select({
        orgId: oboRegistrations.orgId,
        registrantUserId: oboRegistrations.registrantUserId,
        intendedOwnerName: oboRegistrations.intendedOwnerName,
      })
      .from(oboRegistrations)
      .where(inArray(oboRegistrations.orgId, orgIds));
    for (const row of obo) {
      const entry = out.get(row.orgId);
      if (!entry) continue;
      entry.onBehalfOf = true;
      entry.registrantUserId = row.registrantUserId;
      entry.intendedOwnerName = row.intendedOwnerName;
    }

    // Who registered the rest: the first owner membership, which the create
    // transaction wrote for the registrant (ADR-060).
    const owners = await this.db
      .select({ orgId: orgMemberships.orgId, userId: orgMemberships.userId })
      .from(orgMemberships)
      .where(and(inArray(orgMemberships.orgId, orgIds), eq(orgMemberships.orgRole, 'owner')))
      .orderBy(orgMemberships.createdAt);
    for (const row of owners) {
      const entry = out.get(row.orgId);
      if (entry && entry.registrantUserId === null) entry.registrantUserId = row.userId;
    }

    const registrantIds = [...new Set([...out.values()].map((e) => e.registrantUserId).filter((id): id is string => id !== null))];
    if (registrantIds.length > 0) {
      const names = await this.db
        .select({
          userId: users.id,
          legalFullName: verifiedIdentities.legalFullName,
          name: users.name,
        })
        .from(users)
        .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
        .where(inArray(users.id, registrantIds));
      const byId = new Map(names.map((n) => [n.userId, n.legalFullName?.trim() || n.name?.trim() || null]));
      for (const entry of out.values()) {
        if (entry.registrantUserId) entry.registrantName = byId.get(entry.registrantUserId) ?? null;
      }
    }

    // The newest RRA answer per business, with the side of the seam that gave it.
    const checks = await this.db
      .selectDistinctOn([tinVerifications.orgId], {
        orgId: tinVerifications.orgId,
        result: tinVerifications.result,
        adapterMode: tinVerifications.adapterMode,
        checkedAt: tinVerifications.checkedAt,
      })
      .from(tinVerifications)
      .where(inArray(tinVerifications.orgId, orgIds))
      .orderBy(tinVerifications.orgId, desc(tinVerifications.checkedAt));
    for (const check of checks) {
      const entry = out.get(check.orgId);
      if (entry) {
        entry.tinCheck = {
          result: check.result,
          adapterMode: check.adapterMode,
          checkedAt: check.checkedAt.toISOString(),
        };
      }
    }
    return out;
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
  // -------------------------------------------------------------------------
  // Registration documents (F-S03 §5)
  // -------------------------------------------------------------------------

  /**
   * Every document one registration carries, with the object behind it.
   *
   * A LEFT join to `stored_objects`, deliberately: a certificate row can name an
   * object that is no longer there, and the officer has to be told that rather
   * than shown a row that looks complete. `objectKey` comes back so the caller
   * can mint a signed url; nothing else in the answer depends on storage.
   */
  async documentsForOrg(orgId: string): Promise<
    {
      id: string;
      kind: string;
      kindOther: string | null;
      certificateNumber: string | null;
      issuedBy: string | null;
      issuedOn: string | null;
      expiresOn: string | null;
      objectKey: string | null;
      mime: string | null;
      sizeBytes: number | null;
      objectPresent: boolean;
      checkedAt: Date | null;
      checkedByName: string | null;
    }[]
  > {
    const rows = await this.db
      .select({
        id: orgCertificates.id,
        kind: orgCertificates.kind,
        kindOther: orgCertificates.kindOther,
        certificateNumber: orgCertificates.certificateNumber,
        issuedBy: orgCertificates.issuedBy,
        issuedOn: orgCertificates.issuedOn,
        expiresOn: orgCertificates.expiresOn,
        objectKey: orgCertificates.objectKey,
        mime: storedObjects.mime,
        sizeBytes: storedObjects.sizeBytes,
        objectId: storedObjects.id,
        checkedAt: orgCertificates.verifiedAt,
        checkedByName: users.name,
      })
      .from(orgCertificates)
      .leftJoin(storedObjects, eq(storedObjects.objectKey, orgCertificates.objectKey))
      .leftJoin(users, eq(users.id, orgCertificates.verifiedByUserId))
      .where(eq(orgCertificates.orgId, orgId))
      .orderBy(orgCertificates.createdAt, orgCertificates.id);

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      kindOther: r.kindOther,
      certificateNumber: r.certificateNumber,
      issuedBy: r.issuedBy,
      issuedOn: r.issuedOn,
      expiresOn: r.expiresOn,
      objectKey: r.objectKey,
      mime: r.mime,
      sizeBytes: r.sizeBytes,
      objectPresent: r.objectId !== null,
      checkedAt: r.checkedAt,
      checkedByName: r.checkedByName,
    }));
  }

  /**
   * Record that a field verifier read one document (F-S03 §5).
   *
   * Scoped by `orgId` as well as by id, so a certificate id from another
   * registration cannot be stamped through a url the officer is allowed to
   * call. Writing only where `verified_at` is null keeps the FIRST officer's
   * name on it: a second press is not a correction, and a later officer reading
   * the same file must not quietly replace who checked it.
   */
  async markCertificateChecked(input: {
    certificateId: string;
    orgId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const rows = await this.db
      .update(orgCertificates)
      .set({ verifiedAt: new Date(), verifiedByUserId: input.actorUserId })
      .where(
        and(
          eq(orgCertificates.id, input.certificateId),
          eq(orgCertificates.orgId, input.orgId),
          isNull(orgCertificates.verifiedAt),
        ),
      )
      .returning({ id: orgCertificates.id });
    return rows.length > 0;
  }

  /** Does this certificate belong to this registration at all? */
  async certificateBelongsTo(certificateId: string, orgId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orgCertificates.id })
      .from(orgCertificates)
      .where(and(eq(orgCertificates.id, certificateId), eq(orgCertificates.orgId, orgId)))
      .limit(1);
    return Boolean(row);
  }

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
      tourismLicenseNumber: string | null;
      status: OrgRegistrationStatus;
      waitingSince: Date;
      documentCount: number;
      uncheckedDocumentCount: number;
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
        tourismLicenseNumber: orgs.tourismLicenseNumber,
        status: orgs.registrationStatus,
        waitingSince: orgs.updatedAt,
        // Counted in the list query rather than by a read per row: the console
        // flags a document gap on every row it draws.
        documentCount: sql<number>`(
          select count(*) from ${orgCertificates}
           where ${orgCertificates.orgId} = ${orgs.id}
        )::int`,
        uncheckedDocumentCount: sql<number>`(
          select count(*) from ${orgCertificates}
           where ${orgCertificates.orgId} = ${orgs.id}
             and ${orgCertificates.verifiedAt} is null
        )::int`,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .where(and(eq(orgs.registrationStatus, input.stage), scope))
      .orderBy(orgs.updatedAt);
    return rows;
  }

  /**
   * The districts of each named province, in one read, for
   * `districtScopeOf` (ADR-053, AC-G8). An empty list asks nothing.
   */
  async districtsByProvince(
    provinceIds: readonly number[],
  ): Promise<Map<number, number[]>> {
    const out = new Map<number, number[]>();
    if (provinceIds.length === 0) return out;
    const rows = await this.db
      .select({ id: districts.id, provinceId: districts.provinceId })
      .from(districts)
      .where(inArray(districts.provinceId, [...provinceIds]));
    for (const r of rows) {
      out.set(r.provinceId, [...(out.get(r.provinceId) ?? []), r.id]);
    }
    return out;
  }

  /**
   * One officer's own decisions, newest first, keyset paged on
   * (decided_at, id) (ADR-053, AC-G6).
   *
   * The body and title are the review row's own columns, copied when the
   * decision was recorded, and deliberately not joined from the assignment: a
   * revoked posting must not rewrite what was decided under it.
   */
  async decisionsBy(input: {
    userId: string;
    before: { decidedAt: Date; id: string } | undefined;
    limit: number;
  }): Promise<{
    rows: {
      id: string;
      orgId: string;
      legalName: string;
      stage: 'tin_verified' | 'field_verified';
      decision: 'passed' | 'rejected';
      reasonCode: RegistrationRejectionReason | null;
      notes: string | null;
      governmentBodyCode: string;
      governmentTitle: string | null;
      decidedAt: Date;
    }[];
    more: boolean;
  }> {
    const rows = await this.db
      .select({
        id: orgRegistrationReviews.id,
        orgId: orgRegistrationReviews.orgId,
        legalName: orgs.legalName,
        stage: orgRegistrationReviews.stage,
        decision: orgRegistrationReviews.decision,
        reasonCode: orgRegistrationReviews.reasonCode,
        notes: orgRegistrationReviews.notes,
        governmentBodyCode: orgRegistrationReviews.governmentBodyCode,
        governmentTitle: orgRegistrationReviews.governmentTitle,
        decidedAt: orgRegistrationReviews.decidedAt,
      })
      .from(orgRegistrationReviews)
      .innerJoin(orgs, eq(orgs.id, orgRegistrationReviews.orgId))
      .where(
        and(
          eq(orgRegistrationReviews.decidedByUserId, input.userId),
          input.before
            ? sql`(${orgRegistrationReviews.decidedAt}, ${orgRegistrationReviews.id}) < (${input.before.decidedAt}, ${input.before.id}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(orgRegistrationReviews.decidedAt), desc(orgRegistrationReviews.id))
      .limit(input.limit + 1);
    return {
      rows: rows.slice(0, input.limit) as never,
      more: rows.length > input.limit,
    };
  }

  /**
   * Record that an officer read their decision log. The subject is the log
   * itself, not one business, so `subject_ref` is null: a row per business on
   * the page would bury the reads that matter under paging.
   */
  async logDecisionLogRead(actorUserId: string): Promise<void> {
    await this.db.insert(recordAccessLogs).values({
      actorUserId,
      subjectUserId: actorUserId,
      subjectRef: null,
      // Registration decisions and the notes written on a business's file.
      dataClass: 'contract',
      reason: 'oversight decision log',
    });
  }

  // -------------------------------------------------------------------------
  // Registration mail recipients and facts. Read at send time, after the move
  // committed, so a mail describes the business as it now is.
  // -------------------------------------------------------------------------

  /** What a registration mail names: the business, where it is, its workspace. */
  async registrationMailFacts(orgId: string): Promise<{
    legalName: string;
    tin: string | null;
    districtId: number | null;
    districtName: string | null;
    sectorName: string | null;
    workspaceId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        tin: orgs.tin,
        districtId: orgs.districtId,
        districtName: districts.name,
        sectorName: sectors.name,
        workspaceId: workspaces.id,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .leftJoin(workspaces, eq(workspaces.orgId, orgs.id))
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Every live owner of this business and the address to mail them at. For an
   * OBO registration that is the registrant, who holds the owner membership
   * until the claim.
   */
  async activeOwnerRecipients(
    orgId: string,
  ): Promise<{ userId: string; email: string; name: string | null }[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        legalFullName: verifiedIdentities.legalFullName,
        name: users.name,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.orgRole, 'owner'),
          eq(orgMemberships.status, 'active'),
          isNull(orgMemberships.removedAt),
        ),
      );
    return rows
      .filter((r) => Boolean(r.email))
      .map((r) => ({
        userId: r.userId,
        email: r.email,
        name: r.legalFullName?.trim() || r.name?.trim() || null,
      }));
  }

  /**
   * Every unrevoked assignment for one oversight function, with its officer.
   * Region is NOT applied here: the caller reads it through `districtScopeOf`,
   * the one definition, exactly as the gate does.
   */
  async activeOversightAssignments(
    role: 'business_field_verifier' | 'business_approver',
  ): Promise<{
    userId: string;
    email: string;
    name: string | null;
    scopeLevel: 'country' | 'province' | 'district';
    provinceId: number | null;
    districtId: number | null;
  }[]> {
    const rows = await this.db
      .select({
        userId: oversightAssignments.userId,
        email: users.email,
        legalFullName: verifiedIdentities.legalFullName,
        name: users.name,
        scopeLevel: oversightAssignments.scopeLevel,
        provinceId: oversightAssignments.provinceId,
        districtId: oversightAssignments.districtId,
      })
      .from(oversightAssignments)
      .innerJoin(users, eq(users.id, oversightAssignments.userId))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .where(
        and(
          eq(oversightAssignments.oversightRole, role),
          isNull(oversightAssignments.revokedAt),
        ),
      );
    return rows
      .filter((r) => Boolean(r.email))
      .map((r) => ({
        userId: r.userId,
        email: r.email,
        name: r.legalFullName?.trim() || r.name?.trim() || null,
        scopeLevel: r.scopeLevel,
        provinceId: r.provinceId,
        districtId: r.districtId,
      }));
  }
}
