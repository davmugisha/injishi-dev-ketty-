import type {
  ConsentPurpose,
  GuestContactInput,
  GuestTripFacts,
  MarketPropertyKind,
  MyBusinessPlace,
  SavedPlace,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, type SQL, sql } from 'drizzle-orm';

import {
  collectionItems,
  collections,
  userConsents,
  userProfiles,
  users,
  verifiedIdentities,
  workspaces,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { productOnSql } from '../../../shared/entitlements/entitlement-check';
import { placeLine } from '../domain/place-line';

/** What the marketplace adds to a property the canonical public read already admits. */
export interface CardRow {
  id: string;
  domain: 'hospitality' | 'residence';
  kind: MarketPropertyKind;
  sectorName: string | null;
  districtName: string | null;
  legalName: string;
  priceRwf: number | null;
  rating: number | null;
  reviewCount: number;
  bookingMode: 'instant_book' | 'request_to_book' | null;
  stockPhoto: string;
  caption: string;
  amenities: string[];
  bedrooms: number | null;
  floorAreaSqm: number | null;
  availableFrom: string | null;
  /** The card carries a page's own copy (highlights or a gallery), so the interface can draw a property page. */
  hasPage: boolean;
}

export interface PageRow {
  propertyId: string;
  orgId: string;
  gallery: unknown;
  highlights: unknown;
  nearby: unknown;
  houseRuleItems: unknown;
  mapLabel: string | null;
  roomCount: number;
  tin: string | null;
  upi: string | null;
  verifiedAt: string | null;
  licenceValidTo: string | null;
}

export interface RoomCardRow {
  id: string;
  propertyId: string;
  propertySlug: string;
  name: string;
  priceRwf: number | null;
  bed: string;
  sizeSqm: number | null;
  highlight: string;
  sleeps: number | null;
  roomCount: number;
  bookingMode: 'instant_book' | 'request_to_book' | null;
  nonrefundableEligible: boolean;
  cancellationTier: 'flexible' | 'moderate' | 'limited' | 'firm' | 'strict_extended_stay' | null;
  maxAdults: number | null;
  maxChildren: number | null;
  stockPhoto: string;
}

export interface ListRow {
  id: string;
  name: string;
  visibility: 'private' | 'shared';
  isDefault: boolean;
  createdAt: Date;
}

export interface ContactRow {
  name: string | null;
  email: string;
  joinedAt: Date;
  displayName: string | null;
  phone: string | null;
  country: string | null;
  locale: string | null;
  address: string | null;
  providers: string[];
}

export interface ConsentRow {
  purpose: ConsentPurpose;
  granted: boolean;
  recordedAt: Date;
}

/** `a, b, c` as uuid parameters, for an IN list (drizzle expands a bare array into a row, not an array). */
const uuidList = (ids: string[]): SQL => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

const toNumber = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * The marketplace's reads and the guest account's own rows. Every person-scoped query takes the user id
 * from the session (the service passes it) and filters on it here too, so ownership is held in both
 * layers. Raw SQL where a read joins five tables; drizzle where it is a plain row write.
 */
@Injectable()
export class MarketplaceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The marketplace card of each of these (already publicly visible) properties that has one. */
  async cards(propertyIds: string[]): Promise<CardRow[]> {
    if (propertyIds.length === 0) return [];
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT p.id, o.domain::text AS domain, mp.kind, s.name AS sector_name, d.name AS district_name,
             o.legal_name,
             (SELECT min(rt.base_price_rwf) FROM room_types rt
               WHERE rt.property_id = p.id AND rt.status = 'active' AND rt.domain::text = o.domain::text) AS price_rwf,
             (SELECT rt.booking_mode::text FROM room_types rt
               WHERE rt.property_id = p.id AND rt.status = 'active' AND rt.domain = 'hospitality'
               ORDER BY rt.base_price_rwf NULLS LAST, rt.id LIMIT 1) AS booking_mode,
             rv.rating, coalesce(rv.review_count, 0) AS review_count,
             mp.stock_photo, mp.caption, mp.bedrooms, mp.floor_area_sqm, mp.available_from::text AS available_from,
             (jsonb_array_length(mp.highlights) > 0 OR jsonb_array_length(mp.gallery) > 0) AS has_page,
             coalesce((SELECT json_agg(pa.amenity_code ORDER BY pa.amenity_code)
                         FROM property_amenities pa JOIN amenities a ON a.code = pa.amenity_code AND a.active
                        WHERE pa.property_id = p.id), '[]'::json) AS amenities
        FROM properties p
        JOIN orgs o ON o.id = p.org_id
        JOIN market_property_profiles mp ON mp.property_id = p.id
        LEFT JOIN sectors s ON s.id = p.sector_id
        LEFT JOIN districts d ON d.id = p.district_id
        LEFT JOIN LATERAL (
          SELECT round(avg(r.overall_rating)::numeric, 1)::float AS rating, count(*)::int AS review_count
            FROM reviews r
            JOIN guest_stays gs ON gs.id = r.stay_id
            JOIN rooms rm ON rm.id = gs.room_id
           WHERE rm.property_id = p.id AND r.side = 'guest_to_host' AND r.moderation_state = 'visible'
             AND r.published_at IS NOT NULL AND r.published_at <= now() AND r.overall_rating IS NOT NULL
        ) rv ON true
       WHERE p.id IN (${uuidList(propertyIds)})`);
    return result.rows.map((r) => ({
      id: String(r.id),
      domain: r.domain as CardRow['domain'],
      kind: r.kind as MarketPropertyKind,
      sectorName: (r.sector_name as string | null) ?? null,
      districtName: (r.district_name as string | null) ?? null,
      legalName: String(r.legal_name),
      priceRwf: toNumber(r.price_rwf),
      rating: toNumber(r.rating),
      reviewCount: Number(r.review_count),
      bookingMode: (r.booking_mode as CardRow['bookingMode']) ?? null,
      stockPhoto: String(r.stock_photo),
      caption: String(r.caption),
      amenities: (r.amenities as string[]) ?? [],
      bedrooms: toNumber(r.bedrooms),
      floorAreaSqm: toNumber(r.floor_area_sqm),
      availableFrom: (r.available_from as string | null) ?? null,
      hasPage: r.has_page === true,
    }));
  }

  /** The property page's own copy and the business card. Null when the property has no marketplace card. */
  async page(propertyId: string): Promise<PageRow | null> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT p.id, p.org_id, mp.gallery, mp.highlights, mp.nearby, mp.house_rule_items, mp.map_label,
             (SELECT count(*)::int FROM rooms rm WHERE rm.property_id = p.id) AS room_count,
             o.tin, o.upi,
             (SELECT max(rr.decided_at) FROM org_registration_reviews rr
               WHERE rr.org_id = o.id AND rr.decision = 'passed') AS verified_at,
             (SELECT max(c.expires_on)::text FROM org_certificates c
               WHERE c.org_id = o.id AND c.kind = 'tourism_license' AND c.status = 'on_file'
                 AND (c.property_id IS NULL OR c.property_id = p.id)) AS licence_valid_to
        FROM properties p
        JOIN orgs o ON o.id = p.org_id
        JOIN market_property_profiles mp ON mp.property_id = p.id
       WHERE p.id = ${propertyId}::uuid`);
    const r = result.rows[0];
    if (!r) return null;
    return {
      propertyId: String(r.id),
      orgId: String(r.org_id),
      gallery: r.gallery,
      highlights: r.highlights,
      nearby: r.nearby,
      houseRuleItems: r.house_rule_items,
      mapLabel: (r.map_label as string | null) ?? null,
      roomCount: Number(r.room_count),
      tin: (r.tin as string | null) ?? null,
      upi: (r.upi as string | null) ?? null,
      verifiedAt: r.verified_at ? new Date(r.verified_at as string).toISOString() : null,
      licenceValidTo: (r.licence_valid_to as string | null) ?? null,
    };
  }

  /** The amenities a property lists, with the catalogue's English label. */
  async facilities(propertyId: string): Promise<{ code: string; label: string }[]> {
    const result = await this.db.execute<{ code: string; label: string }>(sql`
      SELECT a.code, a.label_en AS label
        FROM property_amenities pa JOIN amenities a ON a.code = pa.amenity_code AND a.active
       WHERE pa.property_id = ${propertyId}::uuid
       ORDER BY a.category, a.code`);
    return result.rows;
  }

  /** Room cards of active room types whose property is among these (publicly visible) ones. */
  async roomCards(propertyIds: string[]): Promise<RoomCardRow[]> {
    if (propertyIds.length === 0) return [];
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT rt.id, rt.property_id, p.slug AS property_slug, rt.name, rt.base_price_rwf AS price_rwf,
             mr.bed, mr.size_sqm, mr.highlight, rt.capacity, rt.room_count, rt.booking_mode::text AS booking_mode,
             rt.cancellation_tier::text AS cancellation_tier, rt.nonrefundable_eligible, rt.max_adults, rt.max_children, mr.stock_photo
        FROM room_types rt
        JOIN market_room_profiles mr ON mr.room_type_id = rt.id
        JOIN properties p ON p.id = rt.property_id
       WHERE rt.property_id IN (${uuidList(propertyIds)}) AND rt.status = 'active' AND p.slug IS NOT NULL
       ORDER BY p.slug, rt.base_price_rwf NULLS LAST, rt.name`);
    return result.rows.map((r) => ({
      id: String(r.id),
      propertyId: String(r.property_id),
      propertySlug: String(r.property_slug),
      name: String(r.name),
      priceRwf: toNumber(r.price_rwf),
      bed: String(r.bed),
      sizeSqm: toNumber(r.size_sqm),
      highlight: String(r.highlight),
      sleeps: toNumber(r.capacity),
      roomCount: Number(r.room_count),
      bookingMode: (r.booking_mode as RoomCardRow['bookingMode']) ?? null,
      cancellationTier: (r.cancellation_tier as RoomCardRow['cancellationTier']) ?? null,
      nonrefundableEligible: r.nonrefundable_eligible === true,
      maxAdults: toNumber(r.max_adults),
      maxChildren: toNumber(r.max_children),
      stockPhoto: String(r.stock_photo),
    }));
  }

  async legalNameOf(propertyId: string): Promise<string | null> {
    const result = await this.db.execute<{ legal_name: string }>(
      sql`SELECT o.legal_name FROM properties p JOIN orgs o ON o.id = p.org_id WHERE p.id = ${propertyId}::uuid`,
    );
    return result.rows[0]?.legal_name ?? null;
  }

  /** The other properties of a business, by name. */
  async siblingNames(orgId: string, exceptPropertyId: string): Promise<string[]> {
    const result = await this.db.execute<{ name: string }>(sql`
      SELECT p.name FROM properties p JOIN listings l ON l.property_id = p.id AND l.status = 'published'
       WHERE p.org_id = ${orgId}::uuid AND p.id <> ${exceptPropertyId}::uuid
       ORDER BY p.name`);
    return result.rows.map((r) => r.name);
  }

  // --- Saved places -------------------------------------------------------------------------

  /**
   * Every saved place of one person, with the list it sits in. A LEFT join to the public state, so a
   * place whose listing was unpublished or whose business was suspended is returned as unavailable
   * rather than dropped (ADR-032, F-B16 §9).
   */
  async savedItems(userId: string): Promise<(SavedPlace & { collectionId: string })[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT ci.collection_id, ci.property_id, p.slug, p.name, s.name AS sector_name, d.name AS district_name,
             o.domain::text AS domain, mp.kind, mp.stock_photo, mp.available_from::text AS available_from,
             (SELECT min(rt.base_price_rwf) FROM room_types rt
               WHERE rt.property_id = p.id AND rt.status = 'active' AND rt.domain::text = o.domain::text) AS price_rwf,
             (SELECT rt.booking_mode::text FROM room_types rt
               WHERE rt.property_id = p.id AND rt.status = 'active' AND rt.domain = 'hospitality'
               ORDER BY rt.base_price_rwf NULLS LAST, rt.id LIMIT 1) AS booking_mode,
             ci.saved_price_rwf, ci.created_at,
             (l.status = 'published' AND o.registration_status = 'active'
              AND ${productOnSql(sql`o.id`, 'marketplace')}) AS available
        FROM collection_items ci
        JOIN collections c ON c.id = ci.collection_id
        JOIN properties p ON p.id = ci.property_id
        JOIN orgs o ON o.id = p.org_id
        LEFT JOIN listings l ON l.property_id = p.id
        LEFT JOIN market_property_profiles mp ON mp.property_id = p.id
        LEFT JOIN sectors s ON s.id = p.sector_id
        LEFT JOIN districts d ON d.id = p.district_id
       WHERE c.user_id = ${userId}::uuid
       ORDER BY ci.created_at DESC, ci.property_id`);
    return result.rows.map((r) => ({
      collectionId: String(r.collection_id),
      propertyId: String(r.property_id),
      slug: (r.slug as string | null) ?? null,
      name: String(r.name),
      where: placeLine((r.sector_name as string | null) ?? null, (r.district_name as string | null) ?? null),
      domain: r.domain as SavedPlace['domain'],
      kind: (r.kind as MarketPropertyKind | null) ?? null,
      stockPhoto: (r.stock_photo as string | null) ?? null,
      priceRwf: toNumber(r.price_rwf),
      savedPriceRwf: toNumber(r.saved_price_rwf),
      available: r.available === true,
      bookingMode: (r.booking_mode as SavedPlace['bookingMode']) ?? null,
      availableFrom: (r.available_from as string | null) ?? null,
      savedAt: new Date(r.created_at as string).toISOString(),
    }));
  }

  async lists(userId: string): Promise<ListRow[]> {
    return this.db
      .select({
        id: collections.id,
        name: collections.name,
        visibility: collections.visibility,
        isDefault: collections.isDefault,
        createdAt: collections.createdAt,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.isDefault), asc(collections.createdAt), asc(collections.id));
  }

  async ownsList(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    return rows.length > 0;
  }

  /** The person's own (personal) workspace: where everything a guest owns lives (F-S11). */
  async personalWorkspace(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.userId, userId), eq(workspaces.kind, 'personal')))
      .limit(1);
    return row?.id ?? null;
  }

  async createList(userId: string, workspaceId: string, name: string): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(collections)
      .values({ userId, workspaceId, name, visibility: 'private', isDefault: false })
      .returning({ id: collections.id });
    return row!;
  }

  async renameList(userId: string, id: string, name: string): Promise<boolean> {
    const rows = await this.db
      .update(collections)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning({ id: collections.id });
    return rows.length > 0;
  }

  /** Its items go with it (`collection_items` cascades). */
  async deleteList(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning({ id: collections.id });
    return rows.length > 0;
  }

  /**
   * The person's default list, created on their first save (ADR-032). The partial unique index
   * `collections_one_default_per_user_uk` decides a race: the loser's insert does nothing and it reads
   * the winner's row.
   */
  async defaultList(userId: string, workspaceId: string): Promise<string> {
    const [existing] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
      .limit(1);
    if (existing) return existing.id;
    await this.db.execute(sql`
      INSERT INTO collections (user_id, workspace_id, name, visibility, is_default)
      VALUES (${userId}::uuid, ${workspaceId}::uuid, 'Saved', 'private', true)
      ON CONFLICT (user_id) WHERE is_default DO NOTHING`);
    const [row] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
      .limit(1);
    return row!.id;
  }

  /** Idempotent: saving a place already in the list keeps the first save (and its price). */
  async addItem(collectionId: string, propertyId: string, savedPriceRwf: number | null): Promise<void> {
    await this.db.insert(collectionItems).values({ collectionId, propertyId, savedPriceRwf }).onConflictDoNothing();
  }

  async removeItem(userId: string, collectionId: string, propertyId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      DELETE FROM collection_items ci USING collections c
       WHERE ci.collection_id = c.id AND c.user_id = ${userId}::uuid
         AND c.id = ${collectionId}::uuid AND ci.property_id = ${propertyId}::uuid`);
    return (result.rowCount ?? 0) > 0;
  }

  /** Unsave everywhere: the heart is off when the place is in none of the person's lists. */
  async removeEverywhere(userId: string, propertyId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      DELETE FROM collection_items ci USING collections c
       WHERE ci.collection_id = c.id AND c.user_id = ${userId}::uuid AND ci.property_id = ${propertyId}::uuid`);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Contact details and consent ------------------------------------------------------------

  async contact(userId: string): Promise<ContactRow | null> {
    const [row] = await this.db
      .select({
        name: users.name,
        email: users.email,
        joinedAt: users.createdAt,
        displayName: userProfiles.displayName,
        phone: userProfiles.phoneE164,
        country: userProfiles.country,
        locale: userProfiles.locale,
        address: userProfiles.addressText,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.id, userId));
    if (!row) return null;
    const providers = await this.db.execute<{ provider_id: string }>(
      sql`SELECT DISTINCT provider_id FROM accounts WHERE user_id = ${userId}::uuid ORDER BY provider_id`,
    );
    return { ...row, providers: providers.rows.map((p) => p.provider_id) };
  }

  async verifiedName(userId: string): Promise<string | null> {
    const [identity] = await this.db
      .select({ name: verifiedIdentities.legalFullName, status: verifiedIdentities.kycStatus })
      .from(verifiedIdentities)
      .where(eq(verifiedIdentities.userId, userId));
    return identity?.status === 'verified' ? (identity.name ?? null) : null;
  }

  /**
   * Name, phone, country and language. A change of country clears the Rwandan address hierarchy, which
   * `user_profiles_address_country_shape` requires of any address outside Rwanda (D24).
   */
  async updateContact(userId: string, input: GuestContactInput): Promise<void> {
    // Stored as E.164: the spaces, brackets and dashes people type around the digits are dropped.
    const digits = input.phone.replace(/\D/g, '');
    const phone = digits === '' ? null : `${input.phone.trim().startsWith('+') ? '+' : ''}${digits}`;
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ name: input.name, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx
        .insert(userProfiles)
        .values({ userId, displayName: input.name, phoneE164: phone, country: input.country, locale: input.locale })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            displayName: input.name,
            phoneE164: phone,
            locale: input.locale,
            country: input.country,
            districtId: sql`CASE WHEN ${input.country} = 'RW' THEN user_profiles.district_id ELSE NULL END`,
            sectorId: sql`CASE WHEN ${input.country} = 'RW' THEN user_profiles.sector_id ELSE NULL END`,
            villageId: sql`CASE WHEN ${input.country} = 'RW' THEN user_profiles.village_id ELSE NULL END`,
            updatedAt: new Date(),
          },
        });
    });
  }

  /** The newest choice per purpose. */
  async latestConsents(userId: string): Promise<ConsentRow[]> {
    const result = await this.db.execute<{ purpose: ConsentPurpose; granted: boolean; recorded_at: string }>(sql`
      SELECT DISTINCT ON (purpose) purpose, granted, recorded_at
        FROM user_consents WHERE user_id = ${userId}::uuid
       ORDER BY purpose, recorded_at DESC, id DESC`);
    return result.rows.map((r) => ({ purpose: r.purpose, granted: r.granted, recordedAt: new Date(r.recorded_at) }));
  }

  /** Append a choice; history is never rewritten. */
  async recordConsent(row: {
    userId: string;
    workspaceId: string;
    purpose: ConsentPurpose;
    granted: boolean;
    policyVersion: string;
  }): Promise<void> {
    await this.db.insert(userConsents).values({ ...row, source: 'account' });
  }

  // --- The businesses a person works at ---------------------------------------------------

  /**
   * Every live branch of every business the person holds an active membership of, narrowed to the branches
   * a limited membership names (ADR-054). The person's own memberships only.
   */
  async businesses(userId: string): Promise<MyBusinessPlace[]> {
    const result = await this.db.execute<{ property_id: string; property_name: string; legal_name: string; org_id: string; org_role: string }>(sql`
      SELECT p.id AS property_id, p.name AS property_name, o.legal_name, o.id AS org_id, m.org_role::text AS org_role
        FROM org_memberships m
        JOIN orgs o ON o.id = m.org_id
        JOIN properties p ON p.org_id = o.id AND p.archived_at IS NULL
       WHERE m.user_id = ${userId}::uuid AND m.status = 'active'
         AND (NOT EXISTS (SELECT 1 FROM org_membership_branches b WHERE b.org_membership_id = m.id)
              OR EXISTS (SELECT 1 FROM org_membership_branches b WHERE b.org_membership_id = m.id AND b.property_id = p.id))
       ORDER BY o.legal_name, p.name`);
    return result.rows.map((r) => ({
      propertyId: r.property_id,
      propertyName: r.property_name,
      legalName: r.legal_name,
      orgId: r.org_id,
      role: r.org_role,
    }));
  }

  // --- Trip facts -----------------------------------------------------------------------------

  /** Payment, refund, request window and pre-arrival state of each of the person's own bookings. */
  async tripFacts(userId: string): Promise<GuestTripFacts[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT b.reference, o.legal_name, mp.stock_photo, b.approval_expires_at, b.refund_rwf, b.cancelled_at,
             pa.instrument_kind, pa.network, pa.payer_masked, pa.amount_rwf AS paid_rwf, pa.settled_at,
             coalesce(pa.adapter_ref, e.adapter_ref) AS provider_ref, e.amount_rwf AS escrow_rwf,
             pre.submitted_at AS pre_arrival_at
        FROM bookings b
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN properties p ON p.id = rt.property_id
        JOIN orgs o ON o.id = p.org_id
        LEFT JOIN market_property_profiles mp ON mp.property_id = p.id
        LEFT JOIN LATERAL (
          SELECT a.instrument_kind::text AS instrument_kind, a.network::text AS network, a.payer_masked,
                 a.amount_rwf, a.settled_at, a.adapter_ref
            FROM payment_attempts a
           WHERE a.booking_id = b.id AND a.state = 'confirmed'
           ORDER BY a.settled_at DESC NULLS LAST LIMIT 1
        ) pa ON true
        LEFT JOIN LATERAL (
          SELECT es.adapter_ref, es.amount_rwf FROM escrows es WHERE es.booking_id = b.id
           ORDER BY es.created_at DESC LIMIT 1
        ) e ON true
        LEFT JOIN LATERAL (
          SELECT pi.submitted_at FROM pre_arrival_identities pi
           WHERE pi.booking_id = b.id AND pi.submitted_at IS NOT NULL
           ORDER BY pi.submitted_at DESC LIMIT 1
        ) pre ON true
       WHERE b.guest_user_id = ${userId}::uuid
       ORDER BY b.created_at DESC
       LIMIT 100`);
    const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
    return result.rows.map((r) => ({
      reference: String(r.reference),
      legalName: String(r.legal_name),
      stockPhoto: (r.stock_photo as string | null) ?? null,
      approvalExpiresAt: iso(r.approval_expires_at),
      payment:
        r.provider_ref || r.instrument_kind
          ? {
              instrumentKind: (r.instrument_kind as 'mobile_money' | 'card' | null) ?? null,
              network: (r.network as 'mtn_momo' | 'airtel_money' | null) ?? null,
              payerMasked: (r.payer_masked as string | null) ?? null,
              providerRef: (r.provider_ref as string | null) ?? null,
              amountRwf: toNumber(r.paid_rwf) ?? toNumber(r.escrow_rwf),
              settledAt: iso(r.settled_at),
            }
          : null,
      refundRwf: toNumber(r.refund_rwf),
      cancelledAt: iso(r.cancelled_at),
      preArrivalSubmittedAt: iso(r.pre_arrival_at),
    }));
  }
}
