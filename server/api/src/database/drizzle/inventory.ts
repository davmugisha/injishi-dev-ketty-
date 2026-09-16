/**
 * §5.2-5.7 INVENTORY.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { approvalPolicyEnum, bookingModeEnum, cancellationTierEnum, checkInMethodEnum, domainKindEnum, housekeepingStatusEnum, listingStatusEnum, rateDerivationKindEnum, ratePlanStatusEnum, roomStatusEnum, roomTypeStatusEnum } from './enums';
import { districts, sectors, villages } from './geography';
import { storedObjects } from './hospitality';
import { departments } from './operations';
import { orgMemberships, orgs, workspaces } from './org';

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    /**
     * The public address of this property on the marketplace.
     *
     * `/property/[slug]` is a page strangers and search engines read, so the
     * address is a name rather than a uuid — and it therefore has to be a
     * COLUMN rather than something a client derives, or two clients will derive
     * it differently and one of them will 404.
     *
     * Nullable, because a property in the registration pipeline has no public
     * page yet and inventing a slug for one would publish a business that has
     * not been approved. Unique where present, so two properties cannot claim
     * one address; a collision is resolved when the slug is minted, never by
     * the reader.
     */
    slug: text('slug'),
    description: text('description'),
    // ADR-009: Province -> District -> Sector, the same shape `orgs` and
    // `user_profiles` carry since D24. `district_id` is DERIVED from the sector
    // rather than asked twice, and `village_id` stays optional and below it.
    // Nullable because the rows that predate this have no sector and inventing
    // one would be worse than leaving it blank; publishing requires it.
    sectorId: integer('sector_id').references(() => sectors.id),
    villageId: integer('village_id').references(() => villages.id),
    districtId: integer('district_id').references(() => districts.id),
    // ADR-009: the street line. Same column name and meaning as
    // `orgs.address_text` for a Rwandan address.
    addressText: text('address_text'),
    latitude: numeric('latitude'),
    longitude: numeric('longitude'),
    locationPrivacy: boolean('location_privacy').notNull().default(false),
    timezone: text('timezone').notNull().default('Africa/Kigali'),
    checkInTime: time('check_in_time'),
    checkOutTime: time('check_out_time'),
    houseRules: text('house_rules'),
    // How a guest or an officer reaches the property itself, which is not
    // always how they reach its owner: a group runs several front desks.
    // Nullable, because every property that predates the setup screen has none.
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    /**
     * ADR-054: a property is a BRANCH of its org. Exactly one active branch of
     * a hospitality org is the head office, which the partial unique index
     * below holds, and the head office change is the only thing that moves it.
     */
    isHeadOffice: boolean('is_head_office').notNull().default(false),
    /**
     * The two digit branch id RRA issued for this location, which a receipt
     * signed here declares under (ADR-054 AC-F1). Null until somebody sets it,
     * and then unique within the org FOREVER, archived branches included, so a
     * retired id is never handed to a second location.
     */
    rraBranchId: text('rra_branch_id'),
    /** Set when the branch is archived. Its history stays readable. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedByUserId: uuid('archived_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('properties_org_idx').on(t.orgId),
    index('properties_district_idx').on(t.districtId),
    index('properties_sector_idx').on(t.sectorId),
    index('properties_workspace_idx').on(t.workspaceId),
    // Postgres treats NULLs as distinct in a unique index, so this constrains
    // the properties that HAVE a public address and leaves the pipeline alone.
    // It is also the index `GET /properties/slug/:slug` reads on.
    uniqueIndex('properties_slug_uk').on(t.slug),
    uniqueIndex('properties_one_head_office_uk')
      .on(t.orgId)
      .where(sql`${t.isHeadOffice} AND ${t.archivedAt} IS NULL`),
    uniqueIndex('properties_org_rra_branch_uk')
      .on(t.orgId, t.rraBranchId)
      .where(sql`${t.rraBranchId} IS NOT NULL`),
    check('properties_rra_branch_id_ck', sql`${t.rraBranchId} ~ '^[0-9]{2}$'`),
    check(
      'properties_head_office_not_archived_ck',
      sql`NOT (${t.isHeadOffice} AND ${t.archivedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * ADR-054: the branches a member is limited to.
 *
 * NO rows for a membership means it covers every branch, which is what every
 * membership that predates this table means, and what an owner always means.
 * The service refuses a row whose property belongs to another org, because a
 * foreign key cannot see that.
 */
export const orgMembershipBranches = pgTable(
  'org_membership_branches',
  {
    orgMembershipId: uuid('org_membership_id')
      .notNull()
      .references(() => orgMemberships.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgMembershipId, t.propertyId] }),
    index('org_membership_branches_property_idx').on(t.propertyId),
  ],
);

/**
 * A property's photographs (ADR-053).
 *
 * **This replaced `properties.photo_object_keys`, a `jsonb` array of keys.** The
 * array was fine while photographs were decoration. ADR-053 made at least one a
 * condition of publishing, which makes them load bearing, and an array cannot
 * carry a cover flag, an order that survives an edit, or a caption — and a key
 * sitting in a `jsonb` blob is invisible to retention and legal hold.
 *
 * A row inherits all of that through `stored_objects`, which is the same
 * reasoning that put certificates in `org_certificates` rather than in columns
 * on `orgs`.
 */
export const propertyPhotos = pgTable(
  'property_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    objectKey: text('object_key')
      .notNull()
      .references((): AnyPgColumn => storedObjects.objectKey),
    /** 0 based and dense. The operator's chosen order, not an upload order. */
    position: integer('position').notNull(),
    isCover: boolean('is_cover').notNull().default(false),
    caption: text('caption'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('property_photos_property_idx').on(t.propertyId),
    // One photograph per slot, so a reorder cannot leave two rows claiming the
    // same place and a reader cannot have to break the tie arbitrarily.
    uniqueIndex('property_photos_position_uk').on(t.propertyId, t.position),
    // Exactly one cover. PARTIAL, because `is_cover = false` is the ordinary case
    // and constraining those would allow only one non-cover photograph.
    uniqueIndex('property_photos_cover_uk')
      .on(t.propertyId)
      .where(sql`${t.isCover}`),
  ],
);


export const roomTypes = pgTable(
  'room_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    domain: domainKindEnum('domain').notNull(),

    // --- PHYSICAL: what the guest gets. Stays on the room type. -----------
    /**
     * Occupancy caps are PHYSICAL ("what the beds hold") and belong here.
     * The COMMERCIAL base occupancy ("what the price covers") lives on
     * `rate_plans.base_occupancy` - fusing the two prevents two rate plans on
     * one room from anchoring at different occupancies (F-L04).
     */
    maxGuests: integer('max_guests'),
    maxAdults: integer('max_adults'),
    maxChildren: integer('max_children'),
    maxInfants: integer('max_infants'),
    checkInMethod: checkInMethodEnum('check_in_method'),
    amenityDetail: jsonb('amenity_detail'),
    status: roomTypeStatusEnum('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    // --- DEPRECATED (F-L03/F-L07 expand phase) ----------------------------
    // These are superseded but NOT yet dropped: the booking engine, contracts
    // and apps/web still read them. Each room type now also has a seeded
    // "Standard rate" `rate_plans` row carrying the same values verbatim, so
    // behaviour is bit-identical. The contract phase drops these columns in the
    // same coordinated change that updates packages/contracts + apps/web.
    /** @deprecated superseded by max_guests/max_adults/... (F-L04). */
    capacity: integer('capacity'),
    /** @deprecated derived from sellable `rooms`; never authoritative (F-L07). */
    roomCount: integer('room_count').notNull().default(1),
    /** @deprecated moved to `rate_plans.base_price_rwf` (F-L03). */
    basePriceRwf: amount('base_price_rwf'),
    /** @deprecated moved to `rate_plans.caution_rwf` (F-L03, residence terms). */
    cautionRwf: amount('caution_rwf'),
    currency: currency(),
    /** @deprecated moved to `rate_plans.booking_mode` (F-L03). */
    bookingMode: bookingModeEnum('booking_mode'),
    /** @deprecated moved to `rate_plans.approval_policy` (F-L03). */
    approvalPolicy: approvalPolicyEnum('approval_policy'),
    /** @deprecated moved to `rate_plans.cancellation_tier` (F-L03). */
    cancellationTier: cancellationTierEnum('cancellation_tier'),
    /** @deprecated a non-refundable RATE PLAN replaces this boolean (F-L03). */
    nonrefundableEligible: boolean('nonrefundable_eligible')
      .notNull()
      .default(false),
    /** @deprecated moved to `rate_plans.min_stay` (F-L03/F-L08). */
    minStay: integer('min_stay'),
    /** @deprecated moved to `rate_plans.max_stay` (F-L03/F-L08). */
    maxStay: integer('max_stay'),
    /** @deprecated moved to `rate_plans.advance_notice_hours` (F-L03). */
    advanceNoticeHours: integer('advance_notice_hours'),
    /** @deprecated moved to `rate_plans.weekly_discount_pct` (F-L03). */
    weeklyDiscountPct: numeric('weekly_discount_pct'),
    /** @deprecated moved to `rate_plans.monthly_discount_pct` (F-L03). */
    monthlyDiscountPct: numeric('monthly_discount_pct'),
    /**
     * The USALI department this room type's revenue belongs to (ADR-016,
     * AC-14). Always the property's Rooms department in practice, and the
     * reason a room charge can name a department without asking anybody.
     *
     * Nullable, and backfilled by migration phase 1 for every row that already
     * exists. It stays nullable because a room type may be created in the same
     * breath as a property whose departments are still being written, and a
     * NOT NULL here would make that ordering a deploy problem.
     */
    departmentId: uuid('department_id').references(
      (): AnyPgColumn => departments.id,
    ),
    ...timestamps,
  },
  (t) => [
    index('room_types_property_idx').on(t.propertyId),
    index('room_types_workspace_idx').on(t.workspaceId),
    index('room_types_department_idx').on(t.departmentId),
    index('room_types_domain_idx').on(t.domain),
    check(
      'room_types_approval_policy_shape',
      sql`(${t.bookingMode} = 'request_to_book') OR (${t.approvalPolicy} IS NULL)`,
    ),
  ],
);


export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    label: text('label'),
    /**
     * INVENTORY status: does this room count as sellable? Owned by Maintenance
     * (F-L01 matrix). Orthogonal to `housekeepingStatus` below.
     * With F-L07, the count of sellable rooms IS the inventory truth - there is
     * no authoritative `room_types.room_count` to disagree with it.
     */
    status: roomStatusEnum('status').notNull().default('available'),
    /**
     * HOUSEKEEPING status (F-L09 / F-P04). Owned by Housekeeping. A checkout
     * flips this to `dirty` WITHOUT touching `status` - the two dimensions are
     * independent, exactly as every real PMS separates them.
     */
    housekeepingStatus: housekeepingStatusEnum('housekeeping_status')
      .notNull()
      .default('clean'),
    housekeepingUpdatedAt: timestamp('housekeeping_updated_at', {
      withTimezone: true,
    }),
    housekeepingUpdatedByUserId: uuid('housekeeping_updated_by_user_id').references(
      () => users.id,
    ),
    ...timestamps,
  },
  (t) => [
    index('rooms_room_type_idx').on(t.roomTypeId),
    index('rooms_housekeeping_idx').on(t.propertyId, t.housekeepingStatus),
    index('rooms_workspace_idx').on(t.workspaceId),
    /**
     * One door, one label, per property (platform audit step 3). The service
     * refuses a collision first and more strictly (case and spacing
     * insensitive, `domain/room-labels.ts`); this is the backstop for two
     * concurrent adds that both passed that read. Its 23505 is answered with
     * the same refusal. Partial, because an unlabelled room collides with
     * nothing.
     */
    uniqueIndex('rooms_property_label_uk')
      .on(t.propertyId, t.label)
      .where(sql`${t.label} IS NOT NULL`),
  ],
);


export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});


export const amenities = pgTable('amenities', {
  code: text('code').primaryKey(),
  category: text('category'),
  /**
   * The OpenTravel `RMA` (room amenity) code this maps to (F-L06). Rwanda-
   * specific entries use a documented extension range and MUST still declare
   * their nearest OTA equivalent here, exactly as Booking.com does with its
   * 5000+ proprietary range. Null only for a code with no OTA analogue.
   */
  otaCode: text('ota_code'),
  labelEn: text('label_en').notNull(),
  labelRw: text('label_rw'),
  active: boolean('active').notNull().default(true),
});


export const propertyAmenities = pgTable(
  'property_amenities',
  {
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    amenityCode: text('amenity_code')
      .notNull()
      .references(() => amenities.code),
    detail: jsonb('detail'),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.amenityCode] })],
);


export const roomTypeAmenities = pgTable(
  'room_type_amenities',
  {
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    amenityCode: text('amenity_code')
      .notNull()
      .references(() => amenities.code),
    detail: jsonb('detail'),
  },
  (t) => [primaryKey({ columns: [t.roomTypeId, t.amenityCode] })],
);

// ---------------------------------------------------------------------------
// §5.8  LISTING INVENTORY  (F-L03/F-L04/F-L06)
//
// The industry-standard model (Booking.com, Expedia and OpenTravel converge on
// it; see docs/listing-inventory-standards-audit.md):
//
//   Property -> Room type (PHYSICAL) -> Rate plan (COMMERCIAL)
//                     |                      |
//                     +-- Product = room type x rate plan  <- the sellable SKU
//                                            |
//                              per date: price, availability, restrictions (ARI)
//
// The room type is the BOOKABLE UNIT and pools inventory; the physical `rooms`
// row is operational and is assigned at check-in, never sold.
// ---------------------------------------------------------------------------


/**
 * OpenTravel `BED` code list as a seeded catalog (F-L06). A table, not a hard
 * enum, for the same reason `amenities` is one (§5.5): it becomes admin-editable
 * without a migration. `ota_code` carries the upstream OTA value (e.g. Double =
 * 249, King = 58, Queen = 86, Twin = 113, Single = 203, Sofa bed = 102).
 */
export const bedTypes = pgTable('bed_types', {
  code: text('code').primaryKey(),
  otaCode: text('ota_code'),
  labelEn: text('label_en').notNull(),
  labelRw: text('label_rw'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});


/** OpenTravel `MPT` (meal plan) code list, same seeded-catalog shape (F-L06). */
export const mealPlans = pgTable('meal_plans', {
  code: text('code').primaryKey(),
  otaCode: text('ota_code'),
  labelEn: text('label_en').notNull(),
  labelRw: text('label_rw'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});


/**
 * The COMMERCIAL half of the model (F-L03): the terms a room type is sold on.
 * One room type has 1..N rate plans (Flexible, Non-refundable, ...) sharing ONE
 * pool of physical rooms.
 *
 * Locked-at-time (D8) still holds: a booking snapshots its rate, tier and terms,
 * so editing a rate plan NEVER rewrites a placed booking.
 */
export const ratePlans = pgTable(
  'rate_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    status: ratePlanStatusEnum('status').notNull().default('active'),
    /** Exactly one default plan per room type (partial unique below). */
    isDefault: boolean('is_default').notNull().default(false),

    // money + the COMMERCIAL occupancy anchor
    basePriceRwf: amount('base_price_rwf'),
    /** Nightly for `hospitality`; monthly rent for `residence`. */
    cautionRwf: amount('caution_rwf'),
    currency: currency(),
    /**
     * How many guests `base_price_rwf` covers. COMMERCIAL - distinct from the
     * room type's PHYSICAL `max_guests`. Extra-person pricing (F-L05) bridges
     * base_occupancy -> max_guests.
     */
    baseOccupancy: integer('base_occupancy'),
    /** Price when only one guest stays (the standard-pricing second point). */
    singleOccupancyPriceRwf: amount('single_occupancy_price_rwf'),

    // terms
    cancellationTier: cancellationTierEnum('cancellation_tier'),
    /** This plan IS non-refundable (replaces the room-type boolean). */
    nonRefundable: boolean('non_refundable').notNull().default(false),
    bookingMode: bookingModeEnum('booking_mode'),
    approvalPolicy: approvalPolicyEnum('approval_policy'),
    mealPlanCode: text('meal_plan_code').references(() => mealPlans.code),
    minStay: integer('min_stay'),
    maxStay: integer('max_stay'),
    advanceNoticeHours: integer('advance_notice_hours'),
    weeklyDiscountPct: numeric('weekly_discount_pct'),
    monthlyDiscountPct: numeric('monthly_discount_pct'),

    /**
     * Rate relations (F-L03): a child plan follows a parent, e.g.
     * Non-refundable = Flexible - 10%. Distinct from occupancy offsets (F-L05).
     */
    parentRatePlanId: uuid('parent_rate_plan_id').references(
      (): AnyPgColumn => ratePlans.id,
    ),
    derivationKind: rateDerivationKindEnum('derivation_kind'),
    derivationValue: numeric('derivation_value'),

    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('rate_plans_room_type_idx').on(t.roomTypeId),
    index('rate_plans_workspace_idx').on(t.workspaceId),
    // Mirrors the room_types check: approval policy is meaningful only for
    // request_to_book.
    check(
      'rate_plans_approval_policy_shape',
      sql`(${t.bookingMode} = 'request_to_book') OR (${t.approvalPolicy} IS NULL)`,
    ),
    // A derivation is all-or-nothing: parent, kind and value travel together.
    check(
      'rate_plans_derivation_shape',
      sql`(${t.parentRatePlanId} IS NULL AND ${t.derivationKind} IS NULL AND ${t.derivationValue} IS NULL)
          OR (${t.parentRatePlanId} IS NOT NULL AND ${t.derivationKind} IS NOT NULL AND ${t.derivationValue} IS NOT NULL)`,
    ),
    // A plan may not derive from itself.
    check('rate_plans_no_self_parent', sql`${t.parentRatePlanId} <> ${t.id}`),
    uniqueIndex('rate_plans_one_default_per_room_type_uk')
      .on(t.roomTypeId)
      .where(sql`${t.isDefault}`),
  ],
);


/**
 * A bedroom WITHIN a unit (F-L04). This is what makes a 2-bedroom serviced
 * apartment model with no bespoke schema: one room type, two `room_type_rooms`.
 * A simple hotel double is one room type with one of these.
 *
 * NOT to be confused with `rooms` (physical, sellable-countable, assigned at
 * check-in) or `spaces` (property-level, descriptive, never bookable).
 */
export const roomTypeRooms = pgTable(
  'room_type_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    /** e.g. "Bedroom 1", "Living room". */
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('room_type_rooms_room_type_idx').on(t.roomTypeId)],
);


/**
 * ALTERNATIVE bed arrangements for one bedroom (F-L04): "twin OR king" is ONE
 * room type with two configurations, not two room types. Exactly one is the
 * default (partial unique below), mirroring Booking.com's
 * `is_default_configuration`.
 */
export const bedConfigurations = pgTable(
  'bed_configurations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeRoomId: uuid('room_type_room_id')
      .notNull()
      .references(() => roomTypeRooms.id, { onDelete: 'cascade' }),
    /** Optional operator label, e.g. "King setup". */
    label: text('label'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('bed_configurations_room_idx').on(t.roomTypeRoomId),
    uniqueIndex('bed_configurations_one_default_uk')
      .on(t.roomTypeRoomId)
      .where(sql`${t.isDefault}`),
  ],
);


/**
 * The beds in one configuration (F-L04). `bed_count` is MANDATORY: Booking.com
 * errors without it, so a null here is un-publishable inventory.
 */
export const beds = pgTable(
  'beds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bedConfigurationId: uuid('bed_configuration_id')
      .notNull()
      .references(() => bedConfigurations.id, { onDelete: 'cascade' }),
    bedTypeCode: text('bed_type_code')
      .notNull()
      .references(() => bedTypes.code),
    bedCount: integer('bed_count').notNull(),
    ...timestamps,
  },
  (t) => [
    index('beds_configuration_idx').on(t.bedConfigurationId),
    check('beds_count_positive', sql`${t.bedCount} > 0`),
  ],
);


export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    status: listingStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    version: integer('version').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique('listings_property_uk').on(t.propertyId),
    index('listings_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * Sparse per-date overrides, now keyed per PRODUCT (room type x rate plan), not
 * per room type (F-L08). This is the ARI surface: Availability, Rates,
 * Inventory. A row exists only while >= 1 field is set; clearing the last field
 * deletes it. Bookings and open stays are overlaid at read time, never stored.
 *
 * Re-keying was safe to do outright: nothing writes this table (no endpoint, no
 * seed), so it is provably empty and `rate_plan_id` could land NOT NULL.
 */
export const dateOverrides = pgTable(
  'date_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    /** The other half of the product key: overrides are per rate plan. */
    ratePlanId: uuid('rate_plan_id')
      .notNull()
      .references(() => ratePlans.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    customNightlyRateRwf: amount('custom_nightly_rate_rwf'),
    /**
     * Stop-sell. ("Stop-sell" is industry vernacular; the field is `closed`,
     * matching Booking.com.) Kept as `blocked` for now - renamed to `closed` in
     * the contract phase so no reader breaks mid-flight.
     */
    blocked: boolean('blocked').notNull().default(false),

    // --- Length-of-stay: TWO distinct semantics, both baseline (F-L08) ------
    // The subtle killer: "min nights if the stay INCLUDES this day" is NOT the
    // same rule as "min nights if the guest CHECKS IN on this day". Modelling
    // only one is what forces an expensive retrofit later, so both land now
    // while the table is empty.
    /** Min nights for any stay that COVERS this day (stay-through). */
    minNights: integer('min_nights'),
    /** Max nights for any stay that COVERS this day (stay-through). */
    maxNights: integer('max_nights'),
    /** Min nights when the guest CHECKS IN on this day. */
    minStayArrival: integer('min_stay_arrival'),
    /** Max nights when the guest CHECKS IN on this day. */
    maxStayArrival: integer('max_stay_arrival'),

    /** CTA: no check-in on this day (does not block staying through it). */
    closedOnArrival: boolean('closed_on_arrival').notNull().default(false),
    /** CTD: no check-out on this day. */
    closedOnDeparture: boolean('closed_on_departure').notNull().default(false),

    /** Never exposed to a guest. */
    hostPrivateNote: text('host_private_note'),
  },
  (t) => [
    uniqueIndex('date_overrides_product_day_uk').on(
      t.roomTypeId,
      t.ratePlanId,
      t.day,
    ),
    index('date_overrides_rate_plan_idx').on(t.ratePlanId),
  ],
);

// ===========================================================================
// §6  HOSPITALITY  (bookings, stays, identities, reviews, collections, guides)
// ===========================================================================
