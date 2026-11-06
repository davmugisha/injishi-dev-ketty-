import { describe, expect, it } from 'vitest';

import {
  enabledProducts,
  isNoop,
  isOnAt,
  planEntitlementChange,
  productReach,
} from './entitlement-rules';

/**
 * The entitlement rules (ADR-076 G5, G6, A-3). The guard, `/me/workspaces` and
 * the admin screen all read through them.
 */
describe('entitlement rules', () => {
  const B1 = '11111111-1111-4111-8111-111111111111';
  const B2 = '22222222-2222-4222-8222-222222222222';
  const B3 = '33333333-3333-4333-8333-333333333333';

  describe('resolution (G5)', () => {
    it('is on at a branch with a row for it or for every branch', () => {
      expect(isOnAt([{ productId: 'pos', propertyId: B1 }], 'pos', B1)).toBe(true);
      expect(isOnAt([{ productId: 'pos', propertyId: null }], 'pos', B2)).toBe(true);
      expect(isOnAt([{ productId: 'pos', propertyId: B1 }], 'pos', B2)).toBe(false);
      expect(isOnAt([{ productId: 'pms', propertyId: null }], 'pos', B1)).toBe(false);
    });

    it('narrows the covered branches to where any of the products is on (A-3)', () => {
      const open = [
        { productId: 'pos', propertyId: B1 },
        { productId: 'outlets', propertyId: B3 },
      ];
      expect(productReach(open, ['pos'], [B1, B2])).toEqual({ everyBranch: false, propertyIds: [B1] });
      expect(productReach(open, ['pos', 'outlets'], [B1, B2, B3])).toEqual({
        everyBranch: false,
        propertyIds: [B1, B3],
      });
      expect(productReach([{ productId: 'pos', propertyId: null }], ['pos'], [B1, B2])).toEqual({
        everyBranch: true,
        propertyIds: [B1, B2],
      });
    });

    it('lists a product as all, as its covered branches, or not at all', () => {
      const open = [
        { productId: 'account', propertyId: null },
        { productId: 'pos', propertyId: B1 },
        { productId: 'pms', propertyId: B3 },
      ];
      expect(enabledProducts(open, [B1, B2], ['account', 'pms', 'pos'])).toEqual([
        { id: 'account', branches: 'all' },
        { id: 'pos', branches: [B1] },
      ]);
    });

    it('never lists all for a member limited to some branches, only the branches they cover', () => {
      const open = [
        { productId: 'account', propertyId: null },
        { productId: 'pms', propertyId: null },
        { productId: 'pos', propertyId: B2 },
      ];
      expect(enabledProducts(open, [B1], ['account', 'pms', 'pos'], 'limited')).toEqual([
        { id: 'account', branches: [B1] },
        { id: 'pms', branches: [B1] },
      ]);
      // Covering no branch at all, they hold no product, as they hold no permission.
      expect(enabledProducts(open, [], ['account', 'pms', 'pos'], 'limited')).toEqual([]);
    });
  });

  describe('a staff change (G6)', () => {
    const plan = (
      input: Partial<Parameters<typeof planEntitlementChange>[0]>,
    ): ReturnType<typeof planEntitlementChange> =>
      planEntitlementChange({
        product: 'pos',
        state: 'off',
        branchIds: null,
        openRows: [],
        activeBranchIds: [B1, B2],
        ...input,
      });

    it('off at one branch of a business wide product: closes the every branch row, opens one per remaining branch', () => {
      expect(plan({ branchIds: [B2], openRows: [{ id: 'row-all', propertyId: null }] })).toEqual({
        ok: true,
        plan: { close: ['row-all'], open: [B1] },
      });
    });

    it('on everywhere: closes the branch rows and opens one every branch row', () => {
      expect(
        plan({ state: 'on', openRows: [{ id: 'row-b1', propertyId: B1 }] }),
      ).toEqual({ ok: true, plan: { close: ['row-b1'], open: [null] } });
    });

    it('on at a branch: opens only what is missing', () => {
      expect(
        plan({ state: 'on', branchIds: [B1, B2], openRows: [{ id: 'row-b1', propertyId: B1 }] }),
      ).toEqual({ ok: true, plan: { close: [], open: [B2] } });
    });

    it('off everywhere closes every open row', () => {
      expect(
        plan({ openRows: [{ id: 'row-b1', propertyId: B1 }, { id: 'row-b2', propertyId: B2 }] }),
      ).toEqual({ ok: true, plan: { close: ['row-b1', 'row-b2'], open: [] } });
    });

    it('asking for what is already true changes nothing, so nothing is written', () => {
      const already = plan({ state: 'on', openRows: [{ id: 'row-all', propertyId: null }] });
      expect(already.ok && isNoop(already.plan)).toBe(true);
      const off = plan({ state: 'off', branchIds: [B1], openRows: [{ id: 'row-b2', propertyId: B2 }] });
      expect(off.ok && isNoop(off.plan)).toBe(true);
    });

    it('refuses a branch list for a business level product, and switching account off', () => {
      expect(plan({ product: 'hr', branchIds: [B1] })).toMatchObject({ ok: false, code: 'entitlement_level' });
      expect(plan({ product: 'marketplace', state: 'on', branchIds: [B1] })).toMatchObject({
        ok: false,
        code: 'entitlement_level',
      });
      expect(plan({ product: 'account' })).toMatchObject({ ok: false, code: 'entitlement_locked' });
      expect(plan({ product: 'admin', state: 'on' })).toMatchObject({ ok: false, code: 'entitlement_level' });
    });
  });
});
