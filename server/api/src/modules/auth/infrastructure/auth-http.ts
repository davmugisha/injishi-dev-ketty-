import type { AuthInstance } from '@injishi/auth';
import { AUTH_BASE_PATH } from '@injishi/auth';

/**
 * Minimal structural types for the raw Fastify surface we touch. Declared
 * locally because `fastify` is only a transitive dependency (via
 * `@nestjs/platform-fastify`) and importing its types directly is not portable.
 */
interface RawFastifyRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface RawFastifyReply {
  status(code: number): RawFastifyReply;
  header(key: string, value: string | string[]): RawFastifyReply;
  send(payload: unknown): RawFastifyReply;
}
interface RawFastify {
  route(opts: {
    method: string[];
    url: string;
    handler: (
      request: RawFastifyRequest,
      reply: RawFastifyReply,
    ) => void | Promise<void>;
  }): void;
}

/**
 * Bridges Better Auth's Fetch-style handler onto the underlying Fastify
 * instance at `/api/auth/*` (version-neutral, outside the product `/api/v1`
 * prefix — see shared/auth/README). Nest never sees these routes; they are raw
 * Fastify so Better Auth owns request/response verbatim (cookies, redirects).
 *
 * The route is registered once at boot, but the instance is chosen PER REQUEST
 * from the Host header, by SURFACE (ADR-018 D-o): a console host gets the
 * console's instance and every other host the marketplace's. Whether an
 * instance issues the fixed demo code is settled per process, not here
 * (ADR-043, `shared/config/platform.ts`).
 */
export function registerAuthRoutes(
  fastify: RawFastify,
  resolveAuth: (host: string) => AuthInstance,
): void {
  fastify.route({
    method: ['GET', 'POST'],
    url: `${AUTH_BASE_PATH}/*`,
    async handler(request, reply) {
      const host =
        (Array.isArray(request.headers.host)
          ? request.headers.host[0]
          : request.headers.host) ?? 'localhost';
      const auth = resolveAuth(host);
      const url = new URL(request.url, `http://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else if (value != null) {
          headers.append(key, String(value));
        }
      }

      const hasBody =
        request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        request.body != null;

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
      });

      const response = await auth.handler(req);

      reply.status(response.status);
      // Copy every header except Set-Cookie (which must not be comma-joined).
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return;
        reply.header(key, value);
      });
      // Preserve multiple Set-Cookie headers individually.
      const setCookies = response.headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        reply.header('set-cookie', setCookies);
      }

      const body = response.body ? await response.text() : null;
      reply.send(body);
    },
  });
}
