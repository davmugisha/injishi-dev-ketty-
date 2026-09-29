/**
 * What `api()` puts on the wire.
 *
 * Every call opts out of the native cookie jar, for the reason `auth.ts`
 * records at `authCall`: this app's identity is the bearer header and nothing
 * else, so a cookie the jar kept from an earlier sign in has no business on any
 * request, a read included.
 */
import { api } from './api';
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
