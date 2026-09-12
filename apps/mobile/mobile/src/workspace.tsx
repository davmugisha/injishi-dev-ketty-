/**
 * The workspaces a person holds, which one they are acting in, and the switch.
 *
 * ADR-038 child 0 task 8. This is the file that ends `src/data/personas.ts`'s
 * `WORKSPACES` constant: the seats are whatever `GET /api/v1/me/workspaces`
 * says they are, so a seat that was revoked is gone on the next launch and a
 * seat that was granted appears without shipping a build.
 *
 * **Authorization stays on the server** (ADR-012 AC-4, umbrella AC-6). Nothing
 * here computes a permission. `permissions` arrives resolved on each
 * `WorkspaceAccess` and the app renders from that list; `can()` and
 * `permissionsForRole()` are never imported into `apps/mobile`.
 *
 * **Surface derivation is a client concern and is presentation, not
 * authorization.** The server answers what a person HOLDS; mapping that to a
 * tab set is the app's job, it lives in `surfaceFor()` in `domain.tsx`, and it
 * does not breach AC-6 because nothing is being decided about access.
 */
import type { WorkspaceAccess } from '@injishi/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, setActiveWorkspaceId, unwrap, type ApiResult } from './lib/api';
import { ENDPOINTS } from './lib/endpoints';
import { meKeys } from './lib/query-keys';
import { useSession } from './session';

/**
 * A workspace as the API returns it: the contract's `WorkspaceAccess` plus the
 * one field the controller adds.
 *
 * `label` is the server's own name for the row — `orgName` for a business or
 * broker seat and the literal `Personal` otherwise. Taking it from the server
 * rather than re-deriving it here keeps the switcher and any other list of
 * workspaces reading the same words.
 */
export type WorkspaceRow = WorkspaceAccess & { label: string };

/** Whether the emailed step up is owed, exactly as the server reports it. */
export interface TwoFactorStatus {
  required: boolean;
  /**
   * The server calls this `verified`, not `satisfied`.
   *
   * ADR-038's value sourcing table says `satisfied`; the shape on the wire is
   * `{ required, verified }` (`two-factor.controller.ts`). Task 10 asked for
   * the real shape to be confirmed rather than assumed, and this is it. The
   * spec's table is owed the correction.
   */
  verified: boolean;
}

interface MeWorkspacesResponse {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string | null;
  twoFactor: TwoFactorStatus;
}

export interface WorkspaceState {
  /** Every workspace the person holds. Exactly what the server returned. */
  workspaces: WorkspaceRow[];
  /** The one being acted in, or null while it is still resolving. */
  active: WorkspaceRow | null;
  activeWorkspaceId: string | null;
  /** The active workspace's resolved permissions. Never computed here. */
  permissions: string[];
  twoFactor: TwoFactorStatus;
  /** True until the first answer lands. Nothing workspace scoped may fire yet. */
  isResolving: boolean;
  /** Set when the list could not be fetched at all. */
  error: unknown;
  /** Switch, server first. Resolves to whether it took. */
  switchTo: (workspaceId: string) => Promise<boolean>;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

function fetchWorkspaces(signal?: AbortSignal): Promise<MeWorkspacesResponse> {
  // A `/me/` route, so `api.ts` sends no workspace header — which is correct
  // and also necessary: this is the call that discovers what the header may be.
  return unwrap(api<MeWorkspacesResponse>(ENDPOINTS.meWorkspaces, { signal }));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { status } = useSession();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: meKeys.workspaces(),
    queryFn: ({ signal }) => fetchWorkspaces(signal),
    // Nobody signed in has no workspaces to fetch. Asking anyway would spend a
    // round trip to be told 401 and would trip the signed-out path on a person
    // who is merely on the sign in screen.
    enabled: status === 'authenticated',
    // The seats a person holds change rarely, and re-asking on every screen
    // focus would put a round trip in front of every navigation.
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Which workspace we are acting in.
   *
   * Held locally as well as read from the server because a switch has to take
   * effect immediately after `POST /me/active-workspace` succeeds, without
   * waiting for the list to be refetched.
   */
  const [chosenId, setChosenId] = useState<string | null>(null);

  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);

  /**
   * The active workspace.
   *
   * Falls back to the server's `activeWorkspaceId`, then to the first row. The
   * fallback matters: a person signing in for the first time has no active
   * workspace on the server, and with no fallback every workspace scoped query
   * would stay disabled forever and every operator screen would sit empty.
   */
  const active = useMemo(() => {
    if (workspaces.length === 0) return null;
    const wanted = chosenId ?? data?.activeWorkspaceId ?? null;
    return (
      workspaces.find((w) => w.workspaceId === wanted) ?? workspaces[0] ?? null
    );
  }, [workspaces, chosenId, data?.activeWorkspaceId]);

  const activeWorkspaceId = active?.workspaceId ?? null;

  /**
   * Keep `api.ts` in step.
   *
   * `api.ts` attaches `x-workspace-id` from module state, because query
   * functions are plain functions outside the React tree and cannot read
   * context. This effect is the ONLY writer of that state.
   */
  useEffect(() => {
    setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const switchTo = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      if (workspaceId === activeWorkspaceId) return true;

      // The server is asked FIRST and the app moves only on success (AC-S6).
      // Moving optimistically would show a workspace the server has not agreed
      // to, and an unreachable server would leave the two disagreeing about
      // which workspace this person is in.
      // No `x-workspace-id` is attached: this is a `/me/` route, so `api.ts`
      // leaves the header off, and `WorkspaceGuard` falls through to the
      // `workspaceId` in the BODY. That is the workspace being entered, and the
      // guard refuses it outright when the caller does not hold that seat — so
      // the authorization is the server's, on the workspace being asked for.
      const answer: ApiResult<unknown> = await api(ENDPOINTS.meActiveWorkspace, {
        method: 'POST',
        body: { workspaceId },
      });

      if (answer.status !== 'ok') return false;

      // Rows cached under the previous workspace can never surface under the
      // new one, because every workspace scoped key BEGINS with the workspace
      // id (`query-keys.ts`). The switch changes the key, so the new workspace
      // reads its own cache or fetches. Nothing is cleared and nothing leaks.
      setChosenId(workspaceId);
      setActiveWorkspaceId(workspaceId);
      void queryClient.invalidateQueries({ queryKey: meKeys.workspaces() });
      return true;
    },
    [activeWorkspaceId, queryClient],
  );

  const value = useMemo<WorkspaceState>(
    () => ({
      workspaces,
      active,
      activeWorkspaceId,
      permissions: active?.permissions ?? [],
      twoFactor: data?.twoFactor ?? { required: false, verified: false },
      isResolving: status === 'authenticated' && isPending,
      error,
      switchTo,
      refetch: () => void refetch(),
    }),
    [
      workspaces,
      active,
      activeWorkspaceId,
      data?.twoFactor,
      isPending,
      status,
      error,
      switchTo,
      refetch,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}

/**
 * The workspace state, or `null` when there is no provider above.
 *
 * `DomainProvider` is the one caller, and it needs this rather than the
 * throwing form for a reason that is about honesty rather than convenience: the
 * absence of a workspace provider and the window before the first
 * `/me/workspaces` answer are the SAME state as far as the domain is concerned
 * — nothing has resolved, so draw the stored surface and no org name. It
 * already models that state, so having it throw instead would be turning one
 * legitimate condition into a crash.
 *
 * It also keeps `DomainProvider` mountable on its own, which is what lets a
 * screen test render one screen rather than the whole provider stack.
 */
export function useOptionalWorkspace(): WorkspaceState | null {
  return useContext(WorkspaceContext);
}

/**
 * Does the active workspace carry this permission?
 *
 * A read of the server's answer, never a computation of one. It exists so a
 * screen asks the question in one place rather than reaching into the array.
 */
export function useMayI(permission: string): boolean {
  const { permissions } = useWorkspace();
  return permissions.includes(permission);
}
