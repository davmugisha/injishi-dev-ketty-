import { currentAccount } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { holdsSampleData } from "./sample-data";

/**
 * Where an owner goes instead of a FIXTURE setup screen, when the API holds real records.
 *
 * `/listing` and `/onboarding` are drawn from the sample store. On a real database their "Publish changes"
 * answered "submitted" and put nothing on the marketplace, and prices typed there reached nothing the
 * publish check counts, so an owner could believe they were live while guests saw nothing. The real one is
 * the business's setup page, which shows where the listing stands and publishes it.
 *
 * Null on a sample database, where the fixture screens are the demo.
 */
export async function realSetupRedirect(): Promise<string | null> {
  if (await holdsSampleData()) return null;
  const account = await currentAccount();
  const business = account?.workspaces.find((w) => w.kind === "business");
  return business ? setupPath(business.workspaceId) : "/owner";
}
