"use server";

/**
 * Registering overnight guests (P5): a tenant's for their lease (`/me/tenancies/:leaseId/guests`), and the
 * landlord's own at one of their buildings (`/ops/guests`, `guest.register`). Each checks its input with
 * the contracts schema the API checks with; the API adds the lease window and the 90 days again.
 */
import { type HostGuest, LandlordGuestRequest, TenantGuestRequest } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { currentApi } from "@/lib/session";
import { type ActionResult, invalid, parse, runLandlord, runPerson, UUID, ws } from "@/server/rentals/action-kit";

const NO_GUEST = "That guest was not found.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const bad = (leaseId: string, id?: string) => !UUID.test(leaseId) || (id !== undefined && !UUID.test(id));

export async function registerTenantGuest(leaseId: string, input: unknown): Promise<ActionResult<HostGuest>> {
  if (bad(leaseId)) return { ok: false, error: "That lease was not found." };
  const parsed = parse(TenantGuestRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(await runPerson(() => api.post<HostGuest>(`/api/v1/me/tenancies/${leaseId}/guests`, parsed.data)));
}

export async function updateTenantGuest(leaseId: string, id: string, input: unknown): Promise<ActionResult<HostGuest>> {
  if (bad(leaseId, id)) return { ok: false, error: NO_GUEST };
  const parsed = parse(TenantGuestRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(() => api.patch<HostGuest>(`/api/v1/me/tenancies/${leaseId}/guests/${id}`, parsed.data), NO_GUEST),
  );
}

export async function cancelTenantGuest(leaseId: string, id: string): Promise<ActionResult<HostGuest>> {
  if (bad(leaseId, id)) return { ok: false, error: NO_GUEST };
  const api = await currentApi();
  return changed(
    await runPerson(() => api.post<HostGuest>(`/api/v1/me/tenancies/${leaseId}/guests/${id}/cancel`, {}), NO_GUEST),
  );
}

export async function registerLandlordGuest(input: unknown): Promise<ActionResult<HostGuest>> {
  const parsed = parse(LandlordGuestRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(await runLandlord((s) => s.api.post<HostGuest>("/api/v1/ops/guests", parsed.data, ws(s))));
}

export async function updateLandlordGuest(id: string, input: unknown): Promise<ActionResult<HostGuest>> {
  if (!UUID.test(id)) return { ok: false, error: NO_GUEST };
  const parsed = parse(LandlordGuestRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord((s) => s.api.patch<HostGuest>(`/api/v1/ops/guests/${id}`, parsed.data, ws(s)), NO_GUEST),
  );
}

export async function cancelLandlordGuest(id: string): Promise<ActionResult<HostGuest>> {
  if (!UUID.test(id)) return { ok: false, error: NO_GUEST };
  return changed(
    await runLandlord((s) => s.api.post<HostGuest>(`/api/v1/ops/guests/${id}/cancel`, {}, ws(s)), NO_GUEST),
  );
}
