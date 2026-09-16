import { Controller, Get, Query } from '@nestjs/common';
import {
  Cell,
  CellListQuery,
  District,
  DistrictListQuery,
  Province,
  Sector,
  SectorListQuery,
  Village,
  VillageListQuery,
} from '@injishi/contracts';

import { GeographyService } from '../../../modules/geography/application/geography.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Public API for geography reference data → /api/v1/geography/*.
 * Composes the GeographyService application service; never reaches into the
 * module's repository or Drizzle. Query input is validated with the same Zod
 * contract the clients use.
 */
@Controller({ path: 'geography', version: '1' })
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get('provinces')
  provinces(): Promise<Province[]> {
    return this.geography.listProvinces();
  }

  @Get('districts')
  districts(
    @Query(new ZodValidationPipe(DistrictListQuery))
    query: DistrictListQuery,
  ): Promise<District[]> {
    return this.geography.listDistricts(query);
  }

  /**
   * Sectors — the third level of the address cascade.
   *
   * A sector row resolves upward to its district and province, so keeping the
   * sector id is keeping the top three levels. Province and district are
   * collected to drive the picker, never written a second time (D24).
   */
  @Get('sectors')
  sectors(
    @Query(new ZodValidationPipe(SectorListQuery))
    query: SectorListQuery,
  ): Promise<Sector[]> {
    return this.geography.listSectors(query);
  }

  /**
   * Cells — the fourth level, and the one nothing stores.
   *
   * It exists to drive the village picker, exactly as province exists to drive
   * the district one: a village resolves upward to its cell, so writing the
   * cell too would be a second copy of the same fact.
   */
  @Get('cells')
  cells(
    @Query(new ZodValidationPipe(CellListQuery))
    query: CellListQuery,
  ): Promise<Cell[]> {
    return this.geography.listCells(query);
  }

  /**
   * Villages — the fifth level, and the second one stored (`orgs.village_id`,
   * `user_profiles.village_id`).
   *
   * Nearly fifteen thousand rows, so a caller that does not pass `cellId` asks
   * for all of them. The address picker always passes one.
   */
  @Get('villages')
  villages(
    @Query(new ZodValidationPipe(VillageListQuery))
    query: VillageListQuery,
  ): Promise<Village[]> {
    return this.geography.listVillages(query);
  }
}
