import { sql, type SQL } from 'drizzle-orm';

/**
 * What a broker's plan lets them see, as a condition on the building: their
 * home district (District, free), one province (Province) or everywhere
 * (Country). A free broker with no district yet sees nothing until they
 * choose one. Every broker read and command carries it, so a unit outside the
 * plan is not found (404), never refused (403).
 */
export type ListingScope =
  | { plan: 'district'; districtId: number | null }
  | { plan: 'province'; provinceId: number }
  | { plan: 'country' };

export function scopeSql(scope: ListingScope, districtColumn: SQL = sql`p.district_id`): SQL {
  if (scope.plan === 'country') return sql`true`;
  if (scope.plan === 'province') {
    return sql`${districtColumn} in (select sd.id from districts sd where sd.province_id = ${scope.provinceId})`;
  }
  return scope.districtId === null ? sql`false` : sql`${districtColumn} = ${scope.districtId}`;
}

/** Whether a district is inside the scope, given the province it is in. */
export function districtInScope(scope: ListingScope, district: { id: number; provinceId: number }): boolean {
  if (scope.plan === 'country') return true;
  if (scope.plan === 'province') return district.provinceId === scope.provinceId;
  return scope.districtId === district.id;
}
