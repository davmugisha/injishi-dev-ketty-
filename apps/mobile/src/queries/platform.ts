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
 *
 * **A production build is never the demo, whatever the API says.** The split
 * used to rest on the API's answer alone, so a production binary pointed at a
 * demo API would show the persona picker and fill in the fixed code for any
 * address typed (mobile audit SA-33). The build profile is fixed at build time
 * and cannot be talked out of it. `isDemo` also gates every demo only
 * affordance on the phone (the mock payment flows, Work's simulated outage), so
 * this one line keeps all of them out of a store build.
 */
import { PlatformInfo } from '@injishi/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { CRASH_ENVIRONMENT } from '../lib/crash-env';
import { ENDPOINTS } from '../lib/endpoints';
import { platformKeys } from '../lib/query-keys';

/**
 * Whether this binary was built by the `production` profile in `eas.json`,
 * the only profile that sets that environment. A build-time constant, read
 * where it is used rather than captured once, so a test can vary it.
 */
function isProductionBuild(): boolean {
  return CRASH_ENVIRONMENT === 'production';
}

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
    /** True only on a positive answer that this is the demo, never in a
     *  production build (see the header). */
    isDemo: !isProductionBuild() && platform?.environment === 'demo',
    /** When the demo data was last reset, an ISO instant, or null. */
    seededAt: platform?.seededAt ?? null,
  };
}
