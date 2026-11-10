import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { Permission, ProductId } from '@injishi/contracts';

import {
  REQUIRE_ANY_PERMISSION,
  REQUIRE_EVERY_BRANCH,
  REQUIRE_PERMISSION,
  REQUIRE_PRODUCT,
} from '../workspace.guard';

/**
 * Every route behind `WorkspaceGuard`, read from the controllers' own
 * decorator metadata, the way Nest resolves it (handler over class). For the
 * tests that must cover every route and cannot be told which ones exist
 * (ADR-076 G18, G19): a route added tomorrow is in them the day it lands.
 *
 * Test support only: nothing in the server imports it. The caller mocks the ESM
 * packages a controller reaches (`@injishi/auth`) before calling it.
 */
export interface GuardedRoute {
  readonly key: string;
  readonly controller: abstract new (...args: never[]) => unknown;
  readonly handler: (...args: unknown[]) => unknown;
  readonly required: readonly Permission[];
  readonly anyOf: readonly Permission[];
  readonly products: readonly ProductId[];
  readonly everyBranch: boolean;
}

function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...controllerFiles(path));
    else if (entry.name.endsWith('.controller.ts')) out.push(path);
  }
  return out;
}

function list<T>(value: unknown): readonly T[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]) as T[];
}

/** handler over class, as `Reflector.getAllAndOverride` reads it. */
function declared(key: string, handler: object, controller: object): unknown {
  const own = Reflect.getMetadata(key, handler);
  return own !== undefined ? own : Reflect.getMetadata(key, controller);
}

/**
 * Every route behind WorkspaceGuard, read from the controllers themselves. Each controller is loaded with a
 * dynamic import so Vitest transforms it as it does the specs; a plain `require` reaches Node's own loader,
 * which cannot read a constructor's parameter properties.
 */
export async function guardedRoutes(): Promise<GuardedRoute[]> {
  const root = join(__dirname, '..', '..', '..', 'api');
  const routes: GuardedRoute[] = [];
  for (const file of controllerFiles(root)) {
    const exported = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    for (const value of Object.values(exported)) {
      if (typeof value !== 'function' || Reflect.getMetadata(PATH_METADATA, value) === undefined) continue;
      const controller = value as GuardedRoute['controller'];
      const classGuards = list<{ name?: string }>(Reflect.getMetadata(GUARDS_METADATA, controller));
      const proto = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        const guards = [...classGuards, ...list<{ name?: string }>(Reflect.getMetadata(GUARDS_METADATA, handler))];
        if (!guards.some((g) => g?.name === 'WorkspaceGuard')) continue;
        routes.push({
          key: `${controller.name}.${name}`,
          controller,
          handler: handler as GuardedRoute['handler'],
          required: list<Permission>(declared(REQUIRE_PERMISSION, handler, controller)),
          anyOf: list<Permission>(declared(REQUIRE_ANY_PERMISSION, handler, controller)),
          products: list<ProductId>(declared(REQUIRE_PRODUCT, handler, controller)),
          everyBranch: declared(REQUIRE_EVERY_BRANCH, handler, controller) === true,
        });
      }
    }
  }
  return routes;
}

/** Does a permission set pass the route's declarations, as the permission layer reads them? */
export function permitted(route: Pick<GuardedRoute, 'required' | 'anyOf'>, held: readonly Permission[]): boolean {
  return (
    route.required.every((p) => held.includes(p)) &&
    (route.anyOf.length === 0 || route.anyOf.some((p) => held.includes(p)))
  );
}
