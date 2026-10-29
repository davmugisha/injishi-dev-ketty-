/**
 * Guests and local leaders (P5, blueprint 1.2).
 *
 * A guest staying overnight in a rented home is registered by the tenant (for
 * their lease) or by the landlord (their own guests at a building). Each
 * registration is delivered, at filing, to the local leaders of the home's
 * area: one `guest_registration_routes` row per step of the chain (village
 * leader, sector DASSO, cell executive secretary, then the district officer
 * for a Rwandan guest or the district immigration officer for a guest from
 * abroad). A step whose post nobody holds keeps `assignment_id` null and waits.
 *
 * The reference lists the form offers are tables too: `countries` (ISO 3166-1,
 * Rwanda first) and `guest_relationships`. Both are seeded by the migration and
 * kept by `scripts/reference-data.mjs`.
 *
 * A LEAF: it imports auth, geography, org, inventory and residence and nothing
 * imports it back, so it adds no schema import cycle.
 *
 * Records are kept 12 months after departure; the purge leaves monthly counts
 * in `guest_purge_tallies` so a report over an old period still adds up.
 */
import { GuestHostKind, GuestRegistrationStatus } from '@injishi/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { idKindEnum, oversightRoleEnum } from './enums';
import { cells, districts, provinces, sectors, villages } from './geography';
import { properties, rentalUnits } from './inventory';
import { oversightAssignments, orgs, workspaces } from './org';
import { leases } from './residence';

export const guestHostKindEnum = pgEnum('guest_host_kind', GuestHostKind.options);
export const guestRegistrationStatusEnum = pgEnum('guest_registration_status', GuestRegistrationStatus.options);

/** ISO 3166-1 alpha-2 countries, Rwanda first (`sort_order` 0), the rest by name. */
export const countries = pgTable(
  'countries',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(100),
    active: boolean('active').notNull().default(true),
  },
  (t) => [check('countries_code_shape', sql`${t.code} ~ '^[A-Z]{2}$'`)],
);

/** Who a guest is to the host. `needs_detail` asks for a few words ("Other"). */
export const guestRelationships = pgTable('guest_relationships', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull(),
  needsDetail: boolean('needs_detail').notNull().default(false),
  active: boolean('active').notNull().default(true),
});

export const guestRegistrations = pgTable(
  'guest_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    hostKind: guestHostKindEnum('host_kind').notNull(),
    /** The tenant's lease; null for a landlord's own guest. */
    leaseId: uuid('lease_id').references(() => leases.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    unitId: uuid('unit_id').references(() => rentalUnits.id),
    registeredByUserId: uuid('registered_by_user_id')
      .notNull()
      .references(() => users.id),
    /**
     * Where the home was when the guest was filed, down to the village. Null
     * levels are not known yet (a building with no village on record): those
     * steps wait, and setting the village fills them in for guests still to
     * come or staying.
     */
    villageId: integer('village_id').references(() => villages.id),
    cellId: integer('cell_id').references(() => cells.id),
    sectorId: integer('sector_id').references(() => sectors.id),
    districtId: integer('district_id').references(() => districts.id),
    fullName: text('full_name').notNull(),
    /** E.164. */
    phone: text('phone').notNull(),
    nationality: text('nationality')
      .notNull()
      .references(() => countries.code),
    /** Optional: both null when no document was given. */
    idKind: idKindEnum('id_kind'),
    idNumber: text('id_number'),
    relationship: text('relationship')
      .notNull()
      .references(() => guestRelationships.code),
    relationshipOther: text('relationship_other'),
    /** RW with a village for a guest coming from somewhere in Rwanda; else the country. */
    originCountry: text('origin_country')
      .notNull()
      .references(() => countries.code),
    originVillageId: integer('origin_village_id').references(() => villages.id),
    arrivalOn: date('arrival_on').notNull(),
    departureOn: date('departure_on').notNull(),
    status: guestRegistrationStatusEnum('status').notNull().default('submitted'),
    /** The host changed it after filing (before arrival); leaders are told again. */
    changedAt: timestamp('changed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('guest_registrations_host_idx').on(t.workspaceId, t.hostKind, t.arrivalOn),
    index('guest_registrations_lease_idx').on(t.leaseId).where(sql`${t.leaseId} IS NOT NULL`),
    index('guest_registrations_property_idx').on(t.propertyId),
    index('guest_registrations_district_idx').on(t.districtId, t.arrivalOn),
    index('guest_registrations_sector_idx').on(t.sectorId, t.arrivalOn),
    index('guest_registrations_cell_idx').on(t.cellId, t.arrivalOn),
    index('guest_registrations_village_idx').on(t.villageId, t.arrivalOn),
    // The 12 month purge reads by departure.
    index('guest_registrations_departure_idx').on(t.departureOn),
    check(
      'guest_registrations_host_shape',
      sql`(${t.hostKind} = 'tenant' AND ${t.leaseId} IS NOT NULL) OR (${t.hostKind} = 'landlord' AND ${t.leaseId} IS NULL)`,
    ),
    // A level is known only when every level above it is.
    check(
      'guest_registrations_area_shape',
      sql`(${t.villageId} IS NULL OR ${t.cellId} IS NOT NULL)
          AND (${t.cellId} IS NULL OR ${t.sectorId} IS NOT NULL)
          AND (${t.sectorId} IS NULL OR ${t.districtId} IS NOT NULL)`,
    ),
    check('guest_registrations_name_present', sql`length(btrim(${t.fullName})) > 1`),
    check('guest_registrations_phone_e164', sql`${t.phone} ~ '^[+][1-9][0-9]{7,14}$'`),
    // 16 digits for a Rwandan national ID, 5 to 20 letters or digits for a passport.
    check(
      'guest_registrations_id_shape',
      sql`(${t.idKind} IS NULL AND ${t.idNumber} IS NULL)
          OR (${t.idKind} = 'national_id' AND ${t.idNumber} ~ '^[0-9]{16}$')
          OR (${t.idKind} = 'passport' AND ${t.idNumber} ~ '^[A-Z0-9]{5,20}$')`,
    ),
    check(
      'guest_registrations_relationship_other',
      sql`${t.relationshipOther} IS NULL OR length(btrim(${t.relationshipOther})) >= 2`,
    ),
    check(
      'guest_registrations_origin_shape',
      sql`(${t.originCountry} = 'RW') = (${t.originVillageId} IS NOT NULL)`,
    ),
    // Departure on or after arrival, at most 90 days later.
    check(
      'guest_registrations_dates',
      sql`${t.departureOn} >= ${t.arrivalOn} AND ${t.departureOn} - ${t.arrivalOn} <= 90`,
    ),
    check(
      'guest_registrations_cancelled_shape',
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

export const guestRegistrationRoutes = pgTable(
  'guest_registration_routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => guestRegistrations.id, { onDelete: 'cascade' }),
    /** The post's place in the chain: local government 1 to 3, DGIE 4 to 6 (7 and 8 retired posts). */
    step: smallint('step').notNull(),
    recipientRole: oversightRoleEnum('recipient_role').notNull(),
    /** The area at the role's level, with the levels above it; null while not known. */
    villageId: integer('village_id').references(() => villages.id),
    cellId: integer('cell_id').references(() => cells.id),
    sectorId: integer('sector_id').references(() => sectors.id),
    districtId: integer('district_id').references(() => districts.id),
    /** The province, for DGIE's province post. */
    provinceId: integer('province_id').references(() => provinces.id),
    /** The post it was delivered to; null while nobody holds it (waiting). */
    assignmentId: uuid('assignment_id').references(() => oversightAssignments.id),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** When the leaders holding the post were emailed. */
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    seenByUserId: uuid('seen_by_user_id').references(() => users.id),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),
    flaggedByUserId: uuid('flagged_by_user_id').references(() => users.id),
    flagNote: text('flag_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('guest_registration_routes_role_uk').on(t.registrationId, t.recipientRole),
    index('guest_registration_routes_waiting_idx')
      .on(t.recipientRole, t.districtId, t.sectorId, t.cellId, t.villageId)
      .where(sql`${t.assignmentId} IS NULL`),
    index('guest_registration_routes_assignment_idx').on(t.assignmentId),
    // Compared as text: the leader roles are added to `oversight_role` in the
    // same migration run that writes this check (blueprint 1.1).
    check(
      'guest_registration_routes_role',
      sql`${t.recipientRole}::text IN ('village_leader', 'dasso', 'cell_executive', 'sector_executive', 'district_officer', 'district_immigration', 'dgie_province', 'dgie_national', 'dgie_village', 'dgie_cell')`,
    ),
    check('guest_registration_routes_step', sql`${t.step} BETWEEN 1 AND 8`),
    check(
      'guest_registration_routes_delivered',
      sql`(${t.assignmentId} IS NULL) = (${t.deliveredAt} IS NULL)`,
    ),
    check('guest_registration_routes_seen', sql`(${t.seenAt} IS NULL) = (${t.seenByUserId} IS NULL)`),
    check(
      'guest_registration_routes_flag',
      sql`(${t.flaggedAt} IS NULL) = (${t.flagNote} IS NULL) AND (${t.flaggedAt} IS NULL) = (${t.flaggedByUserId} IS NULL)`,
    ),
  ],
);

/**
 * What the 12 month purge removed, as counts: one row per purge run, arrival
 * month, place (the deepest level known) and from abroad or not. No names,
 * numbers or homes.
 */
export const guestPurgeTallies = pgTable(
  'guest_purge_tallies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purgedAt: timestamp('purged_at', { withTimezone: true }).notNull().defaultNow(),
    /** The first day of the month the purged guests arrived in. */
    arrivalMonth: date('arrival_month').notNull(),
    villageId: integer('village_id').references(() => villages.id),
    cellId: integer('cell_id').references(() => cells.id),
    sectorId: integer('sector_id').references(() => sectors.id),
    districtId: integer('district_id').references(() => districts.id),
    /** Guests from abroad and Rwandans are counted apart: the district officer and immigration read one each. */
    fromAbroad: boolean('from_abroad').notNull(),
    registrations: integer('registrations').notNull(),
    flagged: integer('flagged').notNull(),
  },
  (t) => [
    index('guest_purge_tallies_district_idx').on(t.districtId, t.arrivalMonth),
    check(
      'guest_purge_tallies_counts',
      sql`${t.registrations} > 0 AND ${t.flagged} BETWEEN 0 AND ${t.registrations}`,
    ),
  ],
);
