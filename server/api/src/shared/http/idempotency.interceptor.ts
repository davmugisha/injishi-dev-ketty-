import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  SetMetadata,
  UnprocessableEntityException,
  UseInterceptors,
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { from, map, mergeMap, catchError, throwError, type Observable } from 'rxjs';

import { idempotencyKeys } from '../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../database/database.module';

const IDEMPOTENT = 'injishi:idempotent';

/** A request still running after this long is taken to have died, and a resend takes it over. */
export const IN_FLIGHT_TAKEOVER_SECONDS = 60;

/** How long a stored answer is kept for a resend. The worker's daily sweep deletes older rows. */
export const IDEMPOTENCY_RETENTION_DAYS = 30;

/** A v4 shaped UUID, the same shape `idempotency-key.ts` accepts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The fields left out of the request hash: the reported time pair changes on
 * every attempt of the same write (a fresh `deviceSentAt`, and an `occurredAt`
 * the phone rebases on its monotonic timer at each send), so a resend must
 * still match its first attempt.
 */
const PER_ATTEMPT_FIELDS = new Set(['deviceSentAt', 'occurredAt']);

interface IdempotentOptions {
  /** A route an offline client always keys refuses a request without one (`400`). */
  required: boolean;
}

/** The structural view of the Fastify request this reads. */
interface IdempotentRequest {
  method: string;
  url: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  routeOptions?: { url?: string };
  user?: { id: string };
}

type Claim = { kind: 'run' } | { kind: 'replay'; status: number; body: unknown };

/**
 * Replay safety for any write a client keys (mobile spec 0003, D-r, the outbox
 * child's interceptor). Put it on a route with `@Idempotent()`, after
 * `SessionGuard`, because keys are scoped to the signed in user.
 *
 * The first request with a key claims a row and runs. Its answer is stored: a
 * `2xx` and a refusal under `500` alike, because a refusal is an answer. A
 * `5xx` or a plain error deletes the row, so a resend runs again. A resend with
 * the same key gets the stored answer replayed; the same key on another route
 * or with another body is `422 idempotency_key_reused`; one that arrives while
 * the first is still running is `409 request_in_progress`, unless the first
 * has run longer than `IN_FLIGHT_TAKEOVER_SECONDS`, when exactly one resend
 * takes it over. Guard refusals (`401`, `403 two_factor_required`, `429`)
 * happen before any interceptor and are never stored.
 */
export function Idempotent(options: Partial<IdempotentOptions> = {}): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    SetMetadata(IDEMPOTENT, { required: options.required ?? false } satisfies IdempotentOptions),
    UseInterceptors(IdempotencyInterceptor),
  );
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.get<IdempotentOptions | undefined>(IDEMPOTENT, context.getHandler()) ?? {
      required: false,
    };
    const request = context.switchToHttp().getRequest<IdempotentRequest>();
    const key = keyOf(request.headers, options.required);
    const userId = request.user?.id;
    // No key: the request runs as it always did. No user cannot happen behind
    // `SessionGuard`; without one there is nobody to scope a key to.
    if (!key || !userId) return next.handle();

    const path = pathOf(request.url);
    const route = `${request.method} ${request.routeOptions?.url ?? path}`;
    const claim = await this.claim({ userId, key, method: request.method, route, hash: requestHash(request.method, path, request.body) });
    if (claim.kind === 'replay') {
      if (claim.status < 300) return from([claim.body]);
      return throwError(() => new HttpException(claim.body as Record<string, unknown> | string, claim.status));
    }

    const success =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ?? (request.method === 'POST' ? 201 : 200);
    return next.handle().pipe(
      mergeMap((data: unknown) => from(this.store(userId, key, success, data)).pipe(map(() => data))),
      catchError((error: unknown) => from(this.settleFailure(userId, key, error)).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private async claim(input: { userId: string; key: string; method: string; route: string; hash: string }): Promise<Claim> {
    const inserted = await this.db
      .insert(idempotencyKeys)
      .values({ userId: input.userId, key: input.key, method: input.method, route: input.route, requestHash: input.hash })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });
    if (inserted.length > 0) return { kind: 'run' };

    const [row] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, input.key)))
      .limit(1);
    // Gone between the insert and the read: the first attempt failed with a
    // 5xx and freed its key. Asking again is the safe answer.
    if (!row) throw inProgress();
    if (row.route !== input.route || row.requestHash !== input.hash) {
      throw new UnprocessableEntityException({
        code: 'idempotency_key_reused',
        message: 'This key was already used for a different request.',
      });
    }
    if (row.statusCode !== null) return { kind: 'replay', status: row.statusCode, body: row.responseBody };

    // Still running. Take it over only when it has run too long to be alive,
    // with one conditional update, so of two resends exactly one runs.
    const taken = await this.db
      .update(idempotencyKeys)
      .set({ createdAt: sql`now()` })
      .where(
        and(
          eq(idempotencyKeys.userId, input.userId),
          eq(idempotencyKeys.key, input.key),
          isNull(idempotencyKeys.statusCode),
          lt(idempotencyKeys.createdAt, sql`now() - ${sql.raw(`interval '${IN_FLIGHT_TAKEOVER_SECONDS} seconds'`)}`),
        ),
      )
      .returning({ key: idempotencyKeys.key });
    if (taken.length > 0) return { kind: 'run' };
    throw inProgress();
  }

  private async store(userId: string, key: string, status: number, body: unknown): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ statusCode: status, responseBody: body ?? null, completedAt: sql`now()` })
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
  }

  /** A refusal under 500 is an answer and is kept; anything else frees the key for a resend. */
  private async settleFailure(userId: string, key: string, error: unknown): Promise<void> {
    if (error instanceof HttpException && error.getStatus() < 500) {
      await this.store(userId, key, error.getStatus(), error.getResponse());
      return;
    }
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
  }
}

function inProgress(): ConflictException {
  return new ConflictException({ code: 'request_in_progress', message: 'This is still being saved. Try again in a moment.' });
}

/** The key from the header, lowercased; a malformed key is refused, a missing one only where it is required. */
function keyOf(headers: IdempotentRequest['headers'], required: boolean): string | null {
  const header = headers['idempotency-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    if (required) throw new BadRequestException('This write needs an Idempotency-Key header so a resend cannot act twice.');
    return null;
  }
  if (!UUID.test(key)) throw new BadRequestException('Idempotency-Key must be a UUID generated by the client.');
  return key.toLowerCase();
}

function pathOf(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/** sha256 of the method, the resolved path and the canonical body without the per attempt fields. */
export function requestHash(method: string, path: string, body: unknown): string {
  const kept =
    body && typeof body === 'object' && !Array.isArray(body)
      ? Object.fromEntries(Object.entries(body).filter(([k]) => !PER_ATTEMPT_FIELDS.has(k)))
      : (body ?? null);
  return createHash('sha256').update(`${method}\n${path}\n${canonicalJson(kept)}`).digest('hex');
}

/** JSON with every object's keys sorted, so the same body always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
