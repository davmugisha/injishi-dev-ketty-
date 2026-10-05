import type { AssistantSource, PropertyCard, PropertyDetail, RoomAvailability } from '@injishi/contracts';
import { HttpException } from '@nestjs/common';
import { z } from 'zod';

import { redact } from '../domain/redaction';
import type { AssistantTool, ToolOutcome } from './tool-types';
import { tokens } from './knowledge-search';

/**
 * Public listing tools (ADR-061 slice B, D-j).
 *
 * Every read goes through the service the public routes use, so the assistant
 * sees exactly what a stranger's browser may see and nothing more. Results are
 * built field by field from an allowlist: coordinates are never passed on,
 * whether or not a property hides its location, because an answer never
 * needs them and a map link on the property page already respects the choice.
 *
 * All three need the catalogue to be open. On the production pre launch host
 * the tools are not offered, and a call that names one anyway is refused,
 * the same rule `PreLaunchGuard` applies to the routes.
 */
export interface ListingReads {
  listPublished(): Promise<PropertyCard[]>;
  getById(propertyId: string): Promise<PropertyDetail>;
  getBySlug(slug: string): Promise<PropertyDetail>;
  availability(roomTypeId: string, from: string, to: string): Promise<RoomAvailability>;
}

/** Longest stay the availability tool checks in one call. */
export const MAX_AVAILABILITY_NIGHTS = 30;
const MAX_SEARCH_RESULTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// Words that describe the kind of place rather than which place, so they
// never narrow a search to nothing ("hotels in Musanze" is a Musanze search).
const GENERIC = new Set(
  tokens('hotel hotels lodge lodges place places stay stays room rooms guest guests guesthouse house apartment villa camp motel listing property show find near around cheap cheapest best good price prices cost budget under below night nights per rwf frw available'),
);

const SearchInput = z
  .object({
    query: z.string().trim().max(120).optional(),
    guests: z.number().int().min(1).max(50).optional(),
    maxNightlyRwf: z.number().int().min(1).optional(),
  })
  .strict();

const GetInput = z
  .object({
    propertyId: z.string().uuid().optional(),
    slug: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => v.propertyId || v.slug, 'Give propertyId or slug.');

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const AvailabilityInput = z
  .object({ roomTypeId: z.string().uuid(), checkIn: IsoDate, checkOut: IsoDate })
  .strict();

export function createListingTools(reads: ListingReads): AssistantTool[] {
  const searchListings: AssistantTool = {
    requires: 'catalogue',
    spec: {
      name: 'search_listings',
      description:
        'Search published Injishi properties by place (district), name or description, optionally by number of guests and a nightly budget in RWF. Returns at most five, with their lowest base nightly rate. Use for "places to stay in <district>" or "hotels under <amount>".',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'A district, town or property name, e.g. "Musanze".' },
          guests: { type: 'integer', description: 'How many guests must fit.' },
          maxNightlyRwf: { type: 'integer', description: 'Highest nightly base rate in RWF.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async run(input) {
      const parsed = SearchInput.safeParse(input);
      if (!parsed.success) return errorOutcome('Give an optional query (at most 120 characters), guests and maxNightlyRwf.');
      const { query, guests, maxNightlyRwf } = parsed.data;
      const wanted = tokens(query ?? '').filter((t) => !GENERIC.has(t));
      const scored = (await reads.listPublished())
        .filter((p) => guests === undefined || (p.maxGuests ?? 0) >= guests)
        .filter((p) => maxNightlyRwf === undefined || (p.fromNightlyRateRwf !== null && p.fromNightlyRateRwf <= maxNightlyRwf))
        .map((p) => ({ p, score: scoreCard(p, wanted) }))
        .filter(({ score }) => wanted.length === 0 || score > 0)
        // Best match first; among equal matches the cheapest, so a budget
        // search reads cheapest first. A property with no priced room last.
        .sort((a, b) => b.score - a.score || (a.p.fromNightlyRateRwf ?? Infinity) - (b.p.fromNightlyRateRwf ?? Infinity) || a.p.name.localeCompare(b.p.name));
      const top = scored.slice(0, MAX_SEARCH_RESULTS).map(({ p }) => p);
      const results = top.map((p) => ({
        propertyId: p.id,
        slug: p.slug,
        name: p.name,
        district: p.districtName,
        fromNightlyRateRwf: p.fromNightlyRateRwf,
        maxGuests: p.maxGuests,
        roomTypes: p.roomTypeCount,
        href: `/property/${p.slug}`,
      }));
      const filters = { guests: guests ?? null, maxNightlyRwf: maxNightlyRwf ?? null };
      return outcome(
        results.length > 0
          ? { results, matched: scored.length, filters, note: 'Rates are the lowest base nightly rate, before any date specific price.' }
          : { results, matched: 0, filters, note: 'No published property matches. Say so; do not suggest properties from memory.' },
        top.map(listingSource),
      );
    },
  };

  const getListing: AssistantTool = {
    requires: 'catalogue',
    spec: {
      name: 'get_listing',
      description:
        "One published property: description, district, check in and out times, house rules, facilities, and room types with capacity, minimum stay, cancellation tier and base nightly rate in RWF. Use search_listings first to find the propertyId.",
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'The propertyId from search_listings.' },
          slug: { type: 'string', description: 'The slug from search_listings, if no id.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async run(input) {
      const parsed = GetInput.safeParse(input);
      if (!parsed.success) return errorOutcome('Give a propertyId (uuid) or a slug.');
      let detail: PropertyDetail;
      try {
        detail = parsed.data.propertyId
          ? await reads.getById(parsed.data.propertyId)
          : await reads.getBySlug(parsed.data.slug as string);
      } catch (error) {
        return refusal(error, 'That property is not published.');
      }
      const payload = {
        propertyId: detail.id,
        name: detail.name,
        district: detail.districtName,
        description: clip(detail.description, 600),
        checkInTime: detail.checkInTime,
        checkOutTime: detail.checkOutTime,
        houseRules: clip(detail.houseRules, 400),
        facilities: detail.facilities
          .map((f) => f.amenity?.label ?? f.outlet?.name)
          .filter((label): label is string => Boolean(label)),
        roomTypes: detail.roomTypes.map((r) => ({
          roomTypeId: r.id,
          name: r.name,
          capacity: r.capacity,
          baseNightlyRateRwf: r.nightlyRateRwf,
          minStay: r.minStay,
          cancellationTier: r.cancellationTier,
          bookingMode: r.bookingMode,
        })),
        href: detail.slug ? `/property/${detail.slug}` : null,
        note: 'Rates are base nightly rates. Date specific prices are not available yet.',
      };
      return outcome(payload, [
        { kind: 'listing', id: detail.id, title: detail.name, href: payload.href },
      ]);
    },
  };

  const checkAvailability: AssistantTool = {
    requires: 'catalogue',
    spec: {
      name: 'check_availability',
      description: `How many units of one room type are free on each night from checkIn up to (not including) checkOut, at most ${MAX_AVAILABILITY_NIGHTS} nights. Get the roomTypeId from get_listing. Dates are yyyy-mm-dd.`,
      inputSchema: {
        type: 'object',
        properties: {
          roomTypeId: { type: 'string', description: 'The roomTypeId from get_listing.' },
          checkIn: { type: 'string', description: 'First night, yyyy-mm-dd.' },
          checkOut: { type: 'string', description: 'Departure day, yyyy-mm-dd.' },
        },
        required: ['roomTypeId', 'checkIn', 'checkOut'],
        additionalProperties: false,
      },
    },
    async run(input) {
      const parsed = AvailabilityInput.safeParse(input);
      if (!parsed.success) return errorOutcome('Give roomTypeId (uuid), checkIn and checkOut as yyyy-mm-dd.');
      const { roomTypeId, checkIn, checkOut } = parsed.data;
      if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) {
        return errorOutcome('Both dates must be real calendar dates, yyyy-mm-dd.');
      }
      const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS;
      if (nights < 1) return errorOutcome('checkOut must be after checkIn.');
      if (nights > MAX_AVAILABILITY_NIGHTS) {
        return errorOutcome(`I can check at most ${MAX_AVAILABILITY_NIGHTS} nights at a time. Ask for a shorter range.`);
      }
      let result: RoomAvailability;
      try {
        result = await reads.availability(roomTypeId, checkIn, checkOut);
      } catch (error) {
        return refusal(error, 'That room type is not offered.');
      }
      const soldOut = result.nights.filter((n) => n.freeUnits <= 0).map((n) => n.night);
      return outcome(
        {
          roomTypeId: result.roomTypeId,
          checkIn,
          checkOut,
          nights: result.nights,
          soldOutNights: soldOut,
          minStay: result.minStay,
          availableForWholeStay: soldOut.length === 0 && result.nights.length >= result.minStay,
        },
        [],
      );
    },
  };

  return [searchListings, getListing, checkAvailability];
}

/** A yyyy-mm-dd string that names a day that exists (no 2026-02-30). */
function isCalendarDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function scoreCard(p: PropertyCard, wanted: string[]): number {
  if (wanted.length === 0) return 0;
  const district = new Set(tokens(p.districtName ?? ''));
  const name = new Set(tokens(p.name));
  const text = new Set(tokens(p.description ?? ''));
  let score = 0;
  for (const word of wanted) {
    if (district.has(word)) score += 3;
    if (name.has(word)) score += 2;
    if (text.has(word)) score += 1;
  }
  return score;
}

/** A listing source, carrying what a surface draws on its card. */
function listingSource(p: PropertyCard): AssistantSource {
  return {
    kind: 'listing',
    id: p.id,
    title: p.name,
    href: `/property/${p.slug}`,
    listing: {
      district: p.districtName,
      fromNightlyRateRwf: p.fromNightlyRateRwf,
      maxGuests: p.maxGuests,
      roomTypes: p.roomTypeCount,
      photoUrl: p.photos[0] ?? null,
    },
  };
}

function clip(text: string | null, max: number): string | null {
  if (text === null) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function outcome(payload: unknown, sources: AssistantSource[]): ToolOutcome {
  // A listing's own text is written by its host: redacted like anything else.
  return { content: redact(JSON.stringify(payload)), isError: false, sources };
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}

/** A 4xx from the service becomes an explanation; anything else is rethrown. */
function refusal(error: unknown, fallback: string): ToolOutcome {
  if (error instanceof HttpException && error.getStatus() < 500) {
    const message = error.message && !/^(Not Found|Bad Request)/.test(error.message) ? error.message : fallback;
    return errorOutcome(message);
  }
  throw error;
}
