/**
 * The reads and writes behind Account's sheets and screens.
 *
 * Two kinds live here, and the difference is the point:
 *
 *   - **Real reads.** `useTwoFactorState` is `GET /api/v1/me/two-factor`, the
 *     route the step-up screen already calls.
 *   - **Fixture state** for the screens still waiting on their reads (staff,
 *     and the devices list Security no longer draws). Decision D9: every local
 *     write goes through `useFixtureMutation`, so the swap to TanStack Query
 *     later is a hook change per screen rather than a rewrite of the surface,
 *     and the `apply` functions are pure because they are the only description
 *     of the change.
 *
 * Personal details used to keep a third kind: a fixture store seeded from the
 * `ME` persona, with Samuel Kayitare's name and his email `samuel@kayitare.rw`
 * as its starting values, which every edit "saved" into and the server never
 * heard about (mobile audit 2026-10-05, SA-01 and SA-14). That store is gone;
 * the screen reads `GET /api/v1/me/profile` and nothing else. `publicForm` is
 * all that is left of it, because it is a rule about a name rather than a store.
 */
import { useQuery } from '@tanstack/react-query';
import { useFixture, type FixtureResult } from '@/data/use-fixture';
import { useFixtureMutation, type FixtureMutation } from '@/data/use-fixture-mutation';
import { api, unwrap } from '@/lib/api';
import { ENDPOINTS } from '@/lib/endpoints';
import { meKeys } from '@/lib/query-keys';
import { useOptionalSession } from '@/session';
import {
  SESSIONS,
  SESSIONS_KEY,
  STAFF,
  STAFF_KEY,
  type DeviceSession,
  type StaffMember,
} from './account-fixtures';

/* ------------------------------------------------------------ two-factor -- */

/**
 * What `GET /api/v1/me/two-factor` answers (`two-factor.controller.ts`).
 *
 * The same shape the step-up screen reads, under the same cache key, so a code
 * verified there refreshes what Security and Account show without a second
 * definition of the route.
 */
export interface TwoFactorState {
  /** Does this person need the emailed step-up at all? Operators and brokers do. */
  required: boolean;
  /** Has THIS session passed it? Signing in with an emailed code counts. */
  verified: boolean;
  /** Where a code would go, already masked by the server. Never unmasked here. */
  sentTo: string;
}

export function fetchTwoFactorState(signal?: AbortSignal): Promise<TwoFactorState> {
  return unwrap(api<TwoFactorState>(ENDPOINTS.meTwoFactor, { signal }));
}

/**
 * The step-up state, read only.
 *
 * It replaced a fixture switch seeded "on" for everyone, whose toggle flipped
 * the fixture and toasted success (mobile audit 2026-10-05, SA-06). The server
 * has no switch: whether the step-up applies follows from the workspaces a
 * person holds, so the app reports it and offers nothing to change.
 *
 * Gated on the session through the OPTIONAL hook, for the reason
 * `useMyIdentity` gives: a `/me/` call without a session earns a 401, and a 401
 * signs the phone out.
 */
export function useTwoFactorState() {
  const session = useOptionalSession();
  return useQuery({
    queryKey: meKeys.twoFactor(),
    queryFn: ({ signal }) => fetchTwoFactorState(signal),
    enabled: session?.status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

/* -------------------------------------------------------------- sessions -- */

/*
 * Not drawn. Security listed these invented devices, and its sign out buttons
 * only edited them (SA-06). They stay as the shape the real list will take, from
 * Better Auth's `list-sessions`, `revoke-session` and `revoke-other-sessions`,
 * because the rule in `applySessionChange` is one that list will need as well.
 */

export type SessionChange =
  | { kind: 'revoke'; id: string }
  /** F-S12 §6 "sign out everywhere": every session but the one asking. */
  | { kind: 'revoke_others' };

export function applySessionChange(
  current: DeviceSession[],
  change: SessionChange,
): DeviceSession[] {
  if (change.kind === 'revoke_others') return current.filter((s) => s.current);
  // The current device is never revocable from this list. Signing the phone in
  // your hand out from a row labelled "this device" is a control that looks
  // like a mistake even when it is not one; `Sign out` is where that lives.
  return current.filter((s) => s.id !== change.id || s.current);
}

export function useSessions(): FixtureResult<DeviceSession[]> {
  return useFixture<DeviceSession[]>(SESSIONS_KEY, () => SESSIONS);
}

export function useSessionMutation(): FixtureMutation<SessionChange> {
  return useFixtureMutation<DeviceSession[], SessionChange>(
    SESSIONS_KEY,
    applySessionChange,
    () => SESSIONS,
  );
}

/* ----------------------------------------------------------------- staff -- */

export type StaffChange =
  | { kind: 'resend'; id: string }
  | { kind: 'revoke'; id: string }
  | { kind: 'restore'; id: string }
  | { kind: 'invite'; name: string; phone: string };

/**
 * Resending an invitation does not change the row, and that is deliberate
 * rather than an omission: the state is still `invited`, the person still has
 * not accepted, and a row that moved would be telling the reader something had
 * happened at the other end. The toast is what says the message went.
 */
export function applyStaffChange(current: StaffMember[], change: StaffChange): StaffMember[] {
  switch (change.kind) {
    case 'resend':
      return current;
    case 'revoke':
      return current.map((m) => (m.id === change.id ? { ...m, state: 'suspended' } : m));
    case 'restore':
      return current.map((m) => (m.id === change.id ? { ...m, state: 'active' } : m));
    case 'invite':
      return [
        ...current,
        {
          id: `st-${current.length + 1}-${change.phone.slice(-4)}`,
          name: change.name,
          roleKey: 'staff.roleCaretaker',
          state: 'invited',
          since: new Date().toISOString().slice(0, 10),
          phone: change.phone,
        },
      ];
  }
}

export function useStaff(): FixtureResult<StaffMember[]> {
  return useFixture<StaffMember[]>(STAFF_KEY, () => STAFF);
}

export function useStaffMutation(): FixtureMutation<StaffChange> {
  return useFixtureMutation<StaffMember[], StaffChange>(STAFF_KEY, applyStaffChange, () => STAFF);
}

/* ------------------------------------------------------- personal details -- */

/**
 * `Claudine Uwase` → `Claudine U.` — F-S12 §6's rule as one function.
 *
 * Personal details prints it beside the name the server holds, because a rule
 * nobody can check is a rule nobody believes. It is derived rather than stored,
 * so it cannot fall out of step with the name it comes from.
 *
 * One name gets no initial and no full stop. Session 11's own test caught that:
 * the first version appended `${last?.[0] ?? ''}.` and trimmed, which turns
 * "Eric" into "Eric ." — a stray full stop standing in for a surname somebody
 * does not have. Mononyms are ordinary here, so this is a case rather than an
 * edge case.
 */
export function publicForm(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
