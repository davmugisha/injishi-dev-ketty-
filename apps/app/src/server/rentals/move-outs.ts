/** The landlord's move-outs read (WP 1.7): one tab of the list with every tab's count. Server side only. */
import type { MoveOutList, MoveOutListTab } from "@injishi/contracts";
import { cache } from "react";
import { landlordScope, NoRentalsBusinessError } from "./client";

export const moveOutList = cache(async (tab: MoveOutListTab, q?: string): Promise<MoveOutList> => {
  const s = await landlordScope();
  if (!s) throw new NoRentalsBusinessError();
  return s.api.get<MoveOutList>("/api/v1/ops/move-outs", {
    workspaceId: s.workspace.workspaceId,
    query: { tab, q: q || undefined },
  });
});
