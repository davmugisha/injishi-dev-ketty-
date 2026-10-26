import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeaseRecordView, type RecordOpen } from "@/features/leases/LeaseRecordView";
import { RECORD_TABS, type RecordTab } from "@/features/leases/shared";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, orNull, rentalsProfile } from "@/server/rentals/client";
import { leaseCharges, leaseContract, leaseDetail, leaseEvents, leasePayments } from "@/server/rentals/leases";

export const metadata: Metadata = { title: screens.LeaseRecord.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN: readonly RecordOpen[] = ["sign", "resend", "start", "remind", "edit", "cancel"];

/** One lease: `?tab=` picks the tab; `?open=` opens a step once (sign, resend, start, remind, edit, cancel). */
export default async function LeaseRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; open?: string }>;
}) {
  await requirePersona("LeaseRecord");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Lease" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const query = await searchParams;
  const lease = await orNull(leaseDetail(id));
  if (!lease) notFound();
  const money = can(scope, "rent.record", "money.view", "lease.manage");
  const [contract, events, charges, payments, profile] = await Promise.all([
    orNull(leaseContract(id)),
    leaseEvents(id),
    money ? orNull(leaseCharges(id)) : Promise.resolve(null),
    money ? orNull(leasePayments(id)) : Promise.resolve(null),
    orNull(rentalsProfile()),
  ]);
  const tab = (RECORD_TABS as readonly string[]).includes(query.tab ?? "") ? (query.tab as RecordTab) : "overview";
  const open = (OPEN as readonly string[]).includes(query.open ?? "") ? (query.open as RecordOpen) : null;
  return (
    <LeaseRecordView
      key={lease.id}
      lease={lease}
      contract={contract}
      events={events.events}
      charges={charges?.charges ?? null}
      payments={payments?.payments ?? null}
      tab={tab}
      open={open}
      today={kigaliToday()}
      autoStart={profile?.leaseDefaults.autoStartLeases ?? true}
      can={{
        manage: can(scope, "lease.manage"),
        sign: can(scope, "lease.sign"),
        record: can(scope, "rent.record"),
        message: can(scope, "message.send"),
        settle: can(scope, "deposit.return"),
      }}
    />
  );
}

export const dynamic = "force-dynamic";
