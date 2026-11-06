import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import type { KioskContext, KioskService } from '../../../modules/hr/application/kiosk.service';
import type { EntitlementCheck } from '../../../shared/entitlements/entitlement-check';
import { KioskGuard } from './kiosk.guard';

/**
 * The kiosk's door (ADR-058 AC-TM10), and HR's entitlement at it (ADR-076 G9):
 * clocking is HR's, so a paired kiosk at a branch where HR is off is refused
 * before any PIN is read.
 */
describe('KioskGuard', () => {
  const KIOSK: KioskContext = {
    id: 'kiosk-1',
    orgId: 'org-1',
    propertyId: 'branch-1',
    name: 'Front door',
    branchName: 'Remera',
  };

  interface Harness {
    guard: KioskGuard;
    context: ExecutionContext;
    request: Record<string, unknown>;
    asked: [string, string, string][];
  }

  function guardWith(kiosk: KioskContext | null, hrOn: boolean): Harness {
    const asked: [string, string, string][] = [];
    const kiosks = { resolve: () => Promise.resolve(kiosk) } as unknown as KioskService;
    const entitlements = {
      onForOrgAt: (product: string, orgId: string, propertyId: string) => {
        asked.push([product, orgId, propertyId]);
        return Promise.resolve(hrOn);
      },
    } as unknown as EntitlementCheck;
    const request: Record<string, unknown> = { cookies: { injishi_kiosk: 'token' }, ip: '127.0.0.1' };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    return { guard: new KioskGuard(kiosks, entitlements), context, request, asked };
  }

  it('lets a paired kiosk in where HR is on, as a device', async () => {
    const { guard, context, request, asked } = guardWith(KIOSK, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(asked).toEqual([['hr', 'org-1', 'branch-1']]);
    expect(request.kiosk).toEqual(KIOSK);
    expect(request.accessContext).toMatchObject({ grantFamily: 'device', deviceId: 'kiosk-1' });
  });

  it('refuses a paired kiosk where HR is off, with the entitlement layer, and resolves no kiosk', async () => {
    const { guard, context, request } = guardWith(KIOSK, false);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { layer: 'entitlement', code: 'product_off', message: 'HR is not switched on here.' },
    });
    expect(request.kiosk).toBeUndefined();
  });

  it('answers an unpaired device as before, without asking about HR', async () => {
    const { guard, context, asked } = guardWith(null, true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { layer: 'session', code: 'kiosk_unpaired' },
    });
    expect(asked).toEqual([]);
  });
});
