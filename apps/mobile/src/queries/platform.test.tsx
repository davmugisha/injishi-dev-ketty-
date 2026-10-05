/**
 * The demo signal, and the one build it can never reach.
 *
 * `isDemo` gates every demo-only affordance on the phone: the persona picker,
 * the fixed sign-in code, the mock payment flows, Work's simulated outage. It
 * used to rest on the API's answer alone, so a production binary pointed at a
 * demo API would have shown the picker and filled in the fixed code for any
 * address typed (mobile audit 2026-10-05, SA-33). The build profile is fixed
 * at build time; these prove it wins.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePlatform } from './platform';

let mockBuild: 'preview' | 'beta' | 'production' | null = 'preview';
jest.mock('@/lib/crash-env', () => ({
  get CRASH_ENVIRONMENT() {
    return mockBuild;
  },
  CRASH_DSN: null,
  IS_DEVELOPMENT_BUILD: false,
  DIAGNOSTICS_ALLOWED: false,
}));

const mockFetch = jest.fn();
const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  mockBuild = 'preview';
});

/** The API says this is the demo. */
function apiSaysDemo() {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ environment: 'demo', sampleData: true, seededAt: null, commit: null }),
    headers: { get: () => null },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePlatform().isDemo', () => {
  it('believes a demo answer in a tester build', async () => {
    apiSaysDemo();
    const { result } = renderHook(() => usePlatform(), { wrapper });

    await waitFor(() => expect(result.current.platform?.environment).toBe('demo'));
    expect(result.current.isDemo).toBe(true);
  });

  it('never says demo in a production build, whatever the API answers', async () => {
    mockBuild = 'production';
    apiSaysDemo();
    const { result } = renderHook(() => usePlatform(), { wrapper });

    await waitFor(() => expect(result.current.platform?.environment).toBe('demo'));
    expect(result.current.isDemo).toBe(false);
  });

  it('fails closed until the API has answered', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePlatform(), { wrapper });

    expect(result.current.isDemo).toBe(false);
  });
});
