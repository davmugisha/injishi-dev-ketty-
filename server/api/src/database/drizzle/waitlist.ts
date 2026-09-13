/**
 * §11 WAITLIST (ADR-048).
 *
 * One table, for the period between `www.injishi.com` resolving and the
 * product opening. It joins to `districts` and to nothing else, which is what
 * makes it cheap to leave behind: launch day deletes the code that reads it,
 * and this table stops being written to.
 *
 * The migration that creates it is NEVER deleted at launch. Deleting a Drizzle
 * migration file drops no table, destroys no data, and desyncs
 * `meta/_journal.json` for anyone rebuilding the database from scratch. If the
 * table is ever genuinely unwanted, removing it is a forward migration
 * (ADR-048 AC-21).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import {
  waitlistAudienceEnum,
  waitlistPropertyTypeEnum,
  waitlistSizeBandEnum,
} from './enums';
import { districts } from './geography';

export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    audience: waitlistAudienceEnum('audience').notNull(),
    /** Stored lower-cased and trimmed by the contract, so one mailbox is one row. */
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    /**
     * E.164 for an owner, because the contract normalises before it gets here.
     * Whatever a traveller typed otherwise: their number is optional and they
     * may be abroad, and refusing a foreign number loses a signup for nothing.
     */
    phone: text('phone'),
    businessName: text('business_name'),
    /** Integer, not uuid: geography carries meaningful smart-codes (schema.ts §1). */
    districtId: integer('district_id').references(() => districts.id),
    propertyType: waitlistPropertyTypeEnum('property_type'),
    sizeBand: waitlistSizeBandEnum('size_band'),
    /**
     * Consent for anything BEYOND being told that Injishi opened. Separate,
     * unticked and never required, which is what Law 058/2021 asks for when a
     * purpose is stated on the form and a second one is not.
     */
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    /**
     * The opaque key in every email's unsubscribe link. A random uuid, so it
     * needs no signing secret, and revoking one is regenerating the column.
     */
    unsubscribeToken: uuid('unsubscribe_token').notNull().defaultRandom(),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    /**
     * Set instead of deleting the row. A deleted row would be re-signed-up by
     * the next import and the person would be mailed again, which is the one
     * thing unsubscribing must guarantee cannot happen. Any send filters on
     * `unsubscribed_at is null`.
     */
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    /**
     * One row per person, case-insensitively. This index is what answers
     * `alreadyJoined` without a read before the write, so two simultaneous
     * submissions of one address cannot both create a row (AC-10).
     */
    uniqueIndex('waitlist_signups_email_uk').on(sql`lower(${t.email})`),
    uniqueIndex('waitlist_signups_unsubscribe_token_uk').on(t.unsubscribeToken),
    index('waitlist_signups_created_at_idx').on(t.createdAt.desc()),
    index('waitlist_signups_district_idx').on(t.districtId),
    /**
     * An owner row is complete or it does not exist, for ANY caller and not
     * only for the form. A direct API call that bypassed the contract still
     * cannot write half an owner (AC-14).
     */
    check(
      'waitlist_owner_complete',
      sql`(${t.audience} <> 'owner') OR (
        ${t.phone} IS NOT NULL
        AND ${t.businessName} IS NOT NULL
        AND ${t.districtId} IS NOT NULL
        AND ${t.propertyType} IS NOT NULL
        AND ${t.sizeBand} IS NOT NULL
      )`,
    ),
    /** The same +250 rule `packages/contracts/src/phone.ts` already enforces. */
    check(
      'waitlist_owner_phone_rw',
      sql`(${t.audience} <> 'owner') OR (${t.phone} ~ '^[+]250(72|73|78|79)[0-9]{7}$')`,
    ),
  ],
);
