import type { OversightGrant, OversightRole } from '@injishi/contracts';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TwoFactorService } from './two-factor.service';
import { WorkspaceService } from './workspace.service';

const OVERSIGHT_ROLE_KEY = 'oversight:role';

/**
 * Declare which oversight function a route belongs to.
 *
 * The route names the FUNCTION, never a person and never a body: a business
 * approver at MINALOC and one at a district office are the same function to
 * this pipeline, which is exactly why `oversight_role` is an enum and the body
 * is a catalog (D19).
 */
export const RequireOversight = (
  role: OversightRole,
): ReturnType<typeof SetMetadata> => SetMetadata(OVERSIGHT_ROLE_KEY, role);

/** The grants this caller actually holds for the route's function. */
export const CurrentOversight = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OversightGrant[] => {
    const request = ctx.switchToHttp().getRequest<{
      oversightGrants?: OversightGrant[];
    }>();
    if (!request.oversightGrants) {
      // The route forgot the guard. Handing back an empty list would read as
      // "this officer has no authority" and quietly pass an unguarded route.
      throw new InternalServerErrorException(
        'CurrentOversight used on a route without OversightGuard.',
      );
    }
    return request.oversightGrants;
  },
);

/**
 * Government oversight authorization — the second control on a gate route.
 *
 * Composes as `@UseGuards(SessionGuard, OversightGuard)`, the same shape as
 * `WorkspaceGuard`. It answers ONE question: does this caller hold an active
 * assignment for the function this route belongs to?
 *
 * It deliberately does NOT answer "is that business in their region". Scope is
 * a property of a TARGET, and the target is a row the service has to load
 * anyway; checking it here would mean loading the org twice and would leave the
 * check absent on a list route, where scope is a WHERE clause rather than a
 * predicate. The service applies `withinScope` from `@injishi/contracts`, which
 * is the one definition both uses share.
 */
@Injectable()
export class OversightGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspaceService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<OversightRole>(
      OVERSIGHT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      // A guarded route that declares no function is a mistake, not a public
      // route. Failing loudly beats letting any signed-in person through.
      throw new InternalServerErrorException(
        'OversightGuard used on a route with no @RequireOversight().',
      );
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string };
      session?: { id: string };
      oversightGrants?: OversightGrant[];
    }>();
    if (!request.user) {
      // SessionGuard did not run. Treating this as anonymous would turn a
      // wiring mistake into a silent 403 nobody investigates.
      throw new InternalServerErrorException(
        'OversightGuard ran before SessionGuard.',
      );
    }

    // Same rule as WorkspaceGuard: an officer must have enrolled and this
    // session must have presented a code (F-S02).
    if (request.session?.id) {
      await this.twoFactor.assertSatisfied(request.user.id, request.session.id);
    }

    const grants = await this.workspaces.oversightGrantsForUser(request.user.id);
    const forRole = grants.filter((g) => g.oversightRole === required);
    if (forRole.length === 0) {
      throw new ForbiddenException(
        'You do not hold an oversight assignment for this console.',
      );
    }

    request.oversightGrants = forRole;
    return true;
  }
}
