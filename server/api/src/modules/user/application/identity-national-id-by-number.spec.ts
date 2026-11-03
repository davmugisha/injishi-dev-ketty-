import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { Platform } from '../../../shared/config/platform';
import type { StorageService } from '../../storage/application/storage.service';
import type { DocumentVerifierPort, NationalIdRegistryPort } from '../domain/identity-ports';
import type { IdentityRegistryPort, RegistryLookup } from '../domain/identity-registry-port';
import type { IdentityRepository } from '../infrastructure/identity.repository';
import { IdentityService } from './identity.service';

const NID = '1200570021035187';

function harness(
  lookup: RegistryLookup,
  opts: { heldByAnother?: boolean } = {},
): {
  service: IdentityService;
  repo: { find: Mock; heldByAnother: Mock; recordScan: Mock; recordTyped: Mock };
  register: { mode: string; lookupNationalId: Mock };
  registry: { mode: string; verify: Mock };
} {
  const repo = {
    find: vi.fn().mockResolvedValue({ kycStatus: 'none' }),
    heldByAnother: vi.fn().mockResolvedValue(opts.heldByAnother ?? false),
    recordScan: vi.fn().mockResolvedValue(1),
    recordTyped: vi.fn().mockResolvedValue(undefined),
  };
  const register = { mode: 'mock', lookupNationalId: vi.fn().mockResolvedValue(lookup) };
  const registry = { mode: 'mock', verify: vi.fn() };
  const service = new IdentityService(
    repo as unknown as IdentityRepository,
    { mode: 'mock' } as unknown as DocumentVerifierPort,
    {} as unknown as StorageService,
    register as unknown as IdentityRegistryPort,
    registry as unknown as NationalIdRegistryPort,
    { environment: 'production' } as unknown as Platform,
  );
  return { service, repo, register, registry };
}

const found: RegistryLookup = {
  status: 'found',
  generated: true,
  person: { fullName: 'Patrick Uwimana', dateOfBirth: '1990-06-13', gender: 'male', phoneE164: '+250788000234' },
} as RegistryLookup;

describe('National ID by number, no selfie (2026-11-02)', () => {
  it('fills NIDA’s details and leaves the ID for the reviewer, never verified', async () => {
    const { service, repo, registry } = harness(found);
    const res = await service.checkNationalId('user-1', { documentNumber: NID });
    expect(res).toMatchObject({ outcome: 'manual_needed', reason: null, mayContinue: false });
    expect(res.fields).toMatchObject({ fullName: 'Patrick Uwimana', checked: false, source: 'registry' });
    expect(repo.recordScan).toHaveBeenCalledWith(expect.objectContaining({ selfieObjectKey: null, outcome: 'manual_needed' }));
    expect(repo.recordTyped).toHaveBeenCalledWith('user-1', expect.objectContaining({ documentNumber: NID, documentType: 'national_id' }));
    // The selfie check (NIDA's face match) is not asked at all.
    expect(registry.verify).not.toHaveBeenCalled();
  });

  it('a number NIDA does not know is a failed try, with its own fix', async () => {
    const { service, repo } = harness({ status: 'not_found' });
    const res = await service.checkNationalId('user-1', { documentNumber: NID });
    expect(res).toMatchObject({ outcome: 'machine_failed', reason: 'not_found', fields: null });
    expect(repo.recordTyped).not.toHaveBeenCalled();
  });

  it('a number another account holds is refused', async () => {
    const { service } = harness(found, { heldByAnother: true });
    await expect(service.checkNationalId('user-1', { documentNumber: NID })).rejects.toBeInstanceOf(ConflictException);
  });
});
