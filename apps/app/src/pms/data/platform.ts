import { PlatformInfo } from "@injishi/contracts";

import { getJson } from "./api";

/**
 * Which platform the API behind this app is: `GET /api/v1/platform`
 * (ADR-043, AC-16, AC-22, AC-23).
 *
 * This replaces the Production/Demo pill and the store's `environment`, which
 * every build started as `"demo"` and any operator could flip. What the API
 * says is now the only answer, and the store holds it as `state.platform`:
 *
 * - a fixture screen's money action makes up a `DEMO-` reference only when this
 *   says `demo`, and refuses otherwise;
 * - the mock banner shows exactly when this says `sampleData`.
 *
 * FAILS CLOSED. Null when the API cannot be reached or answers something the
 * contract rejects, and null refuses a money action and hides the banner.
 *
 * Presentation only, as the old `env.ts` was: it grants nothing and settles
 * nothing. Money is the API's job (`PaymentsModule`, ADR-020); the adapters
 * that once sat in the client bundle left in ADR-035 D-e.
 */
export async function fetchPlatform(): Promise<PlatformInfo | null> {
  const read = await getJson<unknown>("/platform");
  if (read.outcome !== "ok") return null;
  const parsed = PlatformInfo.safeParse(read.data);
  return parsed.success ? parsed.data : null;
}
