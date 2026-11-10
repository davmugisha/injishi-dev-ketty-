/**
 * Admin's reads for PSF memberships across Rwanda (2026-11-02): the register PSF's officers read in
 * their region, over the whole country, with renewals. `StaffGuard` decides (`admin.business.view`);
 * a refusal comes back as the API's status. Server side only.
 */
import type { PsfBusinessDetail, PsfBusinessesPage, PsfBusinessesQuery, PsfRegisterSummary } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function psfSummary(): Promise<PsfRegisterSummary> {
  const api = await currentApi();
  return api.get<PsfRegisterSummary>("/api/v1/admin/psf/summary");
}

/** One page of PSF's register over the whole country, filtered (`GET /admin/psf/businesses`). */
export async function psfBusinesses(query: Partial<PsfBusinessesQuery>): Promise<PsfBusinessesPage> {
  const api = await currentApi();
  const clean = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== "")) as Record<
    string,
    string | number
  >;
  return api.get<PsfBusinessesPage>("/api/v1/admin/psf/businesses", { query: clean });
}

export async function psfBusiness(orgId: string): Promise<PsfBusinessDetail> {
  const api = await currentApi();
  return api.get<PsfBusinessDetail>(`/api/v1/admin/psf/businesses/${orgId}`);
}
