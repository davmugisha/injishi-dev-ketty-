"use client";

/**
 * Setting an approved business up: the checklist's counts, the physical rooms
 * behind each room type, and staff invitations (setup after approval,
 * 2026-09-13).
 *
 * Every read here is behind a permission a business only holds once it is
 * `active` (`listing.manage`, `team.manage`), so none of it opens during the
 * registration pipeline — the user's ruling, and D20.
 *
 * Inventory writes invalidate the whole `inventory` prefix, as `inventory.ts`
 * does: adding a room moves the room type's counts, the property's sellable
 * count, whether it can publish and the checklist, and a prefix cannot miss one.
 */

import {
  IdentityStatus,
  InventoryRoomList,
  OperatorStaffInvitationList,
  PropertySetupProgress,
  type InventoryRoom,
  type InviteStaffRequest,
  type MemberBranchIds,
  type OperatorStaffInvitation,
  type OperatorTeamMember,
  type RoomStatus,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { command } from "./api";
import { read, useMayRead } from "./ops";
import { queryKeys } from "./queries";

/**
 * Keep the checklist in step with every write made while it is on screen.
 *
 * The guided set-up embeds the screens that edit each step (room types,
 * photographs, departments, outlets, amenities, invitations), and only some of
 * their writes invalidate the `inventory` prefix the checklist sits under: an
 * amenity, a department head or an outlet moves a count without touching it.
 * Rather than teach every one of those hooks about the checklist, the set-up
 * listens for ANY write that settles and asks for the counts again. One small
 * read per save, and a step can never show "not done" over a thing just finished.
 *
 * A FAILED write is followed too, and that is not caution for its own sake:
 * `POST /inventory/properties` creates the property and then answers 404,
 * because the read back is checked against the branch scope resolved BEFORE the
 * property existed. The property is there; only the answer says otherwise. So
 * after an error the whole inventory prefix is asked again, and whatever landed
 * shows.
 */
export function useSetupFollowsWrites(): void {
  const client = useQueryClient();
  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type !== "updated") return;
        if (event.action.type === "success") {
          void client.invalidateQueries({ queryKey: ["inventory", "setup"] });
        } else if (event.action.type === "error") {
          void client.invalidateQueries({ queryKey: ["inventory"] });
        }
      }),
    [client],
  );
}

/**
 * The business's first property is also its first BRANCH, which the grant
 * lists (the branch switcher, the branch header every read sends). When the
 * checklist's property count grows, the grant is asked again so the shell stops
 * saying "No property yet" over the property just created.
 */
export function useGrantFollowsProperties(count: number | undefined): void {
  const client = useQueryClient();
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (count === undefined) return;
    if (seen.current !== undefined && count > seen.current) {
      void client.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
    }
    seen.current = count;
  }, [count, client]);
}

/**
 * The signed-in person's own identity check (ADR-060), for the "verify your
 * identity for payouts" task once the listing is live.
 *
 * `/me/identity` is the caller's own record behind the session alone, so it is
 * asked whatever the workspace grants. The workspace header rides along only
 * because `read` always sends it; the route ignores it.
 */
export function useOwnIdentity(workspaceId: string | null, enabled: boolean): UseQueryResult<IdentityStatus> {
  return useQuery({
    queryKey: ["me", "identity"] as const,
    queryFn: () => read("/me/identity", workspaceId as string, IdentityStatus),
    enabled: enabled && workspaceId !== null,
    // A verification happens elsewhere and rarely; one read per visit is plenty.
    staleTime: 5 * 60_000,
  });
}

function useInvalidateInventory(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["inventory"] });
    // A new room lands on today's room status board too.
    void client.invalidateQueries({ queryKey: ["ops", "rooms"] });
  };
}

/** How far this business has got, for the property in view (or its first). */
export function useSetupProgress(
  workspaceId: string | null,
  propertyId: string | null = null,
): UseQueryResult<PropertySetupProgress> {
  const mayRead = useMayRead(["listing.manage"]);
  return useQuery({
    queryKey: queryKeys.setupProgress(workspaceId, propertyId),
    queryFn: () =>
      read(
        propertyId
          ? `/inventory/setup?propertyId=${encodeURIComponent(propertyId)}`
          : "/inventory/setup",
        workspaceId as string,
        PropertySetupProgress,
      ),
    // Every /inventory read is `listing.manage` on the server (class guard);
    // a refusal invalidates me.workspaces, so a caller without it never asks.
    enabled: workspaceId !== null && mayRead,
  });
}

/** The rooms (or units, tents, villas) of one room type. */
export function useInventoryRooms(
  workspaceId: string | null,
  roomTypeId: string | null,
): UseQueryResult<InventoryRoomList> {
  const mayRead = useMayRead(["listing.manage"]);
  return useQuery({
    queryKey: queryKeys.inventoryRooms(workspaceId, roomTypeId),
    queryFn: () =>
      read(`/inventory/room-types/${roomTypeId as string}/rooms`, workspaceId as string, InventoryRoomList),
    enabled: workspaceId !== null && roomTypeId !== null && mayRead,
  });
}

/** Add rooms to a room type, each by the label on its door. */
export function useAddRooms(
  workspaceId: string | null,
): UseMutationResult<InventoryRoomList, Error, { roomTypeId: string; labels: string[] }> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ roomTypeId, labels }) =>
      command<InventoryRoomList>(`/inventory/room-types/${roomTypeId}/rooms`, {
        workspaceId: workspaceId as string,
        body: { workspaceId, labels },
      }),
    onSuccess: invalidate,
  });
}

/** Renumber a room, or change whether it can be sold. */
export function useUpdateRoom(
  workspaceId: string | null,
): UseMutationResult<InventoryRoom, Error, { roomId: string; label?: string; status?: RoomStatus }> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ roomId, ...patch }) =>
      command<InventoryRoom>(`/inventory/rooms/${roomId}`, {
        workspaceId: workspaceId as string,
        method: "PATCH",
        body: { workspaceId, ...patch },
      }),
    onSuccess: invalidate,
  });
}

/** Every staff invitation the business has sent. `team.manage`. */
export function useStaffInvitations(
  workspaceId: string | null,
): UseQueryResult<OperatorStaffInvitationList> {
  const mayRead = useMayRead(["team.manage"]);
  return useQuery({
    queryKey: queryKeys.staffInvitations(workspaceId),
    queryFn: () => read("/ops/team/invitations", workspaceId as string, OperatorStaffInvitationList),
    enabled: workspaceId !== null && mayRead,
  });
}

function useInvalidateTeam(workspaceId: string | null): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.staffInvitations(workspaceId) });
    void client.invalidateQueries({ queryKey: queryKeys.team(workspaceId) });
    void client.invalidateQueries({ queryKey: ["inventory", "setup"] });
  };
}

export function useInviteStaff(
  workspaceId: string | null,
): UseMutationResult<OperatorStaffInvitation, Error, InviteStaffRequest> {
  const invalidate = useInvalidateTeam(workspaceId);
  return useMutation({
    mutationFn: (body) =>
      command<OperatorStaffInvitation>("/ops/team/invitations", {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: invalidate,
  });
}

/**
 * Limit a member to some branches, or give them every branch (ADR-054 AC-T1).
 * `team.manage` plus every branch. `allBranches`, because the branch in view
 * has nothing to do with whose coverage is being changed.
 */
export function useSetMemberBranches(
  workspaceId: string | null,
): UseMutationResult<OperatorTeamMember, Error, { userId: string; branchIds: MemberBranchIds }> {
  const invalidate = useInvalidateTeam(workspaceId);
  return useMutation({
    mutationFn: ({ userId, branchIds }) =>
      command<OperatorTeamMember>(`/ops/team/${userId}/branches`, {
        workspaceId: workspaceId as string,
        method: "PUT",
        body: { branchIds },
        allBranches: true,
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeStaffInvitation(
  workspaceId: string | null,
): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateTeam(workspaceId);
  return useMutation({
    mutationFn: (invitationId) =>
      command<unknown>(`/ops/team/invitations/${invitationId}/revoke`, {
        workspaceId: workspaceId as string,
      }),
    onSuccess: invalidate,
  });
}
