import { randomUUID } from 'node:crypto';

import { ConflictException, HttpCode, HttpException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { defer, lastValueFrom } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../../database/drizzle/schema';
import type { Database } from '../database/database.module';
import { Idempotent, IdempotencyInterceptor, canonicalJson, requestHash } from './idempotency.interceptor';

describe('the request hash (mobile spec 0003, D-r)', () => {
  it('sorts keys, so the same body always hashes the same', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"e":0,"f":1}]},"b":1}');
  });

  it('leaves out the reported time pair, which changes on every attempt', () => {
    const first = requestHash('POST', '/api/v1/me/work/x/clock-in', {
      lat: 1,
      occurredAt: '2026-10-29T05:02:00.000Z',
      deviceSentAt: '2026-10-29T05:40:00.000Z',
    });
    const resend = requestHash('POST', '/api/v1/me/work/x/clock-in', {
      deviceSentAt: '2026-10-29T08:41:00.000Z',
      occurredAt: '2026-10-29T08:03:00.001Z',
      lat: 1,
    });
    expect(resend).toBe(first);
  });

  it('tells a different body, path or method apart', () => {
    const base = requestHash('POST', '/a', { lat: 1 });
    expect(requestHash('POST', '/a', { lat: 2 })).not.toBe(base);
    expect(requestHash('POST', '/b', { lat: 1 })).not.toBe(base);
    expect(requestHash('PUT', '/a', { lat: 1 })).not.toBe(base);
  });
});

/**
 * The store against a real Postgres: the conditional insert, the take over and
 * what is kept. OPT IN, like the rentals integration specs: set
 * `IDEMPOTENCY_IT_DATABASE_URL` to a THROWAWAY database migrated to 0102.
 */
const url = process.env.IDEMPOTENCY_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

class Routes {
  @HttpCode(200)
  @Idempotent()
  clockOut(): void {}

  @Idempotent({ required: true })
  breakStart(): void {}
}

maybe('the idempotency store against Postgres (IDEMPOTENCY_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let interceptor: IdempotencyInterceptor;
  let userId: string;
  const route = '/api/v1/me/work/:employeeId/clock-out';
  const path = '/api/v1/me/work/6f0d2c55-0000-4000-8000-000000000001/clock-out';

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    interceptor = new IdempotencyInterceptor(db, new Reflector());
    const [user] = await db
      .insert(schema.users)
      .values({ email: `idempotency-${randomUUID()}@test.injishi.invalid`, name: 'Idempotency test' })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    // The user's keys go with it (on delete cascade).
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
    await pool?.end();
  });

  function contextFor(key: string | null, body: unknown, handler: () => void = Routes.prototype.clockOut): ExecutionContext {
    const request = {
      method: 'POST',
      url: `${path}?x=1`,
      body,
      headers: key ? { 'idempotency-key': key } : {},
      routeOptions: { url: route },
      user: { id: userId },
    };
    return {
      getHandler: () => handler,
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
    } as unknown as ExecutionContext;
  }

  /** A handler that counts its runs and answers with `answer()`. */
  function handlerOf(answer: () => Promise<unknown>): CallHandler & { runs: number } {
    const handler = {
      runs: 0,
      handle: () =>
        defer(async () => {
          handler.runs += 1;
          return answer();
        }),
    };
    return handler;
  }

  async function send(context: ExecutionContext, handler: CallHandler): Promise<unknown> {
    return lastValueFrom(await interceptor.intercept(context, handler));
  }

  async function refusal(promise: Promise<unknown>): Promise<HttpException> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof HttpException) return error;
      throw error;
    }
    throw new Error('Expected a refusal');
  }

  const body = (deviceSentAt: string): Record<string, unknown> => ({
    occurredAt: '2026-10-29T05:02:00.000Z',
    deviceSentAt,
  });

  it('replays the first answer to a resend with a fresh deviceSentAt, and runs once', async () => {
    const key = randomUUID();
    const handler = handlerOf(async () => ({ recordId: 'r1', closedAt: '2026-10-29T05:02:00.000Z' }));
    const first = await send(contextFor(key, body('2026-10-29T05:40:00.000Z')), handler);
    const resend = await send(contextFor(key, body('2026-10-29T05:41:30.000Z')), handler);
    expect(resend).toEqual(first);
    expect(handler.runs).toBe(1);
    const [row] = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)));
    expect(row?.statusCode).toBe(200);
    expect(row?.route).toBe(`POST ${route}`);
  });

  it('refuses the same key with a different body: idempotency_key_reused', async () => {
    const key = randomUUID();
    const handler = handlerOf(async () => ({ ok: true }));
    await send(contextFor(key, { lat: 1 }), handler);
    const refused = await refusal(send(contextFor(key, { lat: 2 }), handler));
    expect(refused.getStatus()).toBe(422);
    expect(refused.getResponse()).toMatchObject({ code: 'idempotency_key_reused' });
    expect(handler.runs).toBe(1);
  });

  it('answers request_in_progress while the first request still runs', async () => {
    const key = randomUUID();
    await db.insert(schema.idempotencyKeys).values({
      userId,
      key,
      method: 'POST',
      route: `POST ${route}`,
      requestHash: requestHash('POST', path, { lat: 1 }),
    });
    const handler = handlerOf(async () => ({ ok: true }));
    const refused = await refusal(send(contextFor(key, { lat: 1 }), handler));
    expect(refused.getStatus()).toBe(409);
    expect(refused.getResponse()).toMatchObject({ code: 'request_in_progress' });
    expect(handler.runs).toBe(0);
  });

  it('lets exactly one of two resends take over a request that died in flight', async () => {
    const key = randomUUID();
    await db.insert(schema.idempotencyKeys).values({
      userId,
      key,
      method: 'POST',
      route: `POST ${route}`,
      requestHash: requestHash('POST', path, { lat: 1 }),
      createdAt: sql`now() - interval '2 minutes'`,
    });
    const handler = handlerOf(async () => ({ ok: true }));
    const outcomes = await Promise.allSettled([
      send(contextFor(key, { lat: 1 }), handler),
      send(contextFor(key, { lat: 1 }), handler),
    ]);
    // One runs; the other is told to wait, or, when it reads the row after the
    // first finished, gets that answer replayed. Never a second run.
    expect(handler.runs).toBe(1);
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') expect(outcome.value).toEqual({ ok: true });
      else expect((outcome.reason as HttpException).getResponse()).toMatchObject({ code: 'request_in_progress' });
    }
    expect(outcomes.some((o) => o.status === 'fulfilled')).toBe(true);
  });

  it('stores a thrown 409 and replays it, because a refusal is an answer', async () => {
    const key = randomUUID();
    const handler = handlerOf(async () => {
      throw new ConflictException({ code: 'not_clocked_in', message: 'You are not clocked in.' });
    });
    const first = await refusal(send(contextFor(key, { lat: 1 }), handler));
    const resend = await refusal(send(contextFor(key, { lat: 1 }), handler));
    expect(handler.runs).toBe(1);
    expect(resend.getStatus()).toBe(409);
    expect(resend.getResponse()).toEqual(first.getResponse());
  });

  it('keeps no 5xx, so a resend runs again', async () => {
    const key = randomUUID();
    let fail = true;
    const handler = handlerOf(async () => {
      if (fail) throw new Error('database went away');
      return { ok: true };
    });
    await expect(send(contextFor(key, { lat: 1 }), handler)).rejects.toThrow('database went away');
    fail = false;
    expect(await send(contextFor(key, { lat: 1 }), handler)).toEqual({ ok: true });
    expect(handler.runs).toBe(2);
  });

  it('runs a write without a key as before, and refuses one where the key is required', async () => {
    const handler = handlerOf(async () => ({ ok: true }));
    expect(await send(contextFor(null, { lat: 1 }), handler)).toEqual({ ok: true });
    const refused = await refusal(send(contextFor(null, { lat: 1 }, Routes.prototype.breakStart), handler));
    expect(refused.getStatus()).toBe(400);
    expect(handler.runs).toBe(1);
  });
});
