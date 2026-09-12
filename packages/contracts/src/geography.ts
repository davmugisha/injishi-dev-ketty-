import { z } from "zod";
/**
 * Rwandan Province -> District -> Sector -> Cell -> Village hierarchy.
 * Geography uses meaningful integer smart-code PKs (not UUIDs), matching the
 * `provinces/districts/sectors/cells/villages` tables in the Drizzle schema.
 *
 * These are the wire contracts for GET /api/v1/geography/* — the backend
 * validates its responses against them and clients parse against them, so the
 * boundary is checked on both ends.
 */
export const Province = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
});
export type Province = z.infer<typeof Province>;
export const District = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    provinceId: z.number().int().positive(),
});
export type District = z.infer<typeof District>;
export const Sector = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    districtId: z.number().int().positive(),
});
export type Sector = z.infer<typeof Sector>;
export const Cell = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    sectorId: z.number().int().positive(),
});
export type Cell = z.infer<typeof Cell>;
export const Village = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    cellId: z.number().int().positive(),
});
export type Village = z.infer<typeof Village>;
// --- response contracts (list endpoints) -----------------------------------
export const ProvinceListResponse = z.array(Province);
export type ProvinceListResponse = z.infer<typeof ProvinceListResponse>;
export const DistrictListResponse = z.array(District);
export type DistrictListResponse = z.infer<typeof DistrictListResponse>;
/** Query params for GET /api/v1/geography/districts (optionally scoped). */
export const DistrictListQuery = z.object({
    provinceId: z.coerce.number().int().positive().optional(),
});
export type DistrictListQuery = z.infer<typeof DistrictListQuery>;
export const SectorListResponse = z.array(Sector);
export type SectorListResponse = z.infer<typeof SectorListResponse>;
/**
 * Query params for GET /api/v1/geography/sectors (optionally scoped).
 *
 * Optional rather than required, matching `DistrictListQuery`: the cascade in
 * the wizard always passes a district, but an admin console listing every
 * sector should not have to loop over 30 districts to do it.
 */
export const SectorListQuery = z.object({
    districtId: z.coerce.number().int().positive().optional(),
});
export type SectorListQuery = z.infer<typeof SectorListQuery>;