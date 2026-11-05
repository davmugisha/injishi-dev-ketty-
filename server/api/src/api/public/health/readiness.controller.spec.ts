import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ReadinessController } from './readiness.controller';

type Deps = ConstructorParameters<typeof ReadinessController>;

function controller(opts: { db?: () => Promise<unknown>; ping?: () => Promise<unknown> }): ReadinessController {
  const db = { execute: opts.db ?? (async () => [{ '?column?': 1 }]) };
  const queue = { client: Promise.resolve({ ping: opts.ping ?? (async () => 'PONG') }) };
  // A two-method fake stands in for the database and the queue.
  return new ReadinessController(db as unknown as Deps[0], queue as unknown as Deps[1]);
}

async function failure(c: ReadinessController): Promise<Record<string, unknown>> {
  try {
    await c.ready();
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    return (error as ServiceUnavailableException).getResponse() as Record<string, unknown>;
  }
  throw new Error('expected readiness to fail');
}

describe('ReadinessController', () => {
  it('is ready when the database answers and Redis answers a PING', async () => {
    const report = await controller({}).ready();
    expect(report.status).toBe('ready');
    expect(report.checks.database.ok).toBe(true);
    expect(report.checks.redis.ok).toBe(true);
    expect(report.checks.database.reason).toBeUndefined();
  });

  it('answers 503 and names the database when only the database is down', async () => {
    const body = await failure(controller({ db: async () => Promise.reject(new Error('connect ECONNREFUSED')) }));
    expect(body.status).toBe('unavailable');
    expect((body.checks as Record<string, { ok: boolean; reason?: string }>).database).toMatchObject({ ok: false, reason: 'unreachable' });
    expect((body.checks as Record<string, { ok: boolean }>).redis.ok).toBe(true);
  });

  it('answers 503 and names Redis when only Redis is down', async () => {
    const body = await failure(controller({ ping: async () => Promise.reject(new Error('Connection is closed.')) }));
    expect((body.checks as Record<string, { ok: boolean }>).database.ok).toBe(true);
    expect((body.checks as Record<string, { ok: boolean; reason?: string }>).redis).toMatchObject({ ok: false, reason: 'unreachable' });
  });

  it('counts a dependency that never answers as down, instead of hanging', async () => {
    vi.useFakeTimers();
    try {
      const pending = failure(controller({ db: () => new Promise(() => undefined) }));
      await vi.advanceTimersByTimeAsync(2500);
      const body = await pending;
      expect((body.checks as Record<string, { reason?: string }>).database.reason).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never puts an error message, and so never a connection string, in the answer', async () => {
    const secret = 'postgres://injishi:hunter2-s3cret@10.0.0.9:5432/injishi';
    const body = await failure(
      controller({
        db: async () => Promise.reject(new Error(`password authentication failed for ${secret}`)),
        ping: async () => Promise.reject(new Error(`WRONGPASS redis://:hunter2-s3cret@10.0.0.9:6379`)),
      }),
    );
    const text = JSON.stringify(body);
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('10.0.0.9');
    expect(text).not.toContain('postgres://');
  });
});
