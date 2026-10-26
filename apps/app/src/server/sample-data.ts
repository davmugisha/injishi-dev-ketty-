import { cache } from "react";
import { apiRequest } from "./api";

/**
 * Whether the API's database is sample data (`GET /api/v1/platform`, `sampleData`), once per request.
 *
 * A collection with no live source is read from the fixture store, which is the demo's story: a pay run
 * for 48 staff, a refund over the owner's limit, a rate change to publish. On a real database that is a
 * stranger's business shown to a real owner as their own. A screen asks this before drawing one.
 *
 * An API that cannot say counts as real: showing a real person invented records is the failure to avoid.
 */
export const holdsSampleData = cache(async (): Promise<boolean> => {
  try {
    const platform = await apiRequest<{ sampleData?: boolean }>(null, "/api/v1/platform");
    return platform.sampleData === true;
  } catch {
    return false;
  }
});
