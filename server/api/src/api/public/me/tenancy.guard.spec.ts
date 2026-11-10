import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import type { TenanciesService, TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { TenancyGuard } from './tenancy.guard';

/**
 * A tenant's own lease (blueprint 2.4), and the grant a tenant acts under
 * (ADR-076 G16): `self`, so an audit row a tenant's act writes never carries a
 * business grant.
 */
describe('TenancyGuard', () => {
  const LEASE_ID = '33333333-3333-4333-8333-333333333333';

  interface Harness {
    guard: TenancyGuard;
    context: ExecutionContext;
    request: Record<string, unknown>;
    tenancy: TenancyRef;
  }

  function guardFor(params: Record<string, string>): Harness {
    const tenancy = { leaseId: LEASE_ID } as unknown as TenancyRef;
    const tenancies = { resolve: () => Promise.resolve(tenancy) } as unknown as TenanciesService;
    // SessionGuard ran first and left a context of its own; this guard states the tenant's.
    const request: Record<string, unknown> = { user: { id: 'tenant-1' }, params, accessContext: undefined };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    return { guard: new TenancyGuard(tenancies), context, request, tenancy };
  }

  it('resolves the tenancy and acts as the tenant themselves', async () => {
    const { guard, context, request, tenancy } = guardFor({ leaseId: LEASE_ID });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.tenancy).toBe(tenancy);
    expect(request.accessContext).toMatchObject({
      grantFamily: 'self',
      actorUserId: 'tenant-1',
      actorMembershipId: null,
      roleKeys: [],
      permissions: [],
    });
  });

  it('answers a malformed lease id with 404 and no context', async () => {
    const { guard, context, request } = guardFor({ leaseId: 'not-a-uuid' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 404 });
    expect(request.accessContext).toBeUndefined();
  });
});
