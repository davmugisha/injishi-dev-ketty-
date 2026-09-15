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
    id: number;
    name: string;
}, {
    id: number;
    name: string;
}>;
export type Province = z.infer<typeof Province>;
export declare const District: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    provinceId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    provinceId: number;
}, {
    id: number;
    name: string;
    provinceId: number;
}>;
export type District = z.infer<typeof District>;
export declare const Sector: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    districtId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    districtId: number;
    id: number;
    name: string;
}, {
    districtId: number;
    id: number;
    name: string;
}>;
export type Sector = z.infer<typeof Sector>;
export declare const Cell: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    sectorId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    sectorId: number;
    name: string;
}, {
    id: number;
    sectorId: number;
    name: string;
}>;
export type Cell = z.infer<typeof Cell>;
export declare const Village: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    cellId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    cellId: number;
}, {
    id: number;
    name: string;
    cellId: number;
}>;
export type Village = z.infer<typeof Village>;
export declare const ProvinceListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
}, {
    id: number;
    name: string;
}>, "many">;
export type ProvinceListResponse = z.infer<typeof ProvinceListResponse>;
export declare const DistrictListResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    provinceId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    provinceId: number;
}, {
    id: number;
    name: string;
    provinceId: number;
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
    districtId: number;
    id: number;
    name: string;
}, {
    districtId: number;
    id: number;
    name: string;
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
//# sourceMappingURL=geography.d.ts.map