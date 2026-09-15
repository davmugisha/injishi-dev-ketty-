/**
 * The seats a test renders against, as `GET /api/v1/me/workspaces` answers them.
 *
 * ADR-038 child 0 task 8 deleted `WORKSPACES` from `src/data/personas.ts`. The
 * active workspace and the seat count now come from the server, which means a
 * screen test that draws an eyebrow, a role line or a workspace count needs a
 * server answer to draw it from.
 *
 * This is that answer, in one place. Five surface children still have to be
 * cut over (ADR-038 children 1 to 7) and every one of them will need the same
 * five seats, so a copy per suite would be five copies drifting apart.
 *
 * **The roster mirrors `seed-demo.mjs`**: Samuel's five seats, one of them the
 * parked Host. A reader comparing a failing test against a demo on a device
 * should be looking at the same names.
 *
 * ## How to use it
 *
 * `jest.mock` factories may only close over names beginning with `mock`, and
 * they are hoisted above the imports, so the module is pulled in from inside
 * the factory:
 *
 * ```ts
 * let mockSurface: Surface = 'work';
 *
 * jest.mock('@/workspace', () => {
 *   const { workspaceStateFor } = jest.requireActual('@/test-seats');
 *   const state = () => workspaceStateFor(mockSurface);
 *   return { useWorkspace: state, useOptionalWorkspace: state };
 * });
 * ```
 *
 * Both accessors have to be supplied. `DomainProvider` reads the optional form
 * and the screens read the throwing one, so a mock giving only one leaves the
 * provider above every screen holding `undefined` and crashes on mount rather
 * than failing on an assertion.
 */
import type { WorkspaceAccess } from '@injishi/contracts';
import type { Surface } from '@/data/rentals';

/** A `WorkspaceAccess` plus the `label` the controller adds, and its surface. */
export type SeatRow = WorkspaceAccess & { label: string; surface: Surface };

const base: Omit<WorkspaceAccess, 'workspaceId' | 'kind'> = {
  orgId: null,
  orgName: null,
  domain: null,
  orgRole: null,
  permissions: [],
  propertyName: null,
  // Both carried by `WorkspaceAccess` and both irrelevant to what these suites
  // assert, so they are present and empty rather than omitted: the type is what
  // catches a screen reading a field the server does not send.
  departments: [],
  registrationStatus: null,
  branches: [],
  branchCoverage: null,
};

/** Samuel's five seats, in switcher order. */
export const SEATS: SeatRow[] = [
  {
    ...base,
    workspaceId: 'ws-personal',
    kind: 'personal',
    label: 'Personal',
    surface: 'tenant',
  },
  {
    ...base,
    workspaceId: 'ws-kayitare-court',
    kind: 'business',
    domain: 'residence',
    orgRole: 'owner',
    orgId: 'org-kayitare',
    orgName: 'Kayitare Court',
    propertyName: 'Kayitare Court',
    label: 'Kayitare Court',
    surface: 'landlord',
  },
  {
    ...base,
    workspaceId: 'ws-aline-brokerage',
    kind: 'broker',
    domain: 'residence',
    orgId: 'org-aline',
    orgName: 'Aline K. Brokerage',
    label: 'Aline K. Brokerage',
    surface: 'broker',
  },
  {
    ...base,
    workspaceId: 'ws-kivu-crest',
    kind: 'business',
    domain: 'hospitality',
    orgRole: 'housekeeper',
    orgId: 'org-amahoro',
    orgName: 'Kivu Crest Hotel',
    propertyName: 'Kivu Crest Hotel',
    label: 'Kivu Crest Hotel',
    surface: 'work',
  },
  {
    // Parked (parent Follow-up): built, reachable, never offered in the
    // switcher. Its surface is derived — a hospitality business seat whose role
    // is not housekeeper — rather than read off a flag.
    ...base,
    workspaceId: 'ws-umurage',
    kind: 'business',
    domain: 'hospitality',
    orgRole: 'manager',
    orgId: 'org-umurage',
    orgName: 'Umurage Guesthouse',
    propertyName: 'Umurage Guesthouse',
    label: 'Umurage Guesthouse',
    surface: 'host',
  },
] as SeatRow[];

/** The seat a surface opens. Guest and Tenant are one Personal workspace. */
export function seatFor(surface: Surface): SeatRow {
  const wanted = surface === 'guest' ? 'tenant' : surface;
  return SEATS.find((s) => s.surface === wanted) ?? SEATS[0];
}

/**
 * A whole `WorkspaceState`, with the seat for `surface` active.
 *
 * `twoFactor` is reported satisfied, because a step-up screen standing in front
 * of every operator suite would be testing the gate rather than the screen. The
 * gate has its own tests.
 */
export function workspaceStateFor(surface: Surface) {
  const active = seatFor(surface);
  return {
    workspaces: SEATS,
    active,
    activeWorkspaceId: active.workspaceId,
    permissions: active.permissions,
    twoFactor: { required: false, verified: true },
    isResolving: false,
    error: null,
    switchTo: jest.fn(async () => true),
    refetch: jest.fn(),
  };
}
