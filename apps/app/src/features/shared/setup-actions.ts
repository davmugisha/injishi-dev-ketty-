"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as setup from "@/server/mutations/setup";

/**
 * The owner's property setup writes. Each calls the API through `server/mutations/setup.ts` and refreshes the
 * setup page, which reads everything again. A refusal comes back as words for the step it was pressed on:
 * the API's own (the registration gate, a publish blocker) or the screen's (a missing field).
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(workspaceId: string, act: () => Promise<T>): Promise<ActionResult<T>> {
  if (!(await currentAccount())) redirect(`/sign-in?next=${encodeURIComponent(setupPath(workspaceId))}`);
  try {
    const value = await act();
    revalidatePath(setupPath(workspaceId));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof setup.SetupRefusal) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

const int = (value: string) =>
  /^\d+$/.test(value.replace(/[\s,]/g, "")) ? Number(value.replace(/[\s,]/g, "")) : Number.NaN;

/** "Save" on the property step → `PATCH /inventory/properties/:id`. */
export async function updatePropertyAction(
  workspaceId: string,
  propertyId: string,
  input: { description: string; street: string; checkInTime?: string; checkOutTime?: string },
): Promise<ActionResult> {
  return run(workspaceId, async () => {
    await setup.updateProperty(await ctx(), workspaceId, propertyId, input);
    return undefined;
  });
}

/** "Add the property" for a business that has none yet → `POST /inventory/properties`. */
export async function createPropertyAction(
  workspaceId: string,
  input: { name: string; sectorId: string; street: string; description: string },
): Promise<ActionResult> {
  return run(workspaceId, async () => {
    await setup.createProperty(await ctx(), workspaceId, {
      name: input.name,
      sectorId: int(input.sectorId),
      street: input.street,
      description: input.description,
    });
    return undefined;
  });
}

/** "Add room type" → `POST /inventory/properties/:id/room-types`, with its price. */
export async function addRoomTypeAction(
  workspaceId: string,
  propertyId: string,
  input: { name: string; maxGuests: string; basePriceRwf: string; roomCount: string },
): Promise<ActionResult> {
  return run(workspaceId, async () => {
    await setup.addRoomType(await ctx(), workspaceId, propertyId, {
      name: input.name,
      maxGuests: int(input.maxGuests),
      basePriceRwf: int(input.basePriceRwf),
      roomCount: int(input.roomCount),
    });
    return undefined;
  });
}

/** "Add photo" → upload, then attach. The form carries `file` and an optional `caption`. */
export async function addPhotoAction(workspaceId: string, propertyId: string, form: FormData): Promise<ActionResult> {
  return run(workspaceId, async () => {
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new setup.SetupRefusal("Choose a photograph to add.");
    await setup.addPhoto(await ctx(), workspaceId, propertyId, file, String(form.get("caption") ?? ""));
    return undefined;
  });
}

/** "Publish" → `POST /inventory/properties/:id/publish`. Answers the public address. */
export async function publishAction(workspaceId: string, propertyId: string): Promise<ActionResult<string | null>> {
  return run(workspaceId, async () => (await setup.publish(await ctx(), workspaceId, propertyId)).slug);
}

/** "Take it off the marketplace" → `POST /inventory/properties/:id/unpublish`. */
export async function unpublishAction(workspaceId: string, propertyId: string): Promise<ActionResult> {
  return run(workspaceId, async () => {
    await setup.unpublish(await ctx(), workspaceId, propertyId);
    return undefined;
  });
}

/** The next level of the address picker: a province's districts, or a district's sectors. */
export async function placesAction(level: "districts" | "sectors", parentId: number): Promise<setup.Place[]> {
  const c = await ctx();
  return level === "districts" ? setup.districts(c, parentId) : setup.sectors(c, parentId);
}
