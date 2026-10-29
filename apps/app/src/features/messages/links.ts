import { MESSAGE_APP_PATHS, placementThreadWritable } from "@injishi/contracts";

/** Where "Message" on a placement goes, for the broker and the landlord alike (2026-10-26). */
export const placementMessageHref = (placementId: string): string => MESSAGE_APP_PATHS.placement(placementId);

/** "Message" shows while the placement is open or became a lease; a dropped one has nothing to say. */
export const canMessagePlacement = (status: string): boolean => placementThreadWritable(status);
