// The service imports IdentityService, which reads the demo code from the
// ESM-only auth package; every spec that reaches it mocks it the same way.
jest.mock('@injishi/auth', () => ({ DEMO_OTP_CODE: '123456' }));

import { BadRequestException } from '@nestjs/common';
import type { CreateRegistrationRequest } from '@injishi/contracts';

import type { OrganizationRepository } from '../infrastructure/organization.repository';
import type { RraTinAdapter, TinCheckOutcome } from '../infrastructure/rra-tin.adapter';
import type { IdentityService } from '../../user/application/identity.service';
import type { ProfileService } from '../../user/application/profile.service';
import { RegistrationService } from './registration.service';

/**
 * The TIN pre-check (registration Phase 0): a TIN RRA refuses is found at the
 * Business step and refused at create, before any bill exists. An RRA outage
 * refuses nothing, because the check after payment still covers it.
 */

const TIN = '999031001';

function outcome(result: TinCheckOutcome['result']): TinCheckOutcome {
  const base = { latencyMs: 1, adapterMode: 'mock' as const, raw: null };
  if (result === 'failed') return { result, reason: 'unknown', ...base };
  if (result === 'pending') return { result, reason: 'adapter_unavailable', ...base };
  return { result, ...base, business: null };
}

function service(opts: {
  taken?: boolean;
  verify?: () => Promise<TinCheckOutcome>;
}): { svc: RegistrationService; createRegistration: jest.Mock } {
  const createRegistration = jest.fn();
  const orgs = {
    tinTaken: jest.fn(async () => opts.taken ?? false),
    createRegistration,
  } as unknown as OrganizationRepository;
  const tin = {
    verify: jest.fn(opts.verify ?? (async () => outcome('verified'))),
  } as unknown as RraTinAdapter;
  const profiles = {
    save: jest.fn(),
    isComplete: jest.fn(async () => true),
    documentFor: jest.fn(async () => null),
  } as unknown as ProfileService;
  const identity = {
    assertMayRegister: jest.fn(async () => undefined),
  } as unknown as IdentityService;
  const svc = new RegistrationService(
    orgs,
    tin,
    profiles,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    identity,
    { clear: jest.fn(async () => undefined) } as never,
  );
  return { svc, createRegistration };
}

describe('RegistrationService.checkTin', () => {
  it('says verified when RRA recognises the TIN', async () => {
    const { svc } = service({});
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('verified');
  });

  it('says failed when RRA does not', async () => {
    const { svc } = service({ verify: async () => outcome('failed') });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('failed');
  });

  it('says taken before asking RRA when another business holds it', async () => {
    const verify = jest.fn(async () => outcome('verified'));
    const { svc } = service({ taken: true, verify });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('taken');
    expect(verify).not.toHaveBeenCalled();
  });

  it('reads an adapter that throws as pending, never as a refusal', async () => {
    const { svc } = service({
      verify: async () => {
        throw new Error('RRA down');
      },
    });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('pending');
  });
});

describe('RegistrationService.create, the TIN gate before the bill', () => {
  const request = {
    role: 'host',
    business: { domain: 'hospitality', tin: TIN },
  } as unknown as CreateRegistrationRequest;

  it('refuses a TIN RRA does not recognise, at the TIN field, writing nothing', async () => {
    const { svc, createRegistration } = service({
      verify: async () => outcome('failed'),
    });
    const refusal = await svc.create(request, 'user-1').catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(BadRequestException);
    expect(
      ((refusal as BadRequestException).getResponse() as { issues: { path: unknown[] }[] })
        .issues[0]?.path,
    ).toEqual(['business', 'tin']);
    expect(createRegistration).not.toHaveBeenCalled();
  });
});
