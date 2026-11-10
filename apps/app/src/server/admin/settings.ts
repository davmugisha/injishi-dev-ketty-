/**
 * Admin's settings reads (2026-11-09): the fee schedule, PSF's levels and catalogue, government bodies, and
 * the platform's settings and flags. `admin.config.view`, which every staff role holds. Server side only.
 */
import type { AdminConfiguration, AdminFeeSchedule, PsfCatalogue, PsfTier } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function feeSchedule(): Promise<AdminFeeSchedule> {
  return (await currentApi()).get<AdminFeeSchedule>("/api/v1/admin/configuration/fees");
}

export async function psfTiers(): Promise<PsfTier[]> {
  return (await currentApi()).get<PsfTier[]>("/api/v1/admin/configuration/psf-tiers");
}

export async function psfCatalogue(): Promise<PsfCatalogue> {
  return (await currentApi()).get<PsfCatalogue>("/api/v1/admin/configuration/psf-catalogue");
}

export async function platformConfiguration(): Promise<AdminConfiguration> {
  return (await currentApi()).get<AdminConfiguration>("/api/v1/admin/configuration");
}
