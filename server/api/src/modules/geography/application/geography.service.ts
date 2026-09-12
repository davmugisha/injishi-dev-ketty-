import { Injectable } from '@nestjs/common';
import {
  District,
  DistrictListQuery,
  Province,
  Sector,
  SectorListQuery,
} from '@injishi/contracts';

import { GeographyRepository } from '../infrastructure/geography.repository';

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
    return Province.array().parse(rows);
  }

  async listDistricts(query: DistrictListQuery): Promise<District[]> {
    const rows = await this.repo.findDistricts(query.provinceId);
    return District.array().parse(rows);
  }

  async listSectors(query: SectorListQuery): Promise<Sector[]> {
    const rows = await this.repo.findSectors(query.districtId);
    return Sector.array().parse(rows);
  }
}
