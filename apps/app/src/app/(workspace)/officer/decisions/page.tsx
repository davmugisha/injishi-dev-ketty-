import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { OfficerDecisionsView } from "@/features/oversight/OfficerDecisionsView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { decisionRows } from "@/server/sources/oversight";

export const metadata: Metadata = { title: screens.OfficerDecisions.pageTitle };

/** The officer's decisions, newest first. */
export default async function OfficerDecisionsPage() {
  await requirePersona("OfficerDecisions");
  const rows = await decisionRows(await requestContext());
  return <OfficerDecisionsView rows={rows} />;
}

export const dynamic = "force-dynamic";
