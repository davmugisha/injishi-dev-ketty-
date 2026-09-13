"use client";

/**
 * The inventory WRITE path, as the operator app calls it (ADR-053, AC-I1 to
 * AC-I7).
 *
 * Every one of these routes existed and was proven over HTTP before this file:
 * room types, rate plans, photographs, publish and unpublish. What did not exist
 * was a control to press, so an owner could create a property and then do
 * nothing with it. The reads stay in `ops.ts`, beside the other inventory reads.
 *
 * **Every write invalidates the whole `inventory` key.** A price edit moves the
 * room type, its default rate plan, the property's counts and whether it can be
 * published; a photograph changes the cover the list shows. Invalidating by
 * prefix refetches exactly the inventory reads on screen and nothing in `ops`,
 * and it cannot miss a read the next screen adds.
 *
 * Refusals arrive as `ApiError`, already worded by the server. A publish refusal
 * also carries `blockers` in its body, read by `publishBlockers`.
 */

import {
  OperatorRoomTypeList,
  PUBLISH_BLOCKER_LABEL,
  PublishBlocker,
  type CreateRatePlanRequest,
  type CreateRoomTypeRequest,
  type OperatorProperty,
  type OperatorRatePlan,
  type OperatorRoomType,
  type PropertyPhotoList,
  type UpdatePropertyRequest,
  type UpdateRatePlanRequest,
  type UpdateRoomTypeRequest,
  type UploadedPropertyPhoto,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, command, upload } from "./api";
import { read } from "./ops";
import { queryKeys } from "./queries";

type Body<T> = Omit<T, "workspaceId">;

function useInvalidateInventory(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["inventory"] });
  };
}

/** A property's room types with what the editor needs: guests, mode, default plan. */
export function useRoomTypes(
  workspaceId: string | null,
  propertyId: string | null,
): UseQueryResult<OperatorRoomTypeList> {
  return useQuery({
    queryKey: queryKeys.roomTypes(workspaceId, propertyId),
    queryFn: () =>
      read(
        `/inventory/properties/${propertyId as string}/room-types`,
        workspaceId as string,
        OperatorRoomTypeList,
      ),
    enabled: workspaceId !== null && propertyId !== null,
  });
}

/** Edit the property's own fields: description, times, house rules. */
export function useUpdateProperty(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<OperatorProperty, Error, Body<UpdatePropertyRequest>> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorProperty>(`/inventory/properties/${propertyId as string}`, {
        workspaceId: workspaceId as string,
        method: "PATCH",
        body: { ...body, workspaceId },
      }),
    onSuccess: invalidate,
  });
}

/** Create a room type on the property, or edit one when `roomTypeId` is given. */
export function useSaveRoomType(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<
  OperatorRoomType,
  Error,
  { roomTypeId: string | null; body: Body<CreateRoomTypeRequest> | Body<UpdateRoomTypeRequest> }
> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ roomTypeId, body }) =>
      roomTypeId === null
        ? command<OperatorRoomType>(`/inventory/properties/${propertyId as string}/room-types`, {
            workspaceId: workspaceId as string,
            body: { ...body, workspaceId },
          })
        : command<OperatorRoomType>(`/inventory/room-types/${roomTypeId}`, {
            workspaceId: workspaceId as string,
            method: "PATCH",
            body: { ...body, workspaceId },
          }),
    onSuccess: invalidate,
  });
}

/** Add a rate plan to a room type. */
export function useCreateRatePlan(
  workspaceId: string | null,
): UseMutationResult<
  OperatorRatePlan,
  Error,
  { roomTypeId: string; body: Body<CreateRatePlanRequest> }
> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ roomTypeId, body }) =>
      command<OperatorRatePlan>(`/inventory/room-types/${roomTypeId}/rate-plans`, {
        workspaceId: workspaceId as string,
        body: { ...body, workspaceId },
      }),
    onSuccess: invalidate,
  });
}

/** Edit a rate plan, including making it the default or archiving it. */
export function useUpdateRatePlan(
  workspaceId: string | null,
): UseMutationResult<
  OperatorRatePlan,
  Error,
  { ratePlanId: string; body: Body<UpdateRatePlanRequest> }
> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ ratePlanId, body }) =>
      command<OperatorRatePlan>(`/inventory/rate-plans/${ratePlanId}`, {
        workspaceId: workspaceId as string,
        method: "PATCH",
        body: { ...body, workspaceId },
      }),
    onSuccess: invalidate,
  });
}

/**
 * Upload photographs and attach them to the property, in the order chosen.
 *
 * Two calls per file, which is the API's shape on purpose (the bytes, then the
 * attach that knows the property). Files go one at a time so their positions
 * follow the order the operator picked them in, and a failure stops the batch
 * at the file that failed rather than leaving a gap in the middle.
 */
export function useAddPropertyPhotos(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<PropertyPhotoList | null, Error, File[]> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: async (files) => {
      let latest: PropertyPhotoList | null = null;
      for (const file of files) {
        const stored = await upload<UploadedPropertyPhoto>("/uploads/property-photo", file);
        latest = await command<PropertyPhotoList>(
          `/inventory/properties/${propertyId as string}/photos`,
          { workspaceId: workspaceId as string, body: { workspaceId, objectKey: stored.objectKey } },
        );
      }
      return latest;
    },
    onSettled: invalidate,
  });
}

/** Rewrite the order and the cover in one call, the way the API takes it. */
export function useArrangePropertyPhotos(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<
  PropertyPhotoList,
  Error,
  { id: string; position: number; isCover?: boolean }[]
> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (photos) =>
      command<PropertyPhotoList>(`/inventory/properties/${propertyId as string}/photos`, {
        workspaceId: workspaceId as string,
        method: "PATCH",
        body: { workspaceId, photos },
      }),
    onSuccess: invalidate,
  });
}

export function useRemovePropertyPhoto(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<PropertyPhotoList, Error, string> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (photoId) =>
      command<PropertyPhotoList>(
        `/inventory/properties/${propertyId as string}/photos/${photoId}`,
        { workspaceId: workspaceId as string, method: "DELETE" },
      ),
    onSuccess: invalidate,
  });
}

/** Publish or unpublish. The API mints the slug on the first publish and keeps it. */
export function useSetListing(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<OperatorProperty, Error, "publish" | "unpublish"> {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (act) =>
      command<OperatorProperty>(`/inventory/properties/${propertyId as string}/${act}`, {
        workspaceId: workspaceId as string,
      }),
    onSettled: invalidate,
  });
}

/**
 * Every reason a publish was refused, in words, in the order the API listed them.
 *
 * The refusal's `message` names only the first blocker. The body lists all of
 * them, and an operator fixing one thing at a time only to be refused again for
 * the next is exactly what the list exists to prevent. Codes the contract does
 * not know are dropped rather than printed.
 */
export function publishBlockers(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.status !== 409) return [];
  const body = error.body as { blockers?: unknown } | null;
  if (!body || !Array.isArray(body.blockers)) return [];
  return body.blockers.flatMap((code) => {
    const parsed = PublishBlocker.safeParse(code);
    return parsed.success ? [PUBLISH_BLOCKER_LABEL[parsed.data]] : [];
  });
}
