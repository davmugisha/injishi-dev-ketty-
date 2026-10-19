import { AdminConfiguration, AdminFeeSchedule, PsfCatalogue, PsfTier } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Configuration (F-A07) — `GET /api/v1/admin/configuration/**`.
 *
 * Both reads are `admin.config.view` (ADR-053), which every staff role holds.
 * The powers to CHANGE them stay apart: `admin.fee.edit` appends a fee and
 * `admin.config.edit` changes a setting, because changing what a registration
 * costs is not the same power as flipping a flag.
 */

const BASE = "/api/v1/admin/configuration";

/** Versioned config entries and feature flags. P: `admin.config.view`. */
export function getConfiguration(): Promise<ApiResult<AdminConfiguration>> {
  return apiGet(BASE, AdminConfiguration);
}

/** Registration fees, subscription plans and the placement-fee totals. P: `admin.config.view`. */
export function getFeeSchedule(): Promise<ApiResult<AdminFeeSchedule>> {
  return apiGet(`${BASE}/fees`, AdminFeeSchedule);
}

/** The PSF membership tiers, retired ones included (ADR-056 AC-19). P: `admin.config.view`. */
export function getPsfTiers(): Promise<ApiResult<PsfTier[]>> {
  return apiGet(`${BASE}/psf-tiers`, PsfTier.array());
}

/**
 * PSF's sector catalogue (the PSF path): every cluster with its associations,
 * retired ones included. P: `admin.config.view`.
 */
export function getPsfCatalogue(): Promise<ApiResult<PsfCatalogue>> {
  return apiGet(`${BASE}/psf-catalogue`, PsfCatalogue);
}
