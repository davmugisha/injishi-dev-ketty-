/**
 * How the BullMQ connection is resolved, in one place.
 *
 * Railway (and every other managed Redis) hands out ONE variable: a
 * `REDIS_URL` carrying host, port, user, password and scheme together. The
 * discrete `REDIS_HOST` / `REDIS_PORT` pair this service started with can
 * express none of that, so a deploy that only had the pair connected to
 * `127.0.0.1` and every queue silently stopped draining. The URL wins when
 * present; the pair stays for the docker-compose dev stack.
 *
 * Two details that are not obvious and cost a deploy each:
 *
 * - `family: 0`. Railway's private network resolves service hostnames to IPv6
 *   ONLY. ioredis defaults to `family: 4`, so `redis.railway.internal` fails
 *   to resolve and the process retries forever without ever saying why.
 *   `0` means "whatever DNS returns", which is correct on both stacks.
 *
 * - `maxRetriesPerRequest: null`. BullMQ blocks on Redis for long stretches by
 *   design. With ioredis's default of 20 retries a brief network blip turns
 *   into a thrown `MaxRetriesPerRequestError` and a dead worker; `null` makes
 *   the client wait out the reconnect instead. BullMQ requires this.
 */

export interface RedisEnv {
  redisUrl?: string;
  redisHost?: string;
  redisPort?: string;
}

export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  /** Present only for `rediss://`. */
  tls?: Record<string, never>;
  family: 0;
  maxRetriesPerRequest: null;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;

export function resolveRedisConnection(env: RedisEnv): RedisConnection {
  const url = env.redisUrl?.trim();

  if (!url) {
    return {
      host: env.redisHost?.trim() || DEFAULT_HOST,
      port: Number(env.redisPort?.trim() || DEFAULT_PORT),
      family: 0,
      maxRetriesPerRequest: null,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // A malformed URL must not fall back to localhost: a queue that connects
    // to nothing looks healthy and drops every job.
    throw new Error(`REDIS_URL is not a valid URL: ${url}`);
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(
      `REDIS_URL must use redis:// or rediss://, got ${parsed.protocol}//`,
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : DEFAULT_PORT,
    // `default` is the username every managed Redis ships; keep it, because an
    // ACL-enabled server rejects a password sent without one.
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    family: 0,
    maxRetriesPerRequest: null,
  };
}
