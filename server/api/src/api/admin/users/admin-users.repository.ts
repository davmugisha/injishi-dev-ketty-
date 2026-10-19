import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  AdminKycState,
  AdminUserListQuery,
  GlobalRole,
  OrgRole,
  OversightRole,
  OversightScopeLevel,
  StaffRole,
} from '@injishi/contracts';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  adminUsers,
  bookings,
  districts,
  governmentBodies,
  guestStays,
  identityDocuments,
  oboRegistrations,
  orgMemberships,
  orgs,
  oversightAssignments,
  properties,
  provinces,
  rooms,
  stayIdentities,
  userProfiles,
  userRoles,
  users,
  verifiedIdentities,
} from '../../../database/drizzle/schema';
import type { Domain } from '@injishi/contracts';

/** One row of the directory before its side tables are attached. */
export interface AdminUserBaseRow {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  kycStatus: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
  phoneE164: string | null;
  /** The primary `identity_documents` number, falling back to the profile mirror. */
  nationalId: string | null;
  profileTwoFactorEnrolled: boolean | null;
  staffTwoFactorEnrolled: boolean | null;
  createdAt: Date;
}

export interface AdminUserRoleRow {
  userId: string;
  globalRole: GlobalRole;
}

export interface AdminUserMembershipRow {
  userId: string;
  orgId: string;
  orgName: string;
  domain: Domain;
  orgRole: OrgRole;
  payoutLocked: boolean | null;
}

export interface AdminUserStaffRow {
  userId: string;
  staffRoles: StaffRole[];
}

export interface AdminUserOversightRow {
  /** The assignment row, so a grant can be revoked by name (ADR-053, AC-G1). */
  id: string;
  userId: string;
  oversightRole: OversightRole;
  governmentBodyCode: string;
  /** `government_bodies.name_en`. The words a citizen knows the body by. */
  governmentBodyName: string | null;
  governmentTitle: string | null;
  scopeLevel: OversightScopeLevel;
  provinceName: string | null;
  districtName: string | null;
}

export interface AdminUnclaimedStayRow {
  stayId: string;
  bookingReference: string | null;
  claimCode: string | null;
  propertyName: string | null;
  accountName: string | null;
  walkInName: string | null;
  checkOutAt: Date | null;
  identityCaptured: boolean;
  isVerified: boolean;
}

/**
 * The only place the Users section touches Drizzle.
 *
 * Reads, never writes. The PII trail is written by `RecordAccessService`, which
 * is a separate object on purpose: a reader that could also write the log it is
 * audited by is one refactor away from writing it conditionally.
 */
@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The filter every user query shares, so the count and the page can never
   * disagree about which people are in the result. Built once and handed to
   * both; a second hand-written copy inside the count is how a header reading
   * "1-25 of 380" starts lying.
   */
  private userFilter(query: AdminUserListQuery): SQL | undefined {
    const clauses: SQL[] = [];

    if (query.q) {
      const pattern = `%${query.q}%`;
      // An OR over both columns rather than a concatenation: `name` is
      // nullable, `null || 'text'` is null in Postgres, and concatenating
      // would drop every unnamed account out of an email search.
      const match = or(ilike(users.name, pattern), ilike(users.email, pattern));
      if (match) clauses.push(match);
    }

    if (query.globalRole) {
      clauses.push(
        inArray(
          users.id,
          this.db
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(
              and(
                eq(userRoles.globalRole, query.globalRole),
                // A revoked grant is not a role. This is the predicate a
                // second copy of the query forgets, and forgetting it lists
                // people by an authority they no longer hold.
                isNull(userRoles.revokedAt),
              ),
            ),
        ),
      );
    }

    const kyc = this.kycFilter(query.kyc);
    if (kyc) clauses.push(kyc);

    return clauses.length ? and(...clauses) : undefined;
  }

  /**
   * The three-valued console filter projected back onto the four-valued column.
   *
   * `none` has to cover the ABSENCE of a `verified_identities` row as well as
   * `unverified` and `rejected`: a person who never started KYC has no row at
   * all, and a filter matching only the two enum values would hide the largest
   * group of exactly the people it was asked for.
   */
  private kycFilter(kyc: AdminKycState | undefined): SQL | undefined {
    if (!kyc) return undefined;
    if (kyc === 'verified') return eq(verifiedIdentities.kycStatus, 'verified');
    if (kyc === 'pending') return eq(verifiedIdentities.kycStatus, 'pending');
    return or(
      isNull(verifiedIdentities.kycStatus),
      inArray(verifiedIdentities.kycStatus, ['unverified', 'rejected']),
    );
  }

  /** How many people match, before paging. */
  async countUsers(query: AdminUserListQuery): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .where(this.userFilter(query));
    return row?.n ?? 0;
  }

  /** One page of the directory. */
  listUsers(
    query: AdminUserListQuery,
    limit: number,
    offset: number,
  ): Promise<AdminUserBaseRow[]> {
    return this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        kycStatus: verifiedIdentities.kycStatus,
        phoneE164: userProfiles.phoneE164,
        // The identity anchor first, the denormalized profile mirror second.
        // `user_profiles.national_id` is explicitly NOT the anchor (Decision A)
        // and is allowed to lag, so reading it alone would show a superseded
        // number as the current one.
        nationalId: sql<
          string | null
        >`coalesce(${identityDocuments.documentNumber}, ${userProfiles.nationalId})`,
        profileTwoFactorEnrolled: userProfiles.twoFactorEnrolled,
        staffTwoFactorEnrolled: adminUsers.twoFactorEnrolled,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      // At most one primary document per identity
      // (`identity_documents_primary_uk`), so this join cannot multiply a page.
      .leftJoin(
        identityDocuments,
        and(
          eq(identityDocuments.identityId, users.id),
          eq(identityDocuments.isPrimary, true),
        ),
      )
      .leftJoin(
        adminUsers,
        and(eq(adminUsers.userId, users.id), isNull(adminUsers.revokedAt)),
      )
      .where(this.userFilter(query))
      // `id` breaks the tie, so two accounts created in the same transaction
      // cannot swap places between page 1 and page 2 and hide one of
      // themselves from a staffer paging through.
      .orderBy(desc(users.createdAt), users.id)
      .limit(limit)
      .offset(offset);
  }

  /** Active global roles for the people on this page. */
  globalRolesFor(userIds: string[]): Promise<AdminUserRoleRow[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({ userId: userRoles.userId, globalRole: userRoles.globalRole })
      .from(userRoles)
      .where(
        and(inArray(userRoles.userId, userIds), isNull(userRoles.revokedAt)),
      );
  }

  /**
   * Active business memberships for the people on this page.
   *
   * `payoutLocked` is matched on BOTH the org and the registrant, because the
   * lock belongs to the person who registered on someone else's behalf and not
   * to the business. Joining on the org alone would mark every colleague of an
   * OBO registrant as payout-locked, which is a false accusation on a screen
   * staff act from.
   */
  membershipsFor(userIds: string[]): Promise<AdminUserMembershipRow[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({
        userId: orgMemberships.userId,
        orgId: orgs.id,
        orgName: orgs.legalName,
        domain: orgs.domain,
        orgRole: orgMemberships.orgRole,
        payoutLocked: oboRegistrations.payoutLocked,
      })
      .from(orgMemberships)
      .innerJoin(orgs, eq(orgs.id, orgMemberships.orgId))
      .leftJoin(
        oboRegistrations,
        and(
          eq(oboRegistrations.orgId, orgMemberships.orgId),
          eq(oboRegistrations.registrantUserId, orgMemberships.userId),
        ),
      )
      .where(
        and(
          inArray(orgMemberships.userId, userIds),
          // A removed membership is not a membership. The row survives for the
          // audit trail; this screen answers "where does this person work".
          eq(orgMemberships.status, 'active'),
        ),
      )
      .orderBy(orgs.legalName);
  }

  /** Staff roles, from the one table `/api/v1/me/staff` and `StaffGuard` read. */
  staffRolesFor(userIds: string[]): Promise<AdminUserStaffRow[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({ userId: adminUsers.userId, staffRoles: adminUsers.staffRoles })
      .from(adminUsers)
      .where(
        and(inArray(adminUsers.userId, userIds), isNull(adminUsers.revokedAt)),
      );
  }

  /**
   * Live government console seats, newest grant first.
   *
   * The row carries the RESOLVED province and district names rather than their
   * ids, because `scopeLabel` is the half of a seat a citizen would recognise
   * and the console must not need a second copy of the geography table to
   * render it.
   */
  oversightFor(userIds: string[]): Promise<AdminUserOversightRow[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({
        id: oversightAssignments.id,
        userId: oversightAssignments.userId,
        oversightRole: oversightAssignments.oversightRole,
        governmentBodyCode: oversightAssignments.governmentBodyCode,
        governmentBodyName: governmentBodies.nameEn,
        governmentTitle: oversightAssignments.governmentTitle,
        scopeLevel: oversightAssignments.scopeLevel,
        provinceName: provinces.name,
        districtName: districts.name,
      })
      .from(oversightAssignments)
      // The FK to `government_bodies` is what makes the code on a grant a real
      // institution rather than a typo, and a grant naming a body that no longer
      // exists should not read as a seat. ADR-053 also SELECTS its display name,
      // because a console that shows "PSF" where it should say "Private Sector
      // Federation" is showing a database value to a citizen.
      .innerJoin(
        governmentBodies,
        eq(governmentBodies.code, oversightAssignments.governmentBodyCode),
      )
      .leftJoin(provinces, eq(provinces.id, oversightAssignments.provinceId))
      .leftJoin(districts, eq(districts.id, oversightAssignments.districtId))
      .where(
        and(
          inArray(oversightAssignments.userId, userIds),
          isNull(oversightAssignments.revokedAt),
        ),
      )
      .orderBy(desc(oversightAssignments.grantedAt));
  }

  /**
   * How many stays nobody has claimed.
   *
   * `claim_status` is the whole predicate and the stay's LIFECYCLE deliberately
   * is not. An open stay with no account behind it is the same support case one
   * day earlier, which is also why `checkOutAt` is nullable on the contract
   * rather than a value every row is guaranteed to carry.
   */
  async countUnclaimedStays(): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(guestStays)
      .where(eq(guestStays.claimStatus, 'unclaimed'));
    return row?.n ?? 0;
  }

  /** One page of unclaimed stays, most recently departed first. */
  listUnclaimedStays(
    limit: number,
    offset: number,
  ): Promise<AdminUnclaimedStayRow[]> {
    const guestAccounts = alias(users, 'guest_accounts');
    return this.db
      .select({
        stayId: guestStays.id,
        bookingReference: bookings.reference,
        claimCode: guestStays.claimCode,
        propertyName: properties.name,
        accountName: guestAccounts.name,
        walkInName: guestStays.guestName,
        checkOutAt: guestStays.actualExitAt,
        // PRESENCE of the capture, not its contents. Nothing from
        // `stay_identities` itself crosses the wire: the console is told
        // whether a document was taken, never what it said.
        identityCaptured: sql<boolean>`${stayIdentities.id} is not null`,
        isVerified: guestStays.isVerified,
      })
      .from(guestStays)
      .leftJoin(bookings, eq(bookings.id, guestStays.bookingId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(guestAccounts, eq(guestAccounts.id, guestStays.guestUserId))
      // `guest_stay_id` is unique on `stay_identities`, so this cannot
      // duplicate a stay.
      .leftJoin(stayIdentities, eq(stayIdentities.guestStayId, guestStays.id))
      .where(eq(guestStays.claimStatus, 'unclaimed'))
      // Departed stays first, then the ones still open: a stay that ended is
      // the one with a retention clock already running on it.
      .orderBy(sql`${guestStays.actualExitAt} desc nulls last`, guestStays.id)
      .limit(limit)
      .offset(offset);
  }
}
