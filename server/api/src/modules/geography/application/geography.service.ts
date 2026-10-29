import { Injectable } from '@nestjs/common';
import {
  Cell,
  CellListQuery,
  District,
  DistrictListQuery,
  tidyPlaceName,
  Province,
  Sector,
  SectorListQuery,
  Village,
  VillageListQuery,
} from '@injishi/contracts';

import { GeographyRepository } from '../infrastructure/geography.repository';

/** Names as people write them ("Eastern Province", "Gatumba", "Nyakabanda II"), not as the reference dump holds them. */
const named = <T extends { name: string }>(rows: T[]): T[] =>
  rows.map((row) => ({ ...row, name: tidyPlaceName(row.name) }));

/**
 * Application service (use cases) for the Geography module. This is the ONLY
 * surface other modules or the API layer may depend on — never the repository
 * or Drizzle directly. Responses are parsed against the contract so a schema/DB
 * drift fails loudly here rather than leaking a bad shape to clients.
 */
@Injectable()
export class GeographyService {
  constructor(private readonly repo: GeographyRepository) {}

  async listProvinces(): Promise<Province[]> {
    const rows = await this.repo.findProvinces();
    return Province.array().parse(named(rows));
  }

  async listDistricts(query: DistrictListQuery): Promise<District[]> {
    const rows = await this.repo.findDistricts(query.provinceId);
    return District.array().parse(named(rows));
  }

  async listSectors(query: SectorListQuery): Promise<Sector[]> {
    const rows = await this.repo.findSectors(query.districtId);
    return Sector.array().parse(named(rows));
  }

  async listCells(query: CellListQuery): Promise<Cell[]> {
    const rows = await this.repo.findCells(query.sectorId);
    return Cell.array().parse(named(rows));
  }

  async listVillages(query: VillageListQuery): Promise<Village[]> {
    const rows = await this.repo.findVillages(query.cellId);
    return Village.array().parse(named(rows));
  }

  /**
   * Does this village sit under this sector?
   *
   * An address names a sector and MAY name a village (both are on
   * `RwandanAddress`), and the two can disagree — a stale pick left behind by a
   * changed sector, or a hand-made request. Only the `villages -> cells`
   * join can settle it, so the question is answered here, once, and both write
   * paths that ask it get the same sentence back.
   *
   * It returns a verdict rather than throwing, because the two callers put the
   * refusal at different field paths (`address.villageId` for a person,
   * `business.address.villageId` for a business) and the path is the caller's
   * to know. The WORDING is not: two copies of a refusal is two chances to
   * drift.
   */
  async checkVillageInSector(
    villageId: number,
    sectorId: number,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const placement = await this.repo.findVillagePlacement(villageId);
    if (!placement) {
      return {
        ok: false,
        message: 'That village does not exist. Pick one from the list.',
      };
    }
    if (placement.sectorId !== sectorId) {
      return {
        ok: false,
        message: 'That village is not in the sector you chose.',
      };
    }
    return { ok: true };
  }
}
