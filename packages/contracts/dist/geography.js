"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VillageListQuery = exports.VillageListResponse = exports.CellListQuery = exports.CellListResponse = exports.SectorListQuery = exports.SectorListResponse = exports.DistrictListQuery = exports.DistrictListResponse = exports.ProvinceListResponse = exports.Village = exports.Cell = exports.Sector = exports.District = exports.Province = void 0;
const zod_1 = require("zod");
/**
 * Rwandan Province -> District -> Sector -> Cell -> Village hierarchy.
 * Geography uses meaningful integer smart-code PKs (not UUIDs), matching the
 * `provinces/districts/sectors/cells/villages` tables in the Drizzle schema.
 *
 * These are the wire contracts for GET /api/v1/geography/* — the backend
 * validates its responses against them and clients parse against them, so the
 * boundary is checked on both ends.
 */
exports.Province = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
});
exports.District = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    provinceId: zod_1.z.number().int().positive(),
});
exports.Sector = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    districtId: zod_1.z.number().int().positive(),
});
exports.Cell = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    sectorId: zod_1.z.number().int().positive(),
});
exports.Village = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    cellId: zod_1.z.number().int().positive(),
});
// --- response contracts (list endpoints) -----------------------------------
exports.ProvinceListResponse = zod_1.z.array(exports.Province);
exports.DistrictListResponse = zod_1.z.array(exports.District);
/** Query params for GET /api/v1/geography/districts (optionally scoped). */
exports.DistrictListQuery = zod_1.z.object({
    provinceId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.SectorListResponse = zod_1.z.array(exports.Sector);
/**
 * Query params for GET /api/v1/geography/sectors (optionally scoped).
 *
 * Optional rather than required, matching `DistrictListQuery`: the cascade in
 * the wizard always passes a district, but an admin console listing every
 * sector should not have to loop over 30 districts to do it.
 */
exports.SectorListQuery = zod_1.z.object({
    districtId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.CellListResponse = zod_1.z.array(exports.Cell);
/**
 * Query params for GET /api/v1/geography/cells (optionally scoped).
 *
 * Optional like the two above it, for the same reason: the address picker
 * always narrows by sector, and a caller listing a whole district's cells
 * should not have to loop over its sectors to do it.
 */
exports.CellListQuery = zod_1.z.object({
    sectorId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.VillageListResponse = zod_1.z.array(exports.Village);
/**
 * Query params for GET /api/v1/geography/villages (optionally scoped).
 *
 * The one level where the scope is worth thinking about: there are ~14,800
 * villages, so an unscoped list is a real payload. It stays optional for
 * symmetry and for the rare full export, and every client the wizard owns
 * passes a cell.
 */
exports.VillageListQuery = zod_1.z.object({
    cellId: zod_1.z.coerce.number().int().positive().optional(),
});
//# sourceMappingURL=geography.js.map