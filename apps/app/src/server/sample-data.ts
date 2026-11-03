import { personaByEmail } from "@injishi/data";
import { cache } from "react";
import { currentAccount } from "@/lib/session";
import { apiRequest } from "./api";

/**
 * Whether the API's database is sample data (`GET /api/v1/platform`, `sampleData`), once per request.
 *
 * An API that cannot say counts as real: showing a real person invented records is the failure to avoid.
 */
export const databaseIsSample = cache(async (): Promise<boolean> => {
  try {
    const platform = await apiRequest<{ sampleData?: boolean }>(null, "/api/v1/platform");
    return platform.sampleData === true;
  } catch {
    return false;
  }
});

/**
 * Whether this request may be shown sample data: a sample database AND one of the demo's own people
 * (2026-10-30). A collection with no live source is read from the fixture store, which is the demo's
 * story: a pay run for 48 staff, a refund over the owner's limit, a rate change to publish. A real person
 * signed in to a database marked sample (the local test stack is, so its seed scripts may run) is still a
 * real person, and is shown none of it.
 */
export const holdsSampleData = cache(async (): Promise<boolean> => {
  const account = await currentAccount();
  const demo = !!account && personaByEmail(account.user.email)?.id === account.persona.id;
  return demo && (await databaseIsSample());
});
