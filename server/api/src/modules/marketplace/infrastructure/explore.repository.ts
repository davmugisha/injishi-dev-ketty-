import type { ExploreMode, ExploreSort, RoomPriceBasis } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { PUBLICLY_VISIBLE } from '../../listing/infrastructure/listing.repository';
import type { ExploreArea, ExploreKey } from '../domain/explore-query';

/**
 * A review the public may read and count (mobile spec 0005, the property page child): a guest's
 * review of the host, visible, published and rated. The SAME rule the marketplace rating uses, so a
 * hidden or future dated review counts nowhere. Reads `r` (reviews) joined to `rm` (rooms) through
 * the stay.
 */
const PUBLIC_REVIEW = sql`r.side = 'guest_to_host' AND r.moderation_state = 'visible'
  AND r.published_at IS NOT NULL AND r.published_at <= now() AND r.overall_rating IS NOT NULL`;

/**
 * A room type a guest can book, read through the alias `rt` (mobile spec 0005, AC-34): active, in a
 * hospitality business, and a stay. A menu item (`per_item`, a bar's or coffee shop's offering since
 * migration 0117) is listed by its business but never counts here: it never makes a property a stay,
 * prices a card, or shows as a room. The SQL twin of `isStayPriceBasis`.
 */
const STAY_ROOM = sql`rt.status = 'active' AND rt.domain = 'hospitality' AND rt.price_basis <> 'per_item'`;

/** `a, b, c` as uuid parameters, for an IN list. */
const uuidList = (ids: string[]): SQL => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

const toNumber = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** `%`, `_` and `\` in a guest's words are letters, not patterns. */
export function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The same escaping, anchored at the start (a prefix match ranks first among suggestions). */
export function likePrefix(text: string): string {
  return `${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface ExploreSearchInput {
  mode: ExploreMode;
  area: ExploreArea;
  sort: ExploreSort;
  /** The platform mean, frozen for the whole paging (D-as), as a decimal string. */
  mean: string;
  after: ExploreKey | null;
  limit: number;
}

/** One row of search, before the service shapes it into a card. */
export interface ExploreRow {
  id: string;
  slug: string;
  name: string;
  /** `lower(name)`, the second sort key, so the cursor compares what the database compared. */
  sortName: string;
  accommodationClass: string | null;
  sectorName: string | null;
  districtName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrivacy: boolean;
  priceRwf: number | null;
  /** Stays: how the room the price comes from is counted (`room_types.price_basis`); null for homes. */
  priceBasis: RoomPriceBasis | null;
  bookingMode: 'instant_book' | 'request_to_book' | null;
  /** Mean of the public reviews, unrounded; null when there are none. */
  mean: number | null;
  /** The same mean to one decimal, rounded by the database as the marketplace rating is. */
  rating: number | null;
  reviewCount: number;
  /** The weighted score as a decimal string, for the cursor. */
  score: string;
  availableFrom: string | null;
  unitCount: number | null;
}

export interface ExplorePhotoRow {
  propertyId: string;
  id: string;
  kind: 'property' | 'unit';
  caption: string | null;
}

export interface ExplorePlaceRow {
  kind: 'district' | 'sector' | 'property';
  id: string;
  label: string;
  count: number;
  slug: string | null;
  sectorName: string | null;
  districtName: string | null;
}

export interface ExplorePageRow extends ExploreRow {
  orgId: string;
  domain: 'hospitality' | 'residence';
  description: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string | null;
  timezone: string;
  legalName: string;
  tin: string | null;
  verifiedAt: string | null;
}

export interface ExploreRoomRow {
  id: string;
  name: string;
  capacity: number | null;
  roomCount: number;
  priceRwf: number | null;
  priceBasis: RoomPriceBasis;
  bookingMode: 'instant_book' | 'request_to_book' | null;
  cancellationTier: 'flexible' | 'moderate' | 'limited' | 'firm' | 'strict_extended_stay' | null;
  nonrefundableEligible: boolean;
  minStay: number | null;
}

export interface ExploreUnitRow {
  id: string;
  label: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  furnished: boolean;
  rentRwf: number;
  availableFrom: string | null;
}

/**
 * Explore's reads (mobile spec 0005, feature 23): which properties a guest may find, sorted, paged and
 * priced on the server, over the canonical public rule (`PUBLICLY_VISIBLE`: a published listing of an
 * active business) plus a public address and not archived. Stays also need a room type a guest can
 * book (`STAY_ROOM`, which keeps out bars and cafes and their menus), homes a listed unit. No
 * marketplace profile row is required: a business
 * that published its listing is found, whether or not anyone wrote it a profile (D-e).
 *
 * `PUBLICLY_VISIBLE` names `listings` and `orgs` themselves, so every query here joins them
 * unaliased. Raw SQL through drizzle's `sql`, like the marketplace repository.
 */
@Injectable()
export class ExploreRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The visible properties of one mode, with their place, as a CTE body over `properties`. */
  private visible(mode: ExploreMode, area: ExploreArea): SQL {
    const inMode =
      mode === 'stays'
        ? sql`orgs.domain = 'hospitality' AND EXISTS (
            SELECT 1 FROM room_types rt WHERE rt.property_id = properties.id AND ${STAY_ROOM})`
        : sql`orgs.domain = 'residence' AND EXISTS (
            SELECT 1 FROM rental_units u
             WHERE u.property_id = properties.id AND u.listed AND u.state = 'active')`;
    return sql`
      SELECT properties.id, properties.slug, properties.name, lower(properties.name) AS sort_name,
             properties.latitude::float8 AS latitude, properties.longitude::float8 AS longitude,
             properties.location_privacy, properties.sector_id, properties.district_id,
             orgs.accommodation_class, s.name AS sector_name, d.name AS district_name
        FROM properties
        JOIN listings ON listings.property_id = properties.id
        JOIN orgs ON orgs.id = properties.org_id
        LEFT JOIN sectors s ON s.id = properties.sector_id
        LEFT JOIN districts d ON d.id = properties.district_id
       WHERE ${PUBLICLY_VISIBLE} AND properties.slug IS NOT NULL AND properties.archived_at IS NULL
         AND ${inMode} AND ${this.inArea(area)}`;
  }

  private inArea(area: ExploreArea): SQL {
    switch (area.kind) {
      case 'district':
        return sql`properties.district_id = ${area.id}`;
      case 'sector':
        return sql`properties.sector_id = ${area.id}`;
      case 'property':
        return sql`properties.slug = ${area.slug}`;
      case 'text': {
        const words = likeContains(area.text);
        return sql`(properties.name ILIKE ${words} ESCAPE '\\' OR s.name ILIKE ${words} ESCAPE '\\'
                    OR d.name ILIKE ${words} ESCAPE '\\')`;
      }
      case 'all':
        return sql`true`;
    }
  }

  /**
   * Each visible property's price, booking mode and public rating, and its weighted score (D-l):
   * `(v × R + 5 × C) / (v + 5)`, so a property with no reviews scores exactly the platform mean `C`
   * and a new business is not buried. Rounded to nine places, so the cursor round trips exactly.
   *
   * A stay's price, basis and booking mode all come from ONE room (D-j, D-ao): its cheapest priced
   * room a guest can book, ties to the lower id. A room with no price never prices the card; a stay
   * whose rooms are all unpriced reads "Price on request" (null), its first room giving the rest.
   */
  private scored(input: Pick<ExploreSearchInput, 'mode' | 'area' | 'mean'>): SQL {
    const priced =
      input.mode === 'stays'
        ? sql`pr.price, pr.price_basis, pr.booking_mode, NULL::text AS available_from, NULL::int AS unit_count`
        : sql`(SELECT min(u.asking_rent_rwf) FROM rental_units u
                WHERE u.property_id = v.id AND u.listed AND u.state = 'active') AS price,
              NULL::text AS price_basis, NULL::text AS booking_mode,
              (SELECT CASE WHEN bool_or(u.available_from IS NULL) THEN NULL ELSE min(u.available_from)::text END
                 FROM rental_units u WHERE u.property_id = v.id AND u.listed AND u.state = 'active') AS available_from,
              (SELECT count(*)::int FROM rental_units u
                WHERE u.property_id = v.id AND u.listed AND u.state = 'active') AS unit_count`;
    const pricedRoom =
      input.mode === 'stays'
        ? sql`LEFT JOIN LATERAL (
            SELECT rt.base_price_rwf AS price, rt.price_basis::text AS price_basis, rt.booking_mode::text AS booking_mode
              FROM room_types rt
             WHERE rt.property_id = v.id AND ${STAY_ROOM}
             ORDER BY rt.base_price_rwf NULLS LAST, rt.id
             LIMIT 1
          ) pr ON true`
        : sql``;
    return sql`
      WITH visible AS (${this.visible(input.mode, input.area)}),
      priced AS (
        SELECT v.*, ${priced}, rv.mean, coalesce(rv.n, 0) AS review_count
          FROM visible v
          ${pricedRoom}
          LEFT JOIN LATERAL (
            SELECT avg(r.overall_rating)::numeric AS mean, count(*)::int AS n
              FROM reviews r
              JOIN guest_stays gs ON gs.id = r.stay_id
              JOIN rooms rm ON rm.id = gs.room_id
             WHERE rm.property_id = v.id AND ${PUBLIC_REVIEW}
          ) rv ON true
      ),
      scored AS (
        SELECT p.*, round(p.mean, 1)::float8 AS rating,
               round((p.review_count * coalesce(p.mean, 0) + 5 * ${input.mean}::numeric) / (p.review_count + 5), 9) AS score
          FROM priced p
      )`;
  }

  /**
   * The mean over every public review on the platform (`C`), as a decimal string; "0" when there are
   * none, which makes top rated an order by name.
   */
  async platformMean(): Promise<string> {
    const result = await this.db.execute<{ mean: string | null }>(sql`
      SELECT round(avg(r.overall_rating)::numeric, 6)::text AS mean
        FROM reviews r
        JOIN guest_stays gs ON gs.id = r.stay_id
        JOIN rooms rm ON rm.id = gs.room_id
       WHERE ${PUBLIC_REVIEW}`);
    return result.rows[0]?.mean ?? '0';
  }

  /** One page of matches, `limit + 1` rows so the caller knows whether there is another. */
  async search(input: ExploreSearchInput): Promise<ExploreRow[]> {
    const order =
      input.sort === 'top_rated'
        ? sql`s.score DESC, s.sort_name ASC, s.id ASC`
        : input.sort === 'price_asc'
          ? sql`s.price ASC NULLS LAST, s.sort_name ASC, s.id ASC`
          : sql`s.price DESC NULLS LAST, s.sort_name ASC, s.id ASC`;
    const result = await this.db.execute<Record<string, unknown>>(sql`
      ${this.scored(input)}
      SELECT s.* FROM scored s
       WHERE ${this.after(input.after)}
       ORDER BY ${order}
       LIMIT ${input.limit + 1}`);
    return result.rows.map(toRow);
  }

  /** Every match, counted with the same filters (`total`). */
  async count(input: Pick<ExploreSearchInput, 'mode' | 'area'>): Promise<number> {
    const result = await this.db.execute<{ total: number }>(sql`
      WITH visible AS (${this.visible(input.mode, input.area)})
      SELECT count(*)::int AS total FROM visible`);
    return Number(result.rows[0]?.total ?? 0);
  }

  /**
   * The keyset after the last row of the previous page. Row comparisons keep the order total:
   * (score desc, lower name, id) or (price with nulls last, lower name, id).
   */
  private after(key: ExploreKey | null): SQL {
    if (!key) return sql`true`;
    const rest = sql`(s.sort_name, s.id) > (${key.name}, ${key.id}::uuid)`;
    if (key.sort === 'top_rated') {
      return sql`(s.score < ${key.score}::numeric OR (s.score = ${key.score}::numeric AND ${rest}))`;
    }
    if (key.price === null) return sql`(s.price IS NULL AND ${rest})`;
    const beyond = key.sort === 'price_asc' ? sql`s.price > ${key.price}` : sql`s.price < ${key.price}`;
    return sql`(${beyond} OR (s.price = ${key.price} AND ${rest}) OR s.price IS NULL)`;
  }

  /**
   * Up to `perProperty` photographs of each property, the cover first then the operator's order. A home
   * with no property photograph shows its listed units' photographs instead, cheapest unit first.
   */
  async photos(propertyIds: string[], perProperty: number | null): Promise<ExplorePhotoRow[]> {
    if (propertyIds.length === 0) return [];
    const cap = perProperty === null ? sql`true` : sql`x.n <= ${perProperty}`;
    const result = await this.db.execute<Record<string, unknown>>(sql`
      WITH own AS (
        SELECT pp.property_id, pp.id, 'property' AS kind, pp.caption,
               row_number() OVER (PARTITION BY pp.property_id ORDER BY pp.is_cover DESC, pp.position, pp.id) AS n
          FROM property_photos pp
         WHERE pp.property_id IN (${uuidList(propertyIds)})
      ),
      units AS (
        SELECT u.property_id, up.id, 'unit' AS kind, up.caption,
               row_number() OVER (PARTITION BY u.property_id
                                  ORDER BY u.asking_rent_rwf NULLS LAST, u.id, up.position) AS n
          FROM unit_photos up
          JOIN rental_units u ON u.id = up.unit_id AND u.listed AND u.state = 'active'
         WHERE u.property_id IN (${uuidList(propertyIds)})
           AND NOT EXISTS (SELECT 1 FROM own o WHERE o.property_id = u.property_id)
      )
      SELECT x.property_id, x.id, x.kind, x.caption
        FROM (SELECT * FROM own UNION ALL SELECT * FROM units) x
       WHERE ${cap}
       ORDER BY x.property_id, x.n`);
    return result.rows.map((r) => ({
      propertyId: String(r.property_id),
      id: String(r.id),
      kind: r.kind as ExplorePhotoRow['kind'],
      caption: (r.caption as string | null) ?? null,
    }));
  }

  /**
   * Suggestions for what the guest typed (D-g): districts and sectors with at least one visible
   * property in this mode, then properties by name. Prefix matches first, then districts, sectors,
   * properties; at most `limit`.
   */
  async places(mode: ExploreMode, text: string, limit: number): Promise<ExplorePlaceRow[]> {
    const contains = likeContains(text);
    const prefix = likePrefix(text);
    const result = await this.db.execute<Record<string, unknown>>(sql`
      WITH visible AS (${this.visible(mode, { kind: 'all' })})
      SELECT * FROM (
        SELECT 'district' AS kind, d.id::text AS id, d.name AS label, count(*)::int AS n, NULL::text AS slug,
               NULL::text AS sector_name, NULL::text AS district_name,
               (d.name ILIKE ${prefix} ESCAPE '\\') AS starts, 1 AS rank
          FROM visible v JOIN districts d ON d.id = v.district_id
         WHERE d.name ILIKE ${contains} ESCAPE '\\'
         GROUP BY d.id, d.name
        UNION ALL
        SELECT 'sector', sc.id::text, sc.name, count(*)::int, NULL, NULL, sd.name,
               (sc.name ILIKE ${prefix} ESCAPE '\\'), 2
          FROM visible v JOIN sectors sc ON sc.id = v.sector_id
          LEFT JOIN districts sd ON sd.id = sc.district_id
         WHERE sc.name ILIKE ${contains} ESCAPE '\\'
         GROUP BY sc.id, sc.name, sd.name
        UNION ALL
        SELECT 'property', v.id::text, v.name, 1, v.slug, v.sector_name, v.district_name,
               (v.name ILIKE ${prefix} ESCAPE '\\'), 3
          FROM visible v
         WHERE v.name ILIKE ${contains} ESCAPE '\\'
      ) x
      ORDER BY x.starts DESC, x.rank, lower(x.label), x.id
      LIMIT ${limit}`);
    return result.rows.map((r) => ({
      kind: r.kind as ExplorePlaceRow['kind'],
      id: String(r.id),
      label: String(r.label),
      count: Number(r.n),
      slug: (r.slug as string | null) ?? null,
      sectorName: (r.sector_name as string | null) ?? null,
      districtName: (r.district_name as string | null) ?? null,
    }));
  }

  /**
   * One property's page row: the search row (price, rating, score) plus what the page adds. Null when
   * the property is not visible in either mode, which the route answers with a 404 (AC-3).
   */
  async page(slug: string, mean: string): Promise<ExplorePageRow | null> {
    for (const mode of ['stays', 'homes'] as const) {
      const result = await this.db.execute<Record<string, unknown>>(sql`
        ${this.scored({ mode, area: { kind: 'property', slug }, mean })}
        SELECT s.*, p.org_id, o.domain::text AS domain, p.description, p.check_in_time::text AS check_in_time,
               p.check_out_time::text AS check_out_time, p.house_rules, p.timezone, o.legal_name, o.tin,
               (SELECT max(rr.decided_at) FROM org_registration_reviews rr
                 WHERE rr.org_id = o.id AND rr.decision = 'passed') AS verified_at
          FROM scored s
          JOIN properties p ON p.id = s.id
          JOIN orgs o ON o.id = p.org_id
         LIMIT 1`);
      const r = result.rows[0];
      if (!r) continue;
      return {
        ...toRow(r),
        orgId: String(r.org_id),
        domain: r.domain as ExplorePageRow['domain'],
        description: (r.description as string | null) ?? null,
        checkInTime: clock(r.check_in_time),
        checkOutTime: clock(r.check_out_time),
        houseRules: (r.house_rules as string | null) ?? null,
        timezone: String(r.timezone),
        legalName: String(r.legal_name),
        tin: (r.tin as string | null) ?? null,
        verifiedAt: r.verified_at ? new Date(r.verified_at as string).toISOString() : null,
      };
    }
    return null;
  }

  /**
   * A stay's room types a guest can book (never a menu item), cheapest first, ties by id: the same
   * order that picks the card's room, so the first priced row is the room the card's price is.
   */
  async rooms(propertyId: string): Promise<ExploreRoomRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT rt.id, rt.name, rt.capacity, rt.room_count, rt.base_price_rwf, rt.price_basis::text AS price_basis,
             rt.booking_mode::text AS booking_mode, rt.cancellation_tier::text AS cancellation_tier,
             rt.nonrefundable_eligible, rt.min_stay
        FROM room_types rt
       WHERE rt.property_id = ${propertyId}::uuid AND ${STAY_ROOM}
       ORDER BY rt.base_price_rwf NULLS LAST, rt.id`);
    return result.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      capacity: toNumber(r.capacity),
      roomCount: Number(r.room_count),
      priceRwf: toNumber(r.base_price_rwf),
      priceBasis: r.price_basis as RoomPriceBasis,
      bookingMode: (r.booking_mode as ExploreRoomRow['bookingMode']) ?? null,
      cancellationTier: (r.cancellation_tier as ExploreRoomRow['cancellationTier']) ?? null,
      nonrefundableEligible: r.nonrefundable_eligible === true,
      minStay: toNumber(r.min_stay),
    }));
  }

  /** A home's listed units, cheapest first. */
  async units(propertyId: string): Promise<ExploreUnitRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT u.id, u.label, u.bedrooms, u.bathrooms, u.size_sqm, u.furnished, u.asking_rent_rwf,
             u.available_from::text AS available_from
        FROM rental_units u
       WHERE u.property_id = ${propertyId}::uuid AND u.listed AND u.state = 'active'
       ORDER BY u.asking_rent_rwf, lower(u.label), u.id`);
    return result.rows.map((r) => ({
      id: String(r.id),
      label: String(r.label),
      bedrooms: toNumber(r.bedrooms),
      bathrooms: toNumber(r.bathrooms),
      sizeSqm: toNumber(r.size_sqm),
      furnished: r.furnished === true,
      rentRwf: Number(r.asking_rent_rwf),
      availableFrom: (r.available_from as string | null) ?? null,
    }));
  }

  /** Photographs of these listed units, in each unit's order. */
  async unitPhotos(unitIds: string[]): Promise<{ unitId: string; id: string; caption: string | null }[]> {
    if (unitIds.length === 0) return [];
    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT up.unit_id, up.id, up.caption FROM unit_photos up
       WHERE up.unit_id IN (${uuidList(unitIds)})
       ORDER BY up.unit_id, up.position, up.id`);
    return result.rows.map((r) => ({
      unitId: String(r.unit_id),
      id: String(r.id),
      caption: (r.caption as string | null) ?? null,
    }));
  }

  /** The amenities a property lists, with the catalogue's English label, by label. */
  async amenities(propertyId: string): Promise<{ code: string; label: string }[]> {
    const result = await this.db.execute<{ code: string; label: string }>(sql`
      SELECT a.code, a.label_en AS label
        FROM property_amenities pa JOIN amenities a ON a.code = pa.amenity_code AND a.active
       WHERE pa.property_id = ${propertyId}::uuid
       ORDER BY lower(a.label_en), a.code`);
    return result.rows;
  }

  /**
   * The object key behind one public unit photograph, or null: the unit is listed and active, and its
   * property passes the same rule as every explore read. One null for every refusal, so a stranger
   * cannot tell a hidden photograph from one that does not exist.
   */
  async publicUnitPhotoKey(photoId: string): Promise<string | null> {
    const result = await this.db.execute<{ object_key: string }>(sql`
      SELECT so.object_key
        FROM unit_photos up
        JOIN stored_objects so ON so.id = up.stored_object_id
        JOIN rental_units u ON u.id = up.unit_id AND u.listed AND u.state = 'active'
        JOIN properties ON properties.id = u.property_id
        JOIN listings ON listings.property_id = properties.id
        JOIN orgs ON orgs.id = properties.org_id
       WHERE up.id = ${photoId}::uuid AND ${PUBLICLY_VISIBLE}
         AND properties.slug IS NOT NULL AND properties.archived_at IS NULL
       LIMIT 1`);
    return result.rows[0]?.object_key ?? null;
  }
}

/** "14:00:00" from a `time` column, as "14:00". */
function clock(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 5 ? value.slice(0, 5) : null;
}

function toRow(r: Record<string, unknown>): ExploreRow {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    sortName: String(r.sort_name),
    accommodationClass: (r.accommodation_class as string | null) ?? null,
    sectorName: (r.sector_name as string | null) ?? null,
    districtName: (r.district_name as string | null) ?? null,
    latitude: toNumber(r.latitude),
    longitude: toNumber(r.longitude),
    locationPrivacy: r.location_privacy === true,
    priceRwf: toNumber(r.price),
    priceBasis: (r.price_basis as RoomPriceBasis | null) ?? null,
    bookingMode: (r.booking_mode as ExploreRow['bookingMode']) ?? null,
    mean: toNumber(r.mean),
    rating: toNumber(r.rating),
    reviewCount: Number(r.review_count),
    score: String(r.score),
    availableFrom: (r.available_from as string | null) ?? null,
    unitCount: toNumber(r.unit_count),
  };
}
