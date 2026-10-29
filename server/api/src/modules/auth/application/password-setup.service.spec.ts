import { describe, expect, it, type Mock, vi } from 'vitest';

import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { PasswordHolders } from '../infrastructure/password-holders';
import { FRESH_CODE_MS, PasswordSetupService } from './password-setup.service';

/** Passwords are for tenants only, first set right after the invitation's code (2026-10-23). */
describe('PasswordSetupService', () => {
  const NOW = new Date('2026-10-23T10:00:00Z');

  function service(opts: {
    tenant?: boolean;
    has?: boolean;
    createdAgoMs?: number;
    proved?: boolean;
  }): { svc: PasswordSetupService; setPassword: Mock } {
    const created = new Date(NOW.getTime() - (opts.createdAgoMs ?? 60_000));
    const holders = {
      isTenant: vi.fn(async () => opts.tenant ?? true),
      hasPassword: vi.fn(async () => opts.has ?? false),
      session: vi.fn(async () => ({
        createdAt: created,
        twoFactorVerifiedAt: opts.proved === false ? null : created,
      })),
    } as unknown as PasswordHolders;
    const setPassword = vi.fn(async () => {});
    return { svc: new PasswordSetupService(holders, () => NOW), setPassword };
  }

  it('sets a tenant their first password straight after the code', async () => {
    const { svc, setPassword } = service({});
    await expect(svc.create('u', 's', 'long-enough-1', setPassword)).resolves.toEqual({ offered: true, set: true });
    expect(setPassword).toHaveBeenCalledWith('long-enough-1');
  });

  it('refuses a landlord, broker, admin or leader', async () => {
    const { svc, setPassword } = service({ tenant: false });
    await expect(svc.create('u', 's', 'long-enough-1', setPassword)).rejects.toBeInstanceOf(ForbiddenException);
    expect(setPassword).not.toHaveBeenCalled();
  });

  it('never replaces a password: changing one needs the current one', async () => {
    const { svc, setPassword } = service({ has: true });
    await expect(svc.create('u', 's', 'long-enough-1', setPassword)).rejects.toBeInstanceOf(ConflictException);
    expect(setPassword).not.toHaveBeenCalled();
  });

  it('refuses an old session, or one that never proved a code', async () => {
    const old = service({ createdAgoMs: FRESH_CODE_MS + 1 });
    await expect(old.svc.create('u', 's', 'long-enough-1', old.setPassword)).rejects.toBeInstanceOf(ForbiddenException);
    const google = service({ proved: false });
    await expect(google.svc.create('u', 's', 'long-enough-1', google.setPassword)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(old.setPassword).not.toHaveBeenCalled();
    expect(google.setPassword).not.toHaveBeenCalled();
  });

  it('offers a password to a tenant, and shows it to anybody who has one', async () => {
    await expect(service({ tenant: true }).svc.status('u')).resolves.toEqual({ offered: true, set: false });
    await expect(service({ tenant: false }).svc.status('u')).resolves.toEqual({ offered: false, set: false });
    await expect(service({ tenant: false, has: true }).svc.status('u')).resolves.toEqual({ offered: true, set: true });
  });
});
