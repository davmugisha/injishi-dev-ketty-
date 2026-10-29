import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import fastifyMultipart from '@fastify/multipart';
import { VersioningType, type ExecutionContext } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import { StorageService } from '../../../modules/storage/application/storage.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CERTIFICATE_LIMIT_PER_WINDOW,
  UPLOAD_LIMIT_PER_WINDOW,
  UPLOAD_THROTTLERS,
  UPLOAD_WINDOW_MS,
  uploadRefusalMessage,
} from './upload-throttler.guard';
import { UploadsController } from './uploads.controller';

/**
 * The upload throttle over real HTTP, on the Fastify adapter `main` uses.
 *
 * The session guard is stood in for by one that names the caller from a test
 * header, so two people can be told apart; the storage service is stood in for
 * so nothing is written. The throttler is real, in memory, and rebuilt for every
 * test so no bucket leaks between them.
 */

const ATTACHMENT = '/api/v1/uploads';
const CERTIFICATE = '/api/v1/uploads/certificate';
const PROPERTY_PHOTO = '/api/v1/uploads/property-photo';

const BOUNDARY = '----injishi-upload-spec';

/** A one-file multipart body, with any extra text fields beside the file. */
function multipart(fields: Record<string, string> = {}): { payload: string; headers: Record<string, string> } {
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  parts.push(
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\nnot really a jpeg\r\n`,
  );
  return {
    payload: `${parts.join('')}--${BOUNDARY}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

describe('upload throttle limits', () => {
  it('allows 30 uploads per person in 10 minutes, and 10 certificates', () => {
    expect(UPLOAD_LIMIT_PER_WINDOW).toBe(30);
    expect(CERTIFICATE_LIMIT_PER_WINDOW).toBe(10);
    expect(UPLOAD_WINDOW_MS).toBe(10 * 60_000);
    expect(UPLOAD_THROTTLERS.map((t) => [t.name, t.limit, t.ttl])).toEqual([
      ['uploads-user', 30, UPLOAD_WINDOW_MS],
      ['uploads-certificate', 10, UPLOAD_WINDOW_MS],
    ]);
  });

  it('words a refusal in minutes a person can read', () => {
    expect(uploadRefusalMessage(600)).toBe(
      'Too many uploads in a short time. Try again in 10 minutes.',
    );
    expect(uploadRefusalMessage(20)).toBe(
      'Too many uploads in a short time. Try again in 1 minute.',
    );
  });
});

describe('UploadsController, throttled', () => {
  let app: NestFastifyApplication;
  let storage: Record<string, Mock>;

  beforeEach(async () => {
    storage = {
      putAttachment: vi.fn(async () => ({ objectKey: 'attachments/x' })),
      putCertificate: vi.fn(async () => ({ objectKey: 'certificates/x' })),
      putPropertyPhoto: vi.fn(async () => ({ objectKey: 'photos/x' })),
      removeOwnUnattached: vi.fn(async () => true),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'money', ttl: 60_000, limit: 5 }])],
      controllers: [UploadsController],
      providers: [{ provide: StorageService, useValue: storage }],
    })
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user?: { id: string } }>();
          const id = request.headers['x-test-user'];
          if (!id) return false;
          request.user = { id };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyMultipart);
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  /** A request that fails validation (not multipart) but still passes the guards. */
  function bare(url: string, user = 'user-a'): ReturnType<NestFastifyApplication['inject']> {
    return app.inject({ method: 'POST', url, headers: { 'x-test-user': user } });
  }

  it('lets a real upload through under the limit', async () => {
    const { payload, headers } = multipart();

    const response = await app.inject({
      method: 'POST',
      url: PROPERTY_PHOTO,
      payload,
      headers: { ...headers, 'x-test-user': 'user-a' },
    });

    expect(response.statusCode).toBe(201);
    expect(storage.putPropertyPhoto).toHaveBeenCalledTimes(1);
  });

  it('refuses the 31st upload in the window with 429, a readable message and Retry-After', async () => {
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW; i += 1) {
      const ok = await bare(PROPERTY_PHOTO);
      expect(ok.statusCode).toBe(400);
    }

    const refused = await bare(PROPERTY_PHOTO);

    expect(refused.statusCode).toBe(429);
    expect(refused.json().message).toMatch(/^Too many uploads in a short time\. Try again in \d+ minutes?\.$/);
    expect(Number(refused.headers['retry-after-uploads-user'])).toBeGreaterThan(0);
  });

  it('refuses before the body is read, so a refused upload stores nothing', async () => {
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW; i += 1) await bare(PROPERTY_PHOTO);
    const { payload, headers } = multipart();

    const refused = await app.inject({
      method: 'POST',
      url: PROPERTY_PHOTO,
      payload,
      headers: { ...headers, 'x-test-user': 'user-a' },
    });

    expect(refused.statusCode).toBe(429);
    expect(storage.putPropertyPhoto).not.toHaveBeenCalled();
  });

  it('counts one budget across all three routes, so alternating routes does not multiply it', async () => {
    const routes = [ATTACHMENT, PROPERTY_PHOTO, CERTIFICATE];
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW; i += 1) {
      // Certificates stop at their own lower cap, so keep them under it.
      const url = i < CERTIFICATE_LIMIT_PER_WINDOW ? routes[i % 3] : routes[i % 2];
      expect((await bare(url)).statusCode).toBe(400);
    }

    expect((await bare(ATTACHMENT)).statusCode).toBe(429);
    expect((await bare(PROPERTY_PHOTO)).statusCode).toBe(429);
  });

  it('caps certificates lower, without spending the photo budget', async () => {
    for (let i = 0; i < CERTIFICATE_LIMIT_PER_WINDOW; i += 1) {
      expect((await bare(CERTIFICATE)).statusCode).toBe(400);
    }

    expect((await bare(CERTIFICATE)).statusCode).toBe(429);
    expect((await bare(PROPERTY_PHOTO)).statusCode).toBe(400);
  });

  it('keys on the person, so one uploader at the limit does not block another', async () => {
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW; i += 1) await bare(ATTACHMENT, 'user-a');

    expect((await bare(ATTACHMENT, 'user-a')).statusCode).toBe(429);
    expect((await bare(ATTACHMENT, 'user-b')).statusCode).toBe(400);
  });

  it('refuses a caller with no session at the session guard, which runs before the throttle', async () => {
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW + 5; i += 1) {
      const response = await app.inject({ method: 'POST', url: ATTACHMENT });
      expect(response.statusCode).toBe(403);
    }
  });

  it('does not throttle removing an upload', async () => {
    for (let i = 0; i < UPLOAD_LIMIT_PER_WINDOW; i += 1) await bare(ATTACHMENT);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${CERTIFICATE}?objectKey=certificates/x`,
      headers: { 'x-test-user': 'user-a' },
    });

    expect(removed.statusCode).toBe(200);
  });
});
