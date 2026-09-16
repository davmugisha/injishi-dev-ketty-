import { NotFoundException } from '@nestjs/common';

import type { StorageService } from '../../storage/application/storage.service';
import {
  PHOTO_SIGNED_URL_TTL_SECONDS,
  apiPublicOrigin,
  photoRouteUrl,
} from '../domain/photo-route';
import type {
  BookableRoomRecord,
  ListingRepository,
  PublicPropertyCardRecord,
  PublicPropertyRecord,
} from '../infrastructure/listing.repository';
import { ListingService } from './listing.service';

/**
 * Public photographs through the photo route (ADR-053, owner ruling of
 * 2026-09-13).
 *
 * What this pins is the half of the rule that lives in the service: an object
 * key never reaches the wire, every public read carries the route's stable URL
 * built on the API's own origin, and every refusal the route can make is the
 * same bare 404, decided before storage is ever asked to sign anything.
 *
 * The visibility predicate itself is SQL in `findPublicPhotoKey`, the same
 * `PUBLICLY_VISIBLE` every public read uses. A mocked repository cannot prove
 * SQL, so the suspension and unpublish cases are proven against a running API
 * by the ADR-053 verification checks; here the repository's null is taken as
 * that predicate's answer and the service is held to what it does with it.
 */
describe('ListingService, public photographs', () => {
  const ORIGIN = 'https://api.injishi.test';
  const PHOTO_A = '11111111-1111-4111-8111-111111111111';
  const PHOTO_B = '22222222-2222-4222-8222-222222222222';
  const KEY_A = 'property_photo/2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';

  const record: PublicPropertyRecord = {
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'umurage-guesthouse',
    name: 'Umurage Guesthouse',
    description: null,
    districtName: 'Gasabo',
    latitude: null,
    longitude: null,
    locationPrivacy: false,
    checkInTime: '14:00:00',
    checkOutTime: '11:00:00',
    houseRules: null,
    photoIds: [PHOTO_A, PHOTO_B],
    roomTypes: [],
    facilities: [],
  };

  function build(repo: Partial<Record<keyof ListingRepository, jest.Mock>>): {
    service: ListingService;
    signedUrl: jest.Mock;
  } {
    const signedUrl = jest.fn().mockResolvedValue('https://storage.test/signed?X-Amz-Signature=abc');
    const service = new ListingService(
      repo as unknown as ListingRepository,
      { signedUrl } as unknown as StorageService,
      ORIGIN,
    );
    return { service, signedUrl };
  }

  it('puts a photo route URL on the property read for each photo, in order, and no key', async () => {
    const { service } = build({ findPublishedPropertyBySlug: jest.fn().mockResolvedValue(record) });
    const detail = await service.getPublishedPropertyBySlug('umurage-guesthouse');
    expect(detail.photos).toEqual([
      `${ORIGIN}/api/v1/properties/photos/${PHOTO_A}`,
      `${ORIGIN}/api/v1/properties/photos/${PHOTO_B}`,
    ]);
    expect(detail).not.toHaveProperty('photoIds');
    expect(JSON.stringify(detail)).not.toContain('property_photo/');
  });

  it('puts photo route URLs on the discovery cards too, and no key', async () => {
    const card: PublicPropertyCardRecord = {
      id: record.id,
      slug: 'umurage-guesthouse',
      name: record.name,
      description: null,
      districtName: record.districtName,
      photoIds: [PHOTO_B],
      fromNightlyRateRwf: 45_000,
      maxGuests: 2,
      roomTypeCount: 1,
    };
    const { service } = build({ findPublishedCards: jest.fn().mockResolvedValue([card]) });
    const [listed] = await service.listPublishedProperties();
    expect(listed.photos).toEqual([photoRouteUrl(ORIGIN, PHOTO_B)]);
    expect(listed).not.toHaveProperty('photoIds');
  });

  it("puts the cover's photo route URL on the checkout read, or null without a photo", async () => {
    const room = (coverPhotoId: string | null): BookableRoomRecord => ({
      property: {
        id: record.id,
        slug: record.slug,
        name: record.name,
        districtName: record.districtName,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        coverPhotoId,
      },
      roomType: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Standard',
        domain: 'hospitality',
        capacity: 2,
        roomCount: 3,
        nightlyRateRwf: 45_000,
        bookingMode: 'instant_book',
        approvalPolicy: 'approve_all',
        cancellationTier: 'moderate',
        nonrefundableEligible: false,
        minStay: null,
      },
    });
    const withCover = build({ findBookableRoom: jest.fn().mockResolvedValue(room(PHOTO_A)) });
    const bookable = await withCover.service.getBookableRoom('44444444-4444-4444-8444-444444444444');
    expect(bookable.property.photo).toBe(photoRouteUrl(ORIGIN, PHOTO_A));
    expect(bookable.property).not.toHaveProperty('coverPhotoId');

    const without = build({ findBookableRoom: jest.fn().mockResolvedValue(room(null)) });
    expect((await without.service.getBookableRoom('x')).property.photo).toBeNull();
  });

  it('signs a visible photo for a few minutes', async () => {
    const findPublicPhotoKey = jest.fn().mockResolvedValue(KEY_A);
    const { service, signedUrl } = build({ findPublicPhotoKey });
    await expect(service.publicPhotoUrl(PHOTO_A)).resolves.toContain('X-Amz-Signature');
    expect(findPublicPhotoKey).toHaveBeenCalledWith(PHOTO_A);
    expect(signedUrl).toHaveBeenCalledWith(KEY_A, PHOTO_SIGNED_URL_TTL_SECONDS);
    expect(PHOTO_SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(900);
  });

  it('refuses a photo the visibility rule does not return with a bare 404, signing nothing', async () => {
    const { service, signedUrl } = build({ findPublicPhotoKey: jest.fn().mockResolvedValue(null) });
    const refusal = service.publicPhotoUrl(PHOTO_B);
    await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.publicPhotoUrl(PHOTO_B)).rejects.toThrow('Not Found');
    expect(signedUrl).not.toHaveBeenCalled();
  });

  it('refuses a photo id that is not a uuid with the same 404, without querying', async () => {
    const findPublicPhotoKey = jest.fn();
    const { service, signedUrl } = build({ findPublicPhotoKey });
    for (const id of ['not-a-uuid', '../../etc/passwd', KEY_A, '']) {
      await expect(service.publicPhotoUrl(id)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(findPublicPhotoKey).not.toHaveBeenCalled();
    expect(signedUrl).not.toHaveBeenCalled();
  });

  it('builds photo URLs on BETTER_AUTH_URL, the origin the API answers on', () => {
    expect(apiPublicOrigin({ BETTER_AUTH_URL: 'https://api.injishi.com/' })).toBe('https://api.injishi.com');
    expect(apiPublicOrigin({ PORT: '8100' })).toBe('http://localhost:8100');
    expect(apiPublicOrigin({})).toBe('http://localhost:8000');
    expect(photoRouteUrl('https://api-demo.injishi.com', PHOTO_A)).toBe(
      `https://api-demo.injishi.com/api/v1/properties/photos/${PHOTO_A}`,
    );
  });
});

/**
 * Bookability has ONE rule, and it is the domain (FL06 §5C).
 *
 * `BookingService.create` has always refused a non-hospitality room type. Until
 * 2026-09-16 `getBookableRoom` did not, so the checkout's own read answered
 * "here is your priced residence apartment, booking mode request_to_book" for
 * inventory the confirm would then refuse with a 400. The demo carried a live
 * example: Lavender Hill's `Two-bedroom apartment` was seeded `request_to_book`
 * on a `residence` row, and `/book?roomType=<that id>` rendered a full checkout
 * that could not complete.
 *
 * `database-property.tsx` filters residence out of the property page, so the
 * dead end was only reachable by a hand-edited url — which is exactly the case
 * `bookHref` was rewritten to close, and not a reason to leave the server
 * answering two ways.
 */
describe('ListingService, what counts as bookable', () => {
  const ORIGIN = 'https://api.injishi.test';

  function roomRecord(domain: 'hospitality' | 'residence'): BookableRoomRecord {
    return {
      property: {
        id: '44444444-4444-4444-8444-444444444444',
        slug: 'lavender-hill-residences',
        name: 'Lavender Hill Residences',
        districtName: 'Gasabo',
        checkInTime: null,
        checkOutTime: null,
        coverPhotoId: null,
      },
      roomType: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Two-bedroom apartment',
        domain,
        capacity: 4,
        roomCount: 3,
        nightlyRateRwf: 450_000,
        bookingMode: 'request_to_book',
        approvalPolicy: 'approve_first_three',
        cancellationTier: null,
        nonrefundableEligible: false,
        minStay: 30,
      },
    };
  }

  function build(findBookableRoom: jest.Mock): ListingService {
    return new ListingService(
      { findBookableRoom } as unknown as ListingRepository,
      { signedUrl: jest.fn() } as unknown as StorageService,
      ORIGIN,
    );
  }

  it('refuses a residence room type with the same 404 as an unknown one', async () => {
    const service = build(jest.fn().mockResolvedValue(roomRecord('residence')));
    await expect(
      service.getBookableRoom('55555555-5555-4555-8555-555555555555'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses it even while the row still carries a booking mode', async () => {
    // The seed no longer writes one, but a database written before that fix
    // still has the column populated. The domain decides, not the column, so an
    // unmigrated row is refused rather than sold.
    const record = roomRecord('residence');
    expect(record.roomType.bookingMode).toBe('request_to_book');
    const service = build(jest.fn().mockResolvedValue(record));
    await expect(
      service.getBookableRoom(record.roomType.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still answers a hospitality room type, so the guard refuses only residence', async () => {
    const service = build(jest.fn().mockResolvedValue(roomRecord('hospitality')));
    const room = await service.getBookableRoom('55555555-5555-4555-8555-555555555555');
    expect(room.roomType.domain).toBe('hospitality');
    expect(room.property.photo).toBeNull();
  });
});
