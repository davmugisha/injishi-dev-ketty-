/**
 * Which platform the API behind this app is: `GET /api/v1/platform`
 * (ADR-043, AC-16 and AC-21).
 *
 * The app's ONE demo signal. It used to be inferred from whether the persona
 * route answered, which made "the roster loaded" and "this is the demo" the
 * same fact; they are not, and the platform route says the second outright.
 *
 * FAILS CLOSED. Until the API has answered, or when it cannot be reached or
 * answers something the contract rejects, `isDemo` is false and the screens
 * behave as they do on production: no published code, no picker.
 */
import { PlatformInfo } from '@injishi/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { ENDPOINTS } from '../lib/endpoints';
import { platformKeys } from '../lib/query-keys';

/** The platform, or null when it could not be learned. Never throws. */
export async function fetchPlatform(signal?: AbortSignal): Promise<PlatformInfo | null> {
  const answer = await api<unknown>(ENDPOINTS.platform, {
    signal,
    // Read before any session or workspace exists, and never depends on one.
    withoutWorkspace: true,
  });
  if (answer.status !== 'ok') return null;
  const parsed = PlatformInfo.safeParse(answer.data);
  return parsed.success ? parsed.data : null;
}

export function usePlatform() {
  const query = useQuery({
    queryKey: platformKeys.info(),
    queryFn: ({ signal }) => fetchPlatform(signal),
    // The API caches it for a minute; a sign in does not need it fresher.
    staleTime: 60 * 1000,
    retry: false,
  });

  const platform = query.data ?? null;
  return {
    platform,
    /** True only on a positive answer that this is the demo. */
    isDemo: platform?.environment === 'demo',
    /** When the demo data was last reset, an ISO instant, or null. */
    seededAt: platform?.seededAt ?? null,
  };
}
