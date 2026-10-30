import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { MailerPort, MailMessage } from '../../mailer/domain/mailer-port';
import type { OrganizationRepository } from './organization.repository';
import { RegistrationMailer } from './registration.mailer';

/**
 * `RegistrationMailer` resolves recipients and owns delivery. The port and the
 * repository are both faked: a recorder for what was sent, and a repository
 * holding one business in Gasabo (102), its owner and a set of officers.
 */

const ORG = '0f000000-0000-4000-8000-000000000001';
const WS = '0f000000-0000-4000-8000-0000000000aa';
type Recipient = { userId: string; email: string; name: string | null };
const OWNER: Recipient = { userId: 'owner', email: 'owner@example.test', name: 'Aline Uwase' };

function configFrom(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function recorder(): MailerPort & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send: async (message) => {
      sent.push(message);
    },
  };
}

type Officer = {
  userId: string;
  email: string;
  name: string | null;
  scopeLevel: 'country' | 'province' | 'district';
  provinceId: number | null;
  districtId: number | null;
};

function fakeRepo(over: {
  officers?: Partial<Record<'business_field_verifier' | 'business_approver', Officer[]>>;
  members?: string[];
  fieldVerifier?: string | null;
  owners?: Recipient[];
  facts?: unknown;
} = {}): OrganizationRepository {
  return {
    registrationMailFacts: async () =>
      over.facts === undefined
        ? {
            legalName: 'Kigali Hills Guest House',
            tin: '123456789',
            districtId: 102,
            districtName: 'Gasabo',
            sectorName: 'Bumbogo',
            workspaceId: WS,
          }
        : over.facts,
    activeOwnerRecipients: async () => over.owners ?? [OWNER],
    activeOversightAssignments: async (role: 'business_field_verifier' | 'business_approver') =>
      over.officers?.[role] ?? [],
    districtsByProvince: async (ids: readonly number[]) =>
      new Map(ids.includes(1) ? [[1, [101, 102, 103]]] : []),
    latestFieldVerifierId: async () => over.fieldVerifier ?? null,
    holdsOrgRole: async (_org: string, userId: string) =>
      (over.members ?? []).includes(userId),
  } as unknown as OrganizationRepository;
}

const officer = (
  userId: string,
  scope: Pick<Officer, 'scopeLevel' | 'provinceId' | 'districtId'>,
): Officer => ({ userId, email: `${userId}@example.test`, name: null, ...scope });

let error: MockInstance;
beforeEach(() => {
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RegistrationMailer · registrant mails', () => {
  it('mails every owner the received mail, linked to web', async () => {
    const port = recorder();
    const second = { userId: 'co', email: 'co@example.test', name: null };
    const mailer = new RegistrationMailer(
      port,
      configFrom({ WEB_URL: 'https://www.injishi.com' }),
      fakeRepo({ owners: [OWNER, second] }),
    );
    await mailer.received(ORG, 50000);
    expect(port.sent.map((m) => m.to)).toEqual([OWNER.email, second.email]);
    expect(port.sent[0]?.subject).toBe('We received your registration for Kigali Hills Guest House');
    expect(port.sent[0]?.text).toContain('https://www.injishi.com/register');
  });

  it('links the approval mail to the workspace setup screen', async () => {
    const port = recorder();
    await new RegistrationMailer(port, configFrom({}), fakeRepo()).approved(ORG, false);
    expect(port.sent).toHaveLength(1);
    expect(port.sent[0]?.text).toContain(`http://localhost:3000/w/${WS}/setup`);
  });

  it('does not link an OBO approval to setup', async () => {
    const port = recorder();
    await new RegistrationMailer(port, configFrom({}), fakeRepo()).approved(ORG, true);
    expect(port.sent[0]?.text).not.toContain('/setup');
  });

  it('carries the reason and notes into the rejection mail', async () => {
    const port = recorder();
    await new RegistrationMailer(port, configFrom({}), fakeRepo()).rejected(ORG, {
      gate: 'tin_verified',
      reasonCode: 'premises_not_found',
      notes: 'Nobody at the address on 12 September.',
    });
    expect(port.sent[0]?.text).toContain('Nobody at the address on 12 September.');
  });

  it('sends nothing for an org that no longer exists', async () => {
    const port = recorder();
    await new RegistrationMailer(port, configFrom({}), fakeRepo({ facts: null })).submitted(ORG, false);
    expect(port.sent).toHaveLength(0);
  });
});

describe('RegistrationMailer · officer mails', () => {
  it('mails only officers whose region covers the district, never a member of the business', async () => {
    const port = recorder();
    const repo = fakeRepo({
      officers: {
        business_field_verifier: [
          officer('gasabo', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
          officer('rubavu', { scopeLevel: 'district', provinceId: null, districtId: 301 }),
          officer('kigali', { scopeLevel: 'province', provinceId: 1, districtId: null }),
          officer('conflicted', { scopeLevel: 'country', provinceId: null, districtId: null }),
        ],
      },
      members: ['conflicted'],
    });
    await new RegistrationMailer(port, configFrom({}), repo).queueEntered(ORG, 'business_field_verifier');
    expect(port.sent.map((m) => m.to).sort()).toEqual(['gasabo@example.test', 'kigali@example.test']);
    expect(port.sent[0]?.subject).toBe('Field verification needed — Kigali Hills Guest House');
    expect(port.sent[0]?.text).toContain('http://localhost:3000/oversight/verifier/queue');
  });

  it('never mails the approval queue to the officer who field verified the business', async () => {
    const port = recorder();
    const repo = fakeRepo({
      officers: {
        business_approver: [
          officer('dual', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
          officer('claudine', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
        ],
      },
      fieldVerifier: 'dual',
    });
    await new RegistrationMailer(port, configFrom({}), repo).queueEntered(ORG, 'business_approver');
    expect(port.sent.map((m) => m.to)).toEqual(['claudine@example.test']);
    expect(port.sent[0]?.text).toContain('/oversight/approver/queue');
  });
});

describe('RegistrationMailer · failure never throws', () => {
  it('logs a refused send and still tries the next recipient', async () => {
    const sent: string[] = [];
    const port: MailerPort = {
      send: async (m) => {
        if (m.to === OWNER.email) throw new Error('SMTP delivery failed: 550 no such user');
        sent.push(m.to);
      },
    };
    const second = { userId: 'co', email: 'co@example.test', name: null };
    await expect(
      new RegistrationMailer(port, configFrom({}), fakeRepo({ owners: [OWNER, second] })).submitted(ORG, false),
    ).resolves.toBeUndefined();
    expect(sent).toEqual([second.email]);
    expect(String(error.mock.calls[0]?.[0])).toContain('550 no such user');
  });

  it('gives up on a silent transport after the ceiling, without throwing', async () => {
    vi.useFakeTimers();
    const port: MailerPort = { send: () => new Promise<void>(() => undefined) };
    const pending = new RegistrationMailer(port, configFrom({}), fakeRepo()).fieldVerified(ORG);
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(pending).resolves.toBeUndefined();
    expect(String(error.mock.calls[0]?.[0])).toContain('did not respond within 8000ms');
  });

  it('swallows a repository failure', async () => {
    const port = recorder();
    const repo = {
      registrationMailFacts: async () => {
        throw new Error('connection terminated');
      },
    } as unknown as OrganizationRepository;
    await expect(
      new RegistrationMailer(port, configFrom({}), repo).queueEntered(ORG, 'business_approver'),
    ).resolves.toBeUndefined();
    expect(port.sent).toHaveLength(0);
    expect(String(error.mock.calls[0]?.[0])).toContain('connection terminated');
  });

  it('refuses to be built in production without WEB_URL', () => {
    expect(
      () => new RegistrationMailer(recorder(), configFrom({ NODE_ENV: 'production' }), fakeRepo()),
    ).toThrow(/WEB_URL/);
  });
});
