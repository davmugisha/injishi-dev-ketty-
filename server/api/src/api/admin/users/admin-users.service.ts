import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminUnclaimedStaysResponse,
  AdminPersonDetail,
  AdminUserListResponse,
  type AdminAccountStatus,
  type AdminKycState,
  type AdminOversightGrant,
  type AdminUserListQuery,
  type AdminUserMembership,
  type AdminUserRow,
} from '@injishi/contracts';

import { maskNationalId, maskPhone } from './mask-identity';
import {
  AdminUsersRepository,
  type AdminUnclaimedStayRow,
  type AdminUserBaseRow,
  type AdminUserMembershipRow,
  type AdminUserOversightRow,
} from './admin-users.repository';
import { RecordAccessService } from './record-access.service';

/** The contract's ceiling, restated where the clamp happens. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/**
 * The Users section of the admin console.
 *
 * TWO ROUTES, TWO VERY DIFFERENT DISCLOSURES. The directory is a PII read and
 * is reason-gated and logged; unclaimed stays is an operational queue about
 * rows nobody owns, and INTERFACE.md marks only the first as PII. That split is
 * copied from the interface deliberately rather than re-decided here.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly repo: AdminUsersRepository,
    private readonly access: RecordAccessService,
  ) {}

  /**
   * The user directory.
   *
   * The order of operations is the point: read the page, WRITE THE TRAIL, then
   * answer. `recordRead` is awaited before the response is built, so a failure
   * to log is a failure to disclose rather than a silent disclosure.
   */
  async listUsers(
    query: AdminUserListQuery,
    actorUserId: string,
    reason: string,
  ): Promise<AdminUserListResponse> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    const [total, base] = await Promise.all([
      this.repo.countUsers(query),
      this.repo.listUsers(query, pageSize, offset),
    ]);

    const ids = base.map((row) => row.id);

    // `national_id` and not `contact`, even though the row also carries a
    // masked phone. The trail has to name the STRONGEST class disclosed, or a
    // later retention review counts a government-number read as a phonebook
    // lookup and under-states what staff have seen.
    await this.access.recordRead({
      actorUserId,
      subjectUserIds: ids,
      dataClass: 'national_id',
      reason,
    });

    const [roles, memberships, staff, oversight, custom] = await Promise.all([
      this.repo.globalRolesFor(ids),
      this.repo.membershipsFor(ids),
      this.repo.staffRolesFor(ids),
      this.repo.oversightFor(ids),
      this.repo.customRolesFor(ids),
    ]);

    const customByUser = new Map<string, AdminUserRow['customRoles']>();
    for (const row of custom) {
      const list = customByUser.get(row.userId) ?? [];
      list.push({ id: row.id, name: row.name });
      customByUser.set(row.userId, list);
    }

    const rolesByUser = new Map<string, AdminUserRow['globalRoles']>();
    for (const row of roles) {
      const list = rolesByUser.get(row.userId) ?? [];
      list.push(row.globalRole);
      rolesByUser.set(row.userId, list);
    }

    const membershipsByUser = new Map<string, AdminUserMembership[]>();
    for (const row of memberships) {
      const list = membershipsByUser.get(row.userId) ?? [];
      list.push(toMembership(row));
      membershipsByUser.set(row.userId, list);
    }

    const staffByUser = new Map<string, AdminUserRow['staffRoles']>();
    for (const row of staff) staffByUser.set(row.userId, row.staffRoles);

    // Newest grant wins, and the repository already ordered by `granted_at`
    // descending — so the FIRST row seen for a user is the one kept and later
    // ones are dropped. The contract carries one seat; a person holding two
    // active assignments is shown the one they most recently received.
    const oversightByUser = new Map<string, AdminOversightGrant>();
    for (const row of oversight) {
      if (!oversightByUser.has(row.userId)) {
        oversightByUser.set(row.userId, toOversightGrant(row));
      }
    }

    const items: AdminUserRow[] = base.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      kyc: toKycState(row.kycStatus),
      phoneMasked: maskPhone(row.phoneE164),
      nationalIdMasked: maskNationalId(row.nationalId),
      globalRoles: rolesByUser.get(row.id) ?? [],
      memberships: membershipsByUser.get(row.id) ?? [],
      staffRoles: staffByUser.get(row.id) ?? [],
      customRoles: customByUser.get(row.id) ?? [],
      oversight: oversightByUser.get(row.id) ?? null,
      twoFactorEnrolled: isTwoFactorEnrolled(row),
      status: toStatus(row),
      lastSignInAt: toIso(row.lastSignInAt),
      createdAt: row.createdAt.toISOString(),
    }));

    // Parsed, not cast. A shape defect here is a programming error and a 500 is
    // the honest answer to it; sending a half-right row would let the console
    // render a person's authority wrongly and never say so.
    return AdminUserListResponse.parse({
      items,
      meta: { total, page, pageSize },
    });
  }

  /**
   * One person, with every authority they hold (`GET /admin/users/:userId`).
   *
   * The same trail rule as the directory: the read is recorded before it is
   * answered. Every government seat is returned, not the newest one, because
   * this page is where a staffer ends one of several.
   */
  async getUser(userId: string, actorUserId: string, reason: string): Promise<AdminPersonDetail> {
    const row = await this.repo.userById(userId);
    if (!row) throw new NotFoundException('No user has that id.');
    await this.access.recordRead({ actorUserId, subjectUserIds: [userId], dataClass: 'national_id', reason });
    const ids = [userId];
    const [roles, memberships, staff, oversight, custom] = await Promise.all([
      this.repo.globalRolesFor(ids),
      this.repo.membershipsFor(ids),
      this.repo.staffRolesFor(ids),
      this.repo.oversightFor(ids),
      this.repo.customRolesFor(ids),
    ]);
    const grants = oversight.map(toOversightGrant);
    return AdminPersonDetail.parse({
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      kyc: toKycState(row.kycStatus),
      phoneMasked: maskPhone(row.phoneE164),
      nationalIdMasked: maskNationalId(row.nationalId),
      globalRoles: roles.map((r) => r.globalRole),
      memberships: memberships.map(toMembership),
      staffRoles: staff[0]?.staffRoles ?? [],
      customRoles: custom.map((c) => ({ id: c.id, name: c.name })),
      oversight: grants[0] ?? null,
      oversightGrants: grants,
      twoFactorEnrolled: isTwoFactorEnrolled(row),
      status: toStatus(row),
      lastSignInAt: toIso(row.lastSignInAt),
      createdAt: row.createdAt.toISOString(),
    });
  }

  /**
   * Stays nobody claimed.
   *
   * NOT PAGED BY THE CALLER, because `@injishi/contracts` defines no
   * `AdminUnclaimedStaysQuery` and this leaf may not invent one — inventing a
   * query shape here would put a second definition of a wire contract outside
   * the package that owns them all. `meta.total` still reports the TRUE count,
   * so the console can say "25 of 812" and know it is not seeing everything.
   */
  async listUnclaimedStays(): Promise<AdminUnclaimedStaysResponse> {
    const page = 1;
    const pageSize = DEFAULT_PAGE_SIZE;

    const [total, rows] = await Promise.all([
      this.repo.countUnclaimedStays(),
      this.repo.listUnclaimedStays(pageSize, 0),
    ]);

    const items = rows.map((row) => ({
      stayId: row.stayId,
      reference: toReference(row),
      propertyName: row.propertyName,
      // The account name is preferred and the captured walk-in name is the
      // fallback, the same order every other reader of `guest_stays` uses: an
      // account stays current when the person renames themselves.
      guestName: row.accountName ?? row.walkInName,
      checkOutAt: row.checkOutAt ? row.checkOutAt.toISOString() : null,
      identityState: toIdentityState(row),
    }));

    return AdminUnclaimedStaysResponse.parse({
      items,
      meta: { total, page, pageSize },
    });
  }
}

/**
 * Four stored states, three listed ones.
 *
 * `unverified` and `rejected` BOTH project to `none`, and that is a decision
 * rather than a rounding error. A staffer scanning the directory is answering
 * one question — has this person proved who they are — and both values answer
 * it the same way. The difference between "never tried" and "was turned down"
 * is real and is read on the identity screen, where an officer is acting on it;
 * surfacing it here would put a fourth filter button on a list whose two
 * negative buckets mean the same thing to the person reading it.
 *
 * A user with NO `verified_identities` row also lands on `none`, via the null.
 */
function toKycState(
  status: 'unverified' | 'pending' | 'verified' | 'rejected' | null,
): AdminKycState {
  if (status === 'verified') return 'verified';
  if (status === 'pending') return 'pending';
  return 'none';
}

/**
 * Enrolled in step-up, from either of the two columns that record it.
 *
 * `user_profiles.two_factor_enrolled` is the person's own enrolment and
 * `admin_users.two_factor_enrolled` is the staff one. They are separate
 * columns because staff can be held to a rule ordinary users are not, but the
 * question this row answers is "does a second factor stand between an attacker
 * and this account", and either enrolment answers it yes.
 */
/** Suspended wins; otherwise "invited" until they have signed in once (a verified email). */
function toStatus(row: AdminUserBaseRow): AdminAccountStatus {
  if (row.suspended) return 'suspended';
  return row.emailVerified ? 'active' : 'invited';
}

/** A raw `max()` can come back as a string from the driver; either way, ISO or null. */
function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function isTwoFactorEnrolled(row: AdminUserBaseRow): boolean {
  return Boolean(row.profileTwoFactorEnrolled) || Boolean(row.staffTwoFactorEnrolled);
}

function toMembership(row: AdminUserMembershipRow): AdminUserMembership {
  return {
    orgId: row.orgId,
    orgName: row.orgName,
    domain: row.domain,
    orgRole: row.orgRole,
    // No matching `obo_registrations` row means this person did not register
    // on anybody's behalf, so nothing is locked. `false`, never null: the
    // contract asks whether payouts are held, and "no row" is a clear no.
    payoutLocked: row.payoutLocked ?? false,
  };
}

/**
 * `scopeLabel` is the resolved region name, and null for a country-level grant
 * because a country grant names no region at all — an empty string here would
 * read as "a region we failed to look up".
 */
function toOversightGrant(row: AdminUserOversightRow): AdminOversightGrant {
  const scopeLabel =
    row.scopeLevel === 'district'
      ? row.districtName
      : row.scopeLevel === 'province'
        ? row.provinceName
        : null;

  return {
    id: row.id,
    oversightRole: row.oversightRole,
    governmentBodyCode: row.governmentBodyCode,
    governmentBodyName: row.governmentBodyName,
    governmentTitle: row.governmentTitle,
    scopeLevel: row.scopeLevel,
    scopeLabel: scopeLabel ?? null,
  };
}

/**
 * Something a staffer can read out on the phone.
 *
 * A WALK-IN HAS NO BOOKING, so it has no booking reference; the stay's claim
 * code is the handle it was given instead. Where neither exists — a walk-in
 * recorded before a claim code was minted — the stay's own id is used. That is
 * not an invented reference: it is the row's real identity, and it is the only
 * remaining true handle on a record the contract requires a string for.
 */
function toReference(row: AdminUnclaimedStayRow): string {
  return row.bookingReference ?? row.claimCode ?? row.stayId;
}

/**
 * Whether anyone recorded who was actually in the room.
 *
 * DERIVED FROM TWO FACTS, and there is no column holding it. `stay_identities`
 * presence answers "was a document captured"; `guest_stays.is_verified`
 * answers "was it checked". No capture means `none` REGARDLESS of the verified
 * flag — there is nothing captured for a flag to have verified, and reporting
 * `verified` for an empty capture would tell a compliance reviewer a document
 * exists that does not.
 *
 * This is a different question from `claim_status`, which is about who OWNS the
 * stay rather than who was in the room.
 */
function toIdentityState(
  row: AdminUnclaimedStayRow,
): 'none' | 'captured' | 'verified' {
  if (!row.identityCaptured) return 'none';
  return row.isVerified ? 'verified' : 'captured';
}
