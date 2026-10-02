import { AppShell } from "@/pms/components/app-shell";
import { PayRunPage } from "@/pms/screens/staff/pay-run";

/**
 * One pay run (ADR-058). A record route under the Staff leaf, so the leaf's
 * gate is the door; the API answers `payroll.run` on every read of it.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return (
    <AppShell title="Pay run">
      <PayRunPage runId={runId} />
    </AppShell>
  );
}
