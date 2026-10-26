"use client";

import { Card, Toast, toast } from "@heroui/react";
import {
  type AdminBrokerSubscription,
  BROKER_PAY_METHOD_LABEL,
  type BrokerPlan,
  type BrokerPlanCode,
  type BrokerPlanStatus,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FilterTabs,
  FormDialog,
  formatDay,
  formatMoney,
  ListToolbar,
  MoneyInput,
  PageContent,
  PageHeader,
  SearchBar,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TextInput } from "@/features/rentals/fields";
import { setBrokerPlanPrice } from "./actions";

const STATUS: Record<BrokerPlanStatus, { tone: StatusTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  pending_payment: { tone: "info", label: "Waiting to pay" },
  past_due: { tone: "warning", label: "In grace" },
  cancelled: { tone: "default", label: "Cancelled" },
  expired: { tone: "default", label: "Ended" },
};

const COVERS: Record<BrokerPlanCode, string> = {
  district: "One district",
  province: "One province",
  country: "All of Rwanda",
};

type Tab = "all" | "active" | "past_due" | "ended";
const ENDED: BrokerPlanStatus[] = ["cancelled", "expired"];

/**
 * Broker plans in the admin console: the three plans with their monthly price and how many brokers hold
 * each, a new price with a reason (finance, `admin.fee.edit`), and every broker's subscription. A new
 * price applies to the next payment; a month already paid keeps its price.
 */
export function BrokerPlansView({
  plans,
  subscriptions,
  canEdit,
}: {
  plans: BrokerPlan[];
  subscriptions: AdminBrokerSubscription[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<BrokerPlan | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const holding = (code: BrokerPlanCode) =>
    subscriptions.filter((s) => s.plan === code && (s.status === "active" || s.status === "past_due")).length;
  const count = (t: Tab) =>
    t === "all"
      ? subscriptions.length
      : t === "ended"
        ? subscriptions.filter((s) => ENDED.includes(s.status)).length
        : subscriptions.filter((s) => s.status === t).length;
  const needle = q.trim().toLowerCase();
  const rows = subscriptions.filter((s) => {
    if (tab === "ended" ? !ENDED.includes(s.status) : tab !== "all" && s.status !== tab) return false;
    if (!needle) return true;
    return `${s.brokerName ?? ""} ${s.area}`.toLowerCase().includes(needle);
  });
  const planName = (code: BrokerPlanCode) => plans.find((p) => p.code === code)?.name ?? code;

  const columns: DataColumn<AdminBrokerSubscription>[] = [
    {
      id: "broker",
      header: "Broker",
      isRowHeader: true,
      sortValue: (s) => s.brokerName ?? "",
      cell: (s) => <span className="font-medium">{s.brokerName ?? "No name yet"}</span>,
    },
    {
      id: "plan",
      header: "Plan",
      sortValue: (s) => s.plan,
      cell: (s) => (
        <span className="flex flex-col">
          <span>{planName(s.plan)}</span>
          <span className="text-xs text-muted">{s.area}</span>
        </span>
      ),
    },
    {
      id: "period",
      header: "Month",
      sortValue: (s) => s.periodStart,
      cell: (s) => (
        <span className="whitespace-nowrap">
          {formatDay(s.periodStart)} to {formatDay(s.periodEnd)}
        </span>
      ),
    },
    {
      id: "paid",
      header: "Paid",
      align: "end",
      sortValue: (s) => s.paidRwf,
      cell: (s) => (
        <span className="flex flex-col items-end">
          <span className="tabular">{formatMoney(s.paidRwf)}</span>
          {s.method ? <span className="text-xs text-muted">{BROKER_PAY_METHOD_LABEL[s.method]}</span> : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (s) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusChip tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusChip>
          {s.cancelAtPeriodEnd && s.status === "active" ? (
            <span className="text-xs text-muted">Ends {formatDay(s.periodEnd)}</span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader title="Broker plans" />
      <ul className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const held = holding(p.code);
          return (
            <li key={p.code} className="flex">
              <Card className="w-full gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm text-muted">{COVERS[p.code]}</span>
                  </div>
                  {p.active ? null : <StatusChip tone="default">Off</StatusChip>}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight tabular">
                    {p.priceRwf === 0 ? "Free" : formatMoney(p.priceRwf)}
                  </span>
                  {p.priceRwf > 0 ? <span className="text-sm text-muted">a month</span> : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-separator pt-3">
                  <span className="text-sm text-muted">
                    {held} {held === 1 ? "broker" : "brokers"}
                  </span>
                  {canEdit && p.code !== "district" ? (
                    <ActionButton size="sm" icon="PencilToSquare" onPress={() => setEditing(p)}>
                      Change price
                    </ActionButton>
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <ListToolbar
        tabs={
          <FilterTabs
            label="Subscriptions by status"
            name="Status"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as Tab)}
            tabs={[
              { id: "all", label: "All", count: count("all") },
              { id: "active", label: "Active", count: count("active") },
              { id: "past_due", label: "In grace", count: count("past_due") },
              { id: "ended", label: "Ended", count: count("ended") },
            ]}
          />
        }
      >
        <SearchBar label="Search subscriptions" placeholder="Broker or area" value={q} onChange={setQ} />
      </ListToolbar>
      <DataTable
        label="Broker subscriptions"
        rows={rows}
        rowKey={(s) => s.id}
        columns={columns}
        defaultSort={{ column: "period", direction: "descending" }}
        mobile={{
          title: (s) => s.brokerName ?? "No name yet",
          description: (s) => `${planName(s.plan)} · ${s.area} · ${formatMoney(s.paidRwf)}`,
          trailing: (s) => <StatusChip tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusChip>,
        }}
        empty={<EmptyBlock icon="CreditCard" title={needle ? "No subscription matches" : "No subscriptions yet"} />}
      />

      {editing ? <PriceDialog plan={editing} onClose={() => setEditing(null)} /> : null}
    </PageContent>
  );
}

function PriceDialog({ plan, onClose }: { plan: BrokerPlan; onClose: () => void }) {
  const router = useRouter();
  const [price, setPrice] = useState<number | null>(plan.priceRwf);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`${plan.name} price`}
      description="Applies to the next payment. Months already paid keep their price."
      submitLabel="Save price"
      isPending={pending}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setFormError(null);
          const r = await setBrokerPlanPrice(plan.code, { priceRwf: price ?? Number.NaN, reason });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.fieldErrors ? null : r.error);
            return;
          }
          toast.success(`${r.value.name} is now ${formatMoney(r.value.priceRwf)} a month`);
          onClose();
          router.refresh();
        });
      }}
    >
      <MoneyInput
        label="Price a month"
        value={price}
        onChange={(v) => {
          setPrice(v);
          setErrors((e) => ({ ...e, priceRwf: "" }));
        }}
        minValue={0}
        maxValue={10_000_000}
        isRequired
        autoFocus
        errorMessage={errors.priceRwf || null}
      />
      <TextInput
        label="Reason"
        name="reason"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setErrors((e) => ({ ...e, reason: "" }));
        }}
        multiline
        isRequired
        description="Kept in the audit log."
        errorMessage={errors.reason || null}
      />
    </FormDialog>
  );
}
