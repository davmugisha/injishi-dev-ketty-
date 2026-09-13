import type {
  OrderingAccess,
  OutletKind,
  OutletRelationshipType,
  PropertyFacility,
} from '@injishi/contracts';

/**
 * WHAT A PROPERTY OFFERS, AS ONE LIST (ADR-050 D-k, AC-16, AC-18).
 *
 * Two tables answer the question and neither changes its key: the amenities a
 * property lists, and the outlets that sell there. An outlet may point at the
 * amenity it also is, and then the two render ONCE, as one card carrying both
 * faces. Pure, so the dedupe is tested without a database.
 */

export interface AmenityFact {
  code: string;
  label: string;
  category: string | null;
}

export interface OutletFact {
  id: string;
  name: string;
  outletKind: OutletKind;
  orderingAccess: OrderingAccess;
  hours: unknown;
  amenityCode: string | null;
  relationshipType: OutletRelationshipType;
  operatorLegalName: string | null;
  sortOrder: number;
}

/**
 * Amenities first, in the order given, each carrying the outlet that points at
 * it. Then every outlet no listed amenity claimed, in the order given.
 *
 * The caller has already filtered visibility (active, guest visible, a tenant
 * only while its tenancy is active). The database's partial unique index keeps
 * at most one outlet per amenity, so the first match is the only match; if two
 * ever arrive anyway, the second renders as its own card rather than vanishing.
 */
export function buildFacilities(
  amenities: readonly AmenityFact[],
  outlets: readonly OutletFact[],
): PropertyFacility[] {
  const claimed = new Set<string>();
  const facilities: PropertyFacility[] = [];

  for (const amenity of amenities) {
    const outlet = outlets.find((o) => o.amenityCode === amenity.code && !claimed.has(o.id));
    if (outlet) claimed.add(outlet.id);
    facilities.push({
      key: `amenity:${amenity.code}`,
      amenity: { code: amenity.code, label: amenity.label, category: amenity.category },
      outlet: outlet ? outletFace(outlet) : null,
    });
  }

  for (const outlet of outlets) {
    if (claimed.has(outlet.id)) continue;
    facilities.push({ key: `outlet:${outlet.id}`, amenity: null, outlet: outletFace(outlet) });
  }

  return facilities;
}

function outletFace(outlet: OutletFact): NonNullable<PropertyFacility['outlet']> {
  return {
    id: outlet.id,
    name: outlet.name,
    outletKind: outlet.outletKind,
    orderingAccess: outlet.orderingAccess,
    hours:
      outlet.hours && typeof outlet.hours === 'object' && !Array.isArray(outlet.hours)
        ? (outlet.hours as Record<string, unknown>)
        : null,
    // A quiet label naming who runs it, only when that is not the hotel (D-k value sourcing).
    operatorLabel:
      outlet.relationshipType !== 'hotel_operated' ? outlet.operatorLegalName : null,
  };
}
