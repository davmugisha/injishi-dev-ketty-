/**
 * The marketplace and Sarah Kimani's web account (market.*), as rows the API serves.
 *
 *   - Nine more businesses beside the interface world (one property each): the fixture's other
 *     listings, so Explore has the six Rubavu stays and five Kigali homes the screen shows. Each is a
 *     real business row (an active org with a 999-block TIN or a demo UPI, its own business
 *     workspace, a property with an address, a room type, rooms, a default rate plan) and every one
 *     says DEMO SAMPLE DATA in its description. Ids are `iid('market-…', key)`, so all of it lives
 *     under `1e000000-`.
 *   - A published listing and a marketplace card for each listed property (Isangano and Kacyiru
 *     included); a card but no listing for Ishyamba, which the marketplace does not list but Sarah's
 *     past trip draws. Room cards for Isangano's four room types. Isangano's Family Suite is booked by
 *     request, as the prototype draws it.
 *   - Sarah's account: contact details, three saved lists, her consent choices (append-only rows),
 *     and five bookings with their escrows, payments and (for the two completed stays) closed stays.
 *
 * Money follows the backend, not the prototype: a stay is priced per guest per night plus the guest
 * service fee (`computeBreakdown`), so a fixture total of "RWF 280,000" for two nights becomes what the
 * booking service would actually have charged. A request is captured into escrow when it is made
 * (F-B06), so the pending request holds money too. References are drawn from the booking alphabet,
 * never copied from the prototype's sequential numbers.
 *
 * Convergence: rows a flow creates in the fictional businesses (bookings, payments, escrows) and in
 * Sarah's account (lists, saved places, consent rows) go on the next seed. Rows in the hotel workspace
 * are upserted by id and kept, and this module never scopes a deletion over another area's rows there.
 */
import { createHash } from 'node:crypto';

import { computeBreakdown, stayNightlyRateRwf } from '@injishi/contracts';

import { businessKindFor } from '../business-kind.mjs';
import { syntheticCoordFor } from '../synthetic-coords.mjs';
import { day, districtId, iid, kigaliAt, parseFixtureDate, sectorId, shiftDate, userId } from './lib.mjs';
import { ORG, PROPERTY, WORKSPACE, roomId, roomTypeId } from './world.mjs';

const DEMO = 'DEMO SAMPLE DATA. A fictional business of the interface sample world.';

/** Where each fixture listing stands: the interface world's own properties, or a new demo business. */
const PLACES = {
  isangano: { property: PROPERTY.isangano, workspace: WORKSPACE.hotel },
  kacyiru: { property: PROPERTY.kacyiru, workspace: WORKSPACE.residences },
  rubona: { district: 'Rubavu', sector: 'Nyamyumba', street: 'Rubona peninsula road' },
  sunset: { district: 'Rubavu', sector: 'Gisenyi', street: 'Avenue de la Production', room: 'Garden double' },
  nyamyumba: { district: 'Rubavu', sector: 'Nyamyumba', street: 'Lake Kivu shore, Nyamyumba' },
  hills: { district: 'Rubavu', sector: 'Gisenyi', street: 'Nengo hill road' },
  lakeshore: { district: 'Rubavu', sector: 'Gisenyi', street: 'Avenue du Lac' },
  kimihurura: { district: 'Gasabo', sector: 'Kimihurura', street: 'KG 9 Ave' },
  kiyovu: { district: 'Nyarugenge', sector: 'Nyarugenge', street: 'KN 47 St' },
  rebero: { district: 'Kicukiro', sector: 'Kigarama', street: 'KK 515 St' },
  nyarutarama: { district: 'Gasabo', sector: 'Remera', street: 'KG 11 Ave' },
};

/** Marketplace kind → the registration's accommodation class (`AccommodationClass`). */
const CLASS = { hotel: 'hotel', lodge: 'lodge', tented: 'tented_camp', guest: 'guest_house', villa: 'villa', apartment: 'apartment' };

/**
 * The explore filter's amenity ids → the platform's amenity codes. Step-free rooms, furnished and backup
 * water have no code in the `amenities` catalogue, so they are not written; the catalogue is reference
 * data and is not this seed's to extend.
 */
const AMENITY = { wifi: 'wifi', lake: 'view', breakfast: 'breakfast', pool: 'pool', parking: 'parking', transfer: 'shuttle', security: 'guard', garden: 'garden' };
/** Isangano's facilities on its property page (fixture ids → codes); the bar and the hall are an outlet and a space, not amenities. */
const PAGE_AMENITY = { wifi: 'wifi', restaurant: 'restaurant', parking: 'parking', laundry: 'laundry', desk: 'front24', pickup: 'shuttle' };

const propertyOf = (key) => PLACES[key]?.property ?? iid('market-property', key);
const workspaceOf = (key) => PLACES[key]?.workspace ?? iid('market-workspace', key);
const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A booking reference in the booking service's own alphabet (`makeReference`), stable per key. */
function reference(key) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = createHash('sha256').update(`market-booking-ref:${key}`).digest();
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `BK-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** "From 1 Nov" → a shifted ISO date; "Available now" → null (now). */
function availableFrom(text) {
  const m = text?.match(/^From (\d{1,2} [A-Z][a-z]{2})$/);
  return m ? shiftDate(parseFixtureDate(m[1])) : null;
}

function homesFacts(size) {
  const beds = size?.match(/(\d+) bedrooms?/);
  const area = size?.match(/(\d+) m²/);
  return { bedrooms: beds ? Number(beds[1]) : null, area: area ? Number(area[1]) : null };
}

async function upsertBusiness(c, item, index) {
  const place = PLACES[item.id];
  const home = item.mode === 'homes';
  const org = iid('market-org', item.id);
  const workspace = workspaceOf(item.id);
  const property = propertyOf(item.id);
  const district = await districtId(c, place.district);
  // Synthetic identifiers only: a 999-block TIN, a demo-range UPI, never the prototype's real-looking ones.
  await c.query(
    `INSERT INTO orgs (id, legal_name, domain, rdb_entity_group, accommodation_class, residence_class, tin, upi,
                       registration_status, district_id, business_kind)
     VALUES ($1, $2, $3, 'accommodation', $4, $5, $6, $7, 'active', $8, $9)
     ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name, registration_status = 'active'`,
    [org, item.entity, home ? 'residence' : 'hospitality', home ? null : CLASS[item.type], home ? 'residential_landlord' : null,
      home ? null : `9993000${String(index).padStart(2, '0')}`, home ? `1/02/09/01/93${String(index).padStart(2, '0')}` : null, district,
      businessKindFor({ domain: home ? 'residence' : 'hospitality', accommodationClass: home ? null : CLASS[item.type] })],
  );
  await c.query(`INSERT INTO workspaces (id, kind, org_id) VALUES ($1, 'business', $2) ON CONFLICT DO NOTHING`, [workspace, org]);
  const slug = slugify(item.name);
  const [lat, lng] = syntheticCoordFor({ district: place.district, seed: slug });
  await c.query(
    `INSERT INTO properties (id, org_id, workspace_id, name, description, sector_id, district_id, latitude, longitude,
                             address_text, check_in_time, check_out_time, house_rules, slug, is_head_office)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '14:00', '11:00', $11, $12, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, slug = EXCLUDED.slug`,
    [property, org, workspace, item.name, DEMO, await sectorId(c, place.district, place.sector), district, lat, lng,
      `${place.street}, ${place.sector}, ${place.district}`, home ? 'Visitors sign in at the gate.' : 'Quiet hours from 22:00.', slug],
  );
  // One room type per business: the card's price, booked as the card says (homes are let, not booked).
  const type = iid('market-room-type', item.id);
  const units = home ? 2 : 4;
  const mode = home ? null : item.booking === 'request' ? 'request_to_book' : 'instant_book';
  const approval = mode === 'request_to_book' ? 'approve_all' : null;
  await c.query(
    `INSERT INTO room_types (id, property_id, workspace_id, name, domain, capacity, max_guests, room_count, base_price_rwf,
                             booking_mode, approval_policy, cancellation_tier)
     VALUES ($1, $2, $3, $4, $5, 2, 2, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_price_rwf = EXCLUDED.base_price_rwf,
       booking_mode = EXCLUDED.booking_mode, approval_policy = EXCLUDED.approval_policy, room_count = EXCLUDED.room_count`,
    [type, property, workspace, place.room ?? (home ? 'Apartment' : 'Standard'), home ? 'residence' : 'hospitality', units, item.price,
      mode, approval, home ? null : 'flexible'],
  );
  const plan = iid('market-rate-plan', item.id);
  await c.query(
    `INSERT INTO rate_plans (id, room_type_id, workspace_id, name, is_default, base_price_rwf, base_occupancy, booking_mode,
                             approval_policy, cancellation_tier)
     VALUES ($1, $2, $3, 'Standard rate', true, $4, 2, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET base_price_rwf = EXCLUDED.base_price_rwf, booking_mode = EXCLUDED.booking_mode,
       approval_policy = EXCLUDED.approval_policy`,
    [plan, type, workspace, item.price, mode, approval, home ? null : 'flexible'],
  );
  const rooms = [];
  for (let n = 1; n <= units; n++) {
    const id = iid('market-room', `${item.id}:${n}`);
    rooms.push(id);
    await c.query(
      `INSERT INTO rooms (id, room_type_id, property_id, workspace_id, label, status, housekeeping_status)
       VALUES ($1, $2, $3, $4, $5, 'available', 'clean') ON CONFLICT (id) DO NOTHING`,
      [id, type, property, workspace, `${home ? 'U' : 'R'}${n}`],
    );
  }
  return { org, workspace, property, type, plan, rooms };
}

export async function seed({ c, fx, keep, log }) {
  const listings = fx('market.listings');
  const page = fx('market.properties').find((p) => p.listing === 'isangano');
  if (!page) throw new Error('market.properties has no Isangano page');
  const created = { orgs: [], workspaces: [], properties: [], types: [], plans: [], rooms: [] };

  // --- Businesses and listings --------------------------------------------------------------
  let index = 0;
  for (const item of listings) {
    if (!PLACES[item.id]) throw new Error(`market.listings ${item.id} has no place in market.mjs`);
    if (PLACES[item.id].property) continue;
    index += 1;
    const b = await upsertBusiness(c, item, index);
    created.orgs.push(b.org);
    created.workspaces.push(b.workspace);
    created.properties.push(b.property);
    created.types.push(b.type);
    created.plans.push(b.plan);
    created.rooms.push(...b.rooms);
  }
  const marketScope = { column: 'workspace_id', values: created.workspaces };

  const listingIds = [];
  const profileIds = [];
  for (const item of listings) {
    const property = propertyOf(item.id);
    const workspace = workspaceOf(item.id);
    // A property that already carries a listing (another area published it) keeps that listing's id.
    const { rows } = await c.query('SELECT id FROM listings WHERE property_id = $1', [property]);
    const listing = rows[0]?.id ?? iid('market-listing', item.id);
    listingIds.push(listing);
    await c.query(
      `INSERT INTO listings (id, property_id, workspace_id, status, published_at)
       VALUES ($1, $2, $3, 'published', now() - interval '30 days')
       ON CONFLICT (property_id) DO UPDATE SET status = 'published', published_at = coalesce(listings.published_at, EXCLUDED.published_at)`,
      [listing, property, workspace],
    );
    const isPage = item.id === page.listing;
    const homes = homesFacts(item.size);
    const profile = iid('market-profile', item.id);
    profileIds.push(profile);
    await c.query(
      `INSERT INTO market_property_profiles (id, property_id, workspace_id, kind, stock_photo, caption, gallery, highlights,
                                             nearby, house_rule_items, map_label, bedrooms, floor_area_sqm, available_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, stock_photo = EXCLUDED.stock_photo, caption = EXCLUDED.caption,
         gallery = EXCLUDED.gallery, highlights = EXCLUDED.highlights, nearby = EXCLUDED.nearby,
         house_rule_items = EXCLUDED.house_rule_items, map_label = EXCLUDED.map_label, bedrooms = EXCLUDED.bedrooms,
         floor_area_sqm = EXCLUDED.floor_area_sqm, available_from = EXCLUDED.available_from, updated_at = now()`,
      [profile, property, workspace, item.type, item.photo, item.caption,
        JSON.stringify(isPage ? page.gallery : []),
        JSON.stringify(isPage ? page.highlights.map(({ icon, title, desc }) => ({ icon, title, desc })) : []),
        JSON.stringify(isPage ? page.map.distances : []),
        JSON.stringify(isPage ? page.houseRules : []),
        isPage ? page.map.label : null,
        item.mode === 'homes' ? homes.bedrooms : null,
        item.mode === 'homes' ? homes.area : null,
        item.mode === 'homes' ? availableFrom(item.available) : null],
    );
    const codes = new Set(item.amenities.map((a) => AMENITY[a]).filter(Boolean));
    if (isPage) for (const a of page.amenities) if (PAGE_AMENITY[a.id]) codes.add(PAGE_AMENITY[a.id]);
    for (const code of codes) {
      await c.query(
        `INSERT INTO property_amenities (property_id, amenity_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [property, code],
      );
    }
  }
  // Ishyamba is not listed (the Rubavu search does not reach Nyamagabe) but Sarah stayed there: a card, no listing.
  const ishyambaProfile = iid('market-profile', 'ishyamba');
  profileIds.push(ishyambaProfile);
  await c.query(
    `INSERT INTO market_property_profiles (id, property_id, workspace_id, kind, stock_photo, caption)
     VALUES ($1, $2, $3, 'lodge', 'forestLodge', 'Tents at the forest edge')
     ON CONFLICT (id) DO UPDATE SET stock_photo = EXCLUDED.stock_photo, caption = EXCLUDED.caption`,
    [ishyambaProfile, PROPERTY.ishyamba, WORKSPACE.hotel],
  );

  // --- Isangano's room cards; the Family Suite is booked by request --------------------------
  const roomProfiles = [];
  const roomTypes = fx('frontdesk.roomTypes');
  for (const room of fx('market.rooms')) {
    const type = roomTypes.find((t) => t.name === room.name);
    if (!type) throw new Error(`market.rooms ${room.id}: no Isangano room type named ${room.name}`);
    const typeId = roomTypeId('isangano', type.id);
    const id = iid('market-room-profile', room.id);
    roomProfiles.push(id);
    await c.query(
      `INSERT INTO market_room_profiles (id, room_type_id, workspace_id, bed, size_sqm, highlight, stock_photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET bed = EXCLUDED.bed, size_sqm = EXCLUDED.size_sqm, highlight = EXCLUDED.highlight,
         stock_photo = EXCLUDED.stock_photo, updated_at = now()`,
      [id, typeId, WORKSPACE.hotel, room.bed, Number(room.size.match(/\d+/)?.[0]) || null, room.feature, room.photo],
    );
    if (room.booking === 'request') {
      // The room type and its default plan agree, so whichever the booking path reads, it reads a request.
      await c.query(`UPDATE room_types SET booking_mode = 'request_to_book', approval_policy = 'approve_all' WHERE id = $1`, [typeId]);
      await c.query(
        `UPDATE rate_plans SET booking_mode = 'request_to_book', approval_policy = 'approve_all' WHERE room_type_id = $1 AND is_default`,
        [typeId],
      );
    }
  }

  // --- Sarah's contact details -------------------------------------------------------------
  const guest = userId('guest');
  const profile = fx('market.guestProfiles')[0];
  await c.query(`UPDATE users SET created_at = $2 WHERE id = $1`, [guest, '2025-03-04T09:00:00+02:00']);
  // A Kenyan address is one free line, with no Rwandan hierarchy (D24).
  await c.query(
    `UPDATE user_profiles SET phone_e164 = $2, country = 'KE', district_id = NULL, sector_id = NULL, village_id = NULL,
       address_text = $3, locale = $4 WHERE user_id = $1`,
    [guest, profile.mobile.replace(/[^+0-9]/g, ''), profile.home, profile.language],
  );

  // --- Saved lists: the first is the heart's default list ------------------------------------
  const lists = [];
  const items = [];
  const priceOf = (key) => listings.find((l) => l.id === key)?.price ?? null;
  for (const [i, col] of fx('market.savedCollections').entries()) {
    const id = iid('saved-collection', col.id);
    lists.push(id);
    await c.query(
      `INSERT INTO collections (id, user_id, workspace_id, name, visibility, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, visibility = EXCLUDED.visibility, is_default = EXCLUDED.is_default`,
      [id, guest, WORKSPACE.personal('guest'), col.name, col.visibility.startsWith('Shared') ? 'shared' : 'private', i === 0,
        kigaliAt('09:00', -40 + i)],
    );
    for (const [j, place] of col.items.entries()) {
      const itemId = iid('saved-item', `${col.id}:${place.id}`);
      items.push(itemId);
      // "Price down RWF 10,000 since saved" is the saved price minus today's; every other place is unchanged.
      const down = Number(place.note.match(/^Price down RWF ([\d,]+)/)?.[1]?.replace(/,/g, '') ?? 0);
      const now = priceOf(place.id);
      await c.query(
        `INSERT INTO collection_items (id, collection_id, property_id, saved_price_rwf, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (collection_id, property_id) DO UPDATE SET id = EXCLUDED.id, saved_price_rwf = EXCLUDED.saved_price_rwf,
           created_at = EXCLUDED.created_at`,
        // The first place in the list is the newest save (the list reads newest first).
        [itemId, id, propertyOf(place.id), now === null ? null : now + down, kigaliAt(`${18 - j}:00`, -3)],
      );
    }
  }

  // --- Consent: append-only rows, one per fixture choice ------------------------------------
  const PURPOSE = { msg: 'booking_messages', share: 'share_phone_with_hosts', remind: 'review_reminders', offers: 'marketing_offers', recs: 'personalisation' };
  const consents = [];
  for (const choice of fx('market.consents')) {
    const purpose = PURPOSE[choice.id];
    if (!purpose) throw new Error(`market.consents ${choice.id} has no purpose`);
    const id = iid('consent', `guest:${choice.id}`);
    consents.push(id);
    const changed = choice.desc.match(/changed (\d{1,2} [A-Z][a-z]{2} \d{4})/)?.[1];
    await c.query(
      `INSERT INTO user_consents (id, user_id, workspace_id, purpose, granted, policy_version, source, recorded_at)
       VALUES ($1, $2, $3, $4, $5, 'privacy-2.1', 'account', $6)
       ON CONFLICT (id) DO UPDATE SET granted = EXCLUDED.granted, recorded_at = EXCLUDED.recorded_at`,
      [id, guest, WORKSPACE.personal('guest'), purpose, choice.on, changed ? `${parseFixtureDate(changed)}T10:00:00+02:00` : '2025-03-04T09:05:00+02:00'],
    );
  }

  // --- Sarah's bookings ---------------------------------------------------------------------
  const TRIPS = [
    // key, listing (or the world), room type, check-in, check-out, guests, status, booked at
    { key: 'isangano', property: 'isangano', type: roomTypeId('isangano', roomTypes.find((t) => t.name === 'Deluxe Lake View').id),
      rate: roomTypes.find((t) => t.name === 'Deluxe Lake View').rate, in: shiftDate('2026-10-23'), out: shiftDate('2026-10-25'),
      status: 'confirmed', mode: 'instant_book', bookedAt: kigaliAt('10:43'), workspace: WORKSPACE.hotel },
    { key: 'sunset', property: 'sunset', in: shiftDate('2026-11-13'), out: shiftDate('2026-11-15'),
      status: 'pending_approval', mode: 'request_to_book', bookedAt: kigaliAt('09:00') },
    { key: 'ishyamba', property: 'ishyamba', type: roomTypeId('ishyamba', 'tent'), rate: 105000, in: shiftDate('2026-10-03'),
      out: shiftDate('2026-10-06'), status: 'confirmed', mode: 'instant_book', bookedAt: kigaliAt('16:20', -30),
      workspace: WORKSPACE.hotel, stayRoom: roomId('ishyamba', 'T3'), done: true },
    { key: 'nyamyumba', property: 'nyamyumba', in: shiftDate('2026-07-03'), out: shiftDate('2026-07-05'), status: 'confirmed',
      mode: 'instant_book', bookedAt: kigaliAt('11:05', -130), stayRoom: iid('market-room', 'nyamyumba:2'), done: true },
    { key: 'rubona', property: 'rubona', in: '2026-06-02', out: '2026-06-03', status: 'cancelled', mode: 'instant_book',
      bookedAt: new Date('2026-05-02T08:12:00+02:00'), cancelledAt: new Date('2026-05-21T09:15:00+02:00') },
  ];
  const bookingIds = [];
  const escrowIds = [];
  const attemptIds = [];
  const stayIds = [];
  for (const t of TRIPS) {
    const id = iid('market-booking', t.key);
    bookingIds.push(id);
    const type = t.type ?? iid('market-room-type', t.property);
    const workspace = t.workspace ?? workspaceOf(t.property);
    const nightly = t.rate ?? priceOf(t.property);
    const nights = Math.round((Date.parse(`${t.out}T12:00:00Z`) - Date.parse(`${t.in}T12:00:00Z`)) / 86_400_000);
    const breakdown = computeBreakdown({ nightlyRateRwf: nightly, nights, nonRefundable: false, guests: 2 });
    const bookedAt = new Date(Math.min(Date.now() - 60_000, t.bookedAt.getTime()));
    const refunded = t.status === 'cancelled';
    const payment = refunded ? 'refunded_full' : t.done ? 'paid_out' : 'captured';
    const escrowStatus = refunded ? 'refunded_full' : t.done ? 'released' : 'held';
    const approvalExpiresAt = t.status === 'pending_approval' ? new Date(bookedAt.getTime() + 24 * 3_600_000) : null;
    await c.query(
      `INSERT INTO bookings (id, reference, room_type_id, guest_user_id, workspace_id, check_in, check_out, guest_count, status,
                             booking_mode, locked_nightly_rate_rwf, locked_cancellation_tier, nonrefundable, gross_rwf,
                             payment_status, approval_expires_at, confirmed_at, created_at, cancelled_at, cancelled_by, refund_rwf)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 2, $8, $9, $10, 'flexible', false, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
         payment_status = EXCLUDED.payment_status, approval_expires_at = EXCLUDED.approval_expires_at,
         confirmed_at = EXCLUDED.confirmed_at, created_at = EXCLUDED.created_at, cancelled_at = EXCLUDED.cancelled_at,
         cancelled_by = EXCLUDED.cancelled_by, refund_rwf = EXCLUDED.refund_rwf, gross_rwf = EXCLUDED.gross_rwf,
         locked_nightly_rate_rwf = EXCLUDED.locked_nightly_rate_rwf`,
      [id, reference(t.key), type, guest, workspace, t.in, t.out, t.status, t.mode, stayNightlyRateRwf(breakdown),
        breakdown.grossRwf, payment, approvalExpiresAt, t.status === 'confirmed' ? bookedAt : null, bookedAt,
        refunded ? t.cancelledAt : null, refunded ? 'guest' : null, refunded ? breakdown.grossRwf : null],
    );
    // The capture the booking service would have recorded, on the mock rail (adapter_mode mock).
    const key = `seed-interface:market:${t.key}`;
    const escrow = iid('market-escrow', t.key);
    escrowIds.push(escrow);
    await c.query(
      `INSERT INTO escrows (id, workspace_id, source, booking_id, amount_rwf, status, adapter_ref, adapter_mode, idempotency_key)
       VALUES ($1, $2, 'booking', $3, $4, $5, $6, 'mock', $7)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount_rwf = EXCLUDED.amount_rwf`,
      [escrow, workspace, id, breakdown.grossRwf, escrowStatus, `mock_escrow_capture_${key}`, key],
    );
    const attempt = iid('market-attempt', t.key);
    attemptIds.push(attempt);
    await c.query(
      `INSERT INTO payment_attempts (id, idempotency_key, attempt_token, guest_user_id, workspace_id, room_type_id, check_in,
                                     check_out, guest_count, attempt_fingerprint, amount_rwf, adapter_ref, adapter_mode,
                                     instrument_kind, network, payer_masked, state, expires_at, settled_at, booking_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2, $9, $10, $11, 'mock', 'mobile_money', 'mtn_momo', '078••••417', 'confirmed',
               $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET amount_rwf = EXCLUDED.amount_rwf, settled_at = EXCLUDED.settled_at,
         expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at`,
      [attempt, key, iid('market-attempt-token', t.key), guest, workspace, type, t.in, t.out, `mtn_momo:788124417`,
        breakdown.grossRwf, `mock_escrow_capture_${key}`, new Date(bookedAt.getTime() + 180_000), new Date(bookedAt.getTime() + 40_000),
        id, bookedAt],
    );
    if (t.done) {
      // A completed stay: checked in at the property's hour, out the morning the booking ends.
      const stay = iid('market-stay', t.key);
      stayIds.push(stay);
      await c.query(
        `INSERT INTO guest_stays (id, booking_id, guest_user_id, room_id, workspace_id, check_in_mode, is_verified, entry_at,
                                  planned_exit_at, actual_exit_at, price_rwf, lifecycle, guest_name, guest_email)
         VALUES ($1, $2, $3, $4, $5, 'staffed', true, $6, $7, $7, $8, 'closed', $9, $10)
         ON CONFLICT (id) DO UPDATE SET entry_at = EXCLUDED.entry_at, planned_exit_at = EXCLUDED.planned_exit_at,
           actual_exit_at = EXCLUDED.actual_exit_at, lifecycle = 'closed'`,
        [stay, id, guest, t.stayRoom, workspace, new Date(`${t.in}T14:20:00+02:00`), new Date(`${t.out}T10:30:00+02:00`),
          breakdown.grossRwf, profile.name, profile.email],
      );
    }
  }

  // --- What this module keeps --------------------------------------------------------------
  // Parents before children: removal runs in reverse. Deletions are scoped to the demo businesses this
  // module owns and to Sarah's own account, never to the hotel or residence workspaces.
  keep('properties', created.properties, marketScope);
  keep('room_types', created.types, marketScope);
  keep('rate_plans', created.plans, marketScope);
  keep('rooms', created.rooms, marketScope);
  keep('listings', listingIds, marketScope);
  keep('market_property_profiles', profileIds, {
    column: 'workspace_id',
    values: [WORKSPACE.hotel, WORKSPACE.residences, ...created.workspaces],
  });
  keep('market_room_profiles', roomProfiles, { column: 'workspace_id', values: [WORKSPACE.hotel, WORKSPACE.residences, ...created.workspaces] });
  // Sarah's own bookings converge wherever they were made: a flow books Isangano (the hotel workspace),
  // and a booking of hers that no module keeps goes, with its stay, payment and escrow. Another module's
  // seeded bookings of hers are kept by that module's ids.
  const sarahScope = { column: 'guest_user_id', values: [guest] };
  const { rows: hers } = await c.query('SELECT id FROM bookings WHERE guest_user_id = $1', [guest]);
  keep('bookings', bookingIds, marketScope);
  keep('bookings', [], sarahScope);
  keep('guest_stays', stayIds, marketScope);
  keep('guest_stays', [], sarahScope);
  keep('payment_attempts', attemptIds, marketScope);
  keep('payment_attempts', [], sarahScope);
  keep('escrows', escrowIds, marketScope);
  keep('escrows', [], { column: 'booking_id', values: hers.map((r) => r.id) });
  // The booking service opens a conversation with the property for every booking; its messages cascade.
  keep('threads', [], { column: 'booking_id', values: hers.map((r) => r.id) });
  keep('collections', lists, { column: 'user_id', values: [guest] });
  keep('collection_items', items, { column: 'collection_id', values: lists });
  keep('user_consents', consents, { column: 'user_id', values: [guest] });

  log(
    `market: ${listings.length} listed properties (${created.properties.length} demo businesses), ` +
      `${roomProfiles.length} room cards, ${lists.length} saved lists (${items.length} places), ` +
      `${consents.length} consent choices, ${bookingIds.length} of Sarah's bookings`,
  );
}
