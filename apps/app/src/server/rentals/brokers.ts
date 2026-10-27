/**
 * The landlord's broker reads (2026-10-25): the brokers who said they have a tenant for one of the
 * business's units, with the lease and recorded fee each became. Server side only.
 */
import type { LandlordPlacementList } from "@injishi/contracts";
import { cache } from "react";
import { landlordScope, NoRentalsBusinessError } from "./client";

export const landlordPlacements = cache(async (): Promise<LandlordPlacementList> => {
  const s = await landlordScope();
  if (!s) throw new NoRentalsBusinessError();
  return s.api.get<LandlordPlacementList>("/api/v1/ops/rentals/placements", { workspaceId: s.workspace.workspaceId });
});
