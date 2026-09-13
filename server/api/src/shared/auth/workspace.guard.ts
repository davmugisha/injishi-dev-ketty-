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
import {
  PERMISSION_LABEL,
  REGISTRATION_STAGE_MESSAGE,
  isOperational,
  type Permission,
  type WorkspaceAccess,
} from '@injishi/contracts';

import { TwoFactorService } from './two-factor.service';
import { WorkspaceService } from './workspace.service';
import type { SessionRecord, SessionUser } from './session.guard';

export const REQUIRE_PERMISSION = 'require_permission';

/**
 * The permission this route needs inside the active workspace.
 * Omit it to require only that the caller holds the workspace at all.
 *
 * Several may be named, and then EVERY one is required. That exists for one
 * act that is two acts at once: check out closes the stay AND signs its sale,
 * so it needs `stay.checkout` and `folio.close` (ADR-050 D-t, AC-8). Gating it
 * on the first alone would leave the fiscal act reachable through a permission
 * granted for something else.
 */
export const RequirePermission = (
  ...permissions: [Permission, ...Permission[]]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_PERMISSION, permissions);

interface RequestWithWorkspace {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: SessionUser;
  session?: SessionRecord;
  workspace?: WorkspaceAccess;
}

/**
 * Where a caller may name the workspace. The ROUTE PARAM wins, then the header,
 * then the body, then the query (ADR-018, D-j).
 *
 * The order used to be header first. Once a browser route reads
 * `/w/[workspaceId]/...`, the address bar is the visible truth about which
 * workspace a person is looking at, and a header quietly disagreeing with it is
 * the exact bug the restructure removes: two tabs on two hotels, one stale
 * header, and the second tab reads the first tab's money.
 *
 * The header stays, and stays ahead of body and query, because API clients that
 * carry no route param still name the workspace that way.
 */
function claimedWorkspaceId(req: RequestWithWorkspace): string | null {
  const fromParams = req.params?.workspaceId;
  if (typeof fromParams === 'string' && fromParams) return fromParams;
  const header = req.headers['x-workspace-id'];
  if (typeof header === 'string' && header) return header;
  const fromBody = req.body?.workspaceId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromQuery = req.query?.workspaceId;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  return null;
}

/**
 * Word the refusal from its CAUSE, not from the missing permission (ADR-012,
 * AC-2).
 *
 * Two very different situations collapse to the same empty `permissions[]`
 * array: a role that never held this power, and a business still somewhere in
 * the registration pipeline. Telling a registrant "your role cannot do this"
 * when the real answer is "your business is not approved yet" is actively
 * misleading — they hold the role, they are watching their own pipeline, and
 * the message sends them to fix the wrong thing.
 *
 * `WorkspaceAccess` already carries `registrationStatus`, so telling the two
 * apart costs no extra read.
 */
function refusalFor(access: WorkspaceAccess, required: Permission): string {
  if (
    access.kind === 'business' &&
    access.registrationStatus !== null &&
    !isOperational(access.registrationStatus)
  ) {
    return REGISTRATION_STAGE_MESSAGE[access.registrationStatus];
  }
  return `Your role cannot ${PERMISSION_LABEL[required]} in this workspace.`;
}

/**
 * Refuses a request that names a workspace the caller does not hold, and a
 * request that lacks the permission the route declares (Spec 0004).
 *
 * Pair with `SessionGuard`, which must run first:
 *   @UseGuards(SessionGuard, WorkspaceGuard)
 *
 * This is the boundary. The operator app's own checks stay, but they are
 * affordances now: hiding a button is a courtesy, this is the control.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly twoFactor: TwoFactorService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithWorkspace>();

    if (!request.user?.id) {
      // Programming error: the route forgot SessionGuard, or ordered it after
      // this one. Fail loudly rather than treating it as anonymous.
      throw new InternalServerErrorException(
        'WorkspaceGuard ran without a session. Add SessionGuard before it.',
      );
    }

    // The second factor comes before the workspace question (F-S02). A person
    // who holds an operator workspace but has not enrolled, or whose THIS
    // session has not presented a code, is refused every operator route with a
    // `code` the web resolver routes on. Guests never reach here.
    if (request.session?.id) {
      await this.twoFactor.assertSatisfied(request.user.id, request.session.id);
    }

    const workspaceId = claimedWorkspaceId(request);
    if (!workspaceId) {
      throw new ForbiddenException(
        'This request must name the workspace it acts in.',
      );
    }

    const access = await this.workspaces.resolveForUser(
      request.user.id,
      workspaceId,
    );
    if (!access) {
      // Deliberately the same answer whether the workspace does not exist or
      // simply is not theirs: a probe learns nothing either way.
      throw new ForbiddenException('That workspace is not available to you.');
    }

    const declared = this.reflector.getAllAndOverride<
      Permission | readonly Permission[] | undefined
    >(REQUIRE_PERMISSION, [context.getHandler(), context.getClass()]);
    const required: readonly Permission[] =
      declared === undefined ? [] : typeof declared === 'string' ? [declared] : declared;

    // Refused on the FIRST missing one, so the sentence names a real gap.
    const missing = required.find((p) => !access.permissions.includes(p));
    if (missing) {
      throw new ForbiddenException(refusalFor(access, missing));
    }

    request.workspace = access;
    return true;
  }
}

/**
 * Injects the resolved workspace. Throws when the route forgot the guard,
 * mirroring `@CurrentUser()` so the same class of mistake fails the same way.
 */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WorkspaceAccess => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithWorkspace>();
    if (!request.workspace) {
      throw new InternalServerErrorException(
        'No workspace on request. Add @UseGuards(SessionGuard, WorkspaceGuard).',
      );
    }
    return request.workspace;
  },
);
