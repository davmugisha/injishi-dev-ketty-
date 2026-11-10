import { sql, type SQL } from 'drizzle-orm';
import {
  LEGACY_PERMISSION_KEY,
  PSF_DOMAINS,
  ORG_ROLE_LABEL,
  ProductId,
  isPsfApplicant,
  parseRolePermissionOverride,
  permissionsForWorkspace,
  type DepartmentCategory,
  type Domain,
  type OrgRegistrationStatus,
  type OrgRole,
  type Permission,
  type RolePermissionOverride,
  type RoleScope,
  type WorkspaceAccess,
  type WorkspaceBranch,
  type WorkspaceGrants,
  type WorkspaceKind,
} from '@injishi/contracts';

import {
  enabledProducts,
  type OpenEntitlement,
} from '../entitlements/entitlement-rules';
import type { CoveredProperties } from './branch-scope';

/**
 * Everything the server needs to answer "what may this person do in this
 * workspace", read in ONE statement (ADR-076 contract section 7, A-17).
 *
 * The guard used to answer with about seventeen queries: `listForUser` ran
 * seven, the step-up check called it a second time, and the branch scope read
 * the properties once more. Each later layer (the entitlement, the audit
 * context) would have added its own. This reads the claimed workspace's
 * membership, org, departments, branch limit, properties, role overrides, on
 * behalf registration and open entitlements as one row, with each list folded
 * into a JSON column, so a guarded request pays one round trip for all of it.
 *
 * `/me/workspaces` runs the SAME statement without naming a workspace, and both
 * build their answer through the same functions below, so the guard and the
 * client can never be told two different things (ADR-074: "the same
 * resolution the guard runs, never a second copy").
 */
export interface WorkspaceFacts {
  readonly workspaceId: string;
  readonly kind: WorkspaceKind;
  readonly orgId: string | null;
  readonly orgName: string | null;
  readonly domain: Domain | null;
  readonly rdbEntityGroup: string | null;
  readonly registrationStatus: OrgRegistrationStatus | null;
  readonly membershipId: string | null;
  readonly orgRole: OrgRole | null;
  readonly departments: readonly DepartmentCategory[];
  /** The membership's branch limit rows, or null when it has none (every branch). */
  readonly limit: readonly string[] | null;
  /** Every property of the workspace, archived ones included, head office first then by name. */
  readonly properties: readonly FactProperty[];
  readonly overrides: readonly RolePermissionOverride[];
  readonly obo: {
    readonly registrantUserId: string;
    readonly claimStatus: 'registrant_held' | 'owner_claimed' | 'expired';
  } | null;
  /** The org's open entitlement rows. */
  readonly entitlements: readonly OpenEntitlement[];
}

export interface FactProperty {
  readonly id: string;
  readonly name: string;
  readonly districtName: string | null;
  readonly isHeadOffice: boolean;
  readonly archived: boolean;
}

type FactsRow = {
  source: 'own' | 'held';
  workspace_id: string;
  kind: WorkspaceKind;
  org_id: string | null;
  legal_name: string | null;
  domain: Domain | null;
  rdb_entity_group: string | null;
  registration_status: OrgRegistrationStatus | null;
  membership_id: string | null;
  org_role: OrgRole | null;
  departments: DepartmentCategory[] | null;
  limit_ids: string[] | null;
  properties: FactProperty[] | null;
  overrides: { orgRole: string; permission: string; granted: boolean }[] | null;
  obo: { registrantUserId: string; claimStatus: 'registrant_held' | 'owner_claimed' | 'expired' } | null;
  entitlements: { productId: string; propertyId: string | null }[] | null;
};

/**
 * The statement. `workspaceId` null reads every workspace the user holds;
 * a value reads that one, or nothing when they do not hold it.
 *
 * Two grant paths reach a workspace, as before: an own workspace (`broker`,
 * `personal`) through `workspaces.user_id`, and a `business` workspace through
 * an ACTIVE `org_memberships` row. Own workspaces come first, then held ones,
 * each oldest first, so the order is stable where it used to be whatever the
 * database returned.
 */
export function workspaceFactsQuery(userId: string, workspaceId: string | null): SQL {
  const only = workspaceId === null ? sql`true` : sql`w.id = ${workspaceId}::uuid`;
  return sql`
    WITH own AS (
      SELECT w.id AS workspace_id, w.kind, w.created_at AS sort_at
        FROM workspaces w
       WHERE w.user_id = ${userId}::uuid AND ${only}
    ),
    held AS (
      SELECT w.id AS workspace_id, w.kind, m.created_at AS sort_at,
             o.id AS org_id, o.legal_name, o.domain, o.rdb_entity_group,
             o.registration_status, m.id AS membership_id, m.org_role
        FROM org_memberships m
        JOIN orgs o ON o.id = m.org_id
        JOIN workspaces w ON w.org_id = o.id
       WHERE m.user_id = ${userId}::uuid AND m.status = 'active' AND ${only}
    )
    SELECT 'own' AS source, own.workspace_id, own.kind,
           NULL::uuid AS org_id, NULL::text AS legal_name, NULL::text AS domain,
           NULL::text AS rdb_entity_group, NULL::text AS registration_status,
           NULL::uuid AS membership_id, NULL::text AS org_role,
           NULL::json AS departments, NULL::json AS limit_ids, NULL::json AS properties,
           NULL::json AS overrides, NULL::json AS obo, NULL::json AS entitlements,
           own.sort_at
      FROM own
    UNION ALL
    SELECT 'held', h.workspace_id, h.kind,
           h.org_id, h.legal_name, h.domain::text,
           h.rdb_entity_group, h.registration_status::text,
           h.membership_id, h.org_role::text,
           (SELECT json_agg(DISTINCT d.department_category)
              FROM departments d
             WHERE d.workspace_id = h.workspace_id AND d.status = 'active'),
           (SELECT json_agg(b.property_id)
              FROM org_membership_branches b
             WHERE b.org_membership_id = h.membership_id),
           (SELECT json_agg(json_build_object(
                     'id', p.id, 'name', p.name, 'districtName', dt.name,
                     'isHeadOffice', p.is_head_office, 'archived', p.archived_at IS NOT NULL)
                   ORDER BY p.is_head_office DESC, p.name ASC)
              FROM properties p
              LEFT JOIN districts dt ON dt.id = p.district_id
             WHERE p.workspace_id = h.workspace_id),
           (SELECT json_agg(json_build_object(
                     'orgRole', r.org_role, 'permission', r.permission, 'granted', r.granted))
              FROM org_role_permissions r
             WHERE r.org_id = h.org_id),
           (SELECT json_build_object(
                     'registrantUserId', ob.registrant_user_id, 'claimStatus', ob.claim_status)
              FROM obo_registrations ob
             WHERE ob.org_id = h.org_id
             ORDER BY ob.created_at DESC
             LIMIT 1),
           (SELECT json_agg(json_build_object('productId', e.product_id, 'propertyId', e.property_id))
              FROM org_product_entitlements e
             WHERE e.org_id = h.org_id AND e.disabled_at IS NULL),
           h.sort_at
      FROM held h
    ORDER BY source DESC, sort_at, workspace_id
  `;
}

/** One row of the statement, with every list present (empty, never null). */
export function factsFromRow(row: FactsRow): WorkspaceFacts {
  const overrides: RolePermissionOverride[] = [];
  for (const stored of row.overrides ?? []) {
    // The same narrowing the service that writes overrides uses, so a row the
    // model does not recognise is dropped on the read path too.
    const parsed = parseRolePermissionOverride(stored);
    if (parsed) overrides.push(parsed);
  }
  return {
    workspaceId: row.workspace_id,
    kind: row.kind,
    orgId: row.org_id,
    orgName: row.legal_name,
    domain: row.domain,
    rdbEntityGroup: row.rdb_entity_group,
    registrationStatus: row.registration_status,
    membershipId: row.membership_id,
    orgRole: row.org_role,
    departments: row.departments ?? [],
    limit: row.limit_ids && row.limit_ids.length > 0 ? row.limit_ids : null,
    properties: row.properties ?? [],
    overrides,
    obo: row.obo,
    entitlements: row.entitlements ?? [],
  };
}

export type { FactsRow };

/**
 * The branch limit that applies. An owner's rows, which the service never
 * writes, are ignored rather than trusted: an owner always covers every branch
 * (ADR-054 invariant 5).
 */
function effectiveLimit(facts: WorkspaceFacts): ReadonlySet<string> | null {
  if (facts.orgRole === 'owner' || facts.limit === null) return null;
  return new Set(facts.limit);
}

/**
 * What the member covers, for the branch scope (ADR-054): every property of
 * the workspace, archived ones included so their history stays readable, or
 * the limited member's own branches. A limit row naming a property of another
 * workspace (which the service refuses to write) can never widen it.
 */
export function coveredFromFacts(facts: WorkspaceFacts): CoveredProperties {
  const limit = effectiveLimit(facts);
  if (facts.kind !== 'business' || !facts.orgId || limit === null) {
    return { coverage: 'all', propertyIds: facts.properties.map((p) => p.id) };
  }
  return {
    coverage: 'limited',
    propertyIds: facts.properties.filter((p) => limit.has(p.id)).map((p) => p.id),
  };
}

/** The permissions that apply here, through the one model (registration gate and ADR-055 overrides inside). */
function permissionsFromFacts(facts: WorkspaceFacts): Permission[] {
  return permissionsForWorkspace({
    kind: facts.kind,
    orgRole: facts.orgRole,
    registrationStatus: facts.registrationStatus,
    roleOverrides: facts.overrides,
  });
}

/**
 * What the person holds here, in the shape every product reads (contract
 * section 3, G1). Until slice R stores roles as rows, `roles` is the one role
 * of `org_memberships.org_role` (no id, keyed by its value) and its scope is
 * the member's branch limit; every permission carries that same scope, under
 * its new name.
 */
export function grantsFromFacts(
  facts: WorkspaceFacts,
  permissions: readonly Permission[],
  activeCovered: readonly string[],
): WorkspaceGrants {
  const covered = coveredFromFacts(facts);
  // A limited member's scope is the branches they cover. One covering none (every
  // limit row points elsewhere) is given no permission at all, because an empty
  // scope would read as the whole business.
  const limited = covered.coverage === 'limited';
  const scopes: RoleScope[] =
    limited && covered.propertyIds.length > 0
      ? [{ kind: 'branch', ids: [...covered.propertyIds] }]
      : [];
  const held = limited && covered.propertyIds.length === 0 ? [] : permissions;
  const role = facts.orgRole;
  return {
    family: 'business',
    products: enabledProducts(facts.entitlements, activeCovered, ProductId.options, covered.coverage),
    roles: role
      ? [{ roleId: null, key: role, name: ORG_ROLE_LABEL[role], kind: 'default', scopes }]
      : [],
    permissions: held.map((p) => ({ key: LEGACY_PERMISSION_KEY[p], scopes })),
  };
}

/**
 * The grant `/me/workspaces` returns and the guard attaches, built from the
 * facts. Every field it returned before `grants` existed keeps its value
 * (G1): the same permission resolution, the same branch list (active only,
 * head office first then by name, narrowed to the limit), the same coverage
 * and the same PSF rule.
 */
export function accessFromFacts(userId: string, facts: WorkspaceFacts): WorkspaceAccess {
  const permissions = permissionsFromFacts(facts);
  if (facts.kind !== 'business' || !facts.orgId) {
    return {
      workspaceId: facts.workspaceId,
      kind: facts.kind,
      orgId: null,
      orgName: null,
      domain: null,
      orgRole: null,
      registrationStatus: null,
      permissions,
      // Broker and Personal run no departments and have no property. Empty
      // and null, never absent.
      departments: [],
      propertyName: null,
      branches: [],
      branchCoverage: null,
      psfMembership: null,
    };
  }

  const limit = effectiveLimit(facts);
  const branches: WorkspaceBranch[] = facts.properties
    .filter((p) => !p.archived && (limit === null || limit.has(p.id)))
    .map((p) => ({
      id: p.id,
      name: p.name,
      districtName: p.districtName,
      isHeadOffice: p.isHeadOffice,
    }));

  return {
    workspaceId: facts.workspaceId,
    kind: facts.kind,
    orgId: facts.orgId,
    orgName: facts.orgName,
    domain: facts.domain,
    orgRole: facts.orgRole,
    registrationStatus: facts.registrationStatus,
    permissions,
    departments: [...facts.departments],
    // Head office first, then by name, so the first covered branch is the head
    // office when covered and else the first by name (ADR-054 AC-S3).
    propertyName: branches[0]?.name ?? null,
    branches,
    branchCoverage: limit ? 'limited' : 'all',
    // A hotel or a PSF business may hold a PSF membership; a residence may not.
    psfMembership:
      facts.domain !== null && PSF_DOMAINS.includes(facts.domain)
        ? {
            canManage: isPsfApplicant({
              userId,
              domain: facts.domain,
              orgRole: facts.orgRole,
              obo: facts.obo,
            }),
          }
        : null,
    grants: grantsFromFacts(
      facts,
      permissions,
      branches.map((b) => b.id),
    ),
  };
}
