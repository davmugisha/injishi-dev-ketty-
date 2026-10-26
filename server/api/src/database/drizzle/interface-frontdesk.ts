/**
 * The front desk's additions for the new interface (real-data, frontdesk leaf).
 *
 * Only an enum lives here: the desk's new facts are COLUMNS on the rows that
 * already carry the reservation and the stay (`bookings`, `guest_stays` in
 * `hospitality.ts`), because each is one fact about one row and a side table
 * would be a second place to read it from.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Where a booking came from. `bookings.channel` is nullable: every booking made
 * before the column existed came through the marketplace, and a null reads as
 * that. Mirrors `BookingChannel` in `@injishi/contracts`.
 */
export const bookingChannelEnum = pgEnum('booking_channel', [
  'marketplace',
  'direct',
  'phone',
  'travel_agent',
  'corporate',
  'channel_manager',
  'walk_in',
]);
