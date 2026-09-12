import { Test } from '@nestjs/testing';

import { GeographyService } from './geography.service';
import { GeographyRepository } from '../infrastructure/geography.repository';

describe('GeographyService', () => {
  const repo = {
    findProvinces: jest.fn(),
    findDistricts: jest.fn(),
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

  beforeEach(() => jest.clearAllMocks());

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
});
