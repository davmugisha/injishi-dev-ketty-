/**
 * The marketplace and the guest's web account of the new interface (real-data leaf 1.3.2).
 *
 * WHAT THIS ADDS, AND WHAT IT DOES NOT. Whether a property may be shown and what it costs stay where
 * they always were: a published listing of an active business (ADR-053 contract rule 1) and the room
 * types' rates. These tables carry only what the interface's marketplace DRAWS on top of that: the
 * marketplace card of a property (its kind, the card picture and caption, the highlights, the places
 * nearby, the house rules as a list, the homes facts) and of a room type (bed, size, highlight,
 * picture). A property with no card is still bookable through every existing route; the new interface
 * simply has nothing to draw it with, so it does not list it.
 *
 * PICTURES. `stock_photo` is a key into the interface's licensed stock library
 * (`@injishi/data/media`), which is what the interface renders today. Operator uploaded photographs
 * live in `property_photos` and reach the public through the photo route; when the interface draws
 * those, this column goes.
 *
 * CONSENT. `user_consents` is an append-only history: a change of mind is a new row, never an update,
 * and the newest row per purpose is the person's current choice. Booking messages cannot be refused,
 * because a booking cannot be delivered without them; the table refuses that row itself.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { properties, roomTypes } from './inventory';
import { workspaces } from './org';

/** The kinds a marketplace card names (the explore filter's vocabulary). */
export const MARKET_PROPERTY_KINDS = ['hotel', 'lodge', 'tented', 'guest', 'apartment', 'villa', 'house', 'studio'] as const;

/** What a person may grant or refuse on their account. */
export const CONSENT_PURPOSES = [
  'booking_messages',
  'share_phone_with_hosts',
  'review_reminders',
  'marketing_offers',
  'personalisation',
] as const;

const kinds = sql.raw(MARKET_PROPERTY_KINDS.map((k) => `'${k}'`).join(', '));
const purposes = sql.raw(CONSENT_PURPOSES.map((p) => `'${p}'`).join(', '));

/**
 * A property's marketplace card. One per property; the property's own workspace, so the business that
 * owns the property owns its card. The list columns are ordered display lists (validated by the
 * contract schemas in `@injishi/contracts` on the way out), never queried into.
 */
export const marketPropertyProfiles = pgTable(
  'market_property_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .unique()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: text('kind').notNull(),
    stockPhoto: text('stock_photo').notNull(),
    caption: text('caption').notNull().default(''),
    /** `[{ photo, caption }]`, the cover excluded. */
    gallery: jsonb('gallery').notNull().default(sql`'[]'::jsonb`),
    /** `[{ icon, title, desc }]`. */
    highlights: jsonb('highlights').notNull().default(sql`'[]'::jsonb`),
    /** `[{ place, distance }]`: the distances the property states, not a computed route. */
    nearby: jsonb('nearby').notNull().default(sql`'[]'::jsonb`),
    /** `[{ label, value }]`, beside `properties.house_rules` (the prose the existing routes serve). */
    houseRuleItems: jsonb('house_rule_items').notNull().default(sql`'[]'::jsonb`),
    mapLabel: text('map_label'),
    /** Homes only. Null for a studio, which has no separate bedroom. */
    bedrooms: integer('bedrooms'),
    floorAreaSqm: integer('floor_area_sqm'),
    /** Homes only: the first day a tenant may move in. Null means now. */
    availableFrom: date('available_from'),
    ...timestamps,
  },
  (t) => [
    index('market_property_profiles_scope_idx').on(t.workspaceId, t.kind),
    check('market_property_profiles_kind', sql`${t.kind} IN (${kinds})`),
    check('market_property_profiles_bedrooms', sql`${t.bedrooms} IS NULL OR ${t.bedrooms} >= 0`),
    check('market_property_profiles_area', sql`${t.floorAreaSqm} IS NULL OR ${t.floorAreaSqm} > 0`),
    check(
      'market_property_profiles_lists',
      sql`jsonb_typeof(${t.gallery}) = 'array' AND jsonb_typeof(${t.highlights}) = 'array'
          AND jsonb_typeof(${t.nearby}) = 'array' AND jsonb_typeof(${t.houseRuleItems}) = 'array'`,
    ),
  ],
);

/** A room type's marketplace card. Price, capacity and booking mode stay on the room type. */
export const marketRoomProfiles = pgTable(
  'market_room_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .unique()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    bed: text('bed').notNull().default(''),
    sizeSqm: integer('size_sqm'),
    highlight: text('highlight').notNull().default(''),
    stockPhoto: text('stock_photo').notNull(),
    ...timestamps,
  },
  (t) => [
    index('market_room_profiles_scope_idx').on(t.workspaceId),
    check('market_room_profiles_size', sql`${t.sizeSqm} IS NULL OR ${t.sizeSqm} > 0`),
  ],
);

/**
 * A person's consent choices, append-only. Scoped by the person's own (personal) workspace, which is
 * where everything a guest owns lives (F-S11).
 */
export const userConsents = pgTable(
  'user_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull(),
    /** The privacy notice the choice was made under. */
    policyVersion: text('policy_version').notNull(),
    /** Where it was made: the account page or the checkout. */
    source: text('source').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_consents_latest_idx').on(t.userId, t.purpose, t.recordedAt),
    check('user_consents_purpose', sql`${t.purpose} IN (${purposes})`),
    check('user_consents_source', sql`${t.source} IN ('account', 'checkout')`),
    check('user_consents_booking_messages_required', sql`${t.purpose} <> 'booking_messages' OR ${t.granted}`),
  ],
);
