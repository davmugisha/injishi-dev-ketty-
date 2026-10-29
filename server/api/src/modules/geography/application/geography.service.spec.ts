import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Test } from '@nestjs/testing';

import { GeographyService } from './geography.service';
import { GeographyRepository } from '../infrastructure/geography.repository';

describe('GeographyService', () => {
  const repo = {
    findProvinces: vi.fn(),
    findDistricts: vi.fn(),
    findCells: vi.fn(),
    findVillages: vi.fn(),
    findVillagePlacement: vi.fn(),
  };

  const build = async (): Promise<GeographyService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GeographyService,
        { provide: GeographyRepository, useValue: repo },
      ],
    }).compile();
    return moduleRef.get(GeographyService);
  };

  beforeEach(() => vi.clearAllMocks());

  it('returns provinces validated against the contract', async () => {
    repo.findProvinces.mockResolvedValue([
      { id: 1, name: 'Kigali City' },
      { id: 2, name: 'Eastern' },
    ]);
    const service = await build();

    await expect(service.listProvinces()).resolves.toEqual([
      { id: 1, name: 'Kigali City' },
      { id: 2, name: 'Eastern' },
    ]);
  });

  it('names places as people write them, not as the reference dump holds them', async () => {
    repo.findProvinces.mockResolvedValue([{ id: 5, name: 'EAST' }]);
    repo.findCells.mockResolvedValue([
      { id: 1, name: 'Nyakabanda Ii', sectorId: 10201 },
      { id: 2, name: 'GATUMBA', sectorId: 10201 },
    ]);
    const service = await build();

    await expect(service.listProvinces()).resolves.toEqual([
      { id: 5, name: 'Eastern Province' },
    ]);
    await expect(service.listCells({ sectorId: 10201 })).resolves.toEqual([
      { id: 1, name: 'Nyakabanda II', sectorId: 10201 },
      { id: 2, name: 'Gatumba', sectorId: 10201 },
    ]);
  });

  it('passes the optional provinceId filter through to the repository', async () => {
    repo.findDistricts.mockResolvedValue([
      { id: 11, name: 'Gasabo', provinceId: 1 },
    ]);
    const service = await build();

    await expect(service.listDistricts({ provinceId: 1 })).resolves.toEqual([
      { id: 11, name: 'Gasabo', provinceId: 1 },
    ]);
    expect(repo.findDistricts).toHaveBeenCalledWith(1);
  });

  it('throws if a row violates the contract (schema/DB drift)', async () => {
    repo.findProvinces.mockResolvedValue([{ id: -1, name: '' }]);
    const service = await build();

    await expect(service.listProvinces()).rejects.toThrow();
  });

  it('passes the optional sectorId filter through when listing cells', async () => {
    repo.findCells.mockResolvedValue([
      { id: 1020101, name: 'Rukiri I', sectorId: 10201 },
    ]);
    const service = await build();

    await expect(service.listCells({ sectorId: 10201 })).resolves.toEqual([
      { id: 1020101, name: 'Rukiri I', sectorId: 10201 },
    ]);
    expect(repo.findCells).toHaveBeenCalledWith(10201);
  });

  it('passes the optional cellId filter through when listing villages', async () => {
    repo.findVillages.mockResolvedValue([
      { id: 102010101, name: 'Amahoro', cellId: 1020101 },
    ]);
    const service = await build();

    await expect(service.listVillages({ cellId: 1020101 })).resolves.toEqual([
      { id: 102010101, name: 'Amahoro', cellId: 1020101 },
    ]);
    expect(repo.findVillages).toHaveBeenCalledWith(1020101);
  });

  it('rejects a village row that violates the contract', async () => {
    repo.findVillages.mockResolvedValue([{ id: 1, name: '', cellId: 0 }]);
    const service = await build();

    await expect(service.listVillages({})).rejects.toThrow();
  });

  it('accepts a village that sits under the sector it was sent with', async () => {
    repo.findVillagePlacement.mockResolvedValue({
      villageId: 102010101,
      cellId: 1020101,
      sectorId: 10201,
    });
    const service = await build();

    await expect(
      service.checkVillageInSector(102010101, 10201),
    ).resolves.toEqual({ ok: true });
  });

  it('refuses a village that sits under a different sector', async () => {
    repo.findVillagePlacement.mockResolvedValue({
      villageId: 102010101,
      cellId: 1020101,
      sectorId: 10201,
    });
    const service = await build();

    await expect(
      service.checkVillageInSector(102010101, 10202),
    ).resolves.toEqual({
      ok: false,
      message: 'That village is not in the sector you chose.',
    });
  });

  it('refuses a village id no row carries, and says so differently', async () => {
    repo.findVillagePlacement.mockResolvedValue(null);
    const service = await build();

    await expect(service.checkVillageInSector(999999999, 10201)).resolves.toEqual(
      {
        ok: false,
        message: 'That village does not exist. Pick one from the list.',
      },
    );
  });
});
