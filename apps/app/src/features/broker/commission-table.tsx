"use client";

import { toast } from "@heroui/react";
import type {
  BrokerCommission,
  BrokerCommissionList,
  BrokerPayoutAccount,
  BrokerShareStatus,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  KpiStrip,
  SectionCard,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TextInput } from "../rentals/fields";
import { setPayoutNumber } from "./actions";

const SHARE: Record<BrokerShareStatus, { tone: StatusTone; label: string }> = {
  waiting_for_hotel: { tone: "warning", label: "Owed by the hotel" },
  held: { tone: "warning", label: "Waiting for your MoMo number" },
  queued: { tone: "info", label: "On its way" },
  paid: { tone: "success", label: "Paid" },
  failed: { tone: "danger", label: "Transfer refused" },
};

/** What a commission was earned on, in one line: "BK-… · Aline Uwase · 2 nights" or "BG-… · whole group". */
function earnedOn(c: BrokerCommission): string {
  return c.bookingReference
    ? [
        c.bookingReference,
        c.guestName,
        c.nightsStayed ? `${c.nightsStayed} ${c.nightsStayed === 1 ? "night" : "nights"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : `${c.groupReference} · whole group`;
}

/**
 * Commissions on hotel stays (0127), for either side: the broker sees which hotel and where their 85% is; the
 * hotel sees which broker and what it still owes. Earned at check-out on the nights stayed, collected from the
 * hotel's payouts, then paid to the broker.
 */
export function CommissionTable({ data, side }: { data: BrokerCommissionList; side: "broker" | "hotel" }) {
  const columns: DataColumn<BrokerCommission>[] = [
    {
      id: "who",
      header: side === "broker" ? "Hotel" : "Broker",
      cell: (c) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{side === "broker" ? c.hotel.name : (c.broker.name ?? "A broker")}</span>
          <span className="text-xs text-muted">{earnedOn(c)}</span>
        </span>
      ),
      sortValue: (c) => (side === "broker" ? c.hotel.name : (c.broker.name ?? "")),
      isRowHeader: true,
    },
    { id: "earned", header: "Earned", cell: (c) => formatDay(c.earnedAt, "short"), sortValue: (c) => c.earnedAt },
    {
      id: "commission",
      header: "Commission",
      align: "end",
      cell: (c) => <span className="tabular">{formatMoney(c.commissionRwf)}</span>,
      sortValue: (c) => c.commissionRwf,
      hideBelow: "lg",
    },
    side === "broker"
      ? {
          id: "yours",
          header: "Yours (85%)",
          align: "end",
          cell: (c) => <span className="tabular">{formatMoney(c.brokerRwf)}</span>,
          sortValue: (c) => c.brokerRwf,
        }
      : {
          id: "owed",
          header: "Still owed",
          align: "end",
          cell: (c) => (c.owedRwf > 0 ? <span className="tabular">{formatMoney(c.owedRwf)}</span> : "-"),
          sortValue: (c) => c.owedRwf,
        },
    {
      id: "status",
      header: "Status",
      cell: (c) =>
        side === "broker" ? (
          <StatusChip tone={SHARE[c.share.status].tone}>{SHARE[c.share.status].label}</StatusChip>
        ) : (
          <StatusChip tone={c.status === "collected" ? "success" : "warning"}>
            {c.status === "collected" ? "Taken from your payouts" : "Owed"}
          </StatusChip>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip
        label="Commission"
        items={
          side === "broker"
            ? [
                {
                  id: "owed",
                  label: "Still with hotels",
                  value: Math.round(data.totals.owedRwf * 0.85),
                  format: "money",
                  icon: "Clock",
                },
                {
                  id: "paid",
                  label: "Paid to you",
                  value: data.totals.paidToBrokerRwf,
                  format: "money",
                  icon: "Wallet",
                },
              ]
            : [
                { id: "owed", label: "You owe brokers", value: data.totals.owedRwf, format: "money", icon: "Clock" },
                {
                  id: "collected",
                  label: "Taken from your payouts",
                  value: data.totals.collectedRwf,
                  format: "money",
                  icon: "Receipt",
                },
              ]
        }
      />
      <DataTable
        label="Commissions"
        rows={data.commissions}
        rowKey={(c) => c.id}
        columns={columns}
        defaultSort={{ column: "earned", direction: "descending" }}
        mobile={{
          title: (c) => (side === "broker" ? c.hotel.name : (c.broker.name ?? "A broker")),
          description: earnedOn,
          trailing: (c) => (
            <span className="tabular">{formatMoney(side === "broker" ? c.brokerRwf : c.commissionRwf)}</span>
          ),
        }}
        empty={
          <EmptyBlock
            icon="Sack"
            title="No commission yet"
            description={
              side === "broker"
                ? "Commission is earned when a guest you booked checks out."
                : "When a guest a broker booked checks out, their commission shows here."
            }
          />
        }
      />
    </div>
  );
}

/** Where the broker's 85% is paid: one MoMo number, set or changed here. */
export function PayoutNumberCard({ account }: { account: BrokerPayoutAccount | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(account === null);
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const result = await setPayoutNumber({ accountName, phone });
      if (!result.ok) {
        setError(result.fieldErrors?.phone ?? result.fieldErrors?.accountName ?? result.error);
        return;
      }
      toast.success("Your MoMo number is saved");
      setEditing(false);
      setPhone("");
      router.refresh();
    });
  };

  return (
    <SectionCard title="Where your commission is paid">
      {!editing && account ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">{account.accountName}</span>
            <span className="text-muted"> · {account.phoneMasked}</span>
          </span>
          <ActionButton size="sm" onPress={() => setEditing(true)}>
            Change
          </ActionButton>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <p className="text-sm text-muted">
            Your 85% of each commission is sent to this MoMo number once the hotel has paid it.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Name on the MoMo account"
              name="accountName"
              value={accountName}
              onChange={setAccountName}
              isRequired
            />
            <TextInput
              label="MoMo number"
              name="phone"
              value={phone}
              onChange={setPhone}
              inputMode="tel"
              placeholder="078 123 4567"
              isRequired
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <ActionButton type="submit" intent="primary" isPending={pending}>
              Save number
            </ActionButton>
            {account ? <ActionButton onPress={() => setEditing(false)}>Cancel</ActionButton> : null}
          </div>
        </form>
      )}
    </SectionCard>
  );
}
