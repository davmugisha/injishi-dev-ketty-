import { describe, expect, it, vi } from 'vitest';

import {
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { permissionsForRole, REGISTRATION_STAGE_MESSAGE, type WorkspaceAccess } from '@injishi/contracts';

import {
  REQUIRE_ANY_PERMISSION,
  REQUIRE_EVERY_BRANCH,
  REQUIRE_PERMISSION,
  REQUIRE_PRODUCT,
  WorkspaceGuard,
} from './workspace.guard';
import type { TwoFactorService } from './two-factor.service';
import type { WorkspaceService } from './workspace.service';
import type { WorkspaceFacts } from './workspace-facts';

/**
 * The workspace guard is the security boundary (Spec 0004, AC-4 and AC-5).
 *
 * Before it existed the operator app's own checks were the only thing standing
 * between a receptionist and the revenue screen, and those run in the browser.
 * These tests pin the refusals, because a guard that quietly returns true is
 * indistinguishable from no guard at all.
 *
 * Since ADR-076 slice G it resolves the caller's access once (the step-up
 * status and the workspace, together), runs the layers in the contract's
 * order, and names the layer and code of every refusal.
 */
describe('WorkspaceGuard', () => {
  const OWNER_ACCESS: WorkspaceAccess = {
    workspaceId: 'ws-owned',
    kind: 'business',
    orgId: 'org-1',
    orgName: 'Amahoro Hospitality Group',
    domain: 'hospitality',
    orgRole: 'owner',
    registrationStatus: 'active',
    permissions: ['money.view', 'stay.checkin'],
    // The nav sections this business offers (ADR-035, D-a). The guard never
    // reads it — it asks about permissions — but the grant is ONE shape, and a
    // fixture missing a field is a fixture that has already drifted.
    departments: ['rooms', 'fnb'],
    propertyName: 'Kivu Crest Hotel',
    branches: [],
    branchCoverage: 'all',
    psfMembership: { canManage: true },
  };

  const REMERA = '11111111-1111-4111-8111-111111111111';
  const RUBAVU = '22222222-2222-4222-8222-222222222222';

  const RECEPTIONIST_ACCESS: WorkspaceAccess = {
    ...OWNER_ACCESS,
    orgRole: 'receptionist',
    permissions: ['stay.checkin'],
  };

  /** Every product on for the whole business: what the backfill gave every existing hotel. */
  const ALL_ON = ['account', 'marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance', 'pay'].map(
    (productId) => ({ productId, propertyId: null }),
  );

  interface FakeRequest {
    headers: Record<string, string | string[] | undefined>;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, string>;
    user?: { id: string; email: string };
    session?: { id: string };
    workspace?: WorkspaceAccess & { branchScope?: unknown };
    accessContext?: unknown;
  }

  function contextFor(request: FakeRequest): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  interface Wiring {
    requiredPermission?: string | string[];
    anyOfPermissions?: string[];
    everyBranch?: boolean;
    products?: string[];
    entitlements?: { productId: string; propertyId: string | null }[];
    stepUp?: { required: boolean; verified: boolean };
  }

  function guardWith(
    resolved: WorkspaceAccess | null,
    requiredPermission?: string | string[],
    anyOfPermissions?: string[],
    everyBranch?: boolean,
    extra: Omit<Wiring, 'requiredPermission' | 'anyOfPermissions' | 'everyBranch'> = {},
  ): { guard: WorkspaceGuard; workspaces: WorkspaceService; twoFactor: TwoFactorService } {
    // A limited member covers Rubavu only; everyone else covers both.
    const accessFor = vi.fn().mockImplementation(() =>
      Promise.resolve(
        resolved && {
          access: resolved,
          covered:
            resolved.branchCoverage === 'limited'
              ? { coverage: 'limited', propertyIds: [RUBAVU] }
              : { coverage: 'all', propertyIds: [REMERA, RUBAVU] },
          facts: {
            membershipId: resolved.kind === 'business' ? 'membership-1' : null,
            entitlements: extra.entitlements ?? ALL_ON,
          } as unknown as WorkspaceFacts,
        },
      ),
    );
    const workspaces = { accessFor } as unknown as WorkspaceService;
    // Answers per metadata key, the way Nest's reflector does: the all-of and
    // the any-of declarations are two separate keys on the same handler.
    const metadata: Record<string, unknown> = {
      [REQUIRE_PERMISSION]: requiredPermission,
      [REQUIRE_ANY_PERMISSION]: anyOfPermissions,
      [REQUIRE_EVERY_BRANCH]: everyBranch,
      [REQUIRE_PRODUCT]: extra.products,
    };
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => metadata[key]),
    } as unknown as Reflector;
    // The second factor is satisfied unless a case says otherwise.
    const twoFactor = {
      stepUpFor: vi.fn().mockResolvedValue(extra.stepUp ?? { required: true, verified: true }),
    } as unknown as TwoFactorService;
    return {
      guard: new WorkspaceGuard(workspaces, twoFactor, reflector),
      workspaces,
      twoFactor,
    };
  }

  /** The body a refusal sends. */
  async function refusalOf(promise: Promise<unknown>): Promise<Record<string, unknown>> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof HttpException) {
        return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
      }
      throw error;
    }
    throw new Error('expected a refusal');
  }

  const signedIn = { id: 'user-1', email: 'samuel@demo.injishi.com' };

  describe('refuses a workspace the caller does not hold (AC-4)', () => {
    it('throws Forbidden when the workspace resolves to nothing', async () => {
      const { guard } = guardWith(null);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-someone-else' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('gives the same answer whether the workspace is foreign or absent', async () => {
      // A probe must not be able to tell "not yours" from "does not exist".
      const { guard } = guardWith(null);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'does-not-exist' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'That workspace is not available to you.',
      );
    });

    it('refuses when the request names no workspace at all', async () => {
      const { guard } = guardWith(OWNER_ACCESS);
      const context = contextFor({
        headers: { host: 'demo.localhost' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'This request must name the workspace it acts in.',
      );
    });
  });

  describe('refuses a permission the role does not hold', () => {
    it('throws Forbidden and names the missing capability', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'money.view');
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Your role cannot view money in this workspace.',
      );
    });

    it('names the registration stage instead when the org is not active', async () => {
      // The registrant holds owner and every power it implies, and the org is
      // still waiting on RRA. "Your role cannot list units" would send them to
      // fix a role that is already correct (ADR-012, AC-2).
      const pending: WorkspaceAccess = {
        ...OWNER_ACCESS,
        registrationStatus: 'submitted',
        permissions: [],
      };
      const { guard } = guardWith(pending, 'money.view');
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        "We're checking your TIN with RRA. This usually takes seconds.",
      );
    });

    it('still names the capability when the org is active', async () => {
      // The other side of the same branch: an active org with a role that
      // genuinely lacks the power must NOT be told to wait for approval.
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'money.view');
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        /Your role cannot/,
      );
    });

    it('names the capability for a non-business workspace', async () => {
      // Broker and Personal carry no registration status at all. The branch
      // must fall through rather than index a null into the stage table.
      const broker: WorkspaceAccess = {
        workspaceId: 'ws-broker',
        kind: 'broker',
        orgId: null,
        orgName: null,
        domain: null,
        orgRole: null,
        registrationStatus: null,
        permissions: [],
        // A broker runs no departments.
        departments: [],
        propertyName: null,
        branches: [],
        branchCoverage: null,
        psfMembership: null,
      };
      const { guard } = guardWith(broker, 'money.view');
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-broker' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Your role cannot view money in this workspace.',
      );
    });

    it('allows a permission the role does hold', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'stay.checkin');
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('allows any held workspace when the route declares no permission', async () => {
      // Membership alone. The lint rule admits this shape only for a route
      // named in its `allow` option, `POST /me/active-workspace` today.
      const { guard } = guardWith(RECEPTIONIST_ACCESS, undefined);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('lets an undeclared route through for a pending business, which is why it is allowlisted', async () => {
      // Switching into your own pending workspace to watch the pipeline is the
      // one act whose whole check is membership. Everything else declares.
      const pending: WorkspaceAccess = {
        ...OWNER_ACCESS,
        registrationStatus: 'submitted',
        permissions: [],
      };
      const { guard } = guardWith(pending, undefined, undefined);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('all-of: every named permission is required', () => {
    const MANAGER_ACCESS: WorkspaceAccess = {
      ...OWNER_ACCESS,
      orgRole: 'manager',
      permissions: ['stay.checkout', 'folio.close'],
    };

    it('allows a caller holding every one', async () => {
      const { guard } = guardWith(MANAGER_ACCESS, ['stay.checkout', 'folio.close']);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('refuses a caller missing one, naming the one missing', async () => {
      const partial: WorkspaceAccess = {
        ...MANAGER_ACCESS,
        permissions: ['stay.checkout'],
      };
      const { guard } = guardWith(partial, ['stay.checkout', 'folio.close']);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Your role cannot close a bill and sign its receipt in this workspace.',
      );
    });
  });

  describe('finance and hr: a pay run drafted by one, signed by another (ADR-069)', () => {
    // The default sets, resolved by the model itself rather than retyped, so a
    // drift in `ROLE_PERMISSIONS` shows here as a refusal that moved.
    const FINANCE_ACCESS: WorkspaceAccess = {
      ...OWNER_ACCESS,
      orgRole: 'finance',
      permissions: [...permissionsForRole('finance')],
    };
    const HR_ACCESS: WorkspaceAccess = {
      ...OWNER_ACCESS,
      orgRole: 'hr',
      permissions: [...permissionsForRole('hr')],
    };
    const DRAFT = ['payroll.draft', 'payroll.run'];

    function context(): ExecutionContext {
      return contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });
    }

    it('lets hr build a draft', async () => {
      const { guard } = guardWith(HR_ACCESS, undefined, DRAFT);
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses hr the confirm, in the words of the missing power', async () => {
      const { guard } = guardWith(HR_ACCESS, 'payroll.run');
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot confirm the pay run in this workspace.',
      );
    });

    it('refuses finance a draft, worded from the draft permission', async () => {
      const { guard } = guardWith(FINANCE_ACCESS, undefined, DRAFT);
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot draft the pay run in this workspace.',
      );
    });

    it('lets finance read the bookings through money.view (D-d)', async () => {
      const { guard } = guardWith(FINANCE_ACCESS, undefined, [
        'reservation.approve',
        'reservation.assign',
        'stay.checkin',
        'money.view',
      ]);
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses hr the money', async () => {
      const { guard } = guardWith(HR_ACCESS, undefined, ['folio.charge', 'money.view']);
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot add charges to a bill in this workspace.',
      );
    });
  });

  describe('any-of: one of the named permissions is enough (audit H1)', () => {
    const HOUSEKEEPER_ACCESS: WorkspaceAccess = {
      ...OWNER_ACCESS,
      orgRole: 'housekeeper',
      permissions: ['housekeeping.set', 'ticket.advance'],
    };
    const ROOMS_READ = ['stay.checkin', 'housekeeping.set', 'listing.manage'];

    function context(): ExecutionContext {
      return contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });
    }

    it('allows the desk through on the first candidate', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, undefined, ROOMS_READ);
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('allows housekeeping through on a later candidate', async () => {
      const { guard } = guardWith(HOUSEKEEPER_ACCESS, undefined, ROOMS_READ);
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses a role holding none, worded from the first candidate', async () => {
      // A housekeeper reading the rent roll: the read the audit found open.
      const { guard } = guardWith(HOUSEKEEPER_ACCESS, undefined, [
        'rent.record',
        'money.view',
      ]);
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot record rent in this workspace.',
      );
    });

    it('refuses an EMPTY permission set, and names the registration stage', async () => {
      // The registration gate. The owner of a business still at `submitted`
      // holds the role and none of its powers, so no candidate is held.
      const pending: WorkspaceAccess = {
        ...OWNER_ACCESS,
        registrationStatus: 'submitted',
        permissions: [],
      };
      const { guard } = guardWith(pending, undefined, ROOMS_READ);
      await expect(guard.canActivate(context())).rejects.toThrow(
        "We're checking your TIN with RRA. This usually takes seconds.",
      );
    });

    it('refuses an empty set on an active org too, by capability', async () => {
      const nothing: WorkspaceAccess = { ...OWNER_ACCESS, permissions: [] };
      const { guard } = guardWith(nothing, undefined, ROOMS_READ);
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot check guests in in this workspace.',
      );
    });

    it('composes with all-of: both must be satisfied', async () => {
      // Holds an any-of candidate but not the all-of permission.
      const { guard } = guardWith(HOUSEKEEPER_ACCESS, 'money.view', ROOMS_READ);
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Your role cannot view money in this workspace.',
      );

      const both: WorkspaceAccess = {
        ...HOUSEKEEPER_ACCESS,
        permissions: ['housekeeping.set', 'money.view'],
      };
      const { guard: second } = guardWith(both, 'money.view', ROOMS_READ);
      await expect(second.canActivate(context())).resolves.toBe(true);
    });

    it('does not attach the workspace when it refuses', async () => {
      const { guard } = guardWith(HOUSEKEEPER_ACCESS, undefined, ['money.view']);
      const request: FakeRequest = {
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      };
      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        ForbiddenException,
      );
      expect(request.workspace).toBeUndefined();
    });
  });

  describe('fails loudly when it is wired wrong (AC-5)', () => {
    it('throws rather than treating a missing session as anonymous', async () => {
      const { guard } = guardWith(OWNER_ACCESS);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        // no `user`: SessionGuard did not run, or ran after this guard
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('does not consult the workspace service without a session', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow();
      expect(workspaces.accessFor).not.toHaveBeenCalled();
    });
  });

  describe('reads the claimed workspace from every supported place', () => {
    it('prefers the route param (ADR-018, AC-3)', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      await guard.canActivate(
        contextFor({
          headers: { host: 'd', 'x-workspace-id': 'from-header' },
          params: { workspaceId: 'from-param' },
          body: { workspaceId: 'from-body' },
          user: signedIn,
        }),
      );
      expect(workspaces.accessFor).toHaveBeenCalledWith(
        'user-1',
        'from-param',
      );
    });

    /**
     * The disagreement case, and the reason the precedence was flipped.
     *
     * Two tabs on two hotels held by one person: the address bar says one
     * workspace and a stale header says the other. The URL is what the operator
     * can see, so the URL is what the guard resolves and refuses against.
     */
    it('resolves the route param when it disagrees with the header (AC-3)', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      await guard.canActivate(
        contextFor({
          headers: { host: 'd', 'x-workspace-id': 'ws-stale-tab' },
          params: { workspaceId: 'ws-in-the-address-bar' },
          user: signedIn,
        }),
      );
      expect(workspaces.accessFor).toHaveBeenCalledWith(
        'user-1',
        'ws-in-the-address-bar',
      );
      expect(workspaces.accessFor).not.toHaveBeenCalledWith(
        'user-1',
        'ws-stale-tab',
      );
    });

    it('still reads the header when no route param names a workspace', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      await guard.canActivate(
        contextFor({
          headers: { host: 'd', 'x-workspace-id': 'from-header' },
          body: { workspaceId: 'from-body' },
          user: signedIn,
        }),
      );
      expect(workspaces.accessFor).toHaveBeenCalledWith(
        'user-1',
        'from-header',
      );
    });

    it('falls back to the body', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      await guard.canActivate(
        contextFor({
          headers: { host: 'd' },
          body: { workspaceId: 'from-body' },
          user: signedIn,
        }),
      );
      expect(workspaces.accessFor).toHaveBeenCalledWith(
        'user-1',
        'from-body',
      );
    });

    it('falls back to the query string', async () => {
      const { guard, workspaces } = guardWith(OWNER_ACCESS);
      await guard.canActivate(
        contextFor({
          headers: { host: 'd' },
          query: { workspaceId: 'from-query' },
          user: signedIn,
        }),
      );
      expect(workspaces.accessFor).toHaveBeenCalledWith(
        'user-1',
        'from-query',
      );
    });
  });

  it('attaches the resolved workspace for the route to read', async () => {
    const { guard } = guardWith(OWNER_ACCESS);
    const request: FakeRequest = {
      headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
      user: signedIn,
    };

    await guard.canActivate(contextFor(request));

    // With no x-branch-id, every property of the workspace (ADR-054 AC-S2).
    expect(request.workspace).toEqual({
      ...OWNER_ACCESS,
      branchScope: {
        coverage: 'all',
        selectedPropertyId: null,
        propertyIds: [REMERA, RUBAVU],
        includesUnbranched: true,
      },
    });
  });

  describe('the branch in view (ADR-054 AC-S2)', () => {
    const withBranch = (branch: string): FakeRequest => ({
      headers: { host: 'd', 'x-workspace-id': 'ws-owned', 'x-branch-id': branch },
      user: signedIn,
    });

    it('narrows the scope to the one branch the header names', async () => {
      const { guard } = guardWith(OWNER_ACCESS);
      const request = withBranch(RUBAVU);
      await guard.canActivate(contextFor(request));
      expect(request.workspace?.branchScope).toEqual({
        coverage: 'all',
        selectedPropertyId: RUBAVU,
        propertyIds: [RUBAVU],
        includesUnbranched: false,
      });
    });

    it.each([
      ['a malformed id', 'not-a-uuid'],
      ['a branch of another workspace', '33333333-3333-4333-8333-333333333333'],
    ])('answers 404 for %s', async (_label, branch) => {
      const { guard } = guardWith(OWNER_ACCESS);
      await expect(guard.canActivate(contextFor(withBranch(branch)))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('a member limited to some branches (ADR-054 slice 4)', () => {
    const LIMITED_ACCESS: WorkspaceAccess = {
      ...RECEPTIONIST_ACCESS,
      branchCoverage: 'limited',
    };
    const request = (branch?: string): FakeRequest => ({
      headers: {
        host: 'd',
        'x-workspace-id': 'ws-owned',
        ...(branch ? { 'x-branch-id': branch } : {}),
      },
      user: signedIn,
    });

    it('scopes to the covered branches and hides rows of no branch (AC-T2, AC-T3)', async () => {
      const { guard } = guardWith(LIMITED_ACCESS);
      const req = request();
      await guard.canActivate(contextFor(req));
      expect(req.workspace?.branchScope).toEqual({
        coverage: 'limited',
        selectedPropertyId: null,
        propertyIds: [RUBAVU],
        includesUnbranched: false,
      });
    });

    it('answers 404 for a branch of the business it does not cover (AC-S2)', async () => {
      const { guard } = guardWith(LIMITED_ACCESS);
      await expect(guard.canActivate(contextFor(request(REMERA)))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an org wide write with 403 in words (AC-M6)', async () => {
      const { guard } = guardWith(LIMITED_ACCESS, undefined, undefined, true);
      await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
        'This needs access to every branch.',
      );
    });

    it('lets a member covering every branch through the same write', async () => {
      const { guard } = guardWith(OWNER_ACCESS, undefined, undefined, true);
      await expect(guard.canActivate(contextFor(request()))).resolves.toBe(true);
    });
  });

  describe('names the layer and code of every refusal (ADR-076 G11, AC-U3)', () => {
    const at = (headers: Record<string, string> = {}): FakeRequest => ({
      headers: { host: 'd', 'x-workspace-id': 'ws-owned', ...headers },
      user: signedIn,
      session: { id: 'session-1' },
    });

    it('a workspace not held: 403, workspace, workspace_not_available, message unchanged', async () => {
      const { guard } = guardWith(null);
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        status: 403,
        layer: 'workspace',
        code: 'workspace_not_available',
        message: 'That workspace is not available to you.',
      });
    });

    it('no workspace named: 403, workspace, workspace_required', async () => {
      const { guard } = guardWith(OWNER_ACCESS);
      const request = { headers: { host: 'd' }, user: signedIn };
      expect(await refusalOf(guard.canActivate(contextFor(request)))).toMatchObject({
        status: 403,
        layer: 'workspace',
        code: 'workspace_required',
      });
    });

    it('a step-up owed: 403, session, two_factor_required, before the workspace question', async () => {
      const { guard } = guardWith(null, undefined, undefined, undefined, {
        stepUp: { required: true, verified: false },
      });
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        status: 403,
        layer: 'session',
        code: 'two_factor_required',
        message: 'Enter the code we emailed you to continue.',
      });
    });

    it('a branch not covered: 404, scope, not_found', async () => {
      const { guard } = guardWith(OWNER_ACCESS);
      expect(
        await refusalOf(guard.canActivate(contextFor(at({ 'x-branch-id': 'not-a-uuid' })))),
      ).toMatchObject({ status: 404, layer: 'scope', code: 'not_found' });
    });

    it('a missing permission: 403, permission, permission_missing, the same sentence', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'money.view');
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        status: 403,
        layer: 'permission',
        code: 'permission_missing',
        message: 'Your role cannot view money in this workspace.',
      });
    });

    it('a business still in the pipeline: 403, operational, registration_stage, the stage in words', async () => {
      const pending: WorkspaceAccess = { ...OWNER_ACCESS, registrationStatus: 'tin_verified', permissions: [] };
      const { guard } = guardWith(pending, 'money.view');
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        status: 403,
        layer: 'operational',
        code: 'registration_stage',
        // The stage in the words the contract gives it, whatever ADR-075 makes of that stage.
        message: REGISTRATION_STAGE_MESSAGE.tin_verified,
      });
    });

    it('a suspended business: 403, operational, suspended', async () => {
      const suspended: WorkspaceAccess = { ...OWNER_ACCESS, registrationStatus: 'suspended', permissions: [] };
      const { guard } = guardWith(suspended, undefined, ['stay.checkin']);
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        layer: 'operational',
        code: 'suspended',
      });
    });

    it('an org wide write by a limited member: 403, scope, out_of_scope', async () => {
      const limited: WorkspaceAccess = { ...RECEPTIONIST_ACCESS, branchCoverage: 'limited' };
      const { guard } = guardWith(limited, undefined, undefined, true);
      expect(await refusalOf(guard.canActivate(contextFor(at())))).toMatchObject({
        status: 403,
        layer: 'scope',
        code: 'out_of_scope',
        message: 'This needs access to every branch.',
      });
    });

    it('checks the branch before the permission, so a bad branch is a 404 whatever the role lacks', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'money.view');
      expect(
        await refusalOf(guard.canActivate(contextFor(at({ 'x-branch-id': 'not-a-uuid' })))),
      ).toMatchObject({ status: 404, layer: 'scope' });
    });
  });

  describe('the route product (ADR-076 G9, A-3)', () => {
    const at = (branch?: string, access: WorkspaceAccess = OWNER_ACCESS): { request: FakeRequest } => ({
      request: {
        headers: {
          host: 'd',
          'x-workspace-id': access.workspaceId,
          ...(branch ? { 'x-branch-id': branch } : {}),
        },
        user: signedIn,
      },
    });
    const PMS_AT_RUBAVU = [
      { productId: 'account', propertyId: null },
      { productId: 'pms', propertyId: RUBAVU },
    ];

    it('passes when the product is on for the whole business, and leaves the scope as coverage made it', async () => {
      const { guard } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, { products: ['pms'] });
      const { request } = at();
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.workspace?.branchScope).toEqual({
        coverage: 'all',
        selectedPropertyId: null,
        propertyIds: [REMERA, RUBAVU],
        includesUnbranched: true,
      });
    });

    it('refuses 403, entitlement, product_off when the product is off everywhere', async () => {
      const { guard } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, {
        products: ['pms'],
        entitlements: [{ productId: 'account', propertyId: null }],
      });
      expect(await refusalOf(guard.canActivate(contextFor(at().request)))).toMatchObject({
        status: 403,
        layer: 'entitlement',
        code: 'product_off',
      });
    });

    it('with no branch named, narrows to the covered branches where it is on, and hides rows of no branch', async () => {
      const { guard } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, {
        products: ['pms'],
        entitlements: PMS_AT_RUBAVU,
      });
      const { request } = at();
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.workspace?.branchScope).toEqual({
        coverage: 'all',
        selectedPropertyId: null,
        propertyIds: [RUBAVU],
        includesUnbranched: false,
      });
    });

    it('refuses a named branch where it is off, and passes one where it is on', async () => {
      const wiring = { products: ['pms'], entitlements: PMS_AT_RUBAVU };
      const { guard } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, wiring);
      expect(await refusalOf(guard.canActivate(contextFor(at(REMERA).request)))).toMatchObject({
        code: 'product_off',
      });
      await expect(guard.canActivate(contextFor(at(RUBAVU).request))).resolves.toBe(true);
    });

    it('answers a branch the member does not cover with 404 before asking about the product', async () => {
      // The limited member covers Rubavu only; POS is off at Remera. A probe of
      // Remera must learn nothing about Remera, including that POS is off there.
      const limited: WorkspaceAccess = { ...RECEPTIONIST_ACCESS, branchCoverage: 'limited' };
      const { guard } = guardWith(limited, 'stay.checkin', undefined, undefined, {
        products: ['pos'],
        entitlements: [{ productId: 'pos', propertyId: RUBAVU }],
      });
      expect(await refusalOf(guard.canActivate(contextFor(at(REMERA, limited).request)))).toMatchObject({
        status: 404,
        layer: 'scope',
      });
    });

    it('refuses a limited member whose branches all have the product off, though another branch has it', async () => {
      const limited: WorkspaceAccess = { ...RECEPTIONIST_ACCESS, branchCoverage: 'limited' };
      const { guard } = guardWith(limited, 'stay.checkin', undefined, undefined, {
        products: ['pos'],
        entitlements: [{ productId: 'pos', propertyId: REMERA }],
      });
      expect(await refusalOf(guard.canActivate(contextFor(at(undefined, limited).request)))).toMatchObject({
        code: 'product_off',
      });
    });

    it('a platform capability route is on wherever any of its products is', async () => {
      const { guard } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, {
        products: ['pms', 'residence', 'outlets'],
        entitlements: [{ productId: 'outlets', propertyId: null }],
      });
      await expect(guard.canActivate(contextFor(at().request))).resolves.toBe(true);
    });

    it('never grants: a product on with the permission missing is still refused by permission', async () => {
      const { guard } = guardWith(RECEPTIONIST_ACCESS, 'money.view', undefined, undefined, { products: ['finance'] });
      expect(await refusalOf(guard.canActivate(contextFor(at().request)))).toMatchObject({
        layer: 'permission',
      });
    });

    it('a broker workspace on a product route is refused by permission, as before', async () => {
      const broker: WorkspaceAccess = {
        ...OWNER_ACCESS,
        workspaceId: 'ws-broker',
        kind: 'broker',
        orgId: null,
        orgName: null,
        domain: null,
        orgRole: null,
        registrationStatus: null,
        permissions: [],
        departments: [],
        propertyName: null,
        branchCoverage: null,
        psfMembership: null,
      };
      const { guard } = guardWith(broker, 'stay.checkin', undefined, undefined, { products: ['pms'] });
      expect(await refusalOf(guard.canActivate(contextFor(at(undefined, broker).request)))).toMatchObject({
        layer: 'permission',
        code: 'permission_missing',
      });
    });
  });

  describe('one resolution per request (ADR-076 A-17, G17)', () => {
    it('asks for the step-up status and the workspace once each, and never again', async () => {
      const { guard, workspaces, twoFactor } = guardWith(OWNER_ACCESS, 'stay.checkin', undefined, undefined, {
        products: ['pms'],
      });
      const request: FakeRequest = {
        headers: { host: 'd', 'x-workspace-id': 'ws-owned', 'x-branch-id': RUBAVU },
        user: signedIn,
        session: { id: 'session-1' },
      };
      await guard.canActivate(contextFor(request));
      expect(workspaces.accessFor).toHaveBeenCalledTimes(1);
      expect(twoFactor.stepUpFor).toHaveBeenCalledTimes(1);
    });

    it('leaves who acted, and under what grant, on the request for the audit row', async () => {
      const limited: WorkspaceAccess = { ...RECEPTIONIST_ACCESS, branchCoverage: 'limited' };
      const { guard } = guardWith(limited, undefined, ['stay.checkin', 'money.view']);
      const request: FakeRequest = {
        headers: { host: 'd', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      };
      await guard.canActivate(contextFor(request));
      expect(request.accessContext).toEqual({
        actorUserId: 'user-1',
        actorMembershipId: 'membership-1',
        grantFamily: 'business',
        roleKeys: ['receptionist'],
        // Only what the route was granted on, under the new names.
        permissions: ['pms.stay.checkin'],
        scope: [{ kind: 'branch', ids: [RUBAVU] }],
        deviceId: null,
        deviceUserSessionId: null,
        overrideByMembershipId: null,
      });
    });
  });
});
