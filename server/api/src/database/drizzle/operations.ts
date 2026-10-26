/**
 * §14 PMS OPERATIONS LAYER (ADR-016).
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
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { taxCodeEnum } from './enums';
import { bookings, guestStays } from './hospitality';
// Lazy only (inside `references`): interface-operations imports this module back.
import { amenities, properties, rooms } from './inventory';
import { ebmInvoices } from './money';
import { orgs, workspaces } from './org';
import { threads } from './messaging';
import { leases, paymentAttempts } from './residence';

// --- §14.2 departments and outlets -----------------------------------------

/**
 * USALI's two halves. `operated` departments earn (and therefore may take a
 * charge); `undistributed` ones cost. The split is what makes gross operating
 * profit fall out of the folio rather than being assembled later.
 */
export const departmentTypeEnum = pgEnum('department_type', [
  'operated',
  'undistributed',
]);


/**
 * The USALI vocabulary. Stable, so an enum rather than a catalog (D14): the
 * NAMES of a property's departments are editable, the accounting categories
 * they roll up to are not.
 */
export const departmentCategoryEnum = pgEnum('department_category', [
  'rooms',
  'fnb',
  'spa_recreation',
  'other_operated',
  'misc_income',
  'admin_general',
  'sales_marketing',
  'it',
  'engineering',
  'utilities',
  'hr',
]);


/** Soft retirement. A department is never deleted; its revenue history is why. */
export const departmentStatusEnum = pgEnum('department_status', [
  'active',
  'archived',
]);


export const outletKindEnum = pgEnum('outlet_kind', [
  'restaurant',
  'bar',
  'lounge',
  'banquet',
  'room_service',
  'spa',
  'gym',
  'pool',
  'gift_shop',
  'parking',
  'laundry',
  'business_center',
  'other',
]);


/** Operational rank inside a department. A second axis over `org_role` (D17). */
export const departmentPositionEnum = pgEnum('department_position', [
  'department_head',
  'supervisor',
  'staff',
]);


export const departmentMemberStatusEnum = pgEnum('department_member_status', [
  'active',
  'removed',
]);


/**
 * The USALI operating unit, per property (§14.2, D14).
 *
 * `property_id` null means a corporate department that spans the org. Set means
 * it belongs to one property, which is the only shape this build creates.
 *
 * Not an enum on purpose: the set is seeded from a template and then edited,
 * because a resort and a cottage do not run the same departments. The
 * `department_category` above is the stable part.
 */
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** Null = an org-wide corporate department (A and G, corporate sales). */
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    departmentType: departmentTypeEnum('department_type').notNull(),
    departmentCategory: departmentCategoryEnum('department_category').notNull(),
    /**
     * May a revenue charge post here? Operated implies true (AC-1). Kept as its
     * own column rather than derived from the type, because an operator may
     * retire a revenue centre without changing what USALI calls it.
     */
    isRevenueCenter: boolean('is_revenue_center').notNull().default(false),
    /** May a guest message or order this department directly? */
    guestRequestable: boolean('guest_requestable').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    status: departmentStatusEnum('status').notNull().default('active'),
    /**
     * Who runs this department and how to reach them, and the department's own
     * line (the restaurant's extension, the front desk's number).
     *
     * Text, not a `department_members` row. A head of department often has no
     * account yet on the day a property is set up, and the roster row needs
     * one; this is the contact card, the roster is who may work the board.
     */
    headName: text('head_name'),
    headPhone: text('head_phone'),
    phone: text('phone'),
    ...timestamps,
  },
  (t) => [
    index('departments_property_idx').on(t.propertyId),
    index('departments_workspace_idx').on(t.workspaceId),
    index('departments_org_idx').on(t.orgId),
    /**
     * One department per category per property. The template seeds exactly one
     * of each and the backfill has to be safe to run twice; without this a
     * second run silently doubles every property's department list, and the
     * Rooms lookup a room charge does becomes ambiguous.
     */
    uniqueIndex('departments_property_category_uk')
      .on(t.propertyId, t.departmentCategory)
      .where(sql`${t.propertyId} IS NOT NULL`),
    check(
      'departments_revenue_center_is_operated',
      sql`${t.isRevenueCenter} = false OR ${t.departmentType} = 'operated'`,
    ),
  ],
);


/**
 * A named place inside a department (§14.2).
 *
 * So a hotel's three restaurants roll up to one Food and Beverage profit and
 * loss line. A charge may name an outlet, and always also names the parent
 * department, so departmental revenue never depends on outlets existing.
 */
/**
 * Who may order from an outlet (ADR-050 D-o, AC-19).
 *
 * A host's control, not a presentation choice, so it is enforced in the order
 * service before anything is written and never only in the listing. The
 * default is `in_house_only`: an outlet that nobody has opened to the street
 * must not become orderable by strangers the day this column appears.
 */
export const outletOrderingAccessEnum = pgEnum('outlet_ordering_access', [
  'in_house_only',
  'walk_in_only',
  'both',
]);

/**
 * The arrangement between an outlet's operator and the hotel it sits in
 * (ADR-050 D-i). An enum because the vocabulary is stable; WHICH outlet kinds
 * may carry which value is data, the `outlets.allowed_relationships` row in
 * `config_entries`, so allowing a spa to be a tenant later is no migration.
 */
export const outletRelationshipTypeEnum = pgEnum('outlet_relationship_type', [
  'hotel_operated',
  'third_party_managed',
  'leased_tenant',
  'concession',
  'franchise',
  'revenue_share',
]);

export const outletPartyStatusEnum = pgEnum('outlet_party_status', [
  'active',
  'archived',
]);

/**
 * A tenancy's life (ADR-050 D-l): `invited` or `requested` becomes `active`
 * when the other side accepts; either may go straight to `ended` (declined);
 * nothing comes back from `ended`.
 */
export const outletTenancyStatusEnum = pgEnum('outlet_tenancy_status', [
  'invited',
  'requested',
  'active',
  'ended',
]);

export const revenueShareBasisEnum = pgEnum('revenue_share_basis', [
  'gross',
  'net',
]);

/**
 * An operator or an owner of an outlet (ADR-050 D-h).
 *
 * `org_id` is set when the party is a business registered on Injishi, and null
 * when it is only on record (a concessionaire the hotel lists before that
 * business exists here). Only a party with an org may OPERATE an outlet that is
 * not `hotel_operated`, because only an org holds a TIN and an EBM connection.
 * A hotel operated outlet points both its operator and its owner at the one
 * party row for the hotel's own org, created once per org.
 */
export const outletParties = pgTable(
  'outlet_parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Who recorded it. */
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    orgId: uuid('org_id').references(() => orgs.id),
    legalName: text('legal_name').notNull(),
    tin: text('tin'),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    status: outletPartyStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    /** One party per registered business, so a hotel's own row is found, never duplicated. */
    uniqueIndex('outlet_parties_org_uk')
      .on(t.orgId)
      .where(sql`${t.orgId} IS NOT NULL`),
    index('outlet_parties_workspace_idx').on(t.workspaceId),
  ],
);

/**
 * A hotel's consent that a tenant's outlet appears on its property
 * (ADR-050 D-l), plus the commercial terms on record.
 *
 * The revenue share columns are a RECORD, not a settlement: nothing computes or
 * moves money from them in v1 (scope Feature 34 carries that).
 */
export const outletTenancies = pgTable(
  'outlet_tenancies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id')
      .notNull()
      .references((): AnyPgColumn => outlets.id),
    hostPropertyId: uuid('host_property_id')
      .notNull()
      .references(() => properties.id),
    hostOrgId: uuid('host_org_id')
      .notNull()
      .references(() => orgs.id),
    tenantOrgId: uuid('tenant_org_id')
      .notNull()
      .references(() => orgs.id),
    status: outletTenancyStatusEnum('status').notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedReason: text('ended_reason'),
    revenueShareBps: integer('revenue_share_bps'),
    revenueShareBasis: revenueShareBasisEnum('revenue_share_basis'),
    ...timestamps,
  },
  (t) => [
    /** At most one active tenancy per outlet. */
    uniqueIndex('outlet_tenancies_active_uk')
      .on(t.outletId)
      .where(sql`${t.status} = 'active'`),
    index('outlet_tenancies_host_property_idx').on(t.hostPropertyId, t.status),
    index('outlet_tenancies_tenant_org_idx').on(t.tenantOrgId),
    check(
      'outlet_tenancies_share_bps_range',
      sql`${t.revenueShareBps} IS NULL OR (${t.revenueShareBps} >= 0 AND ${t.revenueShareBps} <= 10000)`,
    ),
  ],
);


export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    /**
     * Null for a standalone restaurant or bar with no hotel (ADR-050 D-l), the
     * same choice `departments.property_id` already made. A tenant inside a
     * hotel carries the HOST's property here, and its own workspace below.
     */
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    /** The OPERATOR's workspace: a tenant owns its row and reaches it through its own workspace. */
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    operatorPartyId: uuid('operator_party_id').references(
      (): AnyPgColumn => outletParties.id,
    ),
    ownerPartyId: uuid('owner_party_id').references(
      (): AnyPgColumn => outletParties.id,
    ),
    relationshipType: outletRelationshipTypeEnum('relationship_type')
      .notNull()
      .default('hotel_operated'),
    /**
     * The amenity this outlet also is (ADR-050 D-k), so a pool listed as an
     * amenity and sold as day passes renders once. The service requires the
     * pair to exist in `property_amenities`.
     */
    amenityCode: text('amenity_code').references(() => amenities.code),
    /**
     * The RRA branch this outlet declares under, when it differs from its
     * branch's (ADR-054 AC-F1). Null means "use the branch's". It used to be
     * NOT NULL with a `'00'` default that nothing ever read, so migration 0042
     * turned every `'00'` into null.
     */
    rraBranchId: text('rra_branch_id'),
    guestVisible: boolean('guest_visible').notNull().default(true),
    /** Minted from the name for a standalone outlet, suffixed `-2`, `-3` on collision. */
    slug: text('slug'),
    /** `{ street, district, lat, lng, timeZone }`. Required when there is no property to borrow them from. */
    address: jsonb('address'),
    /**
     * Whose TIN signs a sale made here (ADR-050, cross child contract 1).
     *
     * THE one answer to that question. Every `folio_charge` and every
     * `service_order` copies it at write time, and nothing derives it a second
     * way. Backfilled from the outlet's property's org, which is what every
     * outlet on disk is today: a hotel selling under its own TIN. Slice 4 lets
     * it differ, which is what makes a tenant restaurant possible.
     */
    taxEntityOrgId: uuid('tax_entity_org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    outletKind: outletKindEnum('outlet_kind').notNull().default('other'),
    orderingAccess: outletOrderingAccessEnum('ordering_access')
      .notNull()
      .default('in_house_only'),
    /** Service windows, e.g. `{"mon":["07:00","22:00"]}`. Null means always open. */
    hours: jsonb('hours'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: departmentStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('outlets_department_idx').on(t.departmentId),
    index('outlets_workspace_idx').on(t.workspaceId),
    index('outlets_property_idx').on(t.propertyId),
    /** D-h: an outlet run by anyone but the hotel names who runs it. */
    check(
      'outlets_operator_named',
      sql`${t.relationshipType} = 'hotel_operated' OR ${t.operatorPartyId} IS NOT NULL`,
    ),
    /** D-k: one amenity has at most one outlet face, so the facility dedupe has no tie to break. */
    uniqueIndex('outlets_property_amenity_uk')
      .on(t.propertyId, t.amenityCode)
      .where(sql`${t.amenityCode} IS NOT NULL`),
    uniqueIndex('outlets_slug_uk')
      .on(t.slug)
      .where(sql`${t.slug} IS NOT NULL`),
  ],
);


// `department_members`, who works in which department, moved to `people.ts`
// with ADR-058: it became the HR module's one roster (cross child contract 5),
// and it points at `employees`, which lives there. Declaring it here would have
// made the two schema modules import each other.


// --- §14.5 the folio and its charges ---------------------------------------

/** Whose bill this is. `guest` is the only one this build opens. */
export const folioTypeEnum = pgEnum('folio_type', [
  'guest',
  'master',
  'group',
  'house',
]);


/**
 * `open -> settled -> closed`, and `settled -> disputed -> settled`.
 *
 * `settled` means the balance reached zero. `closed` means no further charge
 * may post. Voiding a charge on a settled folio moves it back to `open`,
 * because the balance is no longer zero.
 */
export const folioStatusEnum = pgEnum('folio_status', [
  'open',
  'settled',
  'closed',
  'disputed',
]);


/**
 * The ten typed lines a bill is made of (§14.5).
 *
 * Signed: charges positive, payments and discounts negative. The sign rule is
 * fixed here and a ledger entry inherits it, so departmental revenue is a plain
 * sum with no second convention to remember.
 */
export const chargeTypeEnum = pgEnum('charge_type', [
  'room',
  'service_order',
  'pos',
  'tax',
  'service_charge',
  'adjustment',
  'discount',
  'deposit',
  'payment',
  'refund',
]);


/**
 * A guest's running bill (§14.5, D13).
 *
 * Never created through the API. The system opens one: a pre-arrival folio when
 * a booking is confirmed, and check in binds it to the stay. A bill with no
 * subject is not a thing an operator should be able to make.
 */
export const folios = pgTable(
  'folios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * A short human code, generated like `bookings.reference`: random base32,
     * checked unique, never derived from a sequence. A sequential bill number
     * tells a competitor how many guests you had last month.
     */
    folioNumber: text('folio_number').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /**
     * RESTRICT since migration 0043 (platform audit step 3). It cascaded, so
     * deleting a property (or the org above it) silently deleted every bill
     * and, through `folio_charges`, the lines a tax invoice was cut from.
     */
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    leaseId: uuid('lease_id').references(() => leases.id),
    /** Null for a walk in nobody has an account for yet. */
    guestUserId: uuid('guest_user_id').references(() => users.id),
    folioType: folioTypeEnum('folio_type').notNull().default('guest'),
    status: folioStatusEnum('status').notNull().default('open'),
    /**
     * Which bill of the stay this is (ADR-050 D-c).
     *
     * Signing locks a folio, and §7.17 allows an original to be cancelled only
     * once, so a minibar charge read the morning after departure must not spend
     * that one cancellation. It opens the next folio instead. `folio_number`
     * for a sequence above 1 is the original's with `-<sequence>` appended, so
     * the global unique on the number still holds.
     */
    folioSequence: integer('folio_sequence').notNull().default(1),
    /**
     * When the `NS` was raised over this folio. Never cleared. A folio with
     * this set accepts no new charge (D-c).
     */
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    /** §4 d and e: the client identified on the receipt, captured at close. */
    customerTin: text('customer_tin'),
    customerName: text('customer_name'),
    currency: currency(),
    /**
     * A derived cache of the sum of this folio's charges (D13, D-l).
     *
     * Recomputed from the sum under a row lock inside the charge's own
     * transaction, never incremented. Incrementing drifts permanently the first
     * time a write reaches the charges by another path, and a bill quietly
     * wrong by one line is very hard to notice.
     */
    balanceRwf: amount('balance_rwf').notNull().default(0),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('folios_number_uk').on(t.folioNumber),
    /**
     * ADR-050 D-c drops the one folio per stay assumption: a locked folio's
     * late charge opens the next sequence. One row per (stay, sequence) is what
     * replaces it, partial because a `house` or `master` folio has no stay.
     */
    uniqueIndex('folios_stay_sequence_uk')
      .on(t.guestStayId, t.folioSequence)
      .where(sql`${t.guestStayId} IS NOT NULL`),
    index('folios_workspace_status_idx').on(t.workspaceId, t.status),
    index('folios_stay_idx').on(t.guestStayId),
    index('folios_booking_idx').on(t.bookingId),
    /**
     * ADR-016 correction 2 (D-k). §14 asked for "exactly one is set" AND for a
     * pre-arrival folio to bind to the stay at check in, which cannot both
     * hold: after check in a guest folio carries the booking AND the stay.
     *
     * So: at least one, and only for a `guest` folio. `master`, `group` and
     * `house` folios carry none of the three, which the strict check would have
     * made impossible.
     */
    check(
      'folios_guest_subject_at_least_one',
      sql`${t.folioType} <> 'guest'
           OR ${t.guestStayId} IS NOT NULL
           OR ${t.bookingId} IS NOT NULL
           OR ${t.leaseId} IS NOT NULL`,
    ),
    /** A folio never closes owing money. */
    check(
      'folios_closed_is_zero',
      sql`${t.status} <> 'closed' OR ${t.balanceRwf} = 0`,
    ),
  ],
);


/**
 * Append only charge lines (§14.5, D13, D-j).
 *
 * A row here is NEVER updated or deleted. Voiding posts a second, negative row
 * naming the first through `source_ref_id`, so history shows the mistake and
 * the correction rather than hiding both. There is no `is_void` column: §14 had
 * one and it contradicted its own "never a mutation" rule, which is ADR-016
 * correction 1.
 *
 * A charge log that can be edited after the fact is worth nothing in a dispute,
 * and this is the document a Rwandan tax invoice is cut from.
 */
export const folioCharges = pgTable(
  'folio_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** RESTRICT since migration 0043: an append only line outlives nothing by accident. */
    folioId: uuid('folio_id')
      .notNull()
      .references(() => folios.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /**
     * Required on a revenue charge, and that department must be a revenue
     * centre (AC-1). Nullable in the column because a payment, a deposit and a
     * tax line credit no department at all; the service refuses a revenue
     * charge without one, which a CHECK cannot do because it would have to
     * subquery `departments`.
     */
    departmentId: uuid('department_id').references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id),
    /**
     * The taxpayer this line's turnover belongs to (ADR-050, contract 1).
     *
     * Copied from the outlet at write time, never inferred later. A revenue
     * line takes its outlet's; a non revenue line (tax, discount, adjustment,
     * payment, deposit, refund) takes it from the line its `source_ref_id`
     * names, and otherwise from the folio's property's org. That keeps a
     * discount against a tenant's meal on the tenant's side of the ledger
     * rather than quietly reducing the host's declared turnover.
     */
    taxEntityOrgId: uuid('tax_entity_org_id')
      .notNull()
      .references(() => orgs.id),
    /**
     * The fiscal document that already declared this line, if one has.
     *
     * Set at post time for a tenant outlet's line (the tenant signs at
     * fulfilment) and at close for the host's own. NOT NULL means declared,
     * and there is no second rule: the host's close covers exactly the charges
     * whose tax entity is its own AND whose invoice id is still null.
     */
    ebmInvoiceId: uuid('ebm_invoice_id').references(
      (): AnyPgColumn => ebmInvoices.id,
    ),
    /**
     * The RRA means of payment code (`01` cash, `02` credit, `05` card,
     * `06` mobile money). REQUIRED on a `payment` or `deposit` line, which §4 k
     * and the `SEND_RECEIPT` payload both need and no column carried. Left null
     * on rows written before ADR-050 and required only on new ones, so the
     * close refuses a payment line with no code rather than a migration
     * refusing every historical folio.
     */
    paymentMethodCode: text('payment_method_code'),
    chargeType: chargeTypeEnum('charge_type').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    unitPriceRwf: amount('unit_price_rwf'),
    /** Signed, and TAX EXCLUSIVE (D-n). Tax is its own line, never folded in. */
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    taxCode: taxCodeEnum('tax_code'),
    /**
     * Snapshotted from `config_entries` at post time (AC-5, D-m). A later rate
     * change never re-prices a posted charge, which is the whole reason the
     * rate is copied here instead of joined at read time.
     */
    taxRate: numeric('tax_rate'),
    /** What the separate `tax` line raised from this one. */
    taxAmountRwf: amount('tax_amount_rwf'),
    /**
     * Where this line came from: `manual`, `night_audit`, `service_order`,
     * `external_pos`, `ebm_invoice`, or `void` for a reversing line, which
     * names the charge it reverses in `source_ref_id`.
     *
     * Text rather than an enum because §14 keeps it open for the Open API
     * seams (D22) that have not been decided yet.
     */
    sourceRefType: text('source_ref_type'),
    sourceRefId: uuid('source_ref_id'),
    /** Null means the system posted it: the night audit, or an order fulfilment. */
    postedByUserId: uuid('posted_by_user_id').references(() => users.id),
    /**
     * The property's business date this line belongs to.
     *
     * Set by the night audit for a room charge, which is the only use the
     * decision names a source for, and what the unique index below counts. A
     * manual charge leaves it null rather than having a date invented for it.
     */
    businessDate: date('business_date'),
    /**
     * Stored as `${workspaceId}:${clientKey}`, because this column is globally
     * unique and a client generated key is not: two properties could pick the
     * same UUID and the second would silently receive the first one's result.
     */
    idempotencyKey: text('idempotency_key'),
    postedAt: timestamp('posted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('folio_charges_folio_idx').on(t.folioId, t.postedAt),
    index('folio_charges_workspace_idx').on(t.workspaceId),
    // No sign CHECK on `amount_rwf`, `unit_price_rwf` or `tax_amount_rwf`, on
    // purpose (platform audit step 3): a void, a discount, a payment and a
    // refund are all negative lines here, and a manual adjustment carries a
    // negative tax line with it (`FolioService`).
    index('folio_charges_department_idx').on(t.departmentId),
    index('folio_charges_source_idx').on(t.sourceRefType, t.sourceRefId),
    unique('folio_charges_idempotency_key_uk').on(t.idempotencyKey),
    /**
     * One room charge per folio per night (AC-15). The night audit is a job and
     * a job runs twice; without this, a rerun bills the guest for the same
     * night again and the second charge looks exactly as legitimate as the
     * first.
     *
     * A reversing line is excluded, because voiding a night charge posts a
     * second `room` row for the same date and the index would refuse the
     * correction.
     */
    uniqueIndex('folio_charges_room_night_uk')
      .on(t.folioId, t.businessDate)
      .where(
        sql`${t.chargeType} = 'room'
             AND ${t.businessDate} IS NOT NULL
             AND ${t.sourceRefType} IS DISTINCT FROM 'void'`,
      ),
  ],
);


// --- room assignment (ADR-016 D-g, new here, not in §14) -------------------

/**
 * A Postgres `daterange`, half open: `[check_in, check_out)`.
 *
 * Half open matters. A departure on the morning of the 5th does not collide
 * with an arrival that afternoon, which a closed range would refuse.
 */
const daterange = customType<{ data: string; driverData: string }>({
  dataType: () => 'daterange',
});


/**
 * Terminal. A move writes a new row rather than reopening a released one, so
 * the history of who was where survives the move.
 */
export const roomAssignmentStatusEnum = pgEnum('room_assignment_status', [
  'assigned',
  'released',
]);


/**
 * A room held for a booking over a date range (ADR-016 D-g, D-h).
 *
 * A booking names a room TYPE, never a physical room, which is correct: the
 * guest bought "a Standard Double", not room 101. A room becomes concrete at
 * check in. But a front desk assigns rooms the afternoon before, and until this
 * table there was no column anywhere that held that.
 *
 * A nullable `rooms` column on `bookings` was the obvious alternative and it
 * cannot express a SPLIT STAY: a guest in 101 for two nights and 205 for the
 * third has two assignments and one booking.
 *
 * THE HOLD RUNS TO CHECKOUT, NOT TO CHECK IN (D-h). Releasing at check in looks
 * tidy and defeats the very requirement that justified the table: the moment
 * the guest walks into 101, the second leg of their split stay in 205 would
 * stop being held and anyone could take it.
 *
 * Occupancy is untouched by this and stays derived from `guest_stays` (D15). A
 * hold and an occupancy are two different facts about the same room.
 */
export const roomAssignments = pgTable(
  'room_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** `[check_in, check_out)`. The half open range the constraint compares. */
    occupies: daterange('occupies').notNull(),
    status: roomAssignmentStatusEnum('status').notNull().default('assigned'),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('room_assignments_booking_idx').on(t.bookingId),
    index('room_assignments_room_idx').on(t.roomId),
    index('room_assignments_workspace_idx').on(t.workspaceId),
    /**
     * An empty range overlaps nothing, so a same day range would slip past the
     * exclusion constraint entirely and two guests would both hold the room.
     * This check matters more than it looks.
     */
    check('room_assignments_range_not_empty', sql`NOT isempty(${t.occupies})`),
    check(
      'room_assignments_released_shape',
      sql`(${t.status} = 'released') = (${t.releasedAt} IS NOT NULL)`,
    ),
    // The GiST exclusion constraint that refuses an overlapping hold lives in
    // migration 0014 by hand: drizzle-kit has no EXCLUDE, so it cannot appear
    // here. It is `EXCLUDE USING gist (room_id WITH =, occupies WITH &&)
    // WHERE (status = 'assigned')`, and AC-6 is proven against the database
    // rather than against this file.
  ],
);


// --- §14.4 the housekeeping queue ------------------------------------------

export const housekeepingTaskTypeEnum = pgEnum('housekeeping_task_type', [
  'checkout_clean',
  'stayover_clean',
  'inspection',
  'deep_clean',
  'turndown',
]);


/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance) and back to `pending`.
 */
export const housekeepingTaskStatusEnum = pgEnum('housekeeping_task_status', [
  'pending',
  'in_progress',
  'done',
  'inspected',
  'blocked',
  // The clean did not pass inspection; a re-clean task names this one (real-data 1.2.3).
  'failed',
]);


/**
 * The cleaning queue behind the housekeeper's phone (§14.4).
 *
 * `assigned_to_user_id` is optional on purpose: a department can run an
 * unassigned pull queue, where whoever is free takes the next room. Assigning
 * every task up front is a supervisor's job that nobody has time for.
 *
 * Checkout writes `rooms.housekeeping_status = 'dirty'` AND inserts a pending
 * `checkout_clean` here in the SAME transaction. Two separate calls mean a
 * dropped connection between them loses the second, and housekeeping then walks
 * past a room that needs them.
 */
export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** The Rooms department, which is where housekeeping sits under USALI. */
    departmentId: uuid('department_id').references(() => departments.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** The stay whose checkout triggered a `checkout_clean`, when one did. */
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    taskType: housekeepingTaskTypeEnum('task_type').notNull(),
    status: housekeepingTaskStatusEnum('status').notNull().default('pending'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    priority: integer('priority').notNull().default(0),
    note: text('note'),
    /**
     * So the offline phone app can replay a "mark clean" safely (F-P10).
     * Stored `${workspaceId}:${clientKey}` for the same reason the folio does:
     * the column is globally unique and a client key is not.
     */
    idempotencyKey: text('idempotency_key'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    /** When the clean was finished (`done`). Inspection keeps it and stamps its own time below. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // --- The housekeeping board (real-data 1.2.3) ---
    /** When the room has to be ready. */
    dueAt: timestamp('due_at', { withTimezone: true }),
    estimatedMinutes: smallint('estimated_minutes'),
    /** The rule that created it; null when a person added it by hand. */
    ruleId: uuid('rule_id').references((): AnyPgColumn => housekeepingRules.id, {
      onDelete: 'set null',
    }),
    /** A re-clean names the task whose inspection failed. */
    reopenedFromTaskId: uuid('reopened_from_task_id').references(
      (): AnyPgColumn => housekeepingTasks.id,
    ),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }),
    inspectedByUserId: uuid('inspected_by_user_id').references(() => users.id),
    inspectionNote: text('inspection_note'),
    ...timestamps,
  },
  (t) => [
    index('housekeeping_tasks_queue_idx').on(
      t.propertyId,
      t.status,
      t.priority,
    ),
    index('housekeeping_tasks_room_idx').on(t.roomId),
    index('housekeeping_tasks_assignee_idx').on(t.assignedToUserId),
    index('housekeeping_tasks_workspace_idx').on(t.workspaceId),
    unique('housekeeping_tasks_idempotency_key_uk').on(t.idempotencyKey),
    /**
     * One open checkout clean per stay. A checkout that runs twice (a double
     * click, a retry) must not put the same room on the board twice, and the
     * queue is the screen where a duplicate is most obvious and most annoying.
     */
    uniqueIndex('housekeeping_tasks_checkout_clean_uk')
      .on(t.guestStayId)
      .where(
        sql`${t.taskType} = 'checkout_clean' AND ${t.guestStayId} IS NOT NULL`,
      ),
  ],
);


// --- §14.6 and §14.7 the service catalog and its orders --------------------

export const serviceCatalogStatusEnum = pgEnum('service_catalog_status', [
  'active',
  'out_of_stock',
  'archived',
]);


export const fulfillmentTypeEnum = pgEnum('fulfillment_type', [
  'in_room_delivery',
  'pickup',
  'appointment',
  'onsite',
  'instant',
]);


export const serviceOrderChannelEnum = pgEnum('service_order_channel', [
  'guest_app',
  'in_room_device',
  'front_desk',
  'staff',
  'api',
]);


/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered -> completed`,
 * plus `submitted -> rejected`, and anything before `delivered` to `cancelled`.
 *
 * A pay now order starts earlier (ADR-050 D-n): `pending_payment -> submitted`
 * when its money settles, or `pending_payment -> payment_failed` when it is
 * refused or expires. The kitchen never sees either of the two new states.
 */
export const serviceOrderStatusEnum = pgEnum('service_order_status', [
  'submitted',
  'acknowledged',
  'in_progress',
  'ready',
  'delivered',
  'completed',
  'cancelled',
  'rejected',
  'pending_payment',
  'payment_failed',
]);


/**
 * When an order's money moves (ADR-050 D-n). One order model, two contexts:
 * `in_house_folio` posts to the guest's bill on `delivered`; `pay_now` settles
 * before the kitchen sees it and never touches a folio.
 */
export const serviceOrderContextEnum = pgEnum('service_order_context', [
  'in_house_folio',
  'pay_now',
]);


/**
 * RRA's item classification list, the `itemClsCd` behind every receipt line
 * (ADR-050 D-m, VSDC v1.0.5 §3.3.2).
 *
 * Reference data the Authority owns. It is written ONLY by
 * `scripts/sync-rra-classifications.mjs` from `RRA_CLASSIFICATION_SOURCE`, and
 * nothing edits it by hand: a code a person typed in is a receipt the Authority
 * refuses. A code RRA withdraws is kept and marked inactive, because an item
 * sold under it last month still names it.
 */
export const rraItemClassifications = pgTable(
  'rra_item_classifications',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    parentCode: text('parent_code'),
    level: integer('level').notNull(),
    active: boolean('active').notNull().default(true),
    syncedAt: timestamp('synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('rra_item_classifications_parent_idx').on(t.parentCode)],
);


/** Groups items within a department or outlet. `guest_visible` gates the app. */
export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    guestVisible: boolean('guest_visible').notNull().default(true),
    status: departmentStatusEnum('status').notNull().default('active'),
    /**
     * What a new item on this menu starts with (ADR-050 D-m). A PREFILL, never
     * a rule: the item is the source of truth and may override every one.
     */
    defaultRraItemClsCd: text('default_rra_item_cls_cd').references(
      () => rraItemClassifications.code,
    ),
    defaultRraItemTyCd: text('default_rra_item_ty_cd'),
    defaultRraPkgUnitCd: text('default_rra_pkg_unit_cd'),
    defaultRraQtyUnitCd: text('default_rra_qty_unit_cd'),
    defaultTaxCode: taxCodeEnum('default_tax_code'),
    ...timestamps,
  },
  (t) => [
    check(
      'service_categories_default_item_ty_cd',
      sql`${t.defaultRraItemTyCd} IS NULL OR ${t.defaultRraItemTyCd} IN ('1', '2', '3')`,
    ),
    index('service_categories_department_idx').on(t.departmentId),
    index('service_categories_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * A priced, tax coded, orderable thing (§14.6).
 *
 * Because an item carries its own department and tax code, an order posts to
 * the right department and the right folio line with the right tax and nobody
 * has to be asked. Editing an item never rewrites a placed order: the order
 * snapshots name, price and tax at order time (D8).
 */
export const serviceItems = pgTable(
  'service_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceCategoryId: uuid('service_category_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'cascade' }),
    /** Denormalized from the category so a charge needs no join to attribute. */
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    description: text('description'),
    photoObjectKeys: jsonb('photo_object_keys'),
    priceRwf: amount('price_rwf').notNull(),
    currency: currency(),
    taxCode: taxCodeEnum('tax_code').notNull().default('TAX_B'),
    fulfillmentType: fulfillmentTypeEnum('fulfillment_type')
      .notNull()
      .default('in_room_delivery'),
    prepTimeMinutes: integer('prep_time_minutes'),
    /** Size, extras, modifiers. */
    options: jsonb('options'),
    /** Hours and days this item can be ordered. */
    availability: jsonb('availability'),
    guestOrderable: boolean('guest_orderable').notNull().default(true),
    /** Null means unlimited, which is the normal case for a service. */
    stockQty: integer('stock_qty'),
    status: serviceCatalogStatusEnum('status').notNull().default('active'),
    /*
     * THE AUTHORITY'S OWN CODES FOR THIS THING (ADR-050 D-m, amended). An item
     * without all of them, and a tax code, is never sold on any channel. The
     * rule is the SERVICE's, not a check here: every item on sale when these
     * columns arrived had none, and a check would have failed the migration or
     * switched every one of them off.
     */
    /** `itemClsCd`, from RRA's list. */
    rraItemClsCd: text('rra_item_cls_cd').references(
      () => rraItemClassifications.code,
    ),
    /** `itemTyCd`, VSDC §4.3: `1` raw material, `2` finished product, `3` service. */
    rraItemTyCd: text('rra_item_ty_cd'),
    /**
     * `itemCd`, VSDC §4.17, minted once by the service and never re minted, so
     * a renamed dish keeps its code: origin, product type, packaging unit,
     * quantity unit, then a 7 digit serial per org.
     */
    rraItemCd: text('rra_item_cd'),
    /** `pkgUnitCd`, VSDC §4.5. */
    rraPkgUnitCd: text('rra_pkg_unit_cd'),
    /** `qtyUnitCd`, VSDC §4.6. */
    rraQtyUnitCd: text('rra_qty_unit_cd'),
    ...timestamps,
  },
  (t) => [
    check(
      'service_items_rra_item_ty_cd',
      sql`${t.rraItemTyCd} IS NULL OR ${t.rraItemTyCd} IN ('1', '2', '3')`,
    ),
    /**
     * `itemCd` is unique per taxpayer. The serial is minted per org under a
     * lock; this is the backstop inside one workspace, which is as far as a
     * constraint on this table can see.
     */
    uniqueIndex('service_items_workspace_item_cd_uk')
      .on(t.workspaceId, t.rraItemCd)
      .where(sql`${t.rraItemCd} IS NOT NULL`),
    index('service_items_category_idx').on(t.serviceCategoryId),
    index('service_items_department_idx').on(t.departmentId),
    index('service_items_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * A guest request routed to a department (§14.7).
 *
 * Routing is to the DEPARTMENT, never to a person (D14). Whoever is on that
 * department's board answers, which is why a shift change does not strand an
 * order.
 *
 * An `in_house_folio` order posts one `folio_charges` line on `delivered`, in
 * the same transaction. A `pay_now` order never touches a folio: its money
 * settles first and it raises its own `NS` then (ADR-050 D-n).
 */
export const serviceOrders = pgTable(
  'service_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /**
     * Nullable since ADR-050 Migration C: a standalone outlet's order has no
     * property. `service_orders_property_or_outlet` keeps one of them set.
     */
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    orderContext: serviceOrderContextEnum('order_context')
      .notNull()
      .default('in_house_folio'),
    /**
     * Whose TIN signs this sale (ADR-050, cross child contract 1). Copied from
     * the outlet at write time, or the property's org for an order with no
     * outlet, and never derived again.
     */
    taxEntityOrgId: uuid('tax_entity_org_id')
      .notNull()
      .references(() => orgs.id),
    /** The pay now attempt currently in flight, for mobile money. A retry replaces it. */
    paymentAttemptId: uuid('payment_attempt_id').references(
      (): AnyPgColumn => paymentAttempts.id,
    ),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** RRA means of payment, VSDC §4.10: `01` cash, `06` mobile money. */
    paymentMethod: text('payment_method'),
    /** Who took the cash, because a staff entered money field needs a name on it (AC-24). */
    paidMarkedByUserId: uuid('paid_marked_by_user_id').references(() => users.id),
    /** The conversation this order was raised in (chat child). Never a thread of its own. */
    threadId: uuid('thread_id').references((): AnyPgColumn => threads.id),
    /** A walk in who is signed in and holds no stay. */
    customerUserId: uuid('customer_user_id').references(() => users.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    /** The bill this order charges when it is fulfilled. */
    folioId: uuid('folio_id').references(() => folios.id),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    orderedByUserId: uuid('ordered_by_user_id').references(() => users.id),
    /** Where it is delivered, when it is delivered anywhere. */
    roomId: uuid('room_id').references(() => rooms.id),
    channel: serviceOrderChannelEnum('channel').notNull().default('front_desk'),
    status: serviceOrderStatusEnum('status').notNull().default('submitted'),
    fulfillmentType: fulfillmentTypeEnum('fulfillment_type')
      .notNull()
      .default('in_room_delivery'),
    requestedForAt: timestamp('requested_for_at', { withTimezone: true }),
    subtotalRwf: amount('subtotal_rwf').notNull().default(0),
    taxRwf: amount('tax_rwf').notNull().default(0),
    totalRwf: amount('total_rwf').notNull().default(0),
    currency: currency(),
    guestNote: text('guest_note'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    /** `${workspaceId}:${clientKey}`, as everywhere else in this layer. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    /** A bill order has a bill; a pay now order never has one (D-n). */
    check(
      'service_orders_context_folio',
      sql`(${t.orderContext} = 'in_house_folio' AND ${t.folioId} IS NOT NULL)
        OR (${t.orderContext} = 'pay_now' AND ${t.folioId} IS NULL)`,
    ),
    check(
      'service_orders_property_or_outlet',
      sql`${t.propertyId} IS NOT NULL OR ${t.outletId} IS NOT NULL`,
    ),
    unique('service_orders_number_uk').on(t.orderNumber),
    unique('service_orders_idempotency_key_uk').on(t.idempotencyKey),
    index('service_orders_board_idx').on(t.departmentId, t.status),
    index('service_orders_workspace_idx').on(t.workspaceId),
    index('service_orders_folio_idx').on(t.folioId),
    index('service_orders_property_idx').on(t.propertyId),
    index('service_orders_booking_idx').on(t.bookingId),
  ],
);


/** Locked at order time (D8), so editing the menu never rewrites an order. */
export const serviceOrderItems = pgTable(
  'service_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    serviceItemId: uuid('service_item_id').references(() => serviceItems.id),
    nameSnapshot: text('name_snapshot').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceRwf: amount('unit_price_rwf').notNull(),
    selectedOptions: jsonb('selected_options'),
    lineTotalRwf: amount('line_total_rwf').notNull(),
    taxCode: taxCodeEnum('tax_code'),
    taxRate: numeric('tax_rate'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('service_order_items_order_idx').on(t.serviceOrderId)],
);


/** The append only status trail behind the department kanban board. */
export const serviceOrderEvents = pgTable(
  'service_order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    status: serviceOrderStatusEnum('status').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('service_order_events_order_idx').on(t.serviceOrderId)],
);

// Defined here rather than in its interface-* file because housekeeping_tasks.rule_id references it: a base schema file never imports an
// interface one, which is what made the import cycles the api-cycles ratchet refused.
export const housekeepingRuleCodeEnum = pgEnum('housekeeping_rule_code', [
  'checkout',
  'stayover',
  'inspection',
  'turndown',
  'deep_clean',
]);

/**
 * The rules that put tasks on the board without anyone typing them: a checkout clean when the desk
 * checks a guest out, the daily stayover, the inspection after a checkout clean. The code decides
 * the task type; `trigger` is the machine-readable condition and `description` says it in words.
 */
export const housekeepingRules = pgTable(
  'housekeeping_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    code: housekeepingRuleCodeEnum('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    trigger: jsonb('trigger').notNull(),
    estimatedMinutes: smallint('estimated_minutes'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('housekeeping_rules_property_idx').on(t.propertyId, t.active),
    uniqueIndex('housekeeping_rules_property_code_uk').on(t.propertyId, t.code),
  ],
);
