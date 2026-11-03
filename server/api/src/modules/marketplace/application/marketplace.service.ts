import {
  CANCELLATION_TIERS,
  COUNTRY_NAMES,
  CONSENT_POLICY_VERSION,
  computeBreakdown,
  countryName,
  EBM_VAT_RATE_PERCENT,
  isKnownCountry,
  NON_REFUNDABLE_DISCOUNT,
  type MarketQuote,
  type MarketQuoteQuery,
  type CollectionInput,
  type ConsentInput,
  ConsentPurpose,
  type GuestCollection,
  type GuestContact,
  type GuestContactInput,
  GuestLocale,
  type MarketCatalogue,
  MarketGalleryPhoto,
  MarketHighlight,
  type MarketListingCard,
  MarketNearby,
  type MarketPropertyPage,
  type MarketRoomCard,
  type MarketRooms,
  MarketRuleItem,
  type MyBusinesses,
  type MyCollections,
  type MyConsents,
  type MySaved,
  type MyTripFacts,
  type PropertyCard,
  REQUIRED_CONSENTS,
  type SavedPlace,
  nightlyRateFor,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { APPROVAL_WINDOW_HOURS } from '../../pms/domain/pricing';
import { ListingService } from '../../listing/application/listing.service';
import { placeLine } from '../domain/place-line';
import { type CardRow, MarketplaceRepository, type RoomCardRow } from '../infrastructure/marketplace.repository';

/** Read a display list column, dropping (never inventing) an entry that does not fit its shape. */
function listOf<T extends z.ZodTypeAny>(item: T, value: unknown): z.infer<T>[] {
  const parsed = z.array(z.unknown()).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.flatMap((entry) => {
    const one = item.safeParse(entry);
    return one.success ? [one.data] : [];
  });
}

/**
 * The marketplace and the guest's web account (real-data leaf 1.3.2).
 *
 * WHICH PROPERTIES EXIST PUBLICLY is `ListingService`'s answer and nobody else's: every public read
 * here starts from `listPublishedProperties()` or `getPublishedPropertyBySlug()` and only then adds
 * the marketplace card, so a suspension or an unpublish takes a property out of the marketplace with
 * no second write and no second statement of the rule (ADR-053 contract rule 1).
 *
 * EVERYTHING ABOUT A PERSON is scoped by the session's user id, passed in by the controller and
 * filtered on again by the repository; anything that is not the caller's answers 404.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly listings: ListingService,
    private readonly repository: MarketplaceRepository,
  ) {}

  // --- The catalogue ------------------------------------------------------------------------

  async catalogue(): Promise<MarketCatalogue> {
    const visible = await this.listings.listPublishedProperties();
    const cards = await this.repository.cards(visible.map((p) => p.id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return {
      listings: visible.flatMap((p) => {
        const card = byId.get(p.id);
        return card ? [this.toCard(p, card)] : [];
      }),
    };
  }

  async rooms(): Promise<MarketRooms> {
    const visible = await this.listings.listPublishedProperties();
    const rows = await this.repository.roomCards(visible.map((p) => p.id));
    return { rooms: rows.map(toRoomCard) };
  }

  /** One property page. A property that is not public, or has no marketplace card, is a 404. */
  async page(slug: string): Promise<MarketPropertyPage> {
    const detail = await this.listings.getPublishedPropertyBySlug(slug);
    const [page, [card], facilities, rooms] = await Promise.all([
      this.repository.page(detail.id),
      this.repository.cards([detail.id]),
      this.repository.facilities(detail.id),
      this.repository.roomCards([detail.id]),
    ]);
    if (!page || !card) throw new NotFoundException('Property not found.');
    const others = await this.repository.siblingNames(page.orgId, detail.id);
    const summary: PropertyCard = {
      id: detail.id,
      slug: detail.slug ?? slug,
      name: detail.name,
      description: detail.description,
      districtName: detail.districtName,
      photos: detail.photos,
      fromNightlyRateRwf: null,
      fromPriceBasis: 'per_person',
      businessKind: null,
      maxGuests: null,
      roomTypeCount: detail.roomTypes.length,
      latitude: detail.latitude,
      longitude: detail.longitude,
    };
    return {
      card: this.toCard(summary, card),
      description: detail.description,
      checkInTime: detail.checkInTime,
      checkOutTime: detail.checkOutTime,
      houseRules: detail.houseRules,
      houseRuleItems: listOf(MarketRuleItem, page.houseRuleItems),
      highlights: listOf(MarketHighlight, page.highlights),
      nearby: listOf(MarketNearby, page.nearby),
      mapLabel: page.mapLabel,
      gallery: listOf(MarketGalleryPhoto, page.gallery),
      facilities,
      roomCount: page.roomCount,
      nonRefundableDiscount: NON_REFUNDABLE_DISCOUNT,
      business: {
        legalName: card.legalName,
        tin: page.tin,
        upi: page.upi,
        verifiedAt: page.verifiedAt,
        licenceValidTo: page.licenceValidTo,
        otherProperties: others,
      },
      rooms: rooms.map(toRoomCard),
    };
  }

  /**
   * What a stay would cost. Priced by `computeBreakdown`, the one implementation the booking service
   * charges with (per guest, per night, plus the guest service fee), never by the client. A room that
   * is not publicly bookable is the same 404 `/bookable` gives.
   */
  async quote(q: MarketQuoteQuery): Promise<MarketQuote> {
    const room = await this.listings.getBookableRoom(q.roomTypeId);
    const nights = Math.round((Date.parse(`${q.checkOut}T12:00:00Z`) - Date.parse(`${q.checkIn}T12:00:00Z`)) / 86_400_000);
    if (!(nights >= 1)) throw new BadRequestException('Check-out must be after check-in.');
    const rate = await this.listings.stayRate(room.roomType, q.checkIn, q.checkOut);
    if (nights > rate.maxNights) throw new BadRequestException(`A stay is at most ${rate.maxNights} nights.`);
    if (nights < rate.minNights) throw new BadRequestException(`This room takes stays of ${rate.minNights} nights or more.`);
    if (rate.closedOn) throw new ConflictException(`${room.roomType.name} is not available on ${rate.closedOn}.`);
    const capacity = room.roomType.capacity;
    if (capacity !== null && q.guests > capacity) {
      throw new BadRequestException(`${room.roomType.name} sleeps ${capacity}.`);
    }
    if (room.roomType.nightlyRateRwf === null) throw new ConflictException('This room has no price yet.');
    // A room priced per room charges one guest its one guest price, when it has one (0117).
    const nightly = nightlyRateFor({ ...room.roomType, nightlyRateRwf: rate.nightlyRateRwf }, q.guests);
    const tier = room.roomType.cancellationTier ?? 'flexible';
    const rule = CANCELLATION_TIERS[tier];
    const time = /^\d{2}:\d{2}/.exec(room.property.checkInTime ?? '')?.[0] ?? '14:00';
    // Kigali has no daylight saving: a property's clock time is always UTC+2.
    const checkInAt = Date.parse(`${q.checkIn}T${time}:00+02:00`);
    const windowEnds = new Date(checkInAt - rule.windowHours * 3_600_000).toISOString();
    const refunds =
      rule.afterPercent > 0
        ? [
            { percent: rule.beforePercent, until: windowEnds },
            { percent: rule.afterPercent, until: new Date(checkInAt).toISOString() },
            { percent: 0, until: null },
          ]
        : [
            { percent: rule.beforePercent, until: windowEnds },
            { percent: 0, until: null },
          ];
    return {
      roomTypeId: room.roomType.id,
      roomName: room.roomType.name,
      propertySlug: room.property.slug,
      legalName: (await this.repository.legalNameOf(room.property.id)) ?? '',
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      guests: q.guests,
      breakdown: computeBreakdown({
        nightlyRateRwf: nightly,
        nights,
        nonRefundable: false,
        guests: q.guests,
        priceBasis: room.roomType.priceBasis,
      }),
      bookingMode: room.roomType.bookingMode,
      approvalWindowHours: room.roomType.bookingMode === 'request_to_book' ? APPROVAL_WINDOW_HOURS : null,
      cancellationTier: tier,
      refunds,
      vatRatePercent: EBM_VAT_RATE_PERCENT,
      checkInTime: room.property.checkInTime,
      checkOutTime: room.property.checkOutTime,
    };
  }

  private toCard(p: PropertyCard, card: CardRow): MarketListingCard {
    const homes = card.domain === 'residence';
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      domain: card.domain,
      kind: card.kind,
      where: placeLine(card.sectorName, card.districtName),
      districtName: card.districtName,
      legalName: card.legalName,
      priceRwf: card.priceRwf,
      rating: card.rating,
      reviewCount: card.reviewCount,
      bookingMode: homes ? null : card.bookingMode,
      approvalWindowHours: !homes && card.bookingMode === 'request_to_book' ? APPROVAL_WINDOW_HOURS : null,
      stockPhoto: card.stockPhoto,
      caption: card.caption,
      amenities: card.amenities,
      latitude: p.latitude,
      longitude: p.longitude,
      bedrooms: homes ? card.bedrooms : null,
      floorAreaSqm: homes ? card.floorAreaSqm : null,
      availableFrom: homes ? card.availableFrom : null,
      hasPage: card.hasPage,
    };
  }

  // --- Saved places (ADR-032) and collections (F-B16) -----------------------------------------

  /** Everything the person saved, once per place (a place in two lists is one heart). */
  async saved(userId: string): Promise<MySaved> {
    const items = await this.repository.savedItems(userId);
    const seen = new Set<string>();
    const saved: SavedPlace[] = [];
    for (const item of items) {
      if (seen.has(item.propertyId)) continue;
      seen.add(item.propertyId);
      saved.push(withoutList(item));
    }
    return { saved };
  }

  /**
   * Heart a place: into the default list, created on the first save. Idempotent (a second heart is
   * the same row, ADR-032). Only a publicly visible place can be saved; anything else is a 404.
   */
  async save(userId: string, propertyId: string): Promise<SavedPlace> {
    const price = await this.publicPrice(propertyId);
    const list = await this.repository.defaultList(userId, await this.workspaceOf(userId));
    await this.repository.addItem(list, propertyId, price);
    return this.placeOf(userId, propertyId);
  }

  /** Unheart a place: out of every list of the person's. Not saved is a 404 (ADR-032). */
  async unsave(userId: string, propertyId: string): Promise<void> {
    if (!(await this.repository.removeEverywhere(userId, propertyId))) throw new NotFoundException('Not saved.');
  }

  async collections(userId: string): Promise<MyCollections> {
    const [lists, items] = await Promise.all([this.repository.lists(userId), this.repository.savedItems(userId)]);
    return {
      collections: lists.map(
        (l): GuestCollection => ({
          id: l.id,
          name: l.name,
          visibility: l.visibility,
          isDefault: l.isDefault,
          createdAt: l.createdAt.toISOString(),
          items: items.filter((i) => i.collectionId === l.id).map(withoutList),
        }),
      ),
    };
  }

  async createCollection(userId: string, input: CollectionInput): Promise<GuestCollection> {
    const { id } = await this.repository.createList(userId, await this.workspaceOf(userId), input.name);
    return this.collectionOf(userId, id);
  }

  async renameCollection(userId: string, id: string, input: CollectionInput): Promise<GuestCollection> {
    if (!(await this.repository.renameList(userId, id, input.name))) throw new NotFoundException('Collection not found.');
    return this.collectionOf(userId, id);
  }

  async deleteCollection(userId: string, id: string): Promise<void> {
    if (!(await this.repository.deleteList(userId, id))) throw new NotFoundException('Collection not found.');
  }

  async addToCollection(userId: string, id: string, propertyId: string): Promise<GuestCollection> {
    if (!(await this.repository.ownsList(userId, id))) throw new NotFoundException('Collection not found.');
    await this.repository.addItem(id, propertyId, await this.publicPrice(propertyId));
    return this.collectionOf(userId, id);
  }

  async removeFromCollection(userId: string, id: string, propertyId: string): Promise<GuestCollection> {
    if (!(await this.repository.ownsList(userId, id))) throw new NotFoundException('Collection not found.');
    if (!(await this.repository.removeItem(userId, id, propertyId))) throw new NotFoundException('Not in this collection.');
    return this.collectionOf(userId, id);
  }

  private async collectionOf(userId: string, id: string): Promise<GuestCollection> {
    const found = (await this.collections(userId)).collections.find((c) => c.id === id);
    if (!found) throw new NotFoundException('Collection not found.');
    return found;
  }

  private async placeOf(userId: string, propertyId: string): Promise<SavedPlace> {
    const found = (await this.saved(userId)).saved.find((p) => p.propertyId === propertyId);
    if (!found) throw new InternalServerErrorException('The saved place could not be read back.');
    return found;
  }

  /** The card price of a publicly visible place; 404 for anything else, so a hidden id cannot be probed. */
  private async publicPrice(propertyId: string): Promise<number | null> {
    const visible = await this.listings.listPublishedProperties();
    if (!visible.some((p) => p.id === propertyId)) throw new NotFoundException('Property not found.');
    const [card] = await this.repository.cards([propertyId]);
    return card?.priceRwf ?? visible.find((p) => p.id === propertyId)?.fromNightlyRateRwf ?? null;
  }

  private async workspaceOf(userId: string): Promise<string> {
    const workspaceId = await this.repository.personalWorkspace(userId);
    // Every account is given a personal workspace at sign-up; its absence is a broken account, not a 4xx.
    if (!workspaceId) throw new InternalServerErrorException('This account has no personal workspace.');
    return workspaceId;
  }

  // --- Contact details ---------------------------------------------------------------------

  async contact(userId: string): Promise<GuestContact> {
    const row = await this.repository.contact(userId);
    if (!row) throw new NotFoundException();
    const locale = GuestLocale.safeParse(row.locale);
    return {
      name: row.name || row.displayName || row.email,
      email: row.email,
      phone: row.phone ?? null,
      country: row.country ?? 'RW',
      countryName: countryName(row.country ?? 'RW'),
      locale: locale.success ? locale.data : 'en',
      address: row.address ?? null,
      joinedAt: row.joinedAt.toISOString(),
      // Every account signs in with an emailed code; a linked Google account adds the second way.
      signInMethods: ['email_code', ...row.providers.filter((p) => p === 'google')],
    };
  }

  /**
   * A verified identity's legal name is not edited from the account page: it is what hosts check at the
   * desk. Spacing and case may differ; anything else is a 409 naming the verified name.
   */
  async updateContact(userId: string, input: GuestContactInput): Promise<GuestContact> {
    const verified = await this.repository.verifiedName(userId);
    const normal = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
    if (verified && normal(verified) !== normal(input.name)) {
      throw new ConflictException(`Your verified name is ${verified}. It changes only through a new identity check.`);
    }
    await this.repository.updateContact(userId, { ...input, country: resolveCountry(input.country) });
    return this.contact(userId);
  }

  // --- Consent -------------------------------------------------------------------------------

  async consents(userId: string): Promise<MyConsents> {
    const latest = await this.repository.latestConsents(userId);
    return {
      policyVersion: CONSENT_POLICY_VERSION,
      consents: ConsentPurpose.options.map((purpose) => {
        const required = REQUIRED_CONSENTS.includes(purpose);
        const row = latest.find((r) => r.purpose === purpose);
        // Off unless the person turned it on (privacy notice: "off unless you turn them on").
        return { purpose, required, granted: required || (row?.granted ?? false), recordedAt: row?.recordedAt.toISOString() ?? null };
      }),
    };
  }

  async recordConsent(userId: string, input: ConsentInput): Promise<MyConsents> {
    if (REQUIRED_CONSENTS.includes(input.purpose) && !input.granted) {
      throw new ConflictException('Booking messages carry your bookings and cannot be turned off.');
    }
    await this.repository.recordConsent({
      userId,
      workspaceId: await this.workspaceOf(userId),
      purpose: input.purpose,
      granted: input.granted,
      policyVersion: CONSENT_POLICY_VERSION,
    });
    return this.consents(userId);
  }

  // --- The businesses a person works at -------------------------------------------------------

  async businesses(userId: string): Promise<MyBusinesses> {
    return { businesses: await this.repository.businesses(userId) };
  }

  // --- Trips -----------------------------------------------------------------------------------

  async tripFacts(userId: string): Promise<MyTripFacts> {
    return { trips: await this.repository.tripFacts(userId) };
  }
}

/** A saved place as the contract states it, without the list it was read from. */
function withoutList(item: SavedPlace & { collectionId: string }): SavedPlace {
  const { collectionId, ...place } = item;
  void collectionId;
  return place;
}

/** A code (KE) or an English name (Kenya) → the code; anything else is a 400, never a guess. */
function resolveCountry(value: string): string {
  const text = value.trim();
  if (isKnownCountry(text.toUpperCase())) return text.toUpperCase();
  const byName = Object.entries(COUNTRY_NAMES).find(([, name]) => name.toLowerCase() === text.toLowerCase());
  if (!byName) throw new BadRequestException(`${text} is not a country we recognise.`);
  return byName[0];
}

function toRoomCard(r: RoomCardRow): MarketRoomCard {
  return {
    id: r.id,
    propertySlug: r.propertySlug,
    name: r.name,
    priceRwf: r.priceRwf,
    bed: r.bed,
    sizeSqm: r.sizeSqm,
    highlight: r.highlight,
    sleeps: r.sleeps,
    roomCount: r.roomCount,
    bookingMode: r.bookingMode,
    approvalWindowHours: r.bookingMode === 'request_to_book' ? APPROVAL_WINDOW_HOURS : null,
    cancellationTier: r.cancellationTier,
    nonrefundableEligible: r.nonrefundableEligible,
    maxAdults: r.maxAdults,
    maxChildren: r.maxChildren,
    stockPhoto: r.stockPhoto,
  };
}
