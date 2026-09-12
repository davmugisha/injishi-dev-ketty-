/**
 * The demo roster for the sign in path, and whether this is the demo at all.
 *
 * ADR-038 child 0 task 12 (AC-S10), the demo half of child 1b's AC-E12, and
 * ADR-043 AC-21.
 *
 * ## Two questions, two routes
 *
 * - **Is this the demo?** `GET /api/v1/platform` (`queries/platform.ts`). It
 *   decides between the footnote that says a code has been emailed and the one
 *   that names the published fixed code. It used to be inferred from whether
 *   the persona route below answered; the platform route now says it outright.
 * - **Who can I sign in as?** `GET /api/v1/demo/personas`, asked only once the
 *   platform said demo, so a presenter fills the address and the code in two
 *   taps rather than typing an address on stage.
 *
 * A 404 from the persona route is modelled as `null` rather than as an error:
 * it is an ANSWER, "there is no demo here". A reachability failure stays an
 * error, because we did not learn anything.
 */
import type { DemoPersona } from '@injishi/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { ENDPOINTS } from '../lib/endpoints';
import { demoKeys } from '../lib/query-keys';
import { usePlatform } from './platform';

/*
 * The roster's shape is the contract's (ADR-043), one definition for the API,
 * web's picker and this app. `personal` covers both Guest and Tenant; `staff`
 * is the admin console seat, which this app lists but does not open. Every seat
 * is listed, never flattened: Samuel holds five and must read as five.
 */
export type { DemoPersona, DemoSeat, DemoSurface } from '@injishi/contracts';

/**
 * The roster, or `null` when this is not a demo host.
 *
 * Throws only when the call could not be made at all, which is what keeps
 * "we could not ask" apart from "the answer is no".
 */
export async function fetchDemoPersonas(
  signal?: AbortSignal,
): Promise<DemoPersona[] | null> {
  const answer = await api<DemoPersona[]>(ENDPOINTS.demoPersonas, {
    signal,
    // Not a `/me/` route, so `api.ts` would attach the workspace header if one
    // were resolved. On the sign-in screen none is, but this route is read
    // before any session exists and must never depend on one, so the header is
    // turned off explicitly rather than by luck of ordering.
    withoutWorkspace: true,
  });

  if (answer.status === 'ok') return answer.data ?? [];
  // 404 is the designed answer for "not a demo host". Any other refusal is a
  // real refusal and is treated as unknown rather than as a denial.
  if (answer.status === 'refused' && answer.httpStatus === 404) return null;
  if (answer.status === 'unauthenticated') return null;
  throw new Error('could not reach the demo roster');
}

/**
 * The demo signal and roster for the sign-in path.
 *
 * `isDemoHost` is true only when `/api/v1/platform` said demo. `personas` is
 * null until the roster has loaded, and always null off the demo, where the
 * list must be ABSENT, not hidden.
 */
export function useDemoPersonas() {
  const { isDemo, seededAt } = usePlatform();
  const query = useQuery({
    queryKey: demoKeys.personas(),
    queryFn: ({ signal }) => fetchDemoPersonas(signal),
    // Asked only on the demo: off it the route is a 404 by design.
    enabled: isDemo,
    // The roster changes when somebody re-seeds, which is not during a sign-in.
    staleTime: 10 * 60 * 1000,
    // One attempt. This is decoration on the sign-in screen, and a retry storm
    // in front of the app's entry point costs more than the list is worth.
    retry: false,
  });

  return {
    personas: isDemo ? (query.data ?? null) : null,
    /** True only when `/api/v1/platform` said this is the demo (AC-21). */
    isDemoHost: isDemo,
    /** When the demo data was last reset, an ISO instant, or null (AC-19). */
    seededAt: isDemo ? seededAt : null,
  };
}
