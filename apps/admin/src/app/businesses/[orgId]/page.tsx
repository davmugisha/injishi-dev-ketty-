import { OrgRecord } from "./org-record";

export const metadata = { title: "Business" };

/**
 * One business · the profile lens (ADR-018, move 3, AC-8).
 *
 * The default lens lives at the record's own address rather than behind a
 * redirect, so `/businesses/[orgId]` is somewhere you can actually land.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgRecord orgId={orgId} lens="profile" />;
}
