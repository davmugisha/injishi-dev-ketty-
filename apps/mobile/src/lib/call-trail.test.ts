/**
 * Every exit of `api()` and of the auth calls writes one entry to the crash
 * trail (ADR-063 AC-6): the method, the path after the API origin, the status
 * when there was one, and the outcome. `recordCall` itself masks the path; its
 * own suite proves that. This one proves the call sites hand it the right
 * things, at every exit, and never the host, a body or a header.
 */
import { api } from './api';
import { requestSignInCode, signOut } from './auth';
import { ENDPOINTS } from './endpoints';

jest.mock('./crash-reporter', () => ({ recordCall: jest.fn() }));

const { recordCall } = jest.requireMock('./crash-reporter') as { recordCall: jest.Mock };
const mockFetch = jest.fn();
const realFetch = globalThis.fetch;

function answer(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  };
}

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  recordCall.mockClear();
});

describe('api() on the crash trail', () => {
  it.each<[string, () => void, Record<string, unknown>]>([
    ['an answer', () => mockFetch.mockResolvedValue(answer(200, {})), { httpStatus: 200, outcome: 'ok' }],
    ['an empty answer', () => mockFetch.mockResolvedValue(answer(204, null)), { httpStatus: 204, outcome: 'ok' }],
    ['a refusal', () => mockFetch.mockResolvedValue(answer(422, { message: 'Jane is not a member' })), { httpStatus: 422, outcome: 'refused' }],
    ['a signed out answer', () => mockFetch.mockResolvedValue(answer(401, {})), { httpStatus: 401, outcome: 'unauthenticated' }],
    ['no answer at all', () => mockFetch.mockRejectedValue(new Error('network down')), { outcome: 'failed' }],
  ])('records %s once, with the path after the origin', async (_name, arrange, expected) => {
    arrange();
    await api(ENDPOINTS.meWorkspaces);
    expect(recordCall).toHaveBeenCalledTimes(1);
    const [call] = recordCall.mock.calls[0] as [Record<string, unknown>];
    expect(call).toEqual({ method: 'GET', path: '/api/v1/me/workspaces', ...expected });
    expect(JSON.stringify(call)).not.toContain('Jane');
  });
});

describe('the auth calls on the crash trail', () => {
  it('records a code request with its masked-to-be path and status, never the email', async () => {
    mockFetch.mockResolvedValue(answer(200, {}));
    await requestSignInCode('jane@x.rw');
    const [call] = recordCall.mock.calls[0] as [Record<string, unknown>];
    expect(call).toMatchObject({ method: 'POST', httpStatus: 200, outcome: 'ok' });
    expect(String(call.path)).toMatch(/^\/api\/auth\//);
    expect(JSON.stringify(call)).not.toContain('jane');
  });

  it('records a refused code request as refused', async () => {
    mockFetch.mockResolvedValue(answer(400, { message: 'Invalid email' }));
    await requestSignInCode('jane@x.rw');
    expect(recordCall.mock.calls[0][0]).toMatchObject({ httpStatus: 400, outcome: 'refused' });
  });

  it('records an unreachable auth server as failed, with no status', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    await requestSignInCode('jane@x.rw');
    const [call] = recordCall.mock.calls[0] as [Record<string, unknown>];
    expect(call).toMatchObject({ method: 'POST', outcome: 'failed' });
    expect(call).not.toHaveProperty('httpStatus');
  });

  it('records nothing for a sign out with no session to end', async () => {
    await signOut();
    expect(recordCall).not.toHaveBeenCalled();
  });
});
