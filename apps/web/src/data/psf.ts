import { PsfCatalogue, PsfTier } from "@injishi/contracts";

import { apiFetchParsed, type ApiResult } from "@/lib/api";

/**
 * PSF's price list and sectors (the PSF path), read from the API's public
 * routes: the PSF page shows the tiers to a visitor deciding whether to
 * register, and the registration wizard asks for the sector from the catalogue
 * admin keeps. Both public, like the registration fee quote.
 */

export function fetchPsfTiers(): Promise<ApiResult<PsfTier[]>> {
  return apiFetchParsed(PsfTier.array(), "/api/v1/psf/tiers");
}

export function fetchPsfCatalogue(): Promise<ApiResult<PsfCatalogue>> {
  return apiFetchParsed(PsfCatalogue, "/api/v1/psf/catalogue");
}
