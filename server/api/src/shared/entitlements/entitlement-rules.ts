import {
  ENTITLEMENT_LEVEL,
  type EnabledProduct,
  type EntitlementRefusalCode,
  type ProductId,
} from '@injishi/contracts';

/**
 * The entitlement rules, as pure functions over a business's OPEN rows
 * (ADR-074 access model; ADR-076 G5, G6, A-3).
 *
 * An open row is one whose `disabled_at` is null. `propertyId` null means the
 * row covers every branch. The guard, `/me/workspaces` and the admin screen
 * all read through these, so "is POS on at Remera" has one answer.
 */
export interface OpenEntitlement {
  readonly productId: string;
  readonly propertyId: string | null;
}

/** Is the product on for the whole business (an open every branch row)? */
export function isOnEveryBranch(open: readonly OpenEntitlement[], product: ProductId): boolean {
  return open.some((row) => row.productId === product && row.propertyId === null);
}

/**
 * G5: product P is on at branch B when an open row exists for (P, B) or for
 * (P, every branch).
 */
export function isOnAt(
  open: readonly OpenEntitlement[],
  product: ProductId,
  propertyId: string,
): boolean {
  return open.some(
    (row) =>
      row.productId === product &&
      (row.propertyId === null || row.propertyId.toLowerCase() === propertyId.toLowerCase()),
  );
}

/**
 * Where any of these products is on, among the branches a member covers
 * (A-3: an entitlement narrows the branch scope exactly as coverage does).
 *
 * `everyBranch` is true when one of them is on for the whole business, and
 * then every covered branch is in. Otherwise only the covered branches holding
 * a row for one of them are, which may be none.
 */
export function productReach(
  open: readonly OpenEntitlement[],
  products: readonly ProductId[],
  covered: readonly string[],
): { everyBranch: boolean; propertyIds: string[] } {
  if (products.some((p) => isOnEveryBranch(open, p))) {
    return { everyBranch: true, propertyIds: [...covered] };
  }
  return {
    everyBranch: false,
    propertyIds: covered.filter((id) => products.some((p) => isOnAt(open, p, id))),
  };
}

/**
 * The products a member sees on in their grants (contract section 3), in
 * `ProductId` order: the open rows intersected with the branches the member
 * covers (ADR-076 value sourcing). `all` only when the product is on for the
 * whole business and the member covers the whole business; a member limited
 * to some branches always gets those branches, never `all`. A product on
 * nowhere the member covers is left out rather than listed with no branch.
 */
export function enabledProducts(
  open: readonly OpenEntitlement[],
  covered: readonly string[],
  order: readonly ProductId[],
  coverage: 'all' | 'limited' = 'all',
): EnabledProduct[] {
  const out: EnabledProduct[] = [];
  for (const product of order) {
    if (!open.some((row) => row.productId === product)) continue;
    if (coverage === 'all' && isOnEveryBranch(open, product)) {
      out.push({ id: product, branches: 'all' });
      continue;
    }
    const at = covered.filter((id) => isOnAt(open, product, id));
    if (at.length > 0) out.push({ id: product, branches: at });
  }
  return out;
}

/** One open row of the product being changed, with its id so it can be closed. */
export interface ProductRow {
  readonly id: string;
  readonly propertyId: string | null;
}

/** What a change writes: rows to close and branches to open rows for (null: every branch). */
export interface EntitlementPlan {
  readonly close: readonly string[];
  readonly open: readonly (string | null)[];
}

export type PlanResult =
  | { readonly ok: true; readonly plan: EntitlementPlan }
  | { readonly ok: false; readonly code: EntitlementRefusalCode; readonly message: string };

/**
 * Plan a staff change to where one product is on (ADR-076 G6).
 *
 * At any moment a product holds EITHER one every branch row OR a set of branch
 * rows, never both, so every answer below keeps that shape:
 *
 * - on everywhere: close the branch rows and open the every branch row;
 * - on at branches: open a row for each listed branch without one (nothing,
 *   when it is already on everywhere);
 * - off everywhere: close every open row;
 * - off at branches: close those branches' rows, or, when it is on everywhere,
 *   close that row and open one per remaining active branch.
 *
 * A plan that closes and opens nothing is a request for what is already true;
 * the caller writes nothing and no audit row. Branch ids must already be
 * checked as active branches of this org (`branch_invalid` is the caller's).
 */
export function planEntitlementChange(input: {
  product: ProductId;
  state: 'on' | 'off';
  branchIds: readonly string[] | null;
  openRows: readonly ProductRow[];
  activeBranchIds: readonly string[];
}): PlanResult {
  const { product, state, branchIds, openRows, activeBranchIds } = input;
  const level = ENTITLEMENT_LEVEL[product];

  if (level === 'none') {
    return {
      ok: false,
      code: 'entitlement_level',
      message: 'Admin and Membership are never switched on for a business.',
    };
  }
  if (level === 'locked' && state === 'off') {
    return { ok: false, code: 'entitlement_locked', message: 'Account cannot be switched off.' };
  }
  if (level !== 'branch' && branchIds !== null) {
    return {
      ok: false,
      code: 'entitlement_level',
      message: 'This product is on or off for the whole business, never for chosen branches.',
    };
  }

  const everyRow = openRows.find((row) => row.propertyId === null);
  const branchRows = openRows.filter((row) => row.propertyId !== null);
  const listed = new Set((branchIds ?? []).map((id) => id.toLowerCase()));
  const isListed = (id: string | null): boolean => id !== null && listed.has(id.toLowerCase());

  if (state === 'on') {
    if (branchIds === null) {
      if (everyRow) return { ok: true, plan: { close: [], open: [] } };
      return { ok: true, plan: { close: branchRows.map((row) => row.id), open: [null] } };
    }
    if (everyRow) return { ok: true, plan: { close: [], open: [] } };
    const missing = [...listed].filter(
      (id) => !branchRows.some((row) => row.propertyId?.toLowerCase() === id),
    );
    return { ok: true, plan: { close: [], open: missing } };
  }

  if (branchIds === null) {
    return { ok: true, plan: { close: openRows.map((row) => row.id), open: [] } };
  }
  if (everyRow) {
    const remaining = activeBranchIds.filter((id) => !isListed(id));
    return { ok: true, plan: { close: [everyRow.id], open: remaining } };
  }
  return {
    ok: true,
    plan: { close: branchRows.filter((row) => isListed(row.propertyId)).map((row) => row.id), open: [] },
  };
}

/** Does the plan change anything at all? */
export function isNoop(plan: EntitlementPlan): boolean {
  return plan.close.length === 0 && plan.open.length === 0;
}
