import { describe, expect, it } from 'vitest';

import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole, permissionsForRole, type ProductId, type WorkspaceAccess } from '@injishi/contracts';

import { guardedRoutes, permitted, type GuardedRoute } from './testing/guarded-routes';
import type { TwoFactorService } from './two-factor.service';
import { WorkspaceGuard } from './workspace.guard';
import type { WorkspaceFacts } from './workspace-facts';
import type { WorkspaceService } from './workspace.service';

/**
 * The generated access matrix (ADR-074 "Tests"; ADR-076 G18).
 *
 * Every route that declares a product, read from the controllers' own
 * metadata, against each default role with the product on and off, through the
 * real guard. The expected answer comes from the catalog alone: allowed when
 * the product is on and the role's default set passes the route's
 * declarations, refused by entitlement when the product is off, refused by
 * permission otherwise. So a new route is in the matrix the day it lands, and
 * a decorator that drifts from the catalog fails here by name.
 */
// Vitest awaits an async suite while it collects, so every route still gets a test of its own.
describe('the access matrix', async () => {
  const routes = await guardedRoutes();
  const productRoutes = routes.filter((route) => route.products.length > 0);
  const BRANCH = '11111111-1111-4111-8111-111111111111';

  function accessFor(role: OrgRole): WorkspaceAccess {
    return {
      workspaceId: 'ws-1',
      kind: 'business',
      orgId: 'org-1',
      orgName: 'A business',
      domain: 'hospitality',
      orgRole: role,
      registrationStatus: 'active',
      permissions: permissionsForRole(role),
      departments: [],
      propertyName: 'Head office',
      branches: [{ id: BRANCH, name: 'Head office', districtName: null, isHeadOffice: true }],
      branchCoverage: 'all',
      psfMembership: null,
    };
  }

  async function decide(
    route: GuardedRoute,
    access: WorkspaceAccess | null,
    on: readonly ProductId[],
  ): Promise<string> {
    const workspaces = {
      accessFor: () =>
        Promise.resolve(
          access && {
            access,
            covered: { coverage: 'all', propertyIds: [BRANCH] },
            facts: {
              membershipId: 'membership-1',
              entitlements: on.map((productId) => ({ productId, propertyId: null })),
            } as unknown as WorkspaceFacts,
          },
        ),
    } as unknown as WorkspaceService;
    const twoFactor = {
      stepUpFor: () => Promise.resolve({ required: true, verified: true }),
    } as unknown as TwoFactorService;
    const guard = new WorkspaceGuard(workspaces, twoFactor, new Reflector());
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-workspace-id': 'ws-1' }, user: { id: 'user-1' } }),
      }),
      getHandler: () => route.handler,
      getClass: () => route.controller,
    } as unknown as ExecutionContext;
    try {
      await guard.canActivate(context);
      return 'allowed';
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse() as { layer?: string };
        return `refused:${body.layer ?? error.getStatus()}`;
      }
      throw error;
    }
  }

  it('reads every product route there is', () => {
    expect(productRoutes.length).toBeGreaterThan(200);
    // The four products slice G declares, the property capability, and Account.
    const declared = new Set(productRoutes.flatMap((r) => r.products));
    for (const product of ['pms', 'outlets', 'hr', 'residence', 'account']) expect(declared).toContain(product);
  });

  it('answers every route, for every default role, with its product on and off, as the catalog says', async () => {
    const mismatches: string[] = [];
    for (const role of OrgRole.options) {
      const access = accessFor(role);
      for (const route of productRoutes) {
        for (const productOn of [true, false]) {
          const on: ProductId[] = productOn ? [...route.products] : ['account'].filter((p) => !route.products.includes(p as ProductId)) as ProductId[];
          const productIsOn = route.products.some((p) => on.includes(p));
          const expected = !productIsOn
            ? 'refused:entitlement'
            : permitted(route, access.permissions)
              ? 'allowed'
              : 'refused:permission';
          const actual = await decide(route, access, on);
          if (actual !== expected) mismatches.push(`${route.key} ${role} product ${productOn ? 'on' : 'off'}: ${actual}, expected ${expected}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('answers a workspace of another business exactly as one that does not exist, on every route', async () => {
    const answers = new Set<string>();
    for (const route of routes) answers.add(await decide(route, null, []));
    expect([...answers]).toEqual(['refused:workspace']);
  });
});
