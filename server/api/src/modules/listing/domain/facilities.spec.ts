import { buildFacilities, type AmenityFact, type OutletFact } from './facilities';

const pool: AmenityFact = { code: 'pool', label: 'Swimming pool', category: 'leisure' };
const wifi: AmenityFact = { code: 'wifi', label: 'Wi-Fi', category: null };

const outlet = (over: Partial<OutletFact>): OutletFact => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Outlet',
  outletKind: 'restaurant',
  orderingAccess: 'in_house_only',
  hours: null,
  amenityCode: null,
  relationshipType: 'hotel_operated',
  operatorLegalName: 'Hotel Ltd',
  sortOrder: 0,
  ...over,
});

describe('buildFacilities (ADR-050 D-k, AC-16)', () => {
  it('renders an amenity and the outlet pointing at it as ONE card with both faces', () => {
    const poolBar = outlet({ id: '00000000-0000-4000-8000-0000000000aa', name: 'Pool passes', outletKind: 'pool', amenityCode: 'pool' });
    const list = buildFacilities([pool, wifi], [poolBar]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ key: 'amenity:pool', amenity: { code: 'pool' }, outlet: { id: poolBar.id } });
    expect(list[1]).toMatchObject({ key: 'amenity:wifi', outlet: null });
  });

  it('adds an outlet with no amenity link as its own card after the amenities', () => {
    const restaurant = outlet({ name: 'Terrace' });
    const list = buildFacilities([wifi], [restaurant]);
    expect(list.map((f) => f.key)).toEqual(['amenity:wifi', `outlet:${restaurant.id}`]);
    expect(list[1].amenity).toBeNull();
  });

  it('renders an outlet whose amenity the property does not list as an outlet card, never dropping it', () => {
    const spa = outlet({ outletKind: 'spa', amenityCode: 'spa' });
    expect(buildFacilities([wifi], [spa]).map((f) => f.key)).toEqual(['amenity:wifi', `outlet:${spa.id}`]);
  });

  it('never attaches one outlet to two cards, and never loses a second outlet on the same code', () => {
    const a = outlet({ id: '00000000-0000-4000-8000-00000000000a', amenityCode: 'pool' });
    const b = outlet({ id: '00000000-0000-4000-8000-00000000000b', amenityCode: 'pool' });
    const list = buildFacilities([pool], [a, b]);
    expect(list).toHaveLength(2);
    expect(list[0].outlet?.id).toBe(a.id);
    expect(list[1]).toMatchObject({ key: `outlet:${b.id}`, amenity: null });
  });

  it('labels the operator only when someone other than the hotel runs it', () => {
    const own = outlet({ id: '00000000-0000-4000-8000-00000000000c' });
    const franchise = outlet({ id: '00000000-0000-4000-8000-00000000000d', relationshipType: 'franchise', operatorLegalName: 'Brand Co' });
    const [first, second] = buildFacilities([], [own, franchise]);
    expect(first.outlet?.operatorLabel).toBeNull();
    expect(second.outlet?.operatorLabel).toBe('Brand Co');
  });

  it('passes object hours through and reads anything else as null', () => {
    const [withHours, broken] = buildFacilities([], [
      outlet({ id: '00000000-0000-4000-8000-00000000000e', hours: { mon: ['07:00', '22:00'] } }),
      outlet({ id: '00000000-0000-4000-8000-00000000000f', hours: ['07:00'] }),
    ]);
    expect(withHours.outlet?.hours).toEqual({ mon: ['07:00', '22:00'] });
    expect(broken.outlet?.hours).toBeNull();
  });

  it('is empty for a property with neither', () => {
    expect(buildFacilities([], [])).toEqual([]);
  });
});
