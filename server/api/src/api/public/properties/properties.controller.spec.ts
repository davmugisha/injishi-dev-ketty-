import fastifyHelmet from '@fastify/helmet';
import { NotFoundException, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { ListingService } from '../../../modules/listing/application/listing.service';
import { PreLaunchGuard } from '../../../shared/pre-launch/pre-launch.guard';
import { PropertiesController } from './properties.controller';

/**
 * The public photo route over real HTTP.
 *
 * Booted on the Fastify adapter with helmet registered as `app.module.ts`
 * registers it, because what this route promises only exists once a reply goes
 * through Nest and the plugins' hooks: one response per request, the status the
 * handler chose, and the cross-origin header that overrides helmet's. Fastify's
 * own log is captured so a second send, which it reports rather than throws,
 * fails the test instead of passing silently.
 *
 * @fastify/cookie is the other plugin with a hook on every reply, but it loads
 * `cookie` through a dynamic import that Jest's CommonJS runtime refuses. Its
 * hook is a pass-through `onSend` with a callback, so one of those stands in.
 */

const PHOTO = '/api/v1/properties/photos/7b0c6b9e-3f53-4a47-9f0a-6a0a3b5f1c11';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const SIGNED = 'https://storage.example.com/property-photos/abc.jpg?X-Amz-Signature=deadbeef';

describe('PropertiesController photo route', () => {
  let app: NestFastifyApplication;
  let publicPhotoUrl: jest.Mock;
  let fastifyLog: string[];

  beforeEach(async () => {
    publicPhotoUrl = jest.fn();
    fastifyLog = [];

    const moduleRef = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: ListingService, useValue: { publicPhotoUrl } }],
    })
      .overrideGuard(PreLaunchGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: { level: 'warn', stream: { write: (line: string) => fastifyLog.push(line) } },
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.register(fastifyHelmet);
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onSend', (_request, _reply, payload, done) => done(null, payload));
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
