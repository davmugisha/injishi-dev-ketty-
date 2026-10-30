"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { BOOKING_ANCHOR, ROOM_PARAM } from "@/components/property/room-param";

export { BOOKING_ANCHOR, ROOM_PARAM };

/**
 * The guest's chosen room and the way to change it. See `room-param.ts` for
 * why it lives in the address.
 */
export function useChosenRoom(): [
  string | null,
  (roomTypeId: string | null, options?: { reveal?: boolean }) => void,
] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const chosen = params.get(ROOM_PARAM);

  const choose = useCallback(
    (roomTypeId: string | null, options?: { reveal?: boolean }) => {
      const next = new URLSearchParams(params.toString());
      if (roomTypeId) next.set(ROOM_PARAM, roomTypeId);
      else next.delete(ROOM_PARAM);
      const query = next.toString();
      // `replace`, not `push`: picking a room is adjusting this page, and Back
      // should leave the property rather than step through every room tried.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      if (options?.reveal) {
        document
          .getElementById(BOOKING_ANCHOR)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [params, pathname, router],
  );

  return [chosen, choose];
}
