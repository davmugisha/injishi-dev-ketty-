import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { randomUUID } from 'node:crypto';

import { ExploreSearchQuery } from '@injishi/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

import * as schema from '../../database/drizzle/schema';
import type { Database } from '../../shared/database/database.module';
import { ListingService } from '../listing/application/listing.service';
import { ListingRepository } from '../listing/infrastructure/listing.repository';
import type { StorageService } from '../storage/application/storage.service';
import { ExploreService } from './application/explore.service';
import { ExploreRepository } from './infrastructure/explore.repository';

/**
 * Explore against a real Postgres (mobile spec 0005, the explore child's tests): the SQL a double
 * cannot judge. Visibility (a draft listing, a suspended business, no slug, an archived property and a
 * bar with no rooms are all absent; a property with no marketplace profile is present), paging with
 * equal scores and with a review landing between pages, `ILIKE` escaping, homes mode, and the location
 * blur on explore and on the legacy `/properties` reads.
 *
 * OPT IN: set `EXPLORE_IT_DATABASE_URL` to a THROWAWAY database, migrated and holding the reference
 * data (geography, RDB classes). The spec writes its own businesses there under a random tag, searches
 * by that tag so other rows never interfere, and does not clean up; drop the database afterwards.
 *
 *   createdb injishi_explore_it && DATABASE_URL=… node scripts/migrate.mjs && node scripts/seed-reference.mjs
 *   EXPLORE_IT_DATABASE_URL=postgres://…/injishi_explore_it npx vitest run src/modules/marketplace/explore.integration.spec.ts
 *   dropdb injishi_explore_it
 */
const url = process.env.EXPLORE_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('explore against Postgres (EXPLORE_IT_DATABASE_URL)', () => {
  vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

  let pool: Pool;
  let db: Database;
  let explore: ExploreService;
  let listings: ListingService;
  const tag = `zx${randomUUID().slice(0, 6)}`;
  let place: { districtId: number; sectorId: number };
  let tinSeq = 0;

  const query = (input: Record<string, unknown>): ExploreSearchQuery => ExploreSearchQuery.parse({ q: tag, ...input });

  /** A business with one property, published unless told otherwise, and one room type. */
  async function stay(
    name: string,
    opts: {
      status?: 'active' | 'suspended';
      listing?: 'published' | 'draft';
      slug?: string | null;
      archived?: boolean;
      rooms?: boolean;
      price?: number | null;
      latitude?: number | null;
      longitude?: number | null;
      privacy?: boolean;
      bar?: boolean;
      /** How the one room type is counted (`room_types.price_basis`); the column's default otherwise. */
      basis?: 'per_person' | 'per_unit';
      singleGuestPrice?: number | null;
      capacity?: number | null;
      /** Menu items (`per_item`, unbooked) to add beside the room, or alone with `bar`. */
      menu?: number[];
    } = {},
  ): Promise<{ propertyId: string; workspaceId: string; roomTypeId: string | null; slug: string | null }> {
    tinSeq += 1;
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `${name} Ltd`,
        domain: 'hospitality',
        businessKind: opts.bar ? 'bar_restaurant' : 'hotel',
        accommodationClass: opts.bar ? null : 'hotel',
        tin: `9${String(Date.now()).slice(-5)}${String(tinSeq).padStart(3, '0')}`,
        registrationStatus: opts.status ?? 'active',
        districtId: place.districtId,
        sectorId: place.sectorId,
      })
      .returning();
    const [workspace] = await db.insert(schema.workspaces).values({ kind: 'business', orgId: org!.id }).returning();
    const slug = opts.slug === undefined ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tinSeq}` : opts.slug;
    const [property] = await db
      .insert(schema.properties)
      .values({
        orgId: org!.id,
        workspaceId: workspace!.id,
        name,
        slug,
        sectorId: place.sectorId,
        districtId: place.districtId,
        latitude: opts.latitude === undefined ? '-1.6789' : opts.latitude === null ? null : String(opts.latitude),
        longitude: opts.longitude === undefined ? '29.2567' : opts.longitude === null ? null : String(opts.longitude),
        locationPrivacy: opts.privacy ?? false,
        archivedAt: opts.archived ? new Date() : null,
      })
      .returning();
    await db.insert(schema.listings).values({
      propertyId: property!.id,
      workspaceId: workspace!.id,
      status: opts.listing ?? 'published',
      publishedAt: (opts.listing ?? 'published') === 'published' ? new Date() : null,
    });
    let roomTypeId: string | null = null;
    if (opts.rooms !== false && !opts.bar) {
      const [rt] = await db
        .insert(schema.roomTypes)
        .values({
          propertyId: property!.id,
          workspaceId: workspace!.id,
          name: 'Standard',
          domain: 'hospitality',
          capacity: opts.capacity === undefined ? 2 : opts.capacity,
          roomCount: 1,
          basePriceRwf: opts.price === undefined ? 50_000 : opts.price,
          bookingMode: 'instant_book',
          ...(opts.basis ? { priceBasis: opts.basis } : {}),
          ...(opts.singleGuestPrice !== undefined ? { singleGuestPriceRwf: opts.singleGuestPrice } : {}),
        })
        .returning();
      roomTypeId = rt!.id;
    }
    for (const [i, price] of (opts.menu ?? []).entries()) {
      // How migration 0117 left a venue's offerings: priced each, never booked.
      await db.insert(schema.roomTypes).values({
        propertyId: property!.id,
        workspaceId: workspace!.id,
        name: `Menu item ${i + 1}`,
        domain: 'hospitality',
        roomCount: 5,
        basePriceRwf: price,
        priceBasis: 'per_item',
        bookingMode: null,
      });
    }
    return { propertyId: property!.id, workspaceId: workspace!.id, roomTypeId, slug };
  }

  /** One more room type on a stay, for a property with several. */
  async function addRoom(
    target: { propertyId: string; workspaceId: string },
    values: { name: string; price: number | null; basis?: 'per_person' | 'per_unit'; capacity?: number | null; mode?: 'instant_book' | 'request_to_book' },
  ): Promise<string> {
    const [rt] = await db
      .insert(schema.roomTypes)
      .values({
        propertyId: target.propertyId,
        workspaceId: target.workspaceId,
        name: values.name,
        domain: 'hospitality',
        capacity: values.capacity === undefined ? 2 : values.capacity,
        roomCount: 2,
        basePriceRwf: values.price,
        bookingMode: values.mode ?? 'instant_book',
        priceBasis: values.basis ?? 'per_unit',
      })
      .returning();
    return rt!.id;
  }

  /** A public review of a stay's room type, through a closed guest stay on a room of it. */
  async function review(
    target: { propertyId: string; workspaceId: string; roomTypeId: string | null },
    rating: number,
  ): Promise<void> {
    const [room] = await db
      .insert(schema.rooms)
      .values({ roomTypeId: target.roomTypeId!, propertyId: target.propertyId, workspaceId: target.workspaceId })
      .returning();
    const [stayRow] = await db
      .insert(schema.guestStays)
      .values({
        roomId: room!.id,
        workspaceId: target.workspaceId,
        checkInMode: 'staffed',
        entryAt: new Date(Date.now() - 5 * 86_400_000),
        lifecycle: 'closed',
        guestName: 'Test Guest',
      })
      .returning();
    await db.insert(schema.reviews).values({
      stayId: stayRow!.id,
      side: 'guest_to_host',
      overallRating: rating,
      moderationState: 'visible',
      publishedAt: new Date(Date.now() - 86_400_000),
    });
  }

  async function allPages(input: Record<string, unknown>): Promise<string[]> {
    const names: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 20; i += 1) {
      const page = await explore.search(query({ ...input, cursor }));
      names.push(...page.results.map((r) => r.name));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return names;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const found = await db.execute<{ id: number; district_id: number }>(
      sql`SELECT id, district_id FROM sectors ORDER BY id LIMIT 1`,
    );
    const row = found.rows[0];
    if (!row) throw new Error('No sectors: run scripts/seed-reference.mjs on the test database first.');
    place = { sectorId: Number(row.id), districtId: Number(row.district_id) };
    const storage = { signedUrl: async (key: string) => `https://storage.test/${key}` } as unknown as StorageService;
    explore = new ExploreService(new ExploreRepository(db), storage);
    listings = new ListingService(new ListingRepository(db), storage, 'https://api.test');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('lists only what the public rule admits, profile row or not (AC-3)', async () => {
    const visible = await stay(`${tag} Visible`);
    await stay(`${tag} Draft`, { listing: 'draft' });
    const suspended = await stay(`${tag} Suspended`, { status: 'suspended' });
    await stay(`${tag} Unaddressed`, { slug: null });
    const archived = await stay(`${tag} Archived`, { archived: true });
    await stay(`${tag} Roomless`, { rooms: false });
    await stay(`${tag} Bar`, { bar: true });

    const names = await allPages({});
    expect(names).toEqual([`${tag} Visible`]);

    const places = await explore.places({ q: tag, mode: 'stays' });
    expect(places.places.filter((p) => p.kind === 'property').map((p) => p.label)).toEqual([`${tag} Visible`]);

    await expect(explore.page(visible.slug!)).resolves.toMatchObject({ card: { name: `${tag} Visible` } });
    for (const hidden of [suspended, archived]) {
      await expect(explore.page(hidden.slug!)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('words a stay by its room\'s basis before a party is set, never "a person, a night" for a room (D-j, AC-33)', async () => {
    const basis = `${tag}b`;
    const hotel = await stay(`${basis} Hotel`, { price: 140_000, basis: 'per_unit', singleGuestPrice: 90_000 });
    await stay(`${basis} Villa`, { price: 450_000, basis: 'per_unit', capacity: 8 });
    await stay(`${basis} Hostel`, { price: 25_000, basis: 'per_person' });
    const cards = (await explore.search(query({ q: basis, sort: 'price_asc' }))).results;
    expect(cards.map((c) => [c.name, c.priceRwf, c.priceBasis])).toEqual([
      [`${basis} Hostel`, 25_000, 'person_night'],
      [`${basis} Hotel`, 140_000, 'unit_night'],
      [`${basis} Villa`, 450_000, 'unit_night'],
    ]);
    // The page's room carries the same figure and basis as the card it priced.
    const page = await explore.page(hotel.slug!);
    expect(page.card).toMatchObject({ priceRwf: 140_000, priceBasis: 'unit_night' });
    expect(page.rooms).toEqual([expect.objectContaining({ priceRwf: 140_000, priceBasis: 'unit_night', sleeps: 2 })]);
  });

  it('never counts a menu item: a bar is no stay, and a cheaper item never prices a hotel (AC-34)', async () => {
    const menu = `${tag}m`;
    await stay(`${menu} Bar`, { bar: true, menu: [3_000, 5_000] });
    const mixed = await stay(`${menu} Hotel`, { price: 80_000, basis: 'per_unit', menu: [2_000] });
    const cards = (await explore.search(query({ q: menu }))).results;
    expect(cards.map((c) => [c.name, c.priceRwf, c.priceBasis])).toEqual([[`${menu} Hotel`, 80_000, 'unit_night']]);
    const places = await explore.places({ q: menu, mode: 'stays' });
    expect(places.places.filter((p) => p.kind === 'property').map((p) => p.label)).toEqual([`${menu} Hotel`]);
    const page = await explore.page(mixed.slug!);
    expect(page.rooms?.map((r) => r.name)).toEqual(['Standard']);
    expect(page.roomCount).toBe(1);
  });

  it('prices from the cheapest priced room, ties to the lower id, a room with no capacity sleeping 4', async () => {
    const ties = `${tag}t`;
    const target = await stay(`${ties} Lodge`, { price: null, capacity: null });
    const a = await addRoom(target, { name: 'Garden', price: 60_000, mode: 'request_to_book' });
    const b = await addRoom(target, { name: 'Lake', price: 60_000, mode: 'instant_book' });
    const [low] = [a, b].sort();
    const card = (await explore.search(query({ q: ties }))).results[0]!;
    expect(card.priceRwf).toBe(60_000);
    expect(card.bookingMode).toBe(low === a ? 'request_to_book' : 'instant_book');
    const page = await explore.page(target.slug!);
    expect(page.rooms?.map((r) => r.id)).toEqual([...[a, b].sort(), target.roomTypeId]);
    // The unpriced room keeps no basis and reads "Price on request"; with no capacity it sleeps 4.
    expect(page.rooms?.at(-1)).toMatchObject({ priceRwf: null, priceBasis: null, sleeps: 4 });
  });

  it('pages without repeating or losing a row, equal scores and a review between pages (AC-4, D-as)', async () => {
    const paging = `${tag}p`;
    const made = [];
    for (let i = 1; i <= 25; i += 1) made.push(await stay(`${paging} Stay ${String(i).padStart(2, '0')}`));
    const first = await explore.search(query({ q: paging }));
    expect(first.total).toBe(25);
    expect(first.results).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();

    // A review lands on a property already on page 1, between the two reads.
    await review(made[0]!, 5);

    const second = await explore.search(query({ q: paging, cursor: first.nextCursor }));
    const names = [...first.results, ...second.results].map((r) => r.name);
    expect(new Set(names).size).toBe(25);
    expect(names).toHaveLength(25);
    expect(second.nextCursor).toBeNull();
  });

  it('refuses a cursor made for another search', async () => {
    const first = await explore.search(query({ q: `${tag}p`, limit: 5 }));
    await expect(explore.search(query({ q: `${tag}p`, sort: 'price_asc', cursor: first.nextCursor }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('sorts by price with unpriced last, either way', async () => {
    const priced = `${tag}r`;
    await stay(`${priced} Cheap`, { price: 20_000 });
    await stay(`${priced} Dear`, { price: 90_000 });
    await stay(`${priced} Unpriced`, { price: null });
    expect(await allPages({ q: priced, sort: 'price_asc', limit: 1 })).toEqual([
      `${priced} Cheap`,
      `${priced} Dear`,
      `${priced} Unpriced`,
    ]);
    expect(await allPages({ q: priced, sort: 'price_desc', limit: 1 })).toEqual([
      `${priced} Dear`,
      `${priced} Cheap`,
      `${priced} Unpriced`,
    ]);
  });

  it('ranks by the weighted score, a new property at the platform mean (D-l)', async () => {
    const rated = `${tag}s`;
    const good = await stay(`${rated} Good`);
    const poor = await stay(`${rated} Poor`);
    await stay(`${rated} New`);
    for (let i = 0; i < 4; i += 1) await review(good, 5);
    for (let i = 0; i < 4; i += 1) await review(poor, 2);
    const page = await explore.search(query({ q: rated }));
    expect(page.results.map((r) => r.name)).toEqual([`${rated} Good`, `${rated} New`, `${rated} Poor`]);
    expect(page.results.find((r) => r.name === `${rated} New`)).toMatchObject({ rating: null, reviewCount: 0 });
    expect(page.results.find((r) => r.name === `${rated} Good`)).toMatchObject({ rating: 5, reviewCount: 4 });
  });

  it('treats % and _ in the words as letters', async () => {
    await stay(`${tag} 100% Kivu`);
    await stay(`${tag} 1000 Kivu`);
    const page = await explore.search(query({ q: `${tag} 100%` }));
    expect(page.results.map((r) => r.name)).toEqual([`${tag} 100% Kivu`]);
    const under = await explore.search(query({ q: `${tag} 10_0` }));
    expect(under.results).toHaveLength(0);
  });

  it('never returns a flagged property\'s true point, on explore or on /properties (AC-24)', async () => {
    const flagged = await stay(`${tag} Hidden Cottage`, { privacy: true, latitude: -1.6943, longitude: 29.2611 });
    const page = await explore.search(query({ q: `${tag} Hidden` }));
    expect(page.results[0]).toMatchObject({ latitude: -1.695, longitude: 29.265, locationApproximate: true });
    const detail = await explore.page(flagged.slug!);
    expect(detail.card).toMatchObject({ latitude: -1.695, longitude: 29.265, locationApproximate: true });

    const cards = await listings.listPublishedProperties();
    expect(cards.find((c) => c.id === flagged.propertyId)).toMatchObject({ latitude: -1.695, longitude: 29.265 });
    const legacy = await listings.getPublishedPropertyBySlug(flagged.slug!);
    expect(legacy).toMatchObject({ latitude: -1.695, longitude: 29.265 });
    const wire = JSON.stringify([page, detail, cards, legacy]);
    expect(wire).not.toContain('-1.6943');
    expect(wire).not.toContain('29.2611');
  });

  it('counts a property without coordinates and lists it unpinned', async () => {
    await stay(`${tag} Nowhere Lodge`, { latitude: null, longitude: null });
    const page = await explore.search(query({ q: `${tag} Nowhere` }));
    expect(page.results[0]).toMatchObject({ latitude: null, longitude: null, locationApproximate: false });
  });

  it('lists homes with listed units only, priced a month, and hides a home\'s TIN', async () => {
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `${tag} Homes Ltd`,
        domain: 'residence',
        businessKind: 'residence',
        residenceClass: 'residential_landlord',
        upi: `1/02/03/04/${Math.floor(1000 + Math.random() * 8999)}`,
        registrationStatus: 'active',
        districtId: place.districtId,
        sectorId: place.sectorId,
      })
      .returning();
    const [workspace] = await db.insert(schema.workspaces).values({ kind: 'business', orgId: org!.id }).returning();
    const [home] = await db
      .insert(schema.properties)
      .values({ orgId: org!.id, workspaceId: workspace!.id, name: `${tag} Court`, slug: `${tag}-court`, sectorId: place.sectorId, districtId: place.districtId })
      .returning();
    await db.insert(schema.listings).values({ propertyId: home!.id, workspaceId: workspace!.id, status: 'published', publishedAt: new Date() });
    await db.insert(schema.rentalUnits).values([
      { workspaceId: workspace!.id, propertyId: home!.id, label: 'A-01', bedrooms: 2, askingRentRwf: 450_000, listed: true },
      { workspaceId: workspace!.id, propertyId: home!.id, label: 'A-02', bedrooms: 3, askingRentRwf: 600_000, listed: true },
      { workspaceId: workspace!.id, propertyId: home!.id, label: 'A-03', bedrooms: 1, askingRentRwf: 200_000, listed: false },
    ]);

    expect((await explore.search(query({ q: `${tag} Court` }))).results).toHaveLength(0);
    const homes = await explore.search(query({ q: `${tag} Court`, mode: 'homes' }));
    expect(homes.results[0]).toMatchObject({ priceRwf: 450_000, priceBasis: 'month', unitCount: 2, type: 'home' });
    const pageOf = await explore.page(`${tag}-court`);
    expect(pageOf.units?.map((u) => u.label)).toEqual(['A-01', 'A-02']);
    expect(pageOf.rooms).toBeNull();
    expect(pageOf.business.tin).toBeNull();
  });
});
