import { screens } from "@injishi/data";
import type { QueueCase, QueueId } from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfficerHomeView } from "@/features/oversight/OfficerHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { leaderOnly, officerConsoles } from "@/server/oversight/nav";
import { readDesk } from "@/server/sources/oversight";

export const metadata: Metadata = { title: screens.OfficerHome.pageTitle };

/**
 * Officer queues, read from the registry as this officer: the businesses waiting on their field visit or their
 * approval, inside the region their assignment covers.
 */
export default async function OfficerHomePage() {
  await requirePersona("OfficerHome");
  // A local leader reviews no business: their home is the guests in their area (P5).
  if (leaderOnly(await officerConsoles())) redirect("/officer/guests");
  const ctx = await requestContext();
  const [desk, cases] = await Promise.all([readDesk(ctx), getCollection<QueueCase>("oversight.cases")]);
  const held: QueueId[] = [];
  if (desk.verification) held.push("verification");
  if (desk.approval) held.push("approval");
  const first = cases.find((c) => c.href && c.action === "open") ?? null;
  return <OfficerHomeView cases={cases} held={held} firstCaseHref={first?.href ?? null} />;
}

export const dynamic = "force-dynamic";
