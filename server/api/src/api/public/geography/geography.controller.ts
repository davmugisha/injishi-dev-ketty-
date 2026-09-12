import { Controller, Get, Query } from '@nestjs/common';
import {
  District,
  DistrictListQuery,
  Province,
  Sector,
  SectorListQuery,
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
   * Sectors — the third level of the address cascade, and the only one stored.
   *
   * A sector row resolves upward to its district and province, so keeping the
   * sector id is keeping the whole address. Province and district are collected
   * to drive the picker, never written a second time (D24).
   */
  @Get('sectors')
  sectors(
    @Query(new ZodValidationPipe(SectorListQuery))
    query: SectorListQuery,
  ): Promise<Sector[]> {
    return this.geography.listSectors(query);
  }
}
