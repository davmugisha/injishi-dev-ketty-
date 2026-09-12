import { departments } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

/**
 * The USALI department set every property starts with (ADR-016, AC-14).
 *
 * One department per accounting category, which is what §14.2 calls "the USALI
 * department set". The NAMES are editable afterwards and the categories are
 * not, because a category decides which revenue account the charges post to.
 *
 * PURE DATA plus one function that takes a transaction handle. It lives in
 * `operations/domain` and `listing-setup` imports it, which is deliberate and
 * is not a module reaching into another module's internals: there is no service
 * here, no injected dependency, and nothing stateful. It has to be callable
 * INSIDE the transaction that inserts the property, because a property that
 * exists without departments cannot take its first room charge, and a second
 * call after commit is a second chance to fail.
 *
 * `guest_requestable` is true only where a guest genuinely contacts the
 * department directly: the front desk (Rooms), the restaurant, the spa, and
 * Engineering, because a broken tap is reported by the person looking at it.
 */
export const USALI_DEPARTMENT_TEMPLATE = [
  { category: 'rooms', name: 'Rooms', type: 'operated', guest: true, sort: 10 },
  { category: 'fnb', name: 'Food and Beverage', type: 'operated', guest: true, sort: 20 },
  { category: 'spa_recreation', name: 'Spa and Recreation', type: 'operated', guest: true, sort: 30 },
  { category: 'other_operated', name: 'Other Operated Departments', type: 'operated', guest: false, sort: 40 },
  { category: 'misc_income', name: 'Miscellaneous Income', type: 'operated', guest: false, sort: 50 },
  { category: 'admin_general', name: 'Administrative and General', type: 'undistributed', guest: false, sort: 60 },
  { category: 'sales_marketing', name: 'Sales and Marketing', type: 'undistributed', guest: false, sort: 70 },
  { category: 'it', name: 'Information and Telecommunications', type: 'undistributed', guest: false, sort: 80 },
  { category: 'engineering', name: 'Engineering and Maintenance', type: 'undistributed', guest: true, sort: 90 },
  { category: 'utilities', name: 'Utilities', type: 'undistributed', guest: false, sort: 100 },
  { category: 'hr', name: 'Human Resources', type: 'undistributed', guest: false, sort: 110 },
] as const;

/** The transaction handle Drizzle hands a `db.transaction` callback. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Give a property its departments. Safe to call twice.
 *
 * `onConflictDoNothing` rides the partial unique index on
 * `(property_id, department_category)`. Without it a second call would double
 * every property's department list, and the Rooms lookup a room charge does
 * would stop returning one row.
 */
export async function seedPropertyDepartments(
  tx: Tx,
  input: { orgId: string; propertyId: string; workspaceId: string },
): Promise<void> {
  await tx
    .insert(departments)
    .values(
      USALI_DEPARTMENT_TEMPLATE.map((d) => ({
        orgId: input.orgId,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
        name: d.name,
        departmentType: d.type,
        departmentCategory: d.category,
        isRevenueCenter: d.type === 'operated',
        guestRequestable: d.guest,
        sortOrder: d.sort,
      })),
    )
    .onConflictDoNothing();
}
