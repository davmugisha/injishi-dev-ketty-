/**
 * Admin's reads for PSF memberships across Rwanda (2026-11-02): the register PSF's officers read in
 * their region, over the whole country, with renewals. `StaffGuard` decides (`admin.business.view`);
 * a refusal comes back as the API's status. Server side only.
 */
import type { PsfBusinessDetail, PsfBusinessesPage, PsfRegisterSummary, PsfStanding } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function psfSummary(): Promise<PsfRegisterSummary> {
  const api = await currentApi();
  return api.get<PsfRegisterSummary>("/api/v1/admin/psf/summary");
}

export async function psfBusinesses(query: { q?: string; standing?: PsfStanding; renewal?: "due"; cursor?: string }): Promise<PsfBusinessesPage> {
  const api = await currentApi();
  return api.get<PsfBusinessesPage>("/api/v1/admin/psf/businesses", {
    query: { q: query.q?.trim(), standing: query.standing, renewal: query.renewal, cursor: query.cursor },
  });
}

export async function psfBusiness(orgId: string): Promise<PsfBusinessDetail> {
  const api = await currentApi();
  return api.get<PsfBusinessDetail>(`/api/v1/admin/psf/businesses/${orgId}`);
}
