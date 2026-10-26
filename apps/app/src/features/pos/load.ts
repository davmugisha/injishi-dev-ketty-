import type { BoardId } from "@injishi/data";
import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { requestContext } from "@/server/data";
import { type PosOutlet, posOutlets, posPermissions } from "@/server/pos";
import type { SourceContext } from "@/server/sources/types";
import { NoWorkspaceError } from "@/server/sources/types";

export type PosPage =
  | { ok: true; ctx: SourceContext; outlets: PosOutlet[]; outlet: PosOutlet; can: string[]; userId: string | null }
  | { ok: false; title: string; message: string };

/**
 * What every live POS page starts from: the person, their hospitality workspace, the outlets their branch
 * scope covers, the one they asked for (or the first), and what they may do there. A person with no POS
 * outlet gets a sentence, not an error page.
 */
export async function loadPosPage(board: BoardId, outletParam: string | undefined): Promise<PosPage> {
  await requirePersona(board);
  const ctx = await requestContext();
  let outlets: PosOutlet[];
  try {
    outlets = await posOutlets(ctx);
  } catch (error) {
    if (error instanceof NoWorkspaceError) {
      return { ok: false, title: "No business here", message: "This account works at no restaurant or bar." };
    }
    if (error instanceof ApiError && (error.forbidden || error.notFound)) {
      return { ok: false, title: "Not open to you", message: "Your role holds none of the point of sale permissions." };
    }
    throw error;
  }
  const outlet = outlets.find((o) => o.id === outletParam) ?? outlets[0];
  if (!outlet) return { ok: false, title: "No outlet", message: "No restaurant or bar outlet is set up in the branches you cover." };
  return { ok: true, ctx, outlets, outlet, can: [...posPermissions(ctx)], userId: ctx.account?.user.id ?? null };
}
