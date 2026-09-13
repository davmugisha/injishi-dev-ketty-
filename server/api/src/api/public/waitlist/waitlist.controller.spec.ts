import type { WaitlistSignupInput } from '@injishi/contracts';
import { VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

/**
 * The public waitlist intake over real HTTP (ADR-048).
 *
 * Booted on the Fastify adapter with the same prefix and versioning `main`
 * uses, because three of the things this controller promises only exist once a
 * request goes through Nest: the status is chosen after the insert (201 or
 * 200), the contract is enforced by a pipe on the body, and the throttle is a
 * guard. Calling the method directly would test none of them.
 *
 * The service is the boundary and is stood in for; its own behaviour is
 * `waitlist.service.spec.ts`. The throttler is real, in memory, and rebuilt for
 * every test so no bucket leaks between them.
 */

const SIGNUPS = '/api/v1/waitlist/signups';
const NEW_ID = '00000000-0000-4000-8000-000000000001';

const TRAVELLER = {
  audience: 'traveller',
  email: 'amani@example.com',
  fullName: 'Amani Uwase',
};

const OWNER = {
  audience: 'owner',
  email: 'owner@example.rw',
  fullName: 'Jean Mugabo',
  phone: '0788123456',
  businessName: 'Lake Kivu Lodge',
  districtId: 42,
  propertyType: 'lodge',
  sizeBand: '6_20',
};

describe('WaitlistController', () => {
  let app: NestFastifyApplication;
  let join: jest.Mock;
  let unsubscribe: jest.Mock;

  beforeEach(async () => {
    join = jest.fn(async () => ({ id: NEW_ID, alreadyJoined: false }));
    unsubscribe = jest.fn(async () => ({ ok: true }));

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'money', ttl: 60_000, limit: 5 }])],
      controllers: [WaitlistController],
      providers: [{ provide: WaitlistService, useValue: { join, unsubscribe } }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  /** One signup from one client address, the way Traefik forwards it. */
  function signup(
    payload: object,
    client = '203.0.113.10',
  ): ReturnType<NestFastifyApplication['inject']> {
    return app.inject({
      method: 'POST',
      url: SIGNUPS,
      payload,
      headers: { 'x-forwarded-for': `${client}, 10.0.0.2` },
    });
  }

  describe('POST /waitlist/signups', () => {
    it('answers 201 for a new signup (covers: AC-9)', async () => {
      const response = await signup(TRAVELLER);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ id: NEW_ID, alreadyJoined: false });
    });

    it('answers 200 when the address was already stored (covers: AC-10)', async () => {
      join.mockResolvedValueOnce({ id: NEW_ID, alreadyJoined: true });

      const response = await signup(TRAVELLER);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: NEW_ID, alreadyJoined: true });
    });

    it('echoes nothing the caller sent (covers: AC-9)', async () => {
      const response = await signup(OWNER);

      expect(response.body).not.toContain(OWNER.email);
      expect(response.body).not.toContain(OWNER.fullName);
      expect(response.body).not.toContain(OWNER.businessName);
    });

    it('accepts a traveller with the phone left out, and defaults consent to false (covers: AC-8, AC-15)', async () => {
      const response = await signup(TRAVELLER);

      expect(response.statusCode).toBe(201);
      expect(join).toHaveBeenCalledWith({ ...TRAVELLER, marketingOptIn: false });
    });

    it('hands the service a trimmed, lower-cased address (covers: AC-10)', async () => {
      await signup({ ...TRAVELLER, email: '  Amani@Example.COM ' });

      expect(join.mock.calls[0][0].email).toBe('amani@example.com');
    });

    it('normalises a local owner number to +250 before the service sees it (covers: AC-8)', async () => {
      const response = await signup(OWNER);

      expect(response.statusCode).toBe(201);
      const input = join.mock.calls[0][0] as Extract<WaitlistSignupInput, { audience: 'owner' }>;
      expect(input.phone).toBe('+250788123456');
    });

    it.each([
      ['a non Rwandan owner phone', { ...OWNER, phone: '12345' }],
      ['an owner with no business name', { ...OWNER, businessName: undefined }],
      ['an owner with no district', { ...OWNER, districtId: undefined }],
      ['a property type outside the list', { ...OWNER, propertyType: 'castle' }],
      ['an address that is not an email', { ...TRAVELLER, email: 'amani' }],
      ['an empty name', { ...TRAVELLER, fullName: '   ' }],
      ['an unknown key', { ...TRAVELLER, role: 'admin' }],
      ['an unknown audience', { ...TRAVELLER, audience: 'investor' }],
      ['a name longer than the cap', { ...TRAVELLER, fullName: 'x'.repeat(121) }],
      ['no body at all', {}],
    ])('refuses %s with 400 and writes nothing (covers: AC-8, AC-14)', async (_label, payload) => {
      const response = await signup(payload);

      expect(response.statusCode).toBe(400);
      expect(join).not.toHaveBeenCalled();
    });

    it('does not answer a GET', async () => {
      const response = await app.inject({ method: 'GET', url: SIGNUPS });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /waitlist/signups, throttled', () => {
    it('refuses the sixth signup in an hour from one client with 429 (covers: AC-13)', async () => {
      for (let i = 1; i <= 5; i += 1) {
        const ok = await signup({ ...TRAVELLER, email: `guest${i}@example.com` });
        expect(ok.statusCode).toBe(201);
      }

      const sixth = await signup({ ...TRAVELLER, email: 'guest6@example.com' });

      expect(sixth.statusCode).toBe(429);
      expect(join).toHaveBeenCalledTimes(5);
    });

    it('counts people by the leftmost forwarded address, not the proxy (covers: AC-13)', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await signup({ ...TRAVELLER, email: `guest${i}@example.com` }, '203.0.113.10');
      }

      const someoneElse = await signup(
        { ...TRAVELLER, email: 'other@example.com' },
        '198.51.100.7',
      );

      expect(someoneElse.statusCode).toBe(201);
    });

    it('refuses a third signup for one mailbox in an hour, from any client (covers: AC-13)', async () => {
      await signup(TRAVELLER, '203.0.113.1');
      await signup(TRAVELLER, '203.0.113.2');

      const third = await signup(TRAVELLER, '203.0.113.3');

      expect(third.statusCode).toBe(429);
      expect(join).toHaveBeenCalledTimes(2);
    });

    it('counts plus tags and letter case as the same mailbox (covers: AC-13)', async () => {
      await signup({ ...TRAVELLER, email: 'amani+one@example.com' }, '203.0.113.1');
      await signup({ ...TRAVELLER, email: 'AMANI+two@example.com' }, '203.0.113.2');

      const third = await signup(TRAVELLER, '203.0.113.3');

      expect(third.statusCode).toBe(429);
    });
  });

  describe('POST /waitlist/unsubscribe/:token', () => {
    const TOKEN = '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f607';

    it('answers 200 with ok and passes the token through (covers: AC-12)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/waitlist/unsubscribe/${TOKEN}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(unsubscribe).toHaveBeenCalledWith(TOKEN);
    });

    it('is not throttled, so a repeated token never answers differently (covers: AC-12)', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 8; i += 1) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/waitlist/unsubscribe/${TOKEN}`,
        });
        statuses.push(response.statusCode);
      }

      expect(new Set(statuses)).toEqual(new Set([200]));
    });

    it('does not answer a GET, so a mail client prefetching the link unsubscribes nobody (covers: AC-12)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/waitlist/unsubscribe/${TOKEN}`,
      });

      expect(response.statusCode).toBe(404);
      expect(unsubscribe).not.toHaveBeenCalled();
    });
  });
});
