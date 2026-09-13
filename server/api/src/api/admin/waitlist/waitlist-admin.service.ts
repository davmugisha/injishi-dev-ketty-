import type {
  AdminWaitlistExportQuery,
  AdminWaitlistInviteResult,
  AdminWaitlistPage,
  AdminWaitlistQuery,
  AdminWaitlistRow,
} from '@injishi/contracts';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';

import { districts } from '../../../database/drizzle/geography';
import { waitlistSignups } from '../../../database/drizzle/waitlist';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The staff view of the waitlist (ADR-048 AC-17, AC-22).
 *
 * EVERYTHING THIS RETURNS IS OTHER PEOPLE'S PERSONAL DATA: names, email
 * addresses and phone numbers given to a pre-launch form under Rwanda's Law
 * 058/2021. Two consequences run through the whole file.
 *
 * First, the export and the invite each write a log line naming the staff
 * member, the action and the time (AC-22). ADR-048 records this as the weakest
 * part of its design and enrols a proper audit trail as its own feature.
 *
 * NOTE FOR WHOEVER PICKS THAT UP: the ADR's stated reason for settling on a log
 * line — that there is no audit log table in this repository to write to — is
 * NOT TRUE. `audit_events` exists in `database/drizzle/governance.ts` and six
 * services already write to it. What is genuinely missing is a `waitlist` value
 * in `audit_subject_type`, which is a migration nobody has written. So this is
 * a smaller gap than the ADR describes, and closing it is cheaper than it says.
 *
 * Second, nothing here is reason-gated, unlike `GET /admin/users`. That is the
 * ADR's call and it is worth knowing rather than inferring: a waitlist row is
 * data somebody volunteered to be contacted about, not a record the platform
 * holds about them regardless.
 */
@Injectable()
export class AdminWaitlistService {
  private readonly log = new Logger(AdminWaitlistService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * One page of the list, newest first.
   *
   * `created_at desc` is API behaviour and not an implementation detail: the
   * index exists for exactly this order, and a staff member opening the screen
   * on launch morning wants the people who joined last night at the top.
   */
  async list(query: AdminWaitlistQuery): Promise<AdminWaitlistPage> {
    const where = filterFor(query);

    const [[totals], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(waitlistSignups)
        .where(where),
      this.db
        .select(ROW_COLUMNS)
        .from(waitlistSignups)
        .leftJoin(districts, eq(waitlistSignups.districtId, districts.id))
        .where(where)
        .orderBy(desc(waitlistSignups.createdAt))
        .limit(query.limit)
        .offset(query.offset),
    ]);

    return {
      total: totals?.total ?? 0,
      rows: rows.map(toRow),
    };
  }

  /**
   * Every row matching the filter, for the CSV.
   *
   * IT IGNORES `limit` AND `offset` ENTIRELY, on purpose. An export silently
   * truncated to one page is worse than no export at all: it looks complete,
   * and the people missing from it are the ones who never hear from you.
   */
  async export(
    query: AdminWaitlistExportQuery,
    staffUserId: string,
  ): Promise<AdminWaitlistRow[]> {
    const rows = await this.db
      .select(ROW_COLUMNS)
      .from(waitlistSignups)
      .leftJoin(districts, eq(waitlistSignups.districtId, districts.id))
      .where(filterFor(query))
      .orderBy(desc(waitlistSignups.createdAt));

    this.log.log(
      `Waitlist export by staff ${staffUserId} at ${new Date().toISOString()}: ${rows.length} rows, audience=${query.audience ?? 'all'}, districtId=${query.districtId ?? 'all'}.`,
    );

    return rows.map(toRow);
  }

  /**
   * Mark somebody invited. Idempotent, and never a 409.
   *
   * `invited_at` records when the person was FIRST invited, so a second click
   * returns the timestamp already there rather than rewriting history. That is
   * why the update carries `isNull(invitedAt)` and why the read comes after it:
   * clicking twice must not make it look as though the invitation went out
   * later than it did.
   */
  async invite(
    id: string,
    staffUserId: string,
  ): Promise<AdminWaitlistInviteResult> {
    await this.db
      .update(waitlistSignups)
      .set({ invitedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(waitlistSignups.id, id),
          isNull(waitlistSignups.invitedAt),
        ),
      );

    const [row] = await this.db
      .select({ invitedAt: waitlistSignups.invitedAt })
      .from(waitlistSignups)
      .where(eq(waitlistSignups.id, id))
      .limit(1);

    if (!row?.invitedAt) throw new NotFoundException();

    this.log.log(
      `Waitlist signup ${id} marked invited by staff ${staffUserId} at ${new Date().toISOString()}.`,
    );

    return { invitedAt: row.invitedAt.toISOString() };
  }
}

/** The one column list, so the page and the export cannot drift apart. */
const ROW_COLUMNS = {
  id: waitlistSignups.id,
  audience: waitlistSignups.audience,
  email: waitlistSignups.email,
  fullName: waitlistSignups.fullName,
  phone: waitlistSignups.phone,
  businessName: waitlistSignups.businessName,
  districtId: waitlistSignups.districtId,
  districtName: districts.name,
  propertyType: waitlistSignups.propertyType,
  sizeBand: waitlistSignups.sizeBand,
  marketingOptIn: waitlistSignups.marketingOptIn,
  invitedAt: waitlistSignups.invitedAt,
  unsubscribedAt: waitlistSignups.unsubscribedAt,
  createdAt: waitlistSignups.createdAt,
};

/** The one filter, so the count and the rows can never disagree. */
function filterFor(query: {
  audience?: 'traveller' | 'owner';
  districtId?: number;
}): SQL | undefined {
  const clauses: SQL[] = [];
  if (query.audience) {
    clauses.push(eq(waitlistSignups.audience, query.audience));
  }
  if (query.districtId !== undefined) {
    clauses.push(eq(waitlistSignups.districtId, query.districtId));
  }
  return clauses.length > 0 ? and(...clauses) : undefined;
}

type RawRow = {
  [K in keyof typeof ROW_COLUMNS]: unknown;
};

/** Timestamps cross the wire as ISO strings, which is what the contract says. */
function toRow(row: RawRow): AdminWaitlistRow {
  return {
    ...(row as unknown as AdminWaitlistRow),
    invitedAt: iso(row.invitedAt),
    unsubscribedAt: iso(row.unsubscribedAt),
    createdAt: iso(row.createdAt) ?? '',
  };
}

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : null;
}
