/**
 * What `auth.ts` puts on the wire, call by call.
 *
 * The auth screens' tests mock this module whole, so nothing else looks at the
 * request itself — and the request is where a device-only failure hid. Expo's
 * `fetch` defaults to `credentials: 'include'`: the native client keeps every
 * cookie a sign in sets and replays it on the next call. Better Auth refuses a
 * cookie-carrying POST with no Origin as "Missing or null Origin", so the first
 * sign in on a phone worked and every later one failed. These pin the opt-out,
 * and the sign out body the API needs before it will end a session at all.
 */
import { currentToken, requestSignInCode, signOut, verifySignInCode } from './auth';

/** The parts of a request these assertions read. */
interface SentInit {
  method?: string;
  credentials?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const mockFetch = jest.fn();
const realFetch = globalThis.fetch;

/** A server answer with only what `auth.ts` reads. */
function answer(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
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
});

describe('auth calls keep the native cookie jar out', () => {
  it('requestSignInCode sends no cookie', async () => {
    mockFetch.mockResolvedValue(answer(200, { success: true }));

    await expect(requestSignInCode(' Aimable@Demo.Injishi.com ')).resolves.toEqual({
      status: 'ok',
    });

    const init = onlyCall();
    expect(init.credentials).toBe('omit');
    expect(sentCookie(init)).toBe(false);
  });

  it('verifySignInCode sends no cookie and keeps the bearer token', async () => {
    mockFetch.mockResolvedValue(answer(200, { token: 'raw' }, { 'set-auth-token': 'signed.token' }));

    await expect(verifySignInCode('aimable@demo.injishi.com', '123456')).resolves.toEqual({
      status: 'ok',
    });

    const init = onlyCall();
    expect(init.credentials).toBe('omit');
    expect(sentCookie(init)).toBe(false);
    expect(currentToken()).toBe('signed.token');
  });

  it('signOut sends no cookie and a JSON body the API will parse', async () => {
    mockFetch.mockResolvedValueOnce(answer(200, {}, { 'set-auth-token': 'signed.token' }));
    await verifySignInCode('aimable@demo.injishi.com', '123456');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(answer(200, { success: true }));

    await expect(signOut()).resolves.toEqual({ serverConfirmed: true });

    const init = onlyCall();
    expect(init.credentials).toBe('omit');
    expect(sentCookie(init)).toBe(false);
    expect(init.headers?.Authorization).toBe('Bearer signed.token');
    // A JSON content type over an empty body is refused by Fastify with a 400
    // before Better Auth runs, which left the session alive after sign out.
    expect(init.headers?.['Content-Type']).toBe('application/json');
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({});
    expect(currentToken()).toBeNull();
  });
});
