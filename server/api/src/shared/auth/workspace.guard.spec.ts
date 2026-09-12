import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { WorkspaceAccess } from '@injishi/contracts';

// The guard only needs the service as a DI token here; every case stubs it.
// Mocked at the module boundary because the real service reaches the vendored
// `@injishi/auth` package, which is ESM and outside what ts-jest transforms.
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

import { WorkspaceGuard } from './workspace.guard';
import type { TwoFactorService } from './two-factor.service';
import type { WorkspaceService } from './workspace.service';

/**
 * The workspace guard is the security boundary (Spec 0004, AC-4 and AC-5).
 *
 * Before it existed the operator app's own checks were the only thing standing
 * between a receptionist and the revenue screen, and those run in the browser.
 * These tests pin the refusals, because a guard that quietly returns true is
 * indistinguishable from no guard at all.
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
  };

  const RECEPTIONIST_ACCESS: WorkspaceAccess = {
    ...OWNER_ACCESS,
    orgRole: 'receptionist',
    permissions: ['stay.checkin'],
  };

  interface FakeRequest {
    headers: Record<string, string | string[] | undefined>;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, string>;
    user?: { id: string; email: string };
    workspace?: WorkspaceAccess;
  }

  function contextFor(request: FakeRequest): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  function guardWith(
    resolved: WorkspaceAccess | null,
    requiredPermission?: string,
  ): { guard: WorkspaceGuard; workspaces: WorkspaceService } {
    const workspaces = {
      resolveForUser: jest.fn().mockResolvedValue(resolved),
    } as unknown as WorkspaceService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredPermission),
    } as unknown as Reflector;
    // The second factor is satisfied in every case here; it has its own spec.
    const twoFactor = {
      assertSatisfied: jest.fn().mockResolvedValue(undefined),
    } as unknown as TwoFactorService;
    return {
      guard: new WorkspaceGuard(workspaces, twoFactor, reflector),
      workspaces,
    };
  }

  const signedIn = { id: 'user-1', email: 'samuel@demo.injishi.rw' };

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
      const { guard } = guardWith(RECEPTIONIST_ACCESS, undefined);
      const context = contextFor({
        headers: { host: 'demo.localhost', 'x-workspace-id': 'ws-owned' },
        user: signedIn,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
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
      expect(workspaces.resolveForUser).not.toHaveBeenCalled();
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
      expect(workspaces.resolveForUser).toHaveBeenCalledWith(
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
      expect(workspaces.resolveForUser).toHaveBeenCalledWith(
        'user-1',
        'ws-in-the-address-bar',
      );
      expect(workspaces.resolveForUser).not.toHaveBeenCalledWith(
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
      expect(workspaces.resolveForUser).toHaveBeenCalledWith(
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
      expect(workspaces.resolveForUser).toHaveBeenCalledWith(
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
      expect(workspaces.resolveForUser).toHaveBeenCalledWith(
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

    expect(request.workspace).toEqual(OWNER_ACCESS);
  });
});
