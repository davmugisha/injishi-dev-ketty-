import { properties, listings } from '../../../database/drizzle/schema';
import { seedPropertyDepartments } from '../../operations/domain/usali-departments';
import type { Database } from '../../../shared/database/database.module';

/** A transaction handle, as `db.transaction` passes it. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface NewPropertyValues {
  orgId: string;
  workspaceId: string;
  name: string;
  sectorId: number;
  /** DERIVED from the sector by the caller, never asked twice (D24). */
  districtId: number;
  street: string | null;
  isHeadOffice: boolean;
  description?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  houseRules?: string | null;
  locationPrivacy?: boolean;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

/**
 * Write one property, its draft listing and its USALI departments, inside the
 * CALLER'S transaction (ADR-054 Value sourcing).
 *
 * Setup's property create and registration's branch rows both go through here,
 * so a branch declared in the wizard starts exactly as one added in Setup does,
 * and registration's rows commit or roll back with the org they belong to.
 *
 * A function taking a transaction handle rather than a repository method, the
 * same shape `seedPropertyDepartments` has: nothing injected, nothing stateful,
 * so the organization module can call it without reaching into a service.
 */
export async function insertPropertyWithListing(
  tx: Tx,
  v: NewPropertyValues,
): Promise<string> {
  const [property] = await tx
    .insert(properties)
    .values({
      orgId: v.orgId,
      workspaceId: v.workspaceId,
      name: v.name,
      description: v.description ?? null,
      sectorId: v.sectorId,
      districtId: v.districtId,
      addressText: v.street,
      checkInTime: v.checkInTime ?? null,
      checkOutTime: v.checkOutTime ?? null,
      houseRules: v.houseRules ?? null,
      locationPrivacy: v.locationPrivacy ?? false,
      contactPhone: v.contactPhone ?? null,
      contactEmail: v.contactEmail ?? null,
      isHeadOffice: v.isHeadOffice,
      // No photo column any more. ADR-053 moved photographs into
      // `property_photos`, so a property is created with none and the
      // attach route adds them; "no photos" is now the absence of rows.
    })
    .returning({ id: properties.id });
  if (!property) throw new Error('Property insert returned no row.');

  // The listing and the property are one act. `listings_property_uk` says a
  // property has at most one listing; this makes it exactly one, from the first
  // moment, so no later code handles a property whose listing does not exist.
  await tx.insert(listings).values({
    propertyId: property.id,
    workspaceId: v.workspaceId,
    status: 'draft',
  });

  // ADR-016 AC-14. A property gets its USALI departments in the SAME
  // transaction that creates it, so a room charge is attributable the first
  // time one posts.
  await seedPropertyDepartments(tx, {
    orgId: v.orgId,
    propertyId: property.id,
    workspaceId: v.workspaceId,
  });

  return property.id;
}
