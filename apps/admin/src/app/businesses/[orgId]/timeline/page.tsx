import { OrgRecord } from "../org-record";

export const metadata = { title: "Business" };

/**
 * One business · the timeline lens.
 *
 * Its own route segment, never a query param (ADR-018, D-c), so it is something
 * a compliance officer can send to a colleague.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgRecord orgId={orgId} lens="timeline" />;
}
