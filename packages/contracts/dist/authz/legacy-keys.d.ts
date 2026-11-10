import type { Permission } from "../authz";
/**
 * The new name of every permission, keyed by the name it has today (ADR-074,
 * "Permission keys named by owner"; ADR-076 D-20).
 *
 * A key becomes `<owner>.<resource>.<action>`, where the owner is the product
 * or platform capability that owns the record: `pms.stay.checkin`,
 * `hr.payroll.run`, `fiscal.ebm.refund`. Nothing stores or checks the new names
 * yet. The rollout is ADR-076's:
 *
 * - the flat `permissions` field on `/me/workspaces` keeps today's keys until
 *   stage 9, so no client built before this breaks;
 * - `grants.permissions` carries these names from slice G on;
 * - stage 8 rewrites storage and the route decorators in one migration, after
 *   confirming every row of this map against the routes and screens that use
 *   it. Until then this is ADR-074's DRAFT map, copied row for row.
 *
 * Typed by `Permission`, so a permission added without a new name does not
 * compile.
 */
export type NamespacedPermission = `${string}.${string}.${string}`;
export declare const LEGACY_PERMISSION_KEY: Readonly<Record<Permission, NamespacedPermission>>;
/** Today's key for a new one, or null when no permission of this release has that name. */
export declare function legacyKeyOf(key: string): Permission | null;
//# sourceMappingURL=legacy-keys.d.ts.map