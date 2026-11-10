import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { OversightGrant } from '@injishi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import type { PsfReportRepository } from '../infrastructure/psf-report.repository';
import type { PsfSetupRepository } from '../infrastructure/psf-setup.repository';
import type { PsfMembershipService } from './psf-membership.service';
import { PsfSetupService } from './psf-setup.service';

const NATIONAL = [{ oversightRole: 'psf_membership_officer', scopeLevel: 'country' }] as unknown as OversightGrant[];
const REGIONAL = [{ oversightRole: 'psf_membership_officer', scopeLevel: 'province', provinceId: 1 }] as unknown as OversightGrant[];

function harness(over: Record<string, unknown> = {}): { service: PsfSetupService; repo: Record<string, ReturnType<typeof vi.fn>> } {
  const repo = {
    splitHistory: vi.fn().mockResolvedValue([{ districtPercent: 60, setByName: null, at: new Date() }]),
    setSplit: vi.fn().mockResolvedValue(undefined),
    levels: vi.fn().mockResolvedValue([{ code: 'indatwa', nameEn: 'Indatwa', blurbEn: null, sortOrder: 30, active: true }]),
    bands: vi.fn().mockResolvedValue([
      { code: 'a', family: 'indatwa', nameEn: 'Indatwa, 50,000 to 99,999', annualFeeMinRwf: 50000, annualFeeMaxRwf: 99999, annualFeeRwf: null, priceKind: 'range', sortOrder: 1, active: true },
      { code: 'b', family: 'indatwa', nameEn: 'Indatwa, 100,000 to 199,999', annualFeeMinRwf: 100000, annualFeeMaxRwf: 199999, annualFeeRwf: null, priceKind: 'range', sortOrder: 2, active: true },
    ]),
    bandMembers: vi.fn().mockResolvedValue(new Map()),
    updateBand: vi.fn().mockResolvedValue(2),
    insertBand: vi.fn().mockResolvedValue(true),
    formSettings: vi.fn().mockResolvedValue([]),
    extras: vi.fn().mockResolvedValue([]),
    saveFormSetting: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const service = new PsfSetupService(repo as unknown as PsfSetupRepository, {} as PsfMembershipRepository, {} as PsfMembershipService, {} as PsfReportRepository);
  return { service, repo: repo as Record<string, ReturnType<typeof vi.fn>> };
}

describe('PSF setup (2026-11-06)', () => {
  it('lets only the National Manager change the split, a band or the form', async () => {
    const { service, repo } = harness();
    await expect(service.setSplit('u', REGIONAL, { districtPercent: 10 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateBand('u', REGIONAL, 'b', { minRwf: 90000 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateFormField('u', REGIONAL, 'website', { required: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.setSplit).not.toHaveBeenCalled();
    await service.setSplit('u', NATIONAL, { districtPercent: 70 });
    expect(repo.setSplit).toHaveBeenCalledWith(70, 'u');
  });

  it('refuses a band range that overlaps another, writing nothing', async () => {
    const { service, repo } = harness();
    await expect(service.updateBand('u', NATIONAL, 'b', { minRwf: 90000 })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.updateBand).not.toHaveBeenCalled();
  });

  it('renames a band still named by its range, and says which prices the new range cleared', async () => {
    const { service, repo } = harness();
    const view = await service.updateBand('u', NATIONAL, 'b', { minRwf: 120000 });
    expect(repo.updateBand).toHaveBeenCalledWith('b', expect.objectContaining({ nameEn: 'Indatwa, 120,000 to 199,999', minRwf: 120000, maxRwf: 199999 }), 'u');
    expect(view.note).toContain('2 prices');
  });

  it('keeps a locked field on the form, while its wording can change', async () => {
    const { service, repo } = harness();
    await expect(service.updateFormField('u', NATIONAL, 'phone', { visible: false })).rejects.toBeInstanceOf(UnprocessableEntityException);
    await service.updateFormField('u', NATIONAL, 'phone', { label: 'Mobile number' });
    expect(repo.saveFormSetting).toHaveBeenCalledWith('phone', { label: 'Mobile number' }, 'u');
  });

  it('holds a locked field required even if a stored row says otherwise', async () => {
    const { service } = harness({ formSettings: vi.fn().mockResolvedValue([{ fieldKey: 'phone', label: null, helpText: null, required: false, visible: false, sortOrder: null }]) });
    const phone = (await service.formConfig()).fields.find((f) => f.key === 'phone');
    expect(phone).toMatchObject({ required: true, visible: true });
  });

  it('asks a submission for what the settings require, and skips what they hide', async () => {
    const hidden = harness({ formSettings: vi.fn().mockResolvedValue([{ fieldKey: 'photo', label: null, helpText: null, required: null, visible: false, sortOrder: null }]) });
    const filled = { businessActivity: 'Coffee', cell: 1, village: 1 };
    await expect(hidden.service.assertSubmission(filled, {})).resolves.toEqual({});
    const shown = harness();
    await expect(shown.service.assertSubmission(filled, {})).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('keeps answers to live questions only, and refuses a required one left blank', async () => {
    const extra = { id: 'e', key: 'staff', step: 'business', label: 'Staff', helpText: null, fieldType: 'number', required: true, options: [], sortOrder: 1, active: true };
    const { service } = harness({ extras: vi.fn().mockResolvedValue([extra]) });
    const filled = { businessActivity: 'Coffee', cell: 1, village: 1, photo: 'k' };
    await expect(service.assertSubmission(filled, {})).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.assertSubmission(filled, { staff: 12, stray: 'x' })).resolves.toEqual({ staff: 12 });
  });
});
