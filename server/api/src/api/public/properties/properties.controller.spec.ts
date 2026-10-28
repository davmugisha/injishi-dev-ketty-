import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { NotFoundException, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { ListingService } from '../../../modules/listing/application/listing.service';
import { PropertiesController } from './properties.controller';

/**
 * The public photo route over real HTTP.
 *
 * Booted on the Fastify adapter with helmet and @fastify/cookie registered as
 * `app.module.ts` registers them, because what this route promises only exists
 * once a reply goes through Nest and the plugins' hooks: one response per
 * request, the status the handler chose, and the cross-origin header that
 * overrides helmet's. Fastify's own log is captured so a second send, which it
 * reports rather than throws, fails the test instead of passing silently.
 */

const PHOTO = '/api/v1/properties/photos/7b0c6b9e-3f53-4a47-9f0a-6a0a3b5f1c11';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const SIGNED = 'https://storage.example.com/property-photos/abc.jpg?X-Amz-Signature=deadbeef';

describe('PropertiesController photo route', () => {
  let app: NestFastifyApplication;
  let publicPhotoUrl: Mock;
  let fastifyLog: string[];

  beforeEach(async () => {
    publicPhotoUrl = vi.fn();
    fastifyLog = [];

    const moduleRef = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: ListingService, useValue: { publicPhotoUrl } }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: { level: 'warn', stream: { write: (line: string) => fastifyLog.push(line) } },
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.register(fastifyHelmet);
    await app.register(fastifyCookie, { secret: 'properties-spec-cookie-secret' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const sentTwice = (): string[] => fastifyLog.filter((l) => /already sent|FST_ERR_REP_ALREADY_SENT/.test(l));

  it('answers a local data: URL with the image bytes, once', async () => {
    publicPhotoUrl.mockResolvedValue(`data:image/jpeg;base64,${JPEG.toString('base64')}`);

    const res = await app.inject({ method: 'GET', url: PHOTO });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.rawPayload.equals(JPEG)).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(sentTwice()).toEqual([]);
  });

  it('redirects to a signed storage URL with a 302, once', async () => {
    publicPhotoUrl.mockResolvedValue(SIGNED);

    const res = await app.inject({ method: 'GET', url: PHOTO });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(SIGNED);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(sentTwice()).toEqual([]);
  });

  it('answers 404 for a photo that is not public', async () => {
    publicPhotoUrl.mockRejectedValue(new NotFoundException());

    const res = await app.inject({ method: 'GET', url: PHOTO });

    expect(res.statusCode).toBe(404);
    expect(sentTwice()).toEqual([]);
  });
});
