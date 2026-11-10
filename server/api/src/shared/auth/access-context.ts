import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { RoleScope } from '@injishi/contracts';
import { Observable } from 'rxjs';

/**
 * Who acted, and under what grant, for the length of one request (ADR-076
 * contract section 8).
 *
 * The guards decide this and write it on the request; `AccessContextInterceptor`
 * then runs the handler inside an `AsyncLocalStorage` holding it, so
 * `AuditWriter` can stamp the actor, grant family, roles, permissions, scope and
 * device on every audit row without a service passing any of it down. A write
 * with no request behind it (a job, a script) has no context, and its audit row
 * carries none of these columns, which is the truth about it.
 *
 * The three grant families of ADR-074 are never mixed: whichever guard ran last
 * on the route writes the context, and a business route, a staff route and an
 * oversight route each have exactly one such guard.
 */
export type GrantFamily = 'business' | 'staff' | 'oversight' | 'self' | 'device';

export interface AccessContext {
  readonly actorUserId: string | null;
  /** The member who acted, on a business route (and, from slice D, a member with no account). */
  readonly actorMembershipId: string | null;
  readonly grantFamily: GrantFamily;
  /** The keys of the roles the actor held where they acted. */
  readonly roleKeys: readonly string[];
  /** What the route was granted on: the permissions it declared, never all the actor holds. */
  readonly permissions: readonly string[];
  /** Where the act was allowed. Empty means the whole business. */
  readonly scope: readonly RoleScope[];
  readonly deviceId: string | null;
  readonly deviceUserSessionId: string | null;
  readonly overrideByMembershipId: string | null;
}

/** The request property the guards write. */
export interface RequestWithAccessContext {
  accessContext?: AccessContext;
}

const storage = new AsyncLocalStorage<AccessContext>();

/** The context of the request this code runs in, or undefined outside one. */
export function currentAccessContext(): AccessContext | undefined {
  return storage.getStore();
}

/** Run `fn` with this context, for a caller that is not an HTTP handler (a test, a job acting for a person). */
export function runWithAccessContext<T>(context: AccessContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** A context for one family, every other field empty. */
export function accessContextFor(
  grantFamily: GrantFamily,
  actorUserId: string | null,
  fields: Partial<Omit<AccessContext, 'grantFamily' | 'actorUserId'>> = {},
): AccessContext {
  return {
    actorUserId,
    actorMembershipId: null,
    grantFamily,
    roleKeys: [],
    permissions: [],
    scope: [],
    deviceId: null,
    deviceUserSessionId: null,
    overrideByMembershipId: null,
    ...fields,
  };
}

/**
 * Runs each HTTP handler inside the access context its guards wrote.
 *
 * Interceptors run after guards and wrap the handler, so subscribing to the
 * handler inside `storage.run` puts its whole promise chain, every service it
 * calls included, inside the context. A request no guard described runs as
 * before, outside any context.
 */
@Injectable()
export class AccessContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<RequestWithAccessContext>();
    const described = request.accessContext;
    if (!described) return next.handle();
    return new Observable((subscriber) =>
      storage.run(described, () => next.handle().subscribe(subscriber)),
    );
  }
}
