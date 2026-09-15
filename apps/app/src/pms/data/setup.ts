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
  InventoryRoomList,
  OperatorStaffInvitationList,
  PropertySetupProgress,
  type InventoryRoom,
  type InviteStaffRequest,
  type OperatorStaffInvitation,
  type RoomStatus,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { command } from "./api";
import { read, useMayRead } from "./ops";
import { queryKeys } from "./queries";

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
