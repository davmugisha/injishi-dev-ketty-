import { describe, expect, it } from 'vitest';

import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { can, type OrgRole, type Permission } from '@injishi/contracts';

import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  REQUIRE_ANY_PERMISSION,
  REQUIRE_PERMISSION,
  REQUIRE_PRODUCT,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { OpsPosCustomersController } from './pos-customers.controller';

/**
 * Who may do what with customers. The decision is made on the SERVER, route by route; this reads the
 * controller's own metadata (not a copy of it), so a route added later without a permission fails here
 * instead of shipping open.
 */
const controller = OpsPosCustomersController;
const handlers = Object.getOwnPropertyNames(controller.prototype)
  .filter((name) => name !== 'constructor')
  .map((name) => ({ name, fn: controller.prototype[name as keyof typeof controller.prototype] as unknown as object }))
  .filter(({ fn }) => Reflect.getMetadata(METHOD_METADATA, fn) !== undefined);

const methodName = (m: RequestMethod): string => RequestMethod[m];
const route = (fn: object): string => `${methodName(Reflect.getMetadata(METHOD_METADATA, fn))} ${Reflect.getMetadata(PATH_METADATA, fn)}`;
const byRoute = (r: string): object => handlers.find(({ fn }) => route(fn) === r)?.fn as object;

describe('customer routes: permissions', () => {
  it('sit behind the session guard and the workspace guard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(WorkspaceGuard);
  });

  it('belong to POS, so they are refused where POS is switched off (ADR-076 G10)', () => {
    expect(Reflect.getMetadata(REQUIRE_PRODUCT, controller)).toEqual(['pos']);
  });

  it('expose exactly the routes the app relies on', () => {
    expect(handlers.map(({ fn }) => route(fn)).sort()).toEqual(
      [
        'GET customers',
        'POST customers',
        'GET customers/:customerId',
        'PATCH customers/:customerId',
        'POST customers/:customerId/merge',
        'POST customers/:customerId/erase',
        'GET customers/:customerId/export',
        'PUT orders/:orderId/customer',
      ].sort(),
    );
  });

  it('declare a permission on EVERY route', () => {
    expect(handlers.length).toBe(8);
    for (const { name, fn } of handlers) {
      const all = Reflect.getMetadata(REQUIRE_PERMISSION, fn);
      const any = Reflect.getMetadata(REQUIRE_ANY_PERMISSION, fn);
      expect(all !== undefined || any !== undefined, `${name} must require a permission`).toBe(true);
    }
  });

  it('let a reader (view or manage) look customers up, and no one else', () => {
    for (const r of ['GET customers', 'GET customers/:customerId']) {
      expect(Reflect.getMetadata(REQUIRE_ANY_PERMISSION, byRoute(r)), r).toEqual(['customer.view', 'customer.manage']);
    }
  });

  it('keep registering and correcting to customer.manage', () => {
    for (const r of ['POST customers', 'PATCH customers/:customerId']) {
      expect(Reflect.getMetadata(REQUIRE_PERMISSION, byRoute(r)), r).toEqual(['customer.manage']);
    }
  });

  it('keep merge, export and erase to customer.admin', () => {
    for (const r of ['POST customers/:customerId/merge', 'POST customers/:customerId/erase', 'GET customers/:customerId/export']) {
      expect(Reflect.getMetadata(REQUIRE_PERMISSION, byRoute(r)), r).toEqual(['customer.admin']);
    }
  });

  it('put a customer on a bill with the permission to take the order', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSION, byRoute('PUT orders/:orderId/customer'))).toEqual(['pos.sell']);
  });

  const holds = (role: OrgRole, permission: Permission): boolean => can(role, permission);

  it('give the owner and the manager everything', () => {
    for (const role of ['owner', 'manager'] as const) {
      for (const p of ['customer.view', 'customer.manage', 'customer.admin'] as const) expect(holds(role, p), `${role} ${p}`).toBe(true);
    }
  });

  it('let the cashier register customers but not merge, export or erase them', () => {
    expect(holds('cashier', 'customer.view')).toBe(true);
    expect(holds('cashier', 'customer.manage')).toBe(true);
    expect(holds('cashier', 'customer.admin')).toBe(false);
  });

  it('let the waiter and bartender look customers up only', () => {
    for (const role of ['waiter', 'bartender'] as const) {
      expect(holds(role, 'customer.view'), role).toBe(true);
      expect(holds(role, 'customer.manage'), role).toBe(false);
      expect(holds(role, 'customer.admin'), role).toBe(false);
    }
  });

  it('keep the kitchen and the stock controller away from customers entirely', () => {
    for (const role of ['kitchen', 'stock_controller'] as const) {
      for (const p of ['customer.view', 'customer.manage', 'customer.admin'] as const) expect(holds(role, p), `${role} ${p}`).toBe(false);
    }
  });
});
