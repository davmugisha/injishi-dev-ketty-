"use client";

/**
 * The server state cache (ADR-012, D-i).
 *
 * One query matters more than the rest: `me.workspaces`. It is the answer to
 * "what may I do here", and every control in the app renders from it. A stale
 * answer is not a cosmetic problem — it is an enabled button the server will
 * refuse, which reads to an operator as the app being broken.
 *
 * So this file owns the three triggers that bound how stale that answer can
 * get. They are the whole of AC-15, and they live together on purpose:
 *
 *  1. Any 403 from any call invalidates it at once. The server refusing IS the
 *     signal that our picture is out of date, and it is the only signal that
 *     arrives the instant the truth changes.
 *  2. `refetchOnWindowFocus`, so an operator coming back to the tab gets a
 *     fresh answer before touching anything.
 *  3. `staleTime` of 60 seconds, so the worst case with no interaction at all
 *     is one minute.
 *
 * This does not make the client a boundary. `WorkspaceGuard` is the boundary.
 * It keeps the client's picture close enough that the operator is not lied to.
 */

import {
  MutationCache,
  QueryCache,
  QueryClient,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { PlatformInfo } from "@injishi/contracts";

import { isForbidden } from "./api";
import { fetchMyWorkspaces, type MeState } from "./me";
import { fetchPlatform } from "./platform";

/** Every key in one place, so an invalidation can never miss by a typo. */
export const queryKeys = {
  meWorkspaces: ["me", "workspaces"] as const,
  /** Which platform the API is (ADR-043). Public, the same for everybody. */
  platform: ["platform"] as const,
  /**
   * The signed-in person's own profile. NOT keyed by workspace: a person is
   * the same person in every workspace they hold, and keying it per workspace
   * would refetch the same name on every switch.
   */
  meProfile: ["me", "profile"] as const,
  /**
   * Keyed BY workspace, not global. An operator holding two properties must
   * never see one desk's reservations while the switcher says the other, and a
   * shared key would show exactly that for the moment before the refetch lands.
   */
  reservations: (workspaceId: string | null) =>
    ["ops", "reservations", workspaceId] as const,
  rooms: (workspaceId: string | null) => ["ops", "rooms", workspaceId] as const,
  /**
   * Every live room hold, per workspace. The windowed key below extends this
   * one, so invalidating the base reaches every window a screen has open.
   */
  roomAssignments: (workspaceId: string | null) =>
    ["ops", "room-assignments", workspaceId] as const,
  roomAssignmentWindow: (workspaceId: string | null, from: string, to: string) =>
    ["ops", "room-assignments", workspaceId, from, to] as const,
  stays: (workspaceId: string | null) => ["ops", "stays", workspaceId] as const,
  /**
   * The cleaning board, kept apart from `rooms` on purpose. A task and a room
   * status are two different facts served by two endpoints; one key for both
   * would refetch the wrong one and leave the other stale.
   */
  housekeepingTasks: (workspaceId: string | null) =>
    ["ops", "housekeeping-tasks", workspaceId] as const,
  threads: (workspaceId: string | null) => ["ops", "threads", workspaceId] as const,
  threadMessages: (workspaceId: string | null, threadId: string | null) =>
    ["ops", "threads", workspaceId, threadId, "messages"] as const,
  leases: (workspaceId: string | null) => ["ops", "leases", workspaceId] as const,
  rentRoll: (workspaceId: string | null) => ["ops", "rent-roll", workspaceId] as const,
  deposits: (workspaceId: string | null) => ["ops", "deposits", workspaceId] as const,
  tickets: (workspaceId: string | null) => ["ops", "tickets", workspaceId] as const,
  team: (workspaceId: string | null) => ["ops", "team", workspaceId] as const,
  departments: (workspaceId: string | null) =>
    ["ops", "departments", workspaceId] as const,
  /**
   * Inventory, not `ops`. Setup rather than today's work, and gated on
   * `listing.manage` rather than on an operational permission.
   */
  properties: (workspaceId: string | null) =>
    ["inventory", "properties", workspaceId] as const,
  ratePlans: (workspaceId: string | null) =>
    ["inventory", "rate-plans", workspaceId] as const,
  property: (workspaceId: string | null, propertyId: string | null) =>
    ["inventory", "properties", workspaceId, propertyId] as const,
  /** Under the property key, so a write that invalidates the property refreshes these too. */
  roomTypes: (workspaceId: string | null, propertyId: string | null) =>
    ["inventory", "properties", workspaceId, propertyId, "room-types"] as const,
  /** The rooms behind one room type. Under `inventory`, so any inventory write refreshes them. */
  inventoryRooms: (workspaceId: string | null, roomTypeId: string | null) =>
    ["inventory", "rooms", workspaceId, roomTypeId] as const,
  /** The setup checklist's counts (setup after approval, 2026-09-13). */
  setupProgress: (workspaceId: string | null, propertyId: string | null) =>
    ["inventory", "setup", workspaceId, propertyId] as const,
  /** Staff invitations. `team.manage`, like the roster beside it. */
  staffInvitations: (workspaceId: string | null) =>
    ["ops", "team", workspaceId, "invitations"] as const,
  folios: (workspaceId: string | null) => ["ops", "folios", workspaceId] as const,
  folio: (workspaceId: string | null, folioId: string | null) =>
    ["ops", "folios", workspaceId, folioId] as const,
  /** One month of departmental revenue. `money.view`, not `folio.charge`. */
  revenue: (workspaceId: string | null, month: string | null) =>
    ["ops", "revenue", workspaceId, month] as const,
  serviceCatalog: (workspaceId: string | null) =>
    ["ops", "service-catalog", workspaceId] as const,
  /** RRA's classification list, by search term (ADR-050 D-m). */
  rraClassifications: (workspaceId: string | null, q: string) =>
    ["ops", "rra-classifications", workspaceId, q] as const,
  serviceOrders: (workspaceId: string | null) =>
    ["ops", "service-orders", workspaceId] as const,
  /** Keyed by PROPERTY as well: a workspace can hold several. */
  amenities: (workspaceId: string | null, propertyId: string | null) =>
    ["ops", "amenities", workspaceId, propertyId] as const,
  /**
   * The business's RRA EBM account (ADR-041). The catalog and customer keys
   * extend the connection key, so invalidating the connection — a reconnect, a
   * disconnect — also drops pickers read under the old authorisation.
   */
  ebmConnection: (workspaceId: string | null) => ["ops", "ebm", workspaceId] as const,
  ebmItems: (workspaceId: string | null) => ["ops", "ebm", workspaceId, "items"] as const,
  ebmCustomers: (workspaceId: string | null) =>
    ["ops", "ebm", workspaceId, "customers"] as const,
};

/** Trigger 3. Long enough to be a cache, short enough to bound a revocation. */
const CAPABILITY_STALE_MS = 60_000;

/**
 * The client, built fresh per browser session.
 *
 * `client` is assigned after the caches are constructed because their handlers
 * need it, and a cache cannot be handed a client that does not exist yet. This
 * is the ordinary way to wire a global handler that invalidates.
 */
export function makeQueryClient(): QueryClient {
  let client: QueryClient | null = null;

  /** Trigger 1, for a command. */
  const mutationCache = new MutationCache({
    onError: (error) => {
      if (isForbidden(error)) {
        void client?.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
      }
    },
  });

  /** Trigger 1 again, for a read that the server refuses. Same rule. */
  const queryCache = new QueryCache({
    onError: (error) => {
      if (isForbidden(error)) {
        void client?.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
      }
    },
  });

  client = new QueryClient({
    mutationCache,
    queryCache,
    defaultOptions: {
      queries: {
        staleTime: CAPABILITY_STALE_MS,
        // Off by default across the app: a room grid refetching every time the
        // window regains focus is noise. `me.workspaces` turns it back on for
        // itself, because there it is the point (trigger 2).
        refetchOnWindowFocus: false,
        // A refusal is an answer. Retrying it wastes a round trip and delays
        // the moment the operator is told what actually happened.
        retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
      },
    },
  });

  return client;
}

/**
 * Who this person is and what they may do, per workspace.
 *
 * Never throws and never rejects: `fetchMyWorkspaces` settles into a `status`
 * instead, so "the API could not be reached" arrives as data rather than as an
 * error. That distinction is AC-13, and it is the reason this query has no
 * error branch — a network blip must never be rendered as "you have no access".
 */
export function useMyWorkspaces(): UseQueryResult<MeState> {
  return useQuery({
    queryKey: queryKeys.meWorkspaces,
    queryFn: fetchMyWorkspaces,
    staleTime: CAPABILITY_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Which platform the API is (ADR-043). Never rejects: an unreachable API
 * settles as `null`, which the store reads as "not the demo".
 */
export function usePlatform(): UseQueryResult<PlatformInfo | null> {
  return useQuery({
    queryKey: queryKeys.platform,
    queryFn: fetchPlatform,
    // The API caches it for a minute; a deployment does not change mid session.
    staleTime: 60_000,
  });
}
