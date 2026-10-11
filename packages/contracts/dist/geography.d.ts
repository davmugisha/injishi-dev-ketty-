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
export declare const Province: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: number;
}, {
    name: string;
    id: number;
}>;
export type Province = z.infer<typeof Province>;
export declare const District: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    provinceId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    provinceId: number;
    id: number;
}, {
    name: string;
    provinceId: number;
    id: number;
}>;
export type District = z.infer<typeof District>;
export declare const Sector: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    districtId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    districtId: number;
    id: number;
}, {
    name: string;
    districtId: number;
    id: number;
}>;
export type Sector = z.infer<typeof Sector>;
export declare const Cell: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    sectorId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    sectorId: number;
    id: number;
}, {
    name: string;
    sectorId: number;
    id: number;
}>;
export type Cell = z.infer<typeof Cell>;
export declare const Village: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    cellId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    cellId: number;
    id: number;
}, {
    name: string;
    cellId: number;
    id: number;
}>;
export type Village = z.infer<typeof Village>;
export declare const ProvinceListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: number;
}, {
    name: string;
    id: number;
}>, "many">;
export type ProvinceListResponse = z.infer<typeof ProvinceListResponse>;
export declare const DistrictListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    provinceId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    provinceId: number;
    id: number;
}, {
    name: string;
    provinceId: number;
    id: number;
}>, "many">;
export type DistrictListResponse = z.infer<typeof DistrictListResponse>;
/** Query params for GET /api/v1/geography/districts (optionally scoped). */
export declare const DistrictListQuery: z.ZodObject<{
    provinceId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provinceId?: number | undefined;
}, {
    provinceId?: number | undefined;
}>;
export type DistrictListQuery = z.infer<typeof DistrictListQuery>;
export declare const SectorListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    districtId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    districtId: number;
    id: number;
}, {
    name: string;
    districtId: number;
    id: number;
}>, "many">;
export type SectorListResponse = z.infer<typeof SectorListResponse>;
/**
 * Query params for GET /api/v1/geography/sectors (optionally scoped).
 *
 * Optional rather than required, matching `DistrictListQuery`: the cascade in
 * the wizard always passes a district, but an admin console listing every
 * sector should not have to loop over 30 districts to do it.
 */
export declare const SectorListQuery: z.ZodObject<{
    districtId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    districtId?: number | undefined;
}, {
    districtId?: number | undefined;
}>;
export type SectorListQuery = z.infer<typeof SectorListQuery>;
export declare const CellListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    sectorId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    sectorId: number;
    id: number;
}, {
    name: string;
    sectorId: number;
    id: number;
}>, "many">;
export type CellListResponse = z.infer<typeof CellListResponse>;
/**
 * Query params for GET /api/v1/geography/cells (optionally scoped).
 *
 * Optional like the two above it, for the same reason: the address picker
 * always narrows by sector, and a caller listing a whole district's cells
 * should not have to loop over its sectors to do it.
 */
export declare const CellListQuery: z.ZodObject<{
    sectorId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sectorId?: number | undefined;
}, {
    sectorId?: number | undefined;
}>;
export type CellListQuery = z.infer<typeof CellListQuery>;
export declare const VillageListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    cellId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    cellId: number;
    id: number;
}, {
    name: string;
    cellId: number;
    id: number;
}>, "many">;
export type VillageListResponse = z.infer<typeof VillageListResponse>;
/**
 * Query params for GET /api/v1/geography/villages (optionally scoped).
 *
 * The one level where the scope is worth thinking about: there are ~14,800
 * villages, so an unscoped list is a real payload. It stays optional for
 * symmetry and for the rare full export, and every client the wizard owns
 * passes a cell.
 */
export declare const VillageListQuery: z.ZodObject<{
    cellId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    cellId?: number | undefined;
}, {
    cellId?: number | undefined;
}>;
export type VillageListQuery = z.infer<typeof VillageListQuery>;
//# sourceMappingURL=geography.d.ts.map