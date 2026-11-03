import type { OversightGrant } from '@injishi/contracts';
import type { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { PaymentPort } from '../../pay/domain/payment-port';
import type { ProfileService } from '../../user/application/profile.service';
import type { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import type { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import type { PsfRenewalRepository } from '../infrastructure/psf-renewal.repository';
import type { PsfReportRepository } from '../infrastructure/psf-report.repository';
import { PsfMembershipService } from './psf-membership.service';

const DM: OversightGrant = {
  assignmentId: '7a1f5b9e-2c4d-4e8f-9a1b-3c5d7e9f1a02',
  oversightRole: 'psf_membership_officer',
  governmentBodyCode: 'PSF',
  governmentTitle: null,
  scopeLevel: 'district',
  provinceId: 1,
  districtId: 102,
  sectorId: null,
  cellId: null,
  villageId: null,
};

interface DueRow {
  orgId: string;
  districtId: number;
  paymentDue: { amountRwf: number; since: string; docId: string; contactName: string; phoneE164: string; email: null; lastRemindedAt: string | null };
}

const due = (orgId: string, lastRemindedAt: string | null): DueRow => ({
  orgId,
  districtId: 102,
  paymentDue: { amountRwf: 30_000, since: '2026-11-01T10:00:00Z', docId: 'PSF-AAAA-BBBB', contactName: 'A', phoneE164: '+250788123456', email: null, lastRemindedAt },
});

function harness(rows: DueRow[]): {
  service: PsfMembershipService;
  repo: { registerPage: Mock; recordPaymentReminder: Mock; districtsByProvince: Mock };
  mail: { paymentReminder: Mock };
} {
  const repo = {
    registerPage: vi.fn().mockResolvedValue({ rows, more: false, total: rows.length }),
    recordPaymentReminder: vi.fn().mockResolvedValue(undefined),
    districtsByProvince: vi.fn().mockResolvedValue(new Map()),
  };
  const mail = { paymentReminder: vi.fn().mockResolvedValue(undefined) };
  const service = new PsfMembershipService(
    repo as unknown as PsfMembershipRepository,
    mail as unknown as PsfMembershipMailer,
    {} as unknown as ProfileService,
    {} as unknown as PaymentPort,
    { get: () => undefined } as unknown as ConfigService,
    {} as unknown as PsfReportRepository,
    {} as unknown as PsfRenewalRepository,
  );
  return { service, repo, mail };
}

describe('PSF payment reminders (2026-11-02)', () => {
  it('reminds every business waiting in the region, and records each', async () => {
    const { service, repo, mail } = harness([due('org-1', null), due('org-2', '2026-10-20T08:00:00Z')]);
    await expect(service.sendPaymentReminders('officer', [DM])).resolves.toEqual({ sent: 2, skipped: 0 });
    expect(mail.paymentReminder).toHaveBeenCalledWith('org-1', 30_000);
    expect(repo.recordPaymentReminder).toHaveBeenCalledTimes(2);
    expect(repo.registerPage).toHaveBeenCalledWith([102], { payment: 'due', orgId: undefined }, undefined, 500);
  });

  it('leaves a business reminded in the last day alone', async () => {
    const { service, mail } = harness([due('org-1', new Date(Date.now() - 3600 * 1000).toISOString()), due('org-2', null)]);
    await expect(service.sendPaymentReminders('officer', [DM])).resolves.toEqual({ sent: 1, skipped: 1 });
    expect(mail.paymentReminder).toHaveBeenCalledTimes(1);
    expect(mail.paymentReminder).toHaveBeenCalledWith('org-2', 30_000);
  });

  it('refuses one business that is not waiting in the region', async () => {
    const { service } = harness([]);
    await expect(service.sendPaymentReminders('officer', [DM], 'org-9')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a BDE reminds nobody', async () => {
    const { service, repo } = harness([due('org-1', null)]);
    await service.sendPaymentReminders('dbo', [{ ...DM, oversightRole: 'psf_business_officer' }]);
    // The edit scope of a BDE is no district at all.
    expect(repo.registerPage).toHaveBeenCalledWith([], { payment: 'due', orgId: undefined }, undefined, 500);
  });
});
