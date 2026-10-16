import { screens } from "@injishi/data";
import type { IntegrationsConnection } from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { IntegrationsView } from "@/features/owner/IntegrationsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Integrations.pageTitle };

export default async function IntegrationsPage() {
  await requirePersona("Integrations");
  const connections = await getCollection<IntegrationsConnection>("owner.integrationsConnections");
  return <IntegrationsView connections={connections} />;
}
