import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  LEGACY_PERMISSION_KEY,
  PERMISSION_LABEL,
  PRODUCT_LABEL,
  REGISTRATION_STAGE_MESSAGE,
  isOperational,
  type Permission,
  type ProductId,
  type RoleScope,
} from '@injishi/contracts';

import { productReach } from '../entitlements/entitlement-rules';
import { accessContextFor, type RequestWithAccessContext } from './access-context';
import { accessRefusal } from './access-refusal';
import {
  assertCoversEveryBranch,
  resolveBranchScope,
  type BranchScope,
  type ScopedWorkspace,
} from './branch-scope';
import { assertStepUp, TwoFactorService } from './two-factor.service';
import { WorkspaceService, type ResolvedWorkspace } from './workspace.service';
import type { SessionRecord, SessionUser } from './session.guard';

export const REQUIRE_PERMISSION = 'require_permission';

/**
 * The permission this route needs inside the active workspace.
 *
 * Omitting every declaration requires only that the caller holds the workspace
 * at all, and the lint rule allows that only for a route named in its `allow`
 * option. A read declares one too — usually as `@RequireAnyPermission`, below.
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

export const REQUIRE_ANY_PERMISSION = 'require_any_permission';

/**
 * The route needs AT LEAST ONE of these permissions inside the active workspace.
 *
 * This is the form a READ takes. A list is read by whoever works it, and that is
 * rarely one role: the rooms list is the front desk's (`stay.checkin`),
 * housekeeping's (`housekeeping.set`) and inventory's (`listing.manage`). Naming
 * one of them would lock the others out of their own screen; naming none is what
 * this replaced, and it let a housekeeper read the rent roll and the owner of a
 * business still in the registration pipeline read everything (audit H1).
 *
 * An empty permission set holds none of the candidates, so the registration gate
 * refuses every read declared this way. The refusal is worded from the FIRST
 * candidate, so list the permission a refused person most plausibly needs first.
 *
 * It composes with `@RequirePermission`: when a route carries both, every
 * all-of permission AND one of the any-of set are required.
 */
export const RequireAnyPermission = (
  ...permissions: [Permission, ...Permission[]]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_ANY_PERMISSION, permissions);

export const REQUIRE_EVERY_BRANCH = 'require_every_branch';

/**
 * The route is an org wide write: a member limited to some branches is refused
 * 403 "This needs access to every branch." (ADR-054 AC-M6).
 *
 * It narrows who may act, never what a permission grants (invariant 6), so it
 * sits beside `@RequirePermission` rather than replacing it. Reads of org wide
 * data stay open to a limited member, which is why it goes on the write
 * handlers and not the class.
 */
export const RequireEveryBranch = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_EVERY_BRANCH, true);

export const REQUIRE_PRODUCT = 'require_product';

/**
 * The product this route belongs to (ADR-074, "Entitlement is not permission";
 * ADR-076 G9).
 *
 * Declared at class level, with a handler override where one route of a
 * controller belongs elsewhere. When the product is off at the branch in view
 * the route is refused 403 with `layer: "entitlement"` and `code:
 * "product_off"`; with no branch named, the route sees only the covered
 * branches where the product is on, and is refused the same way when that is
 * none.
 *
 * Entitlement is decided by this declaration alone, never by a permission
 * key's prefix, and it never grants anything: the permission check still runs
 * after it.
 */
export const RequireProduct = (product: ProductId): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_PRODUCT, [product]);

/**
 * A platform capability route, mounted by the screens of several products
 * (ADR-074): the property routes name `pms`, `residence` and `outlets`, so a
 * coffee shop or a residence can set up and publish without PMS. The route is
 * on wherever ANY of them is.
 */
export const RequireAnyProduct = (
  ...products: [ProductId, ProductId, ...ProductId[]]
): ReturnType<typeof SetMetadata> => SetMetadata(REQUIRE_PRODUCT, products);

interface RequestWithWorkspace extends RequestWithAccessContext {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: SessionUser;
  session?: SessionRecord;
  workspace?: ScopedWorkspace;
  /** The one access resolution of this request (ADR-076 contract section 7). */
  resolvedWorkspace?: ResolvedWorkspace;
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

/** Plain wording for a missing permission. Names the missing capability. */
function permissionRefusal(required: Permission): string {
  return `Your role cannot ${PERMISSION_LABEL[required]} in this workspace.`;
}

/** Where the act is allowed, as the audit row records it: the branch in view, or the member's coverage. */
function scopeOf(branchScope: BranchScope): RoleScope[] {
  if (branchScope.selectedPropertyId === null && branchScope.coverage === 'all') return [];
  return branchScope.propertyIds.length > 0
    ? [{ kind: 'branch', ids: [...branchScope.propertyIds] }]
    : [];
}

/**
 * Refuses a request that names a workspace the caller does not hold, a branch
 * they do not cover, a business that is not operational, a product that is off
 * and a permission they lack, IN THAT ORDER, naming the layer and code of the
 * one that refused (ADR-076 contract section 2, AC-U3).
 *
 * Pair with `SessionGuard`, which must run first:
 *   @UseGuards(SessionGuard, WorkspaceGuard)
 *
 * The caller's whole access is resolved ONCE, in two queries run together (the
 * step-up state, and the workspace with its branches, overrides and
 * entitlements), and attached to the request for every later layer to read
 * (A-17). It used to take about seventeen.
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
    const userId = request.user.id;
    const workspaceId = claimedWorkspaceId(request);

    // The one resolution of this request: both reads at once, judged below in
    // the order of the layers.
    const [stepUp, resolved] = await Promise.all([
      request.session?.id ? this.twoFactor.stepUpFor(userId, request.session.id) : null,
      workspaceId ? this.workspaces.accessFor(userId, workspaceId) : null,
    ]);

    // 1. Session. The second factor comes before the workspace question (F-S02).
    // A person who holds an operator workspace but whose THIS session has not
    // presented a code is refused every operator route with a `code` the web
    // resolver routes on. Guests never reach here.
    if (stepUp) assertStepUp(stepUp);

    // 2. Workspace.
    if (!workspaceId) {
      throw accessRefusal('workspace_required', 'This request must name the workspace it acts in.');
    }
    if (!resolved) {
      // Deliberately the same answer whether the workspace does not exist or
      // simply is not theirs: a probe learns nothing either way.
      throw accessRefusal('workspace_not_available', 'That workspace is not available to you.');
    }
    const { access, covered, facts } = resolved;

    // 3. Scope, the branch in view: validated before anything reads it, so the
    // entitlement below can never tell a limited member whether a branch they
    // cannot see runs a product (ADR-074, "The order of checks").
    let branchScope = resolveBranchScope(covered, request.headers['x-branch-id']);

    const targets = [context.getHandler(), context.getClass()];
    const required = this.declared(REQUIRE_PERMISSION, targets);
    const anyOf = this.declared(REQUIRE_ANY_PERMISSION, targets);
    const products = this.products(targets);
    const declaresSomething = required.length > 0 || anyOf.length > 0 || products.length > 0;

    // 4. Operational: the registration gate (ADR-053, D20). A business still in
    // the pipeline holds its role and none of its powers, so a route that
    // declares anything is refused with the stage's own sentence. A route that
    // declares nothing passes on membership alone, as before: the registrant
    // opens the workspace to watch the pipeline.
    if (
      declaresSomething &&
      access.kind === 'business' &&
      access.registrationStatus !== null &&
      !isOperational(access.registrationStatus)
    ) {
      throw accessRefusal(
        access.registrationStatus === 'suspended' ? 'suspended' : 'registration_stage',
        REGISTRATION_STAGE_MESSAGE[access.registrationStatus],
      );
    }

    // 5. Entitlement: the route's product must be on at the branch in view, or,
    // with none named, the route sees only the covered branches where it is on
    // (A-3). Only a business holds products; a broker or personal workspace
    // holds no permission either, and is refused at the next layer as before.
    if (products.length > 0 && access.kind === 'business') {
      branchScope = this.narrowByProduct(branchScope, products, facts.entitlements);
    }

    // 6. Permission. Refused on the FIRST missing one, so the sentence names a
    // real gap.
    const missing = required.find((p) => !access.permissions.includes(p));
    if (missing) {
      throw accessRefusal('permission_missing', permissionRefusal(missing));
    }
    // One of the candidates is enough, and the refusal is worded from the first.
    if (anyOf.length > 0 && !anyOf.some((p) => access.permissions.includes(p))) {
      throw accessRefusal('permission_missing', permissionRefusal(anyOf[0]));
    }

    // A route that declares NEITHER passes on membership alone. The lint rule
    // `injishi/require-permission-on-guarded-route` refuses that shape on every
    // verb unless the route is named in its `allow` option, so reaching here
    // undeclared is a reviewed exception (`POST /me/active-workspace`), never
    // an accident.

    // An org wide write, after the permission so a refused route says why;
    // refused in words, because the member knows the action exists.
    const everyBranch = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_EVERY_BRANCH,
      targets,
    );
    if (everyBranch) assertCoversEveryBranch(access);

    request.resolvedWorkspace = resolved;
    request.workspace = { ...access, branchScope };
    request.accessContext = accessContextFor('business', userId, {
      actorMembershipId: facts.membershipId,
      roleKeys: access.orgRole ? [access.orgRole] : [],
      // What the route was granted on, under the new names (ADR-076 D-20).
      permissions: [
        ...required,
        ...anyOf.filter((p) => access.permissions.includes(p)),
      ].map((p) => LEGACY_PERMISSION_KEY[p]),
      scope: scopeOf(branchScope),
    });
    return true;
  }

  /**
   * The branch scope, narrowed to where the route's product is on.
   *
   * A named branch where it is off is refused; with no branch named, the scope
   * keeps only the covered branches where it is on, and is refused when that
   * is none. A row that belongs to no branch (a corporate department, a
   * standalone outlet) stays visible only while the product is on for the
   * whole business, the same rule coverage applies to a limited member.
   */
  private narrowByProduct(
    scope: BranchScope,
    products: readonly ProductId[],
    entitlements: ResolvedWorkspace['facts']['entitlements'],
  ): BranchScope {
    const reach = productReach(entitlements, products, scope.propertyIds);
    const refusal = accessRefusal(
      'product_off',
      `${products.map((p) => PRODUCT_LABEL[p]).join(' or ')} is not switched on here.`,
    );
    if (scope.selectedPropertyId !== null) {
      if (reach.propertyIds.length === 0) throw refusal;
      return scope;
    }
    if (reach.everyBranch) return scope;
    if (reach.propertyIds.length === 0) throw refusal;
    return {
      ...scope,
      propertyIds: reach.propertyIds,
      includesUnbranched: false,
    };
  }

  /** One metadata key, handler over class, as a list (never undefined). */
  private declared(
    key: string,
    targets: Parameters<Reflector['getAllAndOverride']>[1],
  ): readonly Permission[] {
    const value = this.reflector.getAllAndOverride<
      Permission | readonly Permission[] | undefined
    >(key, targets);
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
  }

  private products(
    targets: Parameters<Reflector['getAllAndOverride']>[1],
  ): readonly ProductId[] {
    return (
      this.reflector.getAllAndOverride<readonly ProductId[] | undefined>(
        REQUIRE_PRODUCT,
        targets,
      ) ?? []
    );
  }
}

/**
 * Injects the resolved workspace. Throws when the route forgot the guard,
 * mirroring `@CurrentUser()` so the same class of mistake fails the same way.
 */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ScopedWorkspace => {
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

