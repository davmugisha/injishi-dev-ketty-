import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { requestContext } from "@/server/data";
import { type PosOutlet, posOutlets, posPermissions } from "@/server/pos";
import type { SourceContext } from "@/server/sources/types";
import { NoWorkspaceError } from "@/server/sources/types";
import type { PosBoard } from "./pos-boards";

/**
 * Read the data of a screen the role may open but not read. The API is the judge of every read, and a role such as the
 * kitchen may reach a board (the screen registry lets the whole waiter family in) whose data it is not allowed. That
 * refusal must be a sentence the person can read, never a crashed page.
 */
export async function readOrBlock<T>(
  read: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; title: string; message: string }> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return {
        ok: false,
        title: "Not open to you",
        message: "Your role does not use this screen. Ask the owner if you need it.",
      };
    }
    throw error;
  }
}

export type PosPage =
  | { ok: true; ctx: SourceContext; outlets: PosOutlet[]; outlet: PosOutlet; can: string[]; userId: string | null }
  | {
      ok: false;
      title: string;
      message: string /** The person can create the first outlet right now. */;
      firstOutlet?: boolean;
    };

/**
 * What every live POS page starts from: the person, their hospitality workspace, the outlets their branch
 * scope covers, the one they asked for (or the first), and what they may do there. A person with no POS
 * outlet gets a sentence, not an error page.
 */
export async function loadPosPage(board: PosBoard, outletParam: string | undefined): Promise<PosPage> {
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
  if (!outlet) {
    const can = posPermissions(ctx).has("outlet.manage");
    return {
      ok: false,
      title: "No outlet",
      message: can
        ? "Your business has no restaurant or bar outlet yet."
        : "No restaurant or bar outlet is set up in the branches you cover. Ask the owner to set one up.",
      firstOutlet: can,
    };
  }
  return { ok: true, ctx, outlets, outlet, can: [...posPermissions(ctx)], userId: ctx.account?.user.id ?? null };
}
