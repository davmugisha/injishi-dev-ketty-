import { sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  dateOverrides,
  guestStays,
  paymentAttempts,
  properties,
  ratePlans,
  rooms,
  roomTypes,
} from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';
import {
  nightlyCapacity,
  type NightCapacity,
  type RoomTypeFacts,
  type WalkIn,
} from '../domain/sellable-capacity';

/**
 * The ONE read of sellable capacity (platform audit step 3).
 *
 * Three callers, one query: the calendar (`BookingRepository.freeUnitsByNight`),
 * the payment hold (`PaymentAttemptRepository.claimBookingHold`) and the booking
 * write (`BookingRepository.create`). The last two pass their transaction
 * handle AFTER taking the row lock on the room type, so what is counted is what
 * stands when the lock is held, not a number read before it (the old
 * `roomCount` came off the room type before the transaction opened).
 *
 * This gathers facts and nothing more; the rule that turns them into a number
 * is `nightlyCapacity` in `domain/sellable-capacity.ts`, where it is tested.
 *
 * Local dates come from the property's own `timezone`, the same zone its
 * check in and check out times are in. A room type that does not exist answers
 * no nights, which every caller reads as nothing to sell.
 */
export async function readNightlyCapacity(
  db: Database,
  args: {
    roomTypeId: string;
    /** First night, `yyyy-mm-dd`. */
    from: string;
    /** The morning after the last night (a check out date), `yyyy-mm-dd`. */
    to: string;
    now: Date;
    /**
     * Count live payment holds as held (default true). The booking write turns
     * this off: its press already claimed its hold before any charge.
     */
    countHolds?: boolean;
    /** A payment hold not to count against itself: the press re-claiming it. */
    excludeAttemptKey?: string;
    /** A booking not to count against itself: the reservation a desk change is moving (0120). */
    excludeBookingId?: string;
  },
): Promise<NightCapacity[]> {
  const { roomTypeId, from, to, now } = args;

  const facts = await db
    .execute<{
      declared_count: number;
      room_rows: number;
      available_rooms: number;
      today: string;
      default_plan_id: string | null;
      timezone: string;
    }>(sql`
      select
        rt.room_count::int as declared_count,
        (select count(*) from ${rooms} r where r.room_type_id = rt.id)::int as room_rows,
        (select count(*) from ${rooms} r
          where r.room_type_id = rt.id and r.status = 'available')::int as available_rooms,
        to_char((${now}::timestamptz at time zone p.timezone)::date, 'YYYY-MM-DD') as today,
        (select rp.id from ${ratePlans} rp
          where rp.room_type_id = rt.id and rp.is_default
          limit 1) as default_plan_id,
        p.timezone
      from ${roomTypes} rt
      join ${properties} p on p.id = rt.property_id
      where rt.id = ${roomTypeId}
    `)
    .then((r) => r.rows[0]);
  if (!facts) return [];

  // Only when rooms exist can a walk in be standing in one (rule 3).
  const walkIns: WalkIn[] =
    facts.room_rows === 0
      ? []
      : await db
          .execute<{ entry_date: string; planned_exit_date: string | null }>(sql`
            select
              to_char((gs.entry_at at time zone ${facts.timezone})::date, 'YYYY-MM-DD') as entry_date,
              to_char((gs.planned_exit_at at time zone ${facts.timezone})::date, 'YYYY-MM-DD') as planned_exit_date
            from ${guestStays} gs
            join ${rooms} r on r.id = gs.room_id
            where r.room_type_id = ${roomTypeId}
              and r.status = 'available'
              and gs.lifecycle = 'open'
              and gs.booking_id is null
              and (gs.entry_at at time zone ${facts.timezone})::date < ${to}::date
          `)
          .then((r) =>
            r.rows.map((row) => ({
              entryDate: row.entry_date,
              plannedExitDate: row.planned_exit_date,
            })),
          );

  const closedNights = new Set<string>(
    facts.default_plan_id === null
      ? []
      : await db
          .execute<{ day: string }>(sql`
            select to_char(o.day, 'YYYY-MM-DD') as day
            from ${dateOverrides} o
            where o.room_type_id = ${roomTypeId}
              and o.rate_plan_id = ${facts.default_plan_id}
              and o.blocked
              and o.day >= ${from}::date
              and o.day < ${to}::date
          `)
          .then((r) => r.rows.map((row) => row.day)),
  );

  const otherBookings: SQL = args.excludeBookingId ? sql`and b.id <> ${args.excludeBookingId}` : sql``;
  const exclude: SQL = args.excludeAttemptKey
    ? sql`and a.idempotency_key <> ${args.excludeAttemptKey}`
    : sql``;
  const holds: SQL =
    args.countHolds === false
      ? sql`0`
      : sql`(select count(*) from ${paymentAttempts} a
            where a.purpose = 'booking'
              and a.room_type_id = ${roomTypeId}
              and a.state = 'prompting'
              and a.expires_at > ${now}
              ${exclude}
              and a.check_in <= d::date
              and a.check_out > d::date)`;

  // `generate_series` drives the result, so a night with nothing held comes
  // back as zero rather than missing (ADR-047 wave E). Half open: a stay holds
  // `check_in <= night < check_out`.
  const nights = await db
    .execute<{ night: string; held: number }>(sql`
      select
        to_char(d, 'YYYY-MM-DD') as night,
        (
          (select count(*) from ${bookings} b
            where b.room_type_id = ${roomTypeId}
              and b.status in ('pending_approval', 'confirmed')
              and b.check_in <= d::date
              and b.check_out > d::date
              ${otherBookings}
              -- A stay that checked out early holds no night from its
              -- departure day on (0116).
              and (b.completed_at is null
                   or (b.completed_at at time zone 'Africa/Kigali')::date > d::date))
          +
          ${holds}
        )::int as held
      from generate_series(
        ${from}::date,
        ${to}::date - interval '1 day',
        interval '1 day'
      ) as d
      order by d
    `)
    .then((r) => r.rows.map((row) => ({ night: row.night, held: Number(row.held) })));

  const roomType: RoomTypeFacts = {
    declaredCount: Number(facts.declared_count),
    roomRows: Number(facts.room_rows),
    availableRooms: Number(facts.available_rooms),
    today: facts.today,
  };
  return nightlyCapacity({ facts: roomType, walkIns, closedNights, nights });
}
