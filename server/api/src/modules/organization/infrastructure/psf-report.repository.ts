import type { PsfDeclineReason } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { PsfScope } from './psf-membership.repository';

/** node-postgres puts rows on `.rows`; some drivers hand back the array. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
const n = (v: unknown): number => Number(v ?? 0);
/** A Postgres array, parsed by the driver or still in its `{a,b}` text form. */
function pgArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== 'string' || v.length < 2) return [];
  const inner = v.slice(1, -1);
  if (!inner) return [];
  return inner.split(',').map((x) => x.replace(/^"|"$/g, ''));
}

/** The districts the officer may see, as a condition on `o.district_id`. */
function scopeSql(scope: PsfScope): SQL {
  if (scope === null) return sql`true`;
  if (scope.length === 0) return sql`false`;
  return sql`o.district_id IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})`;
}

/** Businesses PSF's register lists: a PSF business or a hotel, past its fee, not refused. */
const ON_REGISTER = sql`o.domain::text IN ('enterprise', 'hospitality') AND o.registration_status::text NOT IN ('pending_payment', 'rejected')`;
/** In PSF's queue: waiting on PSF, and the business in good standing. */
const IN_QUEUE = sql`a.status = 'submitted' AND o.registration_status::text IN ('tin_verified', 'field_verified', 'approved', 'active')`;
/** When the wait on PSF began. */
const WAIT_FROM = sql`coalesce(a.queued_at, a.created_at)`;

export interface PeriodCounts {
  registered: number;
  applied: number;
  approved: number;
  declined: number;
  newMembers: number;
  membershipFeesRwf: number;
  decisionDays: number[];
}

export interface DecisionRow {
  applicationId: string;
  docId: string | null;
  businessName: string;
  businessCode: string | null;
  districtName: string | null;
  tierName: string;
  status: 'approved' | 'member' | 'declined';
  approvedMembershipNumber: string | null;
  approvedFeeRwf: number | null;
  declineReason: PsfDeclineReason | null;
  decidedAt: Date;
  waitFrom: Date;
  decidedByName: string | null;
  clusterName: string | null;
  subsectorName: string | null;
}

/** What the decision log can be narrowed to, past the place. */
export interface DecisionFilter {
  outcome?: 'approved' | 'declined';
  q?: string;
  cluster?: string;
}

/**
 * The officer console's numbers (2026-10-19): the report over a period, the
 * region right now, and the decision log. All of it is SQL over the same rows
 * the queue and the register read, bounded by the same district scope.
 */
@Injectable()
export class PsfReportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async many<T>(query: SQL): Promise<T[]> {
    return rowsOf<T>(await this.db.execute(query));
  }

  async periodCounts(scope: PsfScope, from: Date, to: Date): Promise<PeriodCounts> {
    const s = scopeSql(scope);
    const [reg] = await this.many<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM orgs o
       WHERE ${ON_REGISTER} AND ${s} AND o.created_at >= ${from} AND o.created_at < ${to}`);
    const [apps] = await this.many<Record<string, unknown>>(sql`
      SELECT
        count(*) FILTER (WHERE a.created_at >= ${from} AND a.created_at < ${to})::int AS applied,
        count(*) FILTER (WHERE a.decided_at >= ${from} AND a.decided_at < ${to} AND a.status IN ('approved', 'member'))::int AS approved,
        count(*) FILTER (WHERE a.decided_at >= ${from} AND a.decided_at < ${to} AND a.status = 'declined')::int AS declined,
        count(*) FILTER (WHERE a.paid_at >= ${from} AND a.paid_at < ${to})::int AS members,
        coalesce(sum(a.paid_amount_rwf) FILTER (WHERE a.paid_at >= ${from} AND a.paid_at < ${to}), 0)::bigint AS fees
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s}`);
    const days = await this.many<{ d: number }>(sql`
      SELECT extract(epoch FROM (a.decided_at - ${WAIT_FROM})) / 86400.0 AS d
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s} AND a.decided_at >= ${from} AND a.decided_at < ${to} AND a.status IN ('approved', 'member', 'declined')`);
    return {
      registered: n(reg?.c),
      applied: n(apps?.applied),
      approved: n(apps?.approved),
      declined: n(apps?.declined),
      newMembers: n(apps?.members),
      membershipFeesRwf: n(apps?.fees),
      decisionDays: days.map((r) => Math.max(0, Number(r.d))),
    };
  }

  /** The region right now, not over a period. */
  async now(scope: PsfScope, overdueDays: number, today: string, in30: string, in60: string, in90: string): Promise<{
    members: number;
    waiting: number;
    overdue: number;
    awaitingPayment: number;
    expiringIn30Days: number;
    expiringIn60Days: number;
    expiringIn90Days: number;
    lapsed: number;
    claimsWaiting: number;
  }> {
    const s = scopeSql(scope);
    const [a] = await this.many<Record<string, unknown>>(sql`
      SELECT
        count(*) FILTER (WHERE ${IN_QUEUE})::int AS waiting,
        count(*) FILTER (WHERE ${IN_QUEUE} AND ${WAIT_FROM} < now() - make_interval(days => ${overdueDays}))::int AS overdue,
        count(*) FILTER (WHERE a.status = 'approved')::int AS awaiting
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s}`);
    const [m] = await this.many<Record<string, unknown>>(sql`
      SELECT count(*) FILTER (WHERE m.expires_on IS NULL OR m.expires_on >= ${today})::int AS members,
             count(*) FILTER (WHERE m.expires_on >= ${today} AND m.expires_on <= ${in30})::int AS expiring,
             count(*) FILTER (WHERE m.expires_on >= ${today} AND m.expires_on <= ${in60})::int AS expiring60,
             count(*) FILTER (WHERE m.expires_on >= ${today} AND m.expires_on <= ${in90})::int AS expiring90,
             count(*) FILTER (WHERE m.expires_on < ${today})::int AS lapsed
        FROM psf_memberships m JOIN orgs o ON o.id = m.org_id
       WHERE m.ended_at IS NULL AND ${s}`);
    const [c] = await this.many<Record<string, unknown>>(sql`
      SELECT count(*)::int AS claims FROM psf_membership_claims pc JOIN orgs o ON o.id = pc.org_id
       WHERE pc.status = 'claimed' AND ${s}`);
    return {
      claimsWaiting: n(c?.claims),
      members: n(m?.members),
      waiting: n(a?.waiting),
      overdue: n(a?.overdue),
      awaitingPayment: n(a?.awaiting),
      expiringIn30Days: n(m?.expiring),
      expiringIn60Days: n(m?.expiring60),
      expiringIn90Days: n(m?.expiring90),
      lapsed: n(m?.lapsed),
    };
  }

  /**
   * Injishi registrations in the region right now, and the decisions of a period (2026-10-30). A PSF
   * business (`enterprise`) has no officer gate, so only hospitality and residence registrations wait.
   */
  async registrations(scope: PsfScope, from: Date, to: Date): Promise<{
    waitingReview: number;
    waitingApproval: number;
    waitingPayment: number;
    active: number;
    rejected: number;
    suspended: number;
    approved: number;
    rejectedInPeriod: number;
    decisionDays: number[];
    oldestWaitingDays: number | null;
  }> {
    const s = scopeSql(scope);
    const [now] = await this.many<Record<string, unknown>>(sql`
      SELECT count(*) FILTER (WHERE o.registration_status::text IN ('submitted', 'tin_verified'))::int AS review,
             count(*) FILTER (WHERE o.registration_status::text = 'field_verified')::int AS approval,
             count(*) FILTER (WHERE o.registration_status::text = 'pending_payment')::int AS payment,
             count(*) FILTER (WHERE o.registration_status::text IN ('approved', 'active'))::int AS active,
             count(*) FILTER (WHERE o.registration_status::text = 'rejected')::int AS rejected,
             count(*) FILTER (WHERE o.registration_status::text = 'suspended')::int AS suspended,
             max(extract(epoch FROM now() - e.waiting_since) / 86400)
               FILTER (WHERE o.registration_status::text IN ('submitted', 'tin_verified', 'field_verified')) AS oldest
        FROM orgs o
        LEFT JOIN LATERAL (
          SELECT max(ev.occurred_at) AS waiting_since FROM org_registration_events ev
           WHERE ev.org_id = o.id AND ev.to_status = o.registration_status
        ) e ON true
       WHERE o.domain::text <> 'enterprise' AND ${s}`);
    // A decision in the period: the officer's move to approved or rejected, timed from the fee settling.
    const decided = await this.many<{ to_status: string; days: number | null }>(sql`
      SELECT ev.to_status::text AS to_status,
             extract(epoch FROM ev.occurred_at - (
               SELECT min(p.occurred_at) FROM org_registration_events p
                WHERE p.org_id = ev.org_id AND p.to_status::text = 'submitted'
             )) / 86400 AS days
        FROM org_registration_events ev JOIN orgs o ON o.id = ev.org_id
       WHERE ev.trigger::text = 'officer' AND ev.to_status::text IN ('approved', 'rejected')
         AND ev.occurred_at >= ${from} AND ev.occurred_at < ${to}
         AND o.domain::text <> 'enterprise' AND ${s}`);
    const oldest = now?.oldest;
    return {
      waitingReview: n(now?.review),
      waitingApproval: n(now?.approval),
      waitingPayment: n(now?.payment),
      active: n(now?.active),
      rejected: n(now?.rejected),
      suspended: n(now?.suspended),
      approved: decided.filter((d) => d.to_status === 'approved').length,
      rejectedInPeriod: decided.filter((d) => d.to_status === 'rejected').length,
      decisionDays: decided.filter((d) => d.days !== null).map((d) => Number(d.days)),
      oldestWaitingDays: oldest === null || oldest === undefined ? null : Math.floor(Number(oldest)),
    };
  }

  /** Registrations month by month: fees paid (entering review), and the officers' decisions. */
  async registrationMonths(scope: PsfScope, from: Date, to: Date): Promise<{ month: string; submitted: number; approved: number; rejected: number }[]> {
    const rows = await this.many<{ m: string; submitted: number; approved: number; rejected: number }>(sql`
      SELECT to_char(ev.occurred_at AT TIME ZONE 'Africa/Kigali', 'YYYY-MM') AS m,
             count(*) FILTER (WHERE ev.to_status::text = 'submitted' AND ev.from_status::text = 'pending_payment')::int AS submitted,
             count(*) FILTER (WHERE ev.trigger::text = 'officer' AND ev.to_status::text = 'approved')::int AS approved,
             count(*) FILTER (WHERE ev.trigger::text = 'officer' AND ev.to_status::text = 'rejected')::int AS rejected
        FROM org_registration_events ev JOIN orgs o ON o.id = ev.org_id
       WHERE ev.occurred_at >= ${from} AND ev.occurred_at < ${to}
         AND o.domain::text <> 'enterprise' AND ${scopeSql(scope)}
       GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ month: r.m, submitted: n(r.submitted), approved: n(r.approved), rejected: n(r.rejected) }));
  }

  /** The registrations an officer decided in the period, newest first, with who decided. */
  async decided(scope: PsfScope, from: Date, to: Date): Promise<{
    orgId: string;
    legalName: string;
    kind: string;
    decision: 'approved' | 'rejected';
    decidedAt: Date;
    decidedBy: string | null;
    status: string;
  }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT o.id AS org_id, o.legal_name, coalesce(o.accommodation_class, o.domain::text) AS kind,
             ev.to_status::text AS decision, ev.occurred_at AS decided_at, u.name AS decided_by,
             o.registration_status::text AS status
        FROM org_registration_events ev
        JOIN orgs o ON o.id = ev.org_id
        LEFT JOIN users u ON u.id = ev.actor_user_id
       WHERE ev.trigger::text = 'officer' AND ev.to_status::text IN ('approved', 'rejected')
         AND ev.occurred_at >= ${from} AND ev.occurred_at < ${to}
         AND o.domain::text <> 'enterprise' AND ${scopeSql(scope)}
       ORDER BY ev.occurred_at DESC
       LIMIT 100`);
    return rows.map((r) => ({
      orgId: String(r.org_id),
      legalName: String(r.legal_name),
      kind: String(r.kind),
      decision: r.decision === 'rejected' ? 'rejected' : 'approved',
      decidedAt: new Date(String(r.decided_at)),
      decidedBy: r.decided_by ? String(r.decided_by) : null,
      status: String(r.status),
    }));
  }

  /** Confirmed bookings month by month, by the month guests arrive. */
  async bookingMonths(scope: PsfScope, from: string, to: string): Promise<{ month: string; bookings: number; guestNights: number; valueRwf: number }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT to_char(b.check_in, 'YYYY-MM') AS m, count(*)::int AS bookings,
             coalesce(sum((b.check_out - b.check_in) * greatest(b.guest_count, 1)), 0)::bigint AS nights,
             coalesce(sum(b.gross_rwf), 0)::bigint AS value
        FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN properties p ON p.id = rt.property_id
        JOIN orgs o ON o.id = p.org_id
       WHERE b.status::text = 'confirmed' AND b.check_in >= ${from}::date AND b.check_in < ${to}::date AND ${scopeSql(scope)}
       GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ month: String(r.m), bookings: n(r.bookings), guestNights: n(r.nights), valueRwf: n(r.value) }));
  }

  /** The businesses that sold the most stays arriving in the period. */
  async topBusinesses(scope: PsfScope, from: string, to: string): Promise<{ orgId: string; legalName: string; bookings: number; guestNights: number; valueRwf: number }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT o.id AS org_id, o.legal_name, count(*)::int AS bookings,
             coalesce(sum((b.check_out - b.check_in) * greatest(b.guest_count, 1)), 0)::bigint AS nights,
             coalesce(sum(b.gross_rwf), 0)::bigint AS value
        FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN properties p ON p.id = rt.property_id
        JOIN orgs o ON o.id = p.org_id
       WHERE b.status::text = 'confirmed' AND b.check_in >= ${from}::date AND b.check_in < ${to}::date AND ${scopeSql(scope)}
       GROUP BY o.id, o.legal_name ORDER BY 3 DESC, 5 DESC LIMIT 10`);
    return rows.map((r) => ({
      orgId: String(r.org_id),
      legalName: String(r.legal_name),
      bookings: n(r.bookings),
      guestNights: n(r.nights),
      valueRwf: n(r.value),
    }));
  }

  /** A business's side on Injishi, for its profile: the org, its owner, its decisions and its listings. */
  async registrationProfile(orgId: string): Promise<{
    org: Record<string, unknown>;
    owner: Record<string, unknown> | null;
    reviews: Record<string, unknown>[];
    listings: Record<string, unknown>[];
    bookings90Days: number;
  } | null> {
    const [org] = await this.many<Record<string, unknown>>(sql`
      SELECT o.id, o.legal_name, o.business_code, coalesce(o.accommodation_class, o.domain::text) AS kind,
             o.domain::text AS domain, o.district_id, d.name AS district_name, s.name AS sector_name,
             o.address_text, o.tin, o.eac_star_grade, o.star_grade_verified_at,
             o.registration_status::text AS status, o.created_at
        FROM orgs o
        LEFT JOIN districts d ON d.id = o.district_id
        LEFT JOIN sectors s ON s.id = o.sector_id
       WHERE o.id = ${orgId}::uuid`);
    if (!org) return null;
    const [owner] = await this.many<Record<string, unknown>>(sql`
      SELECT u.name, u.email, u.phone_number FROM org_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ${orgId}::uuid AND m.org_role::text = 'owner' AND m.removed_at IS NULL
       ORDER BY m.created_at LIMIT 1`);
    const reviews = await this.many<Record<string, unknown>>(sql`
      SELECT r.stage::text AS stage, r.decision::text AS decision, r.oversight_role::text AS role,
             u.name AS by_name, r.decided_at, r.notes, r.reason_code::text AS reason
        FROM org_registration_reviews r LEFT JOIN users u ON u.id = r.decided_by_user_id
       WHERE r.org_id = ${orgId}::uuid ORDER BY r.decided_at`);
    const listings = await this.many<Record<string, unknown>>(sql`
      SELECT p.name, coalesce(l.status::text, 'draft') AS status, l.published_at, p.slug,
             (SELECT count(*) FROM room_types rt WHERE rt.property_id = p.id AND rt.status::text = 'active')::int AS room_types,
             (SELECT coalesce(sum(rt.room_count), 0) FROM room_types rt WHERE rt.property_id = p.id AND rt.status::text = 'active')::int AS rooms
        FROM properties p LEFT JOIN listings l ON l.property_id = p.id
       WHERE p.org_id = ${orgId}::uuid AND p.archived_at IS NULL ORDER BY p.created_at`);
    const [b] = await this.many<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id JOIN properties p ON p.id = rt.property_id
       WHERE p.org_id = ${orgId}::uuid AND b.status::text = 'confirmed' AND b.check_in >= (current_date - 90)`);
    return { org, owner: owner ?? null, reviews, listings, bookings90Days: n(b?.c) };
  }

  /** Active businesses by kind: an accommodation's class, else its domain. */
  async activeBusinesses(scope: PsfScope): Promise<{ key: string; count: number }[]> {
    const rows = await this.many<{ k: string; c: number }>(sql`
      SELECT coalesce(o.accommodation_class, o.domain::text) AS k, count(*)::int AS c
        FROM orgs o
       WHERE o.registration_status::text IN ('approved', 'active') AND ${scopeSql(scope)}
       GROUP BY 1 ORDER BY 2 DESC, 1`);
    return rows.map((r) => ({ key: r.k, count: n(r.c) }));
  }

  /** Confirmed bookings arriving in a period at businesses in the region: count, guest nights, value. */
  async bookings(scope: PsfScope, from: string, to: string): Promise<{ bookings: number; guestNights: number; valueRwf: number }> {
    const [r] = await this.many<Record<string, unknown>>(sql`
      SELECT count(*)::int AS bookings,
             coalesce(sum((b.check_out - b.check_in) * greatest(b.guest_count, 1)), 0)::bigint AS guest_nights,
             coalesce(sum(b.gross_rwf), 0)::bigint AS value
        FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN properties p ON p.id = rt.property_id
        JOIN orgs o ON o.id = p.org_id
       WHERE b.status::text = 'confirmed' AND b.check_in >= ${from}::date AND b.check_in < ${to}::date AND ${scopeSql(scope)}`);
    return { bookings: n(r?.bookings), guestNights: n(r?.guest_nights), valueRwf: n(r?.value) };
  }

  /** Month by month, Kigali months, from `from` up to `to`. */
  async months(scope: PsfScope, from: Date, to: Date): Promise<{
    month: string;
    registered: number;
    applied: number;
    approved: number;
    members: number;
    feesRwf: number;
  }[]> {
    const s = scopeSql(scope);
    const k = (col: SQL) => sql`to_char(${col} AT TIME ZONE 'Africa/Kigali', 'YYYY-MM')`;
    const reg = await this.many<{ m: string; c: number }>(sql`
      SELECT ${k(sql`o.created_at`)} AS m, count(*)::int AS c FROM orgs o
       WHERE ${ON_REGISTER} AND ${s} AND o.created_at >= ${from} AND o.created_at < ${to} GROUP BY 1`);
    const applied = await this.many<{ m: string; c: number }>(sql`
      SELECT ${k(sql`a.created_at`)} AS m, count(*)::int AS c
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s} AND a.created_at >= ${from} AND a.created_at < ${to} GROUP BY 1`);
    const approved = await this.many<{ m: string; c: number }>(sql`
      SELECT ${k(sql`a.decided_at`)} AS m, count(*)::int AS c
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s} AND a.status IN ('approved', 'member') AND a.decided_at >= ${from} AND a.decided_at < ${to} GROUP BY 1`);
    const paid = await this.many<{ m: string; c: number; f: unknown }>(sql`
      SELECT ${k(sql`a.paid_at`)} AS m, count(*)::int AS c, coalesce(sum(a.paid_amount_rwf), 0)::bigint AS f
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${s} AND a.paid_at >= ${from} AND a.paid_at < ${to} GROUP BY 1`);
    const months = new Map<string, { registered: number; applied: number; approved: number; members: number; feesRwf: number }>();
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(to.getTime() - 1);
    // `from` is midnight Kigali, a little before UTC midnight: read its Kigali month.
    const kigaliMonth = (d: Date) => new Date(d.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 7);
    const first = kigaliMonth(from);
    const last = kigaliMonth(end);
    cursor.setUTCFullYear(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
    for (let guard = 0; guard < 60; guard += 1) {
      const key = cursor.toISOString().slice(0, 7);
      months.set(key, { registered: 0, applied: 0, approved: 0, members: 0, feesRwf: 0 });
      if (key >= last) break;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (const r of reg) months.get(r.m) && (months.get(r.m)!.registered = n(r.c));
    for (const r of applied) months.get(r.m) && (months.get(r.m)!.applied = n(r.c));
    for (const r of approved) months.get(r.m) && (months.get(r.m)!.approved = n(r.c));
    for (const r of paid) {
      const m = months.get(r.m);
      if (m) {
        m.members = n(r.c);
        m.feesRwf = n(r.f);
      }
    }
    return [...months.entries()].map(([month, v]) => ({ month, ...v }));
  }

  /** Of what was applied for in the period, how far each got. */
  async funnel(scope: PsfScope, from: Date, to: Date): Promise<{ registered: number; approved: number; paid: number; declined: number }> {
    const [r] = await this.many<Record<string, unknown>>(sql`
      SELECT count(*)::int AS applied,
             count(*) FILTER (WHERE a.status IN ('approved', 'member'))::int AS approved,
             count(*) FILTER (WHERE a.status = 'member')::int AS paid,
             count(*) FILTER (WHERE a.status = 'declined')::int AS declined
        FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
       WHERE ${scopeSql(scope)} AND a.created_at >= ${from} AND a.created_at < ${to}`);
    return { registered: n(r?.applied), approved: n(r?.approved), paid: n(r?.paid), declined: n(r?.declined) };
  }

  /** Businesses by sector cluster, with what their members paid over the period. */
  async bySector(scope: PsfScope, from: Date, to: Date): Promise<{ key: string; label: string; count: number; amountRwf: number }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT coalesce(c.code, 'none') AS key, coalesce(c.name_en, 'Not classified') AS label,
             count(DISTINCT o.id)::int AS count,
             coalesce((SELECT sum(a.paid_amount_rwf) FROM psf_membership_applications a JOIN orgs o2 ON o2.id = a.org_id
                         LEFT JOIN psf_associations s2 ON s2.code = o2.psf_association_code
                        WHERE coalesce(s2.cluster_code, 'none') = coalesce(c.code, 'none')
                          AND a.paid_at >= ${from} AND a.paid_at < ${to}
                          AND (${scopeSqlFor('o2', scope)})), 0)::bigint AS amount
        FROM orgs o
        LEFT JOIN psf_associations s ON s.code = o.psf_association_code
        LEFT JOIN psf_clusters c ON c.code = s.cluster_code
       WHERE ${ON_REGISTER} AND ${scopeSql(scope)}
       GROUP BY c.code, c.name_en, c.sort_order
       ORDER BY c.sort_order NULLS LAST`);
    return rows.map((r) => ({ key: String(r.key), label: String(r.label), count: n(r.count), amountRwf: n(r.amount) }));
  }

  /** Current members by membership family, with what they pay a year. */
  async byFamily(scope: PsfScope): Promise<{ key: string; count: number; amountRwf: number }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT t.family::text AS key, count(*)::int AS count, coalesce(sum(m.annual_fee_rwf), 0)::bigint AS amount
        FROM psf_memberships m
        JOIN orgs o ON o.id = m.org_id
        JOIN psf_membership_tiers t ON t.code = m.tier_code
       WHERE m.ended_at IS NULL AND ${scopeSql(scope)}
       GROUP BY t.family`);
    return rows.map((r) => ({ key: String(r.key), count: n(r.count), amountRwf: n(r.amount) }));
  }

  /** Businesses by owner group (PSF's Specialized cluster). */
  async byGroup(scope: PsfScope): Promise<{ key: string; count: number }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT g.grp::text AS key, count(*)::int AS count
        FROM orgs o CROSS JOIN LATERAL unnest(o.owner_groups) AS g(grp)
       WHERE ${ON_REGISTER} AND ${scopeSql(scope)}
       GROUP BY g.grp ORDER BY g.grp`);
    return rows.map((r) => ({ key: String(r.key), count: n(r.count) }));
  }

  /** One row per district in scope, zeroes included, so a quiet district still shows. */
  async districts(scope: PsfScope, from: Date, to: Date, overdueDays: number): Promise<{
    districtId: number;
    name: string;
    provinceName: string;
    registered: number;
    waiting: number;
    overdue: number;
    approved: number;
    declined: number;
    members: number;
    feesRwf: number;
    decisionDays: number[];
    officers: string[];
  }[]> {
    const where = scope === null ? sql`true` : scope.length === 0 ? sql`false` : sql`d.id IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})`;
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT d.id, d.name, p.name AS province,
        (SELECT count(*) FROM orgs o WHERE o.district_id = d.id AND ${ON_REGISTER})::int AS registered,
        (SELECT count(*) FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND ${IN_QUEUE})::int AS waiting,
        (SELECT count(*) FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND ${IN_QUEUE} AND ${WAIT_FROM} < now() - make_interval(days => ${overdueDays}))::int AS overdue,
        (SELECT count(*) FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND a.status IN ('approved', 'member') AND a.decided_at >= ${from} AND a.decided_at < ${to})::int AS approved,
        (SELECT count(*) FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND a.status = 'declined' AND a.decided_at >= ${from} AND a.decided_at < ${to})::int AS declined,
        (SELECT count(*) FROM psf_memberships m JOIN orgs o ON o.id = m.org_id
          WHERE o.district_id = d.id AND m.ended_at IS NULL)::int AS members,
        (SELECT coalesce(sum(a.paid_amount_rwf), 0) FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND a.paid_at >= ${from} AND a.paid_at < ${to})::bigint AS fees,
        (SELECT coalesce(array_agg((extract(epoch FROM (a.decided_at - ${WAIT_FROM})) / 86400.0)::float8), '{}'::float8[])
           FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
          WHERE o.district_id = d.id AND a.decided_at >= ${from} AND a.decided_at < ${to}
            AND a.status IN ('approved', 'member', 'declined')) AS days,
        (SELECT coalesce(array_agg(DISTINCT coalesce(nullif(trim(vi.legal_full_name), ''), nullif(trim(u.name), ''), u.email)), '{}'::text[])
           FROM oversight_assignments g
           JOIN users u ON u.id = g.user_id
           LEFT JOIN verified_identities vi ON vi.user_id = u.id
          WHERE g.oversight_role = 'psf_membership_officer' AND g.revoked_at IS NULL
            AND g.scope_level = 'district' AND g.district_id = d.id) AS officers
        FROM districts d JOIN provinces p ON p.id = d.province_id
       WHERE ${where}
       ORDER BY p.name, d.name`);
    return rows.map((r) => ({
      districtId: n(r.id),
      name: String(r.name),
      provinceName: String(r.province),
      registered: n(r.registered),
      waiting: n(r.waiting),
      overdue: n(r.overdue),
      approved: n(r.approved),
      declined: n(r.declined),
      members: n(r.members),
      feesRwf: n(r.fees),
      decisionDays: pgArray(r.days).map((d) => Math.max(0, Number(d))),
      officers: pgArray(r.officers),
    }));
  }

  // --- The decision log -------------------------------------------------------

  async decisions(
    scope: PsfScope,
    filter: DecisionFilter,
    after: { sortAt: Date; id: string } | undefined,
    limit: number,
  ): Promise<{ rows: DecisionRow[]; more: boolean }> {
    const outcome = filter.outcome;
    const q = filter.q?.trim();
    const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const qSql = like ? sql`AND (o.legal_name ILIKE ${like} OR o.business_code ILIKE ${like} OR a.doc_id ILIKE ${like})` : sql``;
    const clusterSql = filter.cluster ? sql`AND pa.cluster_code = ${filter.cluster}` : sql``;
    const outcomeSql =
      outcome === 'approved'
        ? sql`a.status IN ('approved', 'member')`
        : outcome === 'declined'
          ? sql`a.status = 'declined'`
          : sql`a.status IN ('approved', 'member', 'declined')`;
    const afterSql = after
      ? sql`AND (a.decided_at < ${after.sortAt} OR (a.decided_at = ${after.sortAt} AND a.id < ${after.id}))`
      : sql``;
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT a.id, a.doc_id, o.legal_name, o.business_code, d.name AS district, t.name_en AS tier, a.status::text AS status,
             a.approved_membership_number, a.approved_fee_rwf, a.decline_reason::text AS decline_reason,
             a.decided_at, ${WAIT_FROM} AS wait_from,
             coalesce(nullif(trim(vi.legal_full_name), ''), nullif(trim(u.name), '')) AS decided_by,
             pc.name_en AS cluster_name, coalesce(o.psf_subsector_other, ps.name_en) AS subsector_name
        FROM psf_membership_applications a
        JOIN orgs o ON o.id = a.org_id
        JOIN psf_membership_tiers t ON t.code = a.requested_tier_code
        LEFT JOIN psf_associations pa ON pa.code = o.psf_association_code
        LEFT JOIN psf_clusters pc ON pc.code = pa.cluster_code
        LEFT JOIN psf_subsectors ps ON ps.id = o.psf_subsector_id
        LEFT JOIN districts d ON d.id = o.district_id
        LEFT JOIN users u ON u.id = a.decided_by_user_id
        LEFT JOIN verified_identities vi ON vi.user_id = u.id
       WHERE ${scopeSql(scope)} AND a.decided_at IS NOT NULL AND ${outcomeSql} ${qSql} ${clusterSql} ${afterSql}
       ORDER BY a.decided_at DESC, a.id DESC
       LIMIT ${limit + 1}`);
    const mapped: DecisionRow[] = rows.slice(0, limit).map((r) => ({
      applicationId: String(r.id),
      docId: (r.doc_id as string | null) ?? null,
      businessName: String(r.legal_name),
      businessCode: (r.business_code as string | null) ?? null,
      districtName: (r.district as string | null) ?? null,
      tierName: String(r.tier),
      status: r.status as DecisionRow['status'],
      approvedMembershipNumber: (r.approved_membership_number as string | null) ?? null,
      approvedFeeRwf: r.approved_fee_rwf === null ? null : n(r.approved_fee_rwf),
      declineReason: (r.decline_reason as PsfDeclineReason | null) ?? null,
      decidedAt: new Date(r.decided_at as string),
      waitFrom: new Date(r.wait_from as string),
      decidedByName: (r.decided_by as string | null) ?? null,
      clusterName: (r.cluster_name as string | null) ?? null,
      subsectorName: (r.subsector_name as string | null) ?? null,
    }));
    return { rows: mapped, more: rows.length > limit };
  }

  // --- Places -------------------------------------------------------------------

  /** Every province with its districts, for the console's switcher. */
  async geography(): Promise<{ provinceId: number; provinceName: string; districtId: number; districtName: string }[]> {
    const rows = await this.many<Record<string, unknown>>(sql`
      SELECT p.id AS pid, p.name AS pname, d.id AS did, d.name AS dname
        FROM districts d JOIN provinces p ON p.id = d.province_id
       ORDER BY p.name, d.name`);
    return rows.map((r) => ({ provinceId: n(r.pid), provinceName: String(r.pname), districtId: n(r.did), districtName: String(r.dname) }));
  }

  /** The districts a scope covers, by name, for the subtype screen's "where" list. */
  async districtNames(scope: PsfScope): Promise<{ id: number; name: string }[]> {
    const where = scope === null ? sql`true` : scope.length === 0 ? sql`false` : sql`d.id IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})`;
    const rows = await this.many<{ id: number; name: string }>(sql`SELECT d.id, d.name FROM districts d WHERE ${where} ORDER BY d.name`);
    return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
  }

  /** Is this membership number already PSF's for another business? Case and spaces aside. */
  async membershipNumberTaken(number: string, exceptApplicationId: string): Promise<boolean> {
    const [r] = await this.many<{ taken: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM psf_membership_applications
         WHERE upper(trim(approved_membership_number)) = upper(trim(${number})) AND id <> ${exceptApplicationId}
        UNION ALL
        SELECT 1 FROM psf_memberships m
         WHERE upper(trim(m.membership_number)) = upper(trim(${number}))
           AND m.application_id IS DISTINCT FROM ${exceptApplicationId}::uuid
      ) AS taken`);
    return Boolean(r?.taken);
  }

  /**
   * The highest number already given in a district's run for a year, read off
   * the approved membership numbers (`PSF/KIC/2026/0009`). The next is one more.
   */
  async lastMembershipNumber(letters: string, year: number): Promise<number> {
    const prefix = `PSF/${letters}/${year}/`;
    const [r] = await this.many<{ n: unknown }>(sql`
      SELECT coalesce(max(split_part(x.num, '/', 4)::int), 0) AS n
        FROM (
          SELECT approved_membership_number AS num FROM psf_membership_applications WHERE approved_membership_number LIKE ${`${prefix}%`}
          UNION ALL
          SELECT membership_number FROM psf_memberships WHERE membership_number LIKE ${`${prefix}%`}
        ) x
       WHERE x.num ~ ${`^PSF/${letters}/${year}/[0-9]+$`}`);
    return n(r?.n);
  }
}

/** `scopeSql` for a table alias other than `o`. */
function scopeSqlFor(alias: string, scope: PsfScope): SQL {
  if (scope === null) return sql`true`;
  if (scope.length === 0) return sql`false`;
  return sql`${sql.raw(alias)}.district_id IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})`;
}
