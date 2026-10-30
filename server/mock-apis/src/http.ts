import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * A router small enough to read in one sitting. The mock server answers a
 * handful of routes per provider, and a framework would hide exactly what a
 * reader of a mock wants to see: what goes over the wire.
 */

export interface Request {
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  headers: IncomingMessage['headers'];
  /** The raw body, read whole (the largest is a Smile ID upload of two photos). */
  body: Buffer;
}

export interface Reply {
  status: number;
  headers?: Record<string, string>;
  /** A value is sent as JSON; a Buffer or string as is. */
  body?: unknown;
}

export type Handler = (request: Request) => Reply | Promise<Reply>;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

const MAX_BODY_BYTES = 20 * 1024 * 1024;

export class Router {
  private readonly routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method: method.toUpperCase(), parts: split(pattern), handler });
    return this;
  }

  /** The handler for a method and path, with its `:params`, or null. */
  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = split(path);
    for (const route of this.routes) {
      if (route.method !== method || route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i += 1) {
        const want = route.parts[i]!;
        const got = parts[i]!;
        if (want.startsWith(':')) params[want.slice(1)] = decodeURIComponent(got);
        else if (want !== got) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }

  /** Whether any route answers this path under another method (a 405 rather than a 404). */
  knows(path: string): boolean {
    const parts = split(path);
    return this.routes.some(
      (r) => r.parts.length === parts.length && r.parts.every((p, i) => p.startsWith(':') || p === parts[i]),
    );
  }
}

function split(path: string): string[] {
  return path.split('/').filter((p) => p.length > 0);
}

export async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, { error: 'payload_too_large' });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** A refusal a handler throws with the body the provider would answer. */
export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;

  constructor(status: number, body: unknown, headers: Record<string, string> = {}) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

/** The body as JSON, or a 400 in the shape the caller's provider uses. */
export function json(request: Request, invalid: (message: string) => unknown): unknown {
  if (request.body.length === 0) throw new HttpError(400, invalid('A JSON body is required.'));
  try {
    return JSON.parse(request.body.toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, invalid('The body is not valid JSON.'));
  }
}

export function send(res: ServerResponse, reply: Reply): void {
  const headers: Record<string, string> = { 'cache-control': 'no-store', ...(reply.headers ?? {}) };
  let payload: Buffer | string | undefined;
  if (reply.body === undefined) {
    payload = undefined;
  } else if (Buffer.isBuffer(reply.body) || typeof reply.body === 'string') {
    payload = reply.body;
  } else {
    payload = JSON.stringify(reply.body);
    headers['content-type'] ??= 'application/json; charset=utf-8';
  }
  res.writeHead(reply.status, headers);
  res.end(payload);
}

export function header(request: Request, name: string): string | null {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
