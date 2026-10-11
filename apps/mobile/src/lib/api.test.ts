/**
 * What `api()` puts on the wire.
 *
 * Every call opts out of the native cookie jar, for the reason `auth.ts`
 * records at `authCall`: this app's identity is the bearer header and nothing
 * else, so a cookie the jar kept from an earlier sign in has no business on any
 * request, a read included.
 */
import {
  api,
  isTransientStatus,
  resetUnauthenticatedLatch,
  setForbiddenHandler,
  shouldRetry,
  unwrap,
  ApiError,
} from './api';
import { ENDPOINTS } from './endpoints';

/** The parts of a request these assertions read. */
interface SentInit {
  method?: string;
  credentials?: string;
  headers?: Record<string, string>;
}

const mockFetch = jest.fn();
const realFetch = globalThis.fetch;

/** A server answer with only what `api()` reads. */
function answer(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  };
}

/** The init of the one call the test made. */
function onlyCall(): SentInit {
  expect(mockFetch).toHaveBeenCalledTimes(1);
  return mockFetch.mock.calls[0][1] as SentInit;
}

function sentCookie(init: SentInit): boolean {
  return Object.keys(init.headers ?? {}).some((name) => name.toLowerCase() === 'cookie');
}

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  resetUnauthenticatedLatch();
  setForbiddenHandler(null);
});

describe('api() tells a decision from a server that could not answer', () => {
  // A 5xx, a 408 or a 429 is not the server saying no to THIS request. Calling
  // it `refused` meant no retry, a queued record payment parked as refused
  // during a deploy, and "Internal server error" shown as the server's reason
  // (mobile audit 2026-10-05, XC-04).
  it.each([500, 502, 503, 408, 429])('treats %i as a failure worth retrying', async (status) => {
    mockFetch.mockResolvedValue(answer(status, { message: 'Internal server error' }));

    const result = await api(ENDPOINTS.meWorkspaces);

    expect(result).toEqual({ status: 'failed', httpStatus: status });
    const error = await unwrap(Promise.resolve(result)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(shouldRetry(0, error)).toBe(true);
  });

  it.each([400, 403, 404, 409, 422])('keeps %i a refusal with the server’s own message', async (status) => {
    mockFetch.mockResolvedValue(answer(status, { message: 'That month is already recorded.' }));

    await expect(api(ENDPOINTS.meWorkspaces)).resolves.toEqual({
      status: 'refused',
      message: 'That month is already recorded.',
      httpStatus: status,
    });
  });

  it('agrees with the list it exports', () => {
    expect([500, 504, 408, 429].every(isTransientStatus)).toBe(true);
    expect([400, 401, 403, 404, 409, 422].some(isTransientStatus)).toBe(false);
  });
});

describe('api() on a 403', () => {
  it('asks for the permissions to be read again, once per burst', async () => {
    // A power revoked on the server stayed on offer until the cached seats aged
    // out. Web refreshes on any 403; so does this (mobile audit XC-04).
    const refresh = jest.fn();
    setForbiddenHandler(refresh);
    mockFetch.mockResolvedValue(answer(403, { message: 'You may not record rent here.' }));

    await api(ENDPOINTS.opsRentRoll);
    await api(ENDPOINTS.opsRentRoll);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh anything on a refusal that is not about permission', async () => {
    const refresh = jest.fn();
    setForbiddenHandler(refresh);
    mockFetch.mockResolvedValue(answer(422, { message: 'Bad month.' }));

    await api(ENDPOINTS.opsRentRoll);

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('api() keeps the native cookie jar out', () => {
  it('sends no cookie on a read', async () => {
    mockFetch.mockResolvedValue(answer(200, { workspaces: [] }));

    await expect(api(ENDPOINTS.meWorkspaces)).resolves.toEqual({
      status: 'ok',
      data: { workspaces: [] },
    });

    const init = onlyCall();
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
    expect(sentCookie(init)).toBe(false);
  });

  it('sends no cookie on a write', async () => {
    mockFetch.mockResolvedValue(answer(200, { ok: true }));

    await api(ENDPOINTS.meActiveWorkspace, { method: 'POST', body: { workspaceId: 'w1' } });

    const init = onlyCall();
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(sentCookie(init)).toBe(false);
  });
});
