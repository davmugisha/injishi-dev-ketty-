import { describe, expect, it } from 'vitest';

import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OrgRole, permissionsForRole, type Permission } from '@injishi/contracts';

import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  REQUIRE_ANY_PERMISSION,
  REQUIRE_PERMISSION,
  REQUIRE_PRODUCT,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { OpsPosVenueController } from './pos-venue.controller';

/**
 * Who may configure the floor. The decision is made on the SERVER, route by route, so a hidden button in the
 * app is never the only thing between a waiter and a table layout. This reads the controller's own metadata
 * (not a copy of it), so a route added later without a permission fails here instead of shipping open.
 */
const controller = OpsPosVenueController;
const handlers = Object.getOwnPropertyNames(controller.prototype)
  .filter((name) => name !== 'constructor')
  .map((name) => ({ name, fn: controller.prototype[name as keyof typeof controller.prototype] as unknown as object }))
  .filter(({ fn }) => Reflect.getMetadata(METHOD_METADATA, fn) !== undefined);

const methodName = (m: RequestMethod): string => RequestMethod[m];

describe('venue setup routes: permissions', () => {
  it('sits behind the session guard and the workspace guard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(WorkspaceGuard);
  });

  it('belongs to POS, so it is refused where POS is switched off (ADR-076 G10)', () => {
    expect(Reflect.getMetadata(REQUIRE_PRODUCT, controller)).toEqual(['pos']);
  });

  it('exposes the routes the app relies on (and none it does not know about)', () => {
    const routes = handlers
      .map(({ fn }) => `${methodName(Reflect.getMetadata(METHOD_METADATA, fn))} ${Reflect.getMetadata(PATH_METADATA, fn)}`)
      .sort();
    expect(routes).toEqual(
      [
        'GET venue',
        'GET setup',
        'POST venue/areas',
        'PATCH venue/areas/:areaId',
        'POST venue/areas/:areaId/archive',
        'POST venue/tables',
        'PATCH venue/tables/:tableId',
        'POST venue/tables/:tableId/archive',
        'POST venue/stations',
        'PATCH venue/stations/:stationId',
        'POST venue/stations/:stationId/archive',
        'POST venue/registers',
        'PATCH venue/registers/:registerId',
        'POST venue/registers/:registerId/archive',
        'PUT venue/routing',
      ].sort(),
    );
  });

  it('requires outlet.manage on EVERY route, read or write, and nothing weaker', () => {
    expect(handlers.length).toBeGreaterThan(0);
    for (const { name, fn } of handlers) {
      expect(Reflect.getMetadata(REQUIRE_PERMISSION, fn), `${name} must require a permission`).toEqual(['outlet.manage']);
      expect(Reflect.getMetadata(REQUIRE_ANY_PERMISSION, fn), `${name} must not widen access with an any-of list`).toBeUndefined();
    }
  });

  const holds = (role: OrgRole, permission: Permission): boolean => [...permissionsForRole(role)].includes(permission);

  it('lets the owner and the manager configure the floor', () => {
    expect(holds('owner', 'outlet.manage')).toBe(true);
    expect(holds('manager', 'outlet.manage')).toBe(true);
  });

  it.each(['waiter', 'cashier', 'bartender', 'kitchen', 'stock_controller'] as const)(
    'refuses the %s: serving guests is not deciding what the floor is',
    (role) => {
      expect(holds(role, 'outlet.manage')).toBe(false);
    },
  );
});
