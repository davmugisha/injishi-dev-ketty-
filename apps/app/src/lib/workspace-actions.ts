"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/server/api";
import { currentApi, safeNext } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Open another of the person's businesses from the business switcher: the API records the choice on the
 * session (`POST /me/active-workspace`, refused for a business the person does not hold), every screen
 * then acts in it, and the person lands on its home.
 */
export async function switchBusiness(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const next = safeNext(String(form.get("next") ?? "")) ?? "/";
  if (!UUID.test(workspaceId)) redirect(next);
  const api = await currentApi();
  try {
    await api.post("/api/v1/me/active-workspace", { workspaceId }, { workspaceId });
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) redirect("/sign-in");
    if (!(error instanceof ApiError)) throw error;
    // Refused (no longer a member): stay where they were; the switcher redraws from the API.
    revalidatePath("/", "layout");
    return;
  }
  revalidatePath("/", "layout");
  redirect(next);
}
