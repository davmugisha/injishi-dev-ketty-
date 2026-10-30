import {
  EXPLORE_SHARE_ORIGIN,
  EXPLORE_TYPE_LABEL,
  type ExploreCard,
  type ExploreMode,
  type ExplorePage,
  type ExplorePhoto,
  type ExplorePlace,
  type ExplorePlaces,
  type ExplorePlacesQuery,
  type ExploreSearchQuery,
  type ExploreSearchResult,
  exploreTypeOf,
} from '@injishi/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { blurLocation } from '../../listing/domain/location-blur';
import { PHOTO_SIGNED_URL_TTL_SECONDS, isPhotoId } from '../../listing/domain/photo-route';
import { APPROVAL_WINDOW_HOURS } from '../../pms/domain/pricing';
import { StorageService } from '../../storage/application/storage.service';
import { ExploreCursorError, decodeCursor, encodeCursor } from '../domain/explore-cursor';
import { type ExploreKey, areaOf, factsOf } from '../domain/explore-query';
import { placeLine } from '../domain/place-line';
import { type ExplorePhotoRow, ExploreRepository, type ExploreRow } from '../infrastructure/explore.repository';

/** Suggestions a guest sees at most (D-g). */
const MAX_PLACES = 8;

/** Photos a card carries at most. */
const CARD_PHOTOS = 5;

/**
 * Explore (mobile spec 0005, feature 23): the guest's search over stays and homes, on the server,
 * paged, over the canonical public rule. Milestone 1: free text or a picked place, the mode, the
 * weighted top rated order or price either way, and the property page without dates.
 *
 * Every coordinate leaves through `blurLocation` (AC-24); every price is the API's, with the basis it
 * was computed on, so the phone never multiplies (D-j).
 */
@Injectable()
export class ExploreService {
  constructor(
    private readonly repository: ExploreRepository,
    private readonly storage: StorageService,
  ) {}

  async search(query: ExploreSearchQuery): Promise<ExploreSearchResult> {
    const area = areaOf(query);
    const filters = { mode: query.mode, area };
    let mean: string;
    let after: ExploreKey | null = null;
    if (query.cursor) {
      try {
        ({ mean, key: after } = decodeCursor(query.cursor, { sort: query.sort, filters }));
      } catch (error) {
        if (error instanceof ExploreCursorError) throw new BadRequestException(error.message);
        throw error;
      }
    } else {
      // The first page freezes the platform mean for the whole paging (D-as).
      mean = await this.repository.platformMean();
    }
    const [rows, total] = await Promise.all([
      this.repository.search({ mode: query.mode, area, sort: query.sort, mean, after, limit: query.limit }),
      this.repository.count({ mode: query.mode, area }),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const photos = await this.repository.photos(
      page.map((r) => r.id),
      CARD_PHOTOS,
    );
    return {
      results: page.map((row) => toCard(row, query.mode, photos)),
      nextCursor: rows.length > query.limit && last ? encodeCursor({ mean, key: keyOf(last, query.sort), filters }) : null,
      total,
    };
  }

  async places(query: ExplorePlacesQuery): Promise<ExplorePlaces> {
    const rows = await this.repository.places(query.mode, query.q, MAX_PLACES);
    const noun = (n: number): string =>
      query.mode === 'homes' ? `${n} ${n === 1 ? 'home' : 'homes'}` : `${n} ${n === 1 ? 'stay' : 'stays'}`;
    return {
      places: rows.map((r): ExplorePlace => {
        if (r.kind === 'property') {
          return {
            kind: 'property',
            id: r.id,
            label: r.label,
            sub: placeLine(r.sectorName, r.districtName),
            slug: r.slug,
            ref: `property:${r.slug}`,
          };
        }
        return {
          kind: r.kind,
          id: r.id,
          label: r.label,
          // A sector's name can repeat across districts; its district says which one.
          sub: r.kind === 'sector' && r.districtName ? `${noun(r.count)} · ${r.districtName}` : noun(r.count),
          slug: null,
          ref: `${r.kind}:${r.id}`,
        };
      }),
    };
  }

  /** One property page; a property the public rule hides is a 404 (AC-3). */
  async page(slug: string): Promise<ExplorePage> {
    const row = await this.repository.page(slug, await this.repository.platformMean());
    if (!row) throw new NotFoundException('Property not found.');
    const mode: ExploreMode = row.domain === 'residence' ? 'homes' : 'stays';
    const [photos, amenities, rooms, units] = await Promise.all([
      this.repository.photos([row.id], null),
      this.repository.amenities(row.id),
      mode === 'stays' ? this.repository.rooms(row.id) : Promise.resolve([]),
      mode === 'homes' ? this.repository.units(row.id) : Promise.resolve([]),
    ]);
    const unitPhotos = await this.repository.unitPhotos(units.map((u) => u.id));
    return {
      card: toCard(row, mode, photos.slice(0, CARD_PHOTOS)),
      description: row.description,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      houseRules: row.houseRules,
      timezone: row.timezone,
      photos: photos.map(toPhoto),
      facts: factsOf(amenities),
      facilities: amenities,
      rooms:
        mode === 'stays'
          ? rooms.map((r) => ({
              id: r.id,
              name: r.name,
              sleeps: r.capacity,
              roomCount: r.roomCount,
              priceRwf: r.priceRwf,
              priceBasis: 'person_night' as const,
              bookingMode: r.bookingMode,
              approvalWindowHours: r.bookingMode === 'request_to_book' ? APPROVAL_WINDOW_HOURS : null,
              cancellationTier: r.cancellationTier,
              nonrefundableEligible: r.nonrefundableEligible,
              minStay: r.minStay,
              // Dates arrive with the sheet (milestone 3); without them nothing is sold out.
              freeUnits: null,
            }))
          : null,
      units:
        mode === 'homes'
          ? units.map((u) => ({
              ...u,
              photos: unitPhotos
                .filter((p) => p.unitId === u.id)
                .map((p) => toPhoto({ propertyId: row.id, id: p.id, kind: 'unit', caption: p.caption })),
            }))
          : null,
      roomCount: rooms.reduce((sum, r) => sum + r.roomCount, 0),
      business: {
        legalName: row.legalName,
        // A home's landlord may be a private person: no TIN on a home's page (D-o).
        tin: mode === 'stays' ? row.tin : null,
        // Activation requires the field verified pass, so every visible business is verified.
        verified: true,
        verifiedAt: row.verifiedAt,
      },
      shareUrl: `${EXPLORE_SHARE_ORIGIN}/property/${encodeURIComponent(row.slug)}`,
    };
  }

  /**
   * Where one public unit photograph can be read right now: a short lived signed URL, as the property
   * photo route does. One 404 for every refusal (not a uuid, missing, hidden).
   */
  async unitPhotoUrl(photoId: string): Promise<string> {
    const key = isPhotoId(photoId) ? await this.repository.publicUnitPhotoKey(photoId) : null;
    if (!key) throw new NotFoundException();
    return this.storage.signedUrl(key, PHOTO_SIGNED_URL_TTL_SECONDS);
  }
}

function keyOf(row: ExploreRow, sort: ExploreSearchQuery['sort']): ExploreKey {
  return sort === 'top_rated'
    ? { sort, score: row.score, name: row.sortName, id: row.id }
    : { sort, price: row.priceRwf, name: row.sortName, id: row.id };
}

function toPhoto(p: ExplorePhotoRow): ExplorePhoto {
  // Originals carry no size; the variants of milestone 4 do.
  return { id: p.id, kind: p.kind, caption: p.caption, width: null, height: null };
}

/** A search row as the card the guest sees. */
export function toCard(row: ExploreRow, mode: ExploreMode, photos: ExplorePhotoRow[]): ExploreCard {
  const location = blurLocation(row.latitude, row.longitude, row.locationPrivacy);
  const type = exploreTypeOf(mode, row.accommodationClass);
  const stays = mode === 'stays';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    mode,
    type,
    typeLabel: EXPLORE_TYPE_LABEL[type],
    where: placeLine(row.sectorName, row.districtName),
    districtName: row.districtName,
    rating: row.rating,
    reviewCount: row.reviewCount,
    priceRwf: row.priceRwf,
    // No party until the sheet sets one (milestone 3): a person, a night.
    priceBasis: stays ? 'person_night' : 'month',
    bookingMode: stays ? row.bookingMode : null,
    approvalWindowHours: stays && row.bookingMode === 'request_to_book' ? APPROVAL_WINDOW_HOURS : null,
    roomsLeft: null,
    photos: photos.filter((p) => p.propertyId === row.id).slice(0, CARD_PHOTOS).map(toPhoto),
    latitude: location.latitude,
    longitude: location.longitude,
    locationApproximate: location.approximate,
    availableFrom: stays ? null : row.availableFrom,
    unitCount: stays ? null : row.unitCount,
  };
}
