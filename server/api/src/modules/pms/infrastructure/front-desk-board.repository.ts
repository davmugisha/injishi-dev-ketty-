import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The reads behind the front desk's day (`GET /api/v1/ops/front-desk`).
 *
 * Plain SQL, scoped in every `WHERE` to ONE workspace and ONE property the
 * service has already proved the caller covers. Nothing here decides what a
 * caller may see; it answers for the property it was handed.
 *
 * Dates arrive as `YYYY-MM-DD` Kigali days from the service, which decided
 * "today" once, so every row in one board agrees about it.
 */

export interface BoardPropertyRow {
  id: string;
  name: string;
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface BoardBookingRow {
  id: string;
  reference: string;
  guestUserId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  adults: number | null;
  children: number | null;
  roomTypeId: string;
  roomTypeName: string;
  status: string;
  bookingMode: string;
  cancellationTier: string | null;
  nonRefundable: boolean;
  channel: string | null;
  eta: string | null;
  deskNote: string | null;
  grossRwf: number;
  lockedNightlyRateRwf: number;
  paymentStatus: string | null;
  escrowRwf: number;
  /** The booking escrow's status, or null when no payment was taken. */
  escrowStatus: string | null;
  approvalExpiresAt: Date | null;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  refundRwf: number | null;
  noShowAt: Date | null;
  noShowReason: string | null;
  preArrival: boolean;
  guestMessage: string | null;
  folioId: string | null;
  folioNumber: string | null;
  folioStatus: string | null;
  folioBalanceRwf: number | null;
  folioLockedAt: Date | null;
}

export interface BoardHoldRow {
  bookingId: string;
  roomId: string;
  roomLabel: string | null;
  from: string;
  to: string;
}

export interface BoardStayRow {
  id: string;
  reference: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  guestName: string | null;
  roomId: string;
  roomLabel: string | null;
  roomTypeName: string;
  lifecycle: 'open' | 'closed';
  entryAt: Date;
  plannedExitAt: Date | null;
  actualExitAt: Date | null;
  channel: string | null;
  checkIn: string | null;
  checkOut: string | null;
  deskNote: string | null;
  departureNote: string | null;
  priceRwf: number | null;
  folioId: string | null;
  folioNumber: string | null;
  folioStatus: string | null;
  folioBalanceRwf: number | null;
  folioLockedAt: Date | null;
}

export interface BoardRoomRow {
  id: string;
  label: string | null;
  roomTypeId: string;
  roomTypeName: string;
  status: 'available' | 'maintenance' | 'out_of_service';
  housekeeping: 'clean' | 'dirty' | 'inspected' | 'out_of_order';
  housekeepingUpdatedAt: Date | null;
  occupantStayId: string | null;
  occupantName: string | null;
  occupantPlannedExitAt: Date | null;
  holdBookingId: string | null;
  holdReference: string | null;
  holdGuestName: string | null;
}

export interface BoardRoomTypeRow {
  id: string;
  name: string;
  sleeps: number | null;
  rateRwf: number | null;
  beds: string | null;
  active: boolean;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const dateOrNull = (v: unknown): Date | null => (v == null ? null : new Date(v as string));

@Injectable()
export class FrontDeskBoardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async rows(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
    return (await this.db.execute(query)).rows as Record<string, unknown>[];
  }

  /**
   * The properties of this workspace the caller covers, head office first.
   * An archived property is not a desk anybody works.
   */
  async properties(workspaceId: string, propertyIds: readonly string[]): Promise<BoardPropertyRow[]> {
    const rows = await this.rows(sql`
      SELECT p.id, p.name,
             to_char(p.check_in_time, 'HH24:MI') AS check_in_time,
             to_char(p.check_out_time, 'HH24:MI') AS check_out_time
        FROM properties p
       WHERE p.workspace_id = ${workspaceId}
         AND p.archived_at IS NULL
         AND p.id = ANY(${sql.raw(uuidArray(propertyIds))})
       ORDER BY p.is_head_office DESC, p.name`);
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      checkInTime: (r.check_in_time as string | null) ?? null,
      checkOutTime: (r.check_out_time as string | null) ?? null,
    }));
  }

  /**
   * Every booking on this property the desk still has a reason to look at:
   * anything leaving yesterday or later and arriving within four months, and
   * every request still waiting for an answer whatever its dates.
   */
  async bookings(workspaceId: string, propertyId: string, today: string): Promise<BoardBookingRow[]> {
    const rows = await this.rows(sql`
      SELECT b.id, b.reference, b.guest_user_id,
             coalesce(nullif(btrim(u.name), ''), b.guest_name) AS guest_name,
             coalesce(up.phone_e164, b.guest_phone) AS guest_phone,
             b.check_in::text AS check_in, b.check_out::text AS check_out,
             b.guest_count, b.adults, b.children,
             b.room_type_id, rt.name AS room_type_name,
             b.status, b.booking_mode, b.locked_cancellation_tier, b.nonrefundable,
             b.channel, to_char(b.eta, 'HH24:MI') AS eta, b.desk_note,
             b.gross_rwf, b.locked_nightly_rate_rwf, b.payment_status,
             coalesce((SELECT sum(e.amount_rwf) FROM escrows e
                        WHERE e.booking_id = b.id AND e.source = 'booking'), 0) AS escrow_rwf,
             (SELECT e.status FROM escrows e
               WHERE e.booking_id = b.id AND e.source = 'booking'
               ORDER BY e.created_at DESC LIMIT 1) AS escrow_status,
             b.approval_expires_at, b.created_at, b.confirmed_at,
             b.cancelled_at, b.cancelled_by, b.refund_rwf,
             b.no_show_at, b.no_show_reason,
             EXISTS (SELECT 1 FROM pre_arrival_identities p WHERE p.booking_id = b.id) AS pre_arrival,
             (SELECT m.body
                FROM threads t JOIN messages m ON m.thread_id = t.id
               WHERE t.booking_id = b.id AND m.sender_user_id = b.guest_user_id
                 AND m.body_type = 'text' AND m.body IS NOT NULL
               ORDER BY m.created_at LIMIT 1) AS guest_message,
             f.id AS folio_id, f.folio_number, f.status AS folio_status,
             f.balance_rwf AS folio_balance_rwf, f.locked_at AS folio_locked_at
        FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id
        LEFT JOIN users u ON u.id = b.guest_user_id
        LEFT JOIN user_profiles up ON up.user_id = b.guest_user_id
        LEFT JOIN LATERAL (
          SELECT f.id, f.folio_number, f.status, f.balance_rwf, f.locked_at
            FROM folios f
           WHERE f.booking_id = b.id
           ORDER BY (f.status <> 'closed') DESC, f.folio_sequence DESC
           LIMIT 1) f ON true
       WHERE b.workspace_id = ${workspaceId}
         AND rt.property_id = ${propertyId}
         AND (b.status = 'pending_approval'
              OR (b.check_out >= ${today}::date - 1 AND b.check_in <= ${today}::date + 120))
       ORDER BY b.check_in, b.reference`);
    return rows.map((r) => ({
      id: String(r.id),
      reference: String(r.reference),
      guestUserId: (r.guest_user_id as string | null) ?? null,
      guestName: (r.guest_name as string | null) ?? null,
      guestPhone: (r.guest_phone as string | null) ?? null,
      checkIn: String(r.check_in),
      checkOut: String(r.check_out),
      guestCount: num(r.guest_count),
      adults: numOrNull(r.adults),
      children: numOrNull(r.children),
      roomTypeId: String(r.room_type_id),
      roomTypeName: String(r.room_type_name),
      status: String(r.status),
      bookingMode: String(r.booking_mode),
      cancellationTier: (r.locked_cancellation_tier as string | null) ?? null,
      nonRefundable: r.nonrefundable === true,
      channel: (r.channel as string | null) ?? null,
      eta: (r.eta as string | null) ?? null,
      deskNote: (r.desk_note as string | null) ?? null,
      grossRwf: num(r.gross_rwf),
      lockedNightlyRateRwf: num(r.locked_nightly_rate_rwf),
      paymentStatus: (r.payment_status as string | null) ?? null,
      escrowRwf: num(r.escrow_rwf),
      escrowStatus: (r.escrow_status as string | null) ?? null,
      approvalExpiresAt: dateOrNull(r.approval_expires_at),
      createdAt: new Date(r.created_at as string),
      confirmedAt: dateOrNull(r.confirmed_at),
      cancelledAt: dateOrNull(r.cancelled_at),
      cancelledBy: (r.cancelled_by as string | null) ?? null,
      refundRwf: numOrNull(r.refund_rwf),
      noShowAt: dateOrNull(r.no_show_at),
      noShowReason: (r.no_show_reason as string | null) ?? null,
      preArrival: r.pre_arrival === true,
      guestMessage: (r.guest_message as string | null) ?? null,
      folioId: (r.folio_id as string | null) ?? null,
      folioNumber: (r.folio_number as string | null) ?? null,
      folioStatus: (r.folio_status as string | null) ?? null,
      folioBalanceRwf: numOrNull(r.folio_balance_rwf),
      folioLockedAt: dateOrNull(r.folio_locked_at),
    }));
  }

  /** The live holds of these bookings. A released hold is history, never drawn. */
  async holds(bookingIds: readonly string[]): Promise<BoardHoldRow[]> {
    if (bookingIds.length === 0) return [];
    const rows = await this.rows(sql`
      SELECT ra.booking_id, ra.room_id, r.label,
             lower(ra.occupies)::text AS from_day, upper(ra.occupies)::text AS to_day
        FROM room_assignments ra
        JOIN rooms r ON r.id = ra.room_id
       WHERE ra.status = 'assigned'
         AND ra.booking_id = ANY(${sql.raw(uuidArray(bookingIds))})
       ORDER BY lower(ra.occupies)`);
    return rows.map((r) => ({
      bookingId: String(r.booking_id),
      roomId: String(r.room_id),
      roomLabel: (r.label as string | null) ?? null,
      from: String(r.from_day),
      to: String(r.to_day),
    }));
  }

  /**
   * The stays the desk is working: everyone in the building, everyone who
   * left in the last three days, and every stay of the bookings on the board.
   * Through the ROOM's property, never the booking's: a walk in has none.
   */
  async stays(workspaceId: string, propertyId: string, bookingIds: readonly string[]): Promise<BoardStayRow[]> {
    const rows = await this.rows(sql`
      SELECT s.id, s.reference, s.booking_id, b.reference AS booking_reference,
             coalesce(nullif(btrim(u.name), ''), s.guest_name) AS guest_name,
             s.room_id, r.label AS room_label, rt.name AS room_type_name,
             s.lifecycle, s.entry_at, s.planned_exit_at, s.actual_exit_at,
             b.channel, b.check_in::text AS check_in, b.check_out::text AS check_out,
             s.desk_note, s.departure_note, s.price_rwf,
             f.id AS folio_id, f.folio_number, f.status AS folio_status,
             f.balance_rwf AS folio_balance_rwf, f.locked_at AS folio_locked_at
        FROM guest_stays s
        JOIN rooms r ON r.id = s.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        LEFT JOIN bookings b ON b.id = s.booking_id
        LEFT JOIN users u ON u.id = s.guest_user_id
        LEFT JOIN LATERAL (
          SELECT f.id, f.folio_number, f.status, f.balance_rwf, f.locked_at
            FROM folios f
           WHERE f.guest_stay_id = s.id
           ORDER BY (f.status <> 'closed') DESC, f.folio_sequence DESC
           LIMIT 1) f ON true
       WHERE s.workspace_id = ${workspaceId}
         AND r.property_id = ${propertyId}
         AND (s.lifecycle = 'open'
              OR s.actual_exit_at >= now() - interval '3 days'
              OR s.booking_id = ANY(${sql.raw(uuidArray(bookingIds))}))
       ORDER BY s.entry_at`);
    return rows.map((r) => ({
      id: String(r.id),
      reference: (r.reference as string | null) ?? null,
      bookingId: (r.booking_id as string | null) ?? null,
      bookingReference: (r.booking_reference as string | null) ?? null,
      guestName: (r.guest_name as string | null) ?? null,
      roomId: String(r.room_id),
      roomLabel: (r.room_label as string | null) ?? null,
      roomTypeName: String(r.room_type_name),
      lifecycle: r.lifecycle === 'closed' ? 'closed' : 'open',
      entryAt: new Date(r.entry_at as string),
      plannedExitAt: dateOrNull(r.planned_exit_at),
      actualExitAt: dateOrNull(r.actual_exit_at),
      channel: (r.channel as string | null) ?? null,
      checkIn: (r.check_in as string | null) ?? null,
      checkOut: (r.check_out as string | null) ?? null,
      deskNote: (r.desk_note as string | null) ?? null,
      departureNote: (r.departure_note as string | null) ?? null,
      priceRwf: numOrNull(r.price_rwf),
      folioId: (r.folio_id as string | null) ?? null,
      folioNumber: (r.folio_number as string | null) ?? null,
      folioStatus: (r.folio_status as string | null) ?? null,
      folioBalanceRwf: numOrNull(r.folio_balance_rwf),
      folioLockedAt: dateOrNull(r.folio_locked_at),
    }));
  }

  /**
   * Every room of the property with who is in it now and who holds it
   * tonight. A hold for tonight is one whose range covers `today` and whose
   * booking is still live; the guest already IN the room keeps their own hold
   * until checkout, which is how a stay over shows as both.
   */
  async rooms(workspaceId: string, propertyId: string, today: string): Promise<BoardRoomRow[]> {
    const rows = await this.rows(sql`
      SELECT r.id, r.label, r.room_type_id, rt.name AS room_type_name,
             r.status, r.housekeeping_status, r.housekeeping_updated_at,
             occ.id AS occupant_stay_id, occ.guest_name AS occupant_name,
             occ.planned_exit_at AS occupant_planned_exit_at,
             hold.booking_id AS hold_booking_id, hold.reference AS hold_reference,
             hold.guest_name AS hold_guest_name
        FROM rooms r
        JOIN room_types rt ON rt.id = r.room_type_id
        LEFT JOIN LATERAL (
          SELECT s.id, s.planned_exit_at,
                 coalesce(nullif(btrim(u.name), ''), s.guest_name) AS guest_name
            FROM guest_stays s
            LEFT JOIN users u ON u.id = s.guest_user_id
           WHERE s.room_id = r.id AND s.lifecycle = 'open'
           ORDER BY s.entry_at DESC
           LIMIT 1) occ ON true
        LEFT JOIN LATERAL (
          SELECT ra.booking_id, b.reference, coalesce(nullif(btrim(u.name), ''), b.guest_name) AS guest_name
            FROM room_assignments ra
            JOIN bookings b ON b.id = ra.booking_id
            LEFT JOIN users u ON u.id = b.guest_user_id
           WHERE ra.room_id = r.id AND ra.status = 'assigned'
             AND ra.occupies @> ${today}::date
             AND b.status IN ('confirmed', 'pending_approval')
           LIMIT 1) hold ON true
       WHERE r.workspace_id = ${workspaceId}
         AND r.property_id = ${propertyId}
       ORDER BY r.label`);
    return rows.map((r) => ({
      id: String(r.id),
      label: (r.label as string | null) ?? null,
      roomTypeId: String(r.room_type_id),
      roomTypeName: String(r.room_type_name),
      status: r.status as BoardRoomRow['status'],
      housekeeping: r.housekeeping_status as BoardRoomRow['housekeeping'],
      housekeepingUpdatedAt: dateOrNull(r.housekeeping_updated_at),
      occupantStayId: (r.occupant_stay_id as string | null) ?? null,
      occupantName: (r.occupant_name as string | null) ?? null,
      occupantPlannedExitAt: dateOrNull(r.occupant_planned_exit_at),
      holdBookingId: (r.hold_booking_id as string | null) ?? null,
      holdReference: (r.hold_reference as string | null) ?? null,
      holdGuestName: (r.hold_guest_name as string | null) ?? null,
    }));
  }

  /**
   * The property's room types, with the default rate plan's price (else the
   * type's base price) and the beds of each bedroom's default configuration.
   */
  async roomTypes(workspaceId: string, propertyId: string): Promise<BoardRoomTypeRow[]> {
    const rows = await this.rows(sql`
      SELECT rt.id, rt.name, coalesce(rt.max_guests, rt.capacity) AS sleeps,
             coalesce(
               (SELECT rp.base_price_rwf FROM rate_plans rp
                 WHERE rp.room_type_id = rt.id AND rp.is_default AND rp.status = 'active'
                 LIMIT 1),
               rt.base_price_rwf) AS rate_rwf,
             (SELECT string_agg(bd.bed_count || ' ' || lower(bt.label_en), ' · ' ORDER BY rtr.sort_order, bt.label_en)
                FROM room_type_rooms rtr
                JOIN bed_configurations bc ON bc.room_type_room_id = rtr.id AND bc.is_default
                JOIN beds bd ON bd.bed_configuration_id = bc.id
                JOIN bed_types bt ON bt.code = bd.bed_type_code
               WHERE rtr.room_type_id = rt.id) AS beds,
             rt.status = 'active' AS active
        FROM room_types rt
       WHERE rt.workspace_id = ${workspaceId}
         AND rt.property_id = ${propertyId}
       ORDER BY coalesce(rt.base_price_rwf, 0), rt.name`);
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sleeps: numOrNull(r.sleeps),
      rateRwf: numOrNull(r.rate_rwf),
      beds: (r.beds as string | null) ?? null,
      active: r.active === true,
    }));
  }
}

/**
 * A uuid[] literal for `= ANY(...)`. Every element is checked against the uuid
 * shape before it is spliced, so nothing a caller typed can reach the SQL; the
 * ids come from rows this repository read or from the caller's verified scope.
 */
function uuidArray(ids: readonly string[]): string {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of ids) if (!UUID.test(id)) throw new Error(`not a uuid: ${id}`);
  return `ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`;
}
