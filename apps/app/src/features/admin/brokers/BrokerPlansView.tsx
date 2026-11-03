"use client";

import { Toast, toast } from "@heroui/react";
import {
  type AdminBrokerSubscription,
  BROKER_PAY_METHOD_LABEL,
  type BrokerPlan,
  type BrokerPlanCode,
  type BrokerPlanStatus,
} from "@injishi/contracts";
import {
  type DataColumn,
  DataTable,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatMoney,
  IconAction,
  MoneyInput,
  PageContent,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
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
  view,
  plans,
  subscriptions,
  canEdit,
}: {
  /** The Subscriptions tab or the Plan prices tab. */
  view: "subscriptions" | "prices";
  plans: BrokerPlan[];
  subscriptions: AdminBrokerSubscription[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<BrokerPlan | null>(null);
  const holding = (code: BrokerPlanCode) =>
    subscriptions.filter((s) => s.plan === code && (s.status === "active" || s.status === "past_due")).length;
  const count = (t: Tab) =>
    t === "all"
      ? subscriptions.length
      : t === "ended"
        ? subscriptions.filter((s) => ENDED.includes(s.status)).length
        : subscriptions.filter((s) => s.status === t).length;
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
      <AreaHeader />
      {view === "prices" ? (
        <DataTable<BrokerPlan>
          label="Plan prices"
          noun={{ one: "plan", many: "plans" }}
          rows={plans}
          rowKey={(p) => p.code}
          columns={[
            {
              id: "plan",
              header: "Plan",
              isRowHeader: true,
              cell: (p) => (
                <span className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{COVERS[p.code]}</span>
                </span>
              ),
            },
            {
              id: "price",
              header: "Price a month",
              align: "end",
              sortValue: (p) => p.priceRwf,
              cell: (p) => (p.priceRwf === 0 ? "Free" : formatMoney(p.priceRwf)),
            },
            {
              id: "brokers",
              header: "Brokers on it",
              align: "end",
              sortValue: (p) => holding(p.code),
              cell: (p) => <span className="tabular">{holding(p.code)}</span>,
            },
            {
              id: "status",
              header: "Status",
              cell: (p) => <StatusChip tone={p.active ? "success" : "default"}>{p.active ? "On" : "Off"}</StatusChip>,
            },
          ]}
          rowActions={
            canEdit
              ? (p) =>
                  p.code !== "district" ? (
                    <IconAction
                      icon="PencilToSquare"
                      label={`Change the ${p.name} price`}
                      onPress={() => setEditing(p)}
                    />
                  ) : null
              : undefined
          }
          mobile={{
            title: (p) => p.name,
            description: (p) => `${COVERS[p.code]} · ${holding(p.code)} brokers`,
            trailing: (p) => (
              <span className="font-medium tabular">{p.priceRwf === 0 ? "Free" : formatMoney(p.priceRwf)}</span>
            ),
          }}
          empty={<EmptyBlock icon="CreditCard" title="No plans yet" />}
        />
      ) : (
        <DataTable
          label="Broker subscriptions"
          noun={{ one: "subscription", many: "subscriptions" }}
          rows={subscriptions}
          rowKey={(s) => s.id}
          columns={columns}
          defaultSort={{ column: "period", direction: "descending" }}
          search={{ placeholder: "Broker or area", text: (s) => `${s.brokerName ?? ""} ${s.area}` }}
          filters={[
            {
              id: "status",
              name: "Status",
              options: [
                { id: "all", label: "All", count: count("all") },
                { id: "active", label: "Active", count: count("active") },
                { id: "past_due", label: "In grace", count: count("past_due") },
                { id: "ended", label: "Ended", count: count("ended") },
              ],
              match: (s, v) => (v === "ended" ? ENDED.includes(s.status) : s.status === v),
            },
            {
              id: "plan",
              name: "Plan",
              icon: "CreditCard",
              options: [{ id: "all", label: "All" }, ...plans.map((p) => ({ id: p.code, label: p.name }))],
              match: (s, v) => s.plan === v,
            },
          ]}
          mobile={{
            title: (s) => s.brokerName ?? "No name yet",
            description: (s) => `${planName(s.plan)} · ${s.area} · ${formatMoney(s.paidRwf)}`,
            trailing: (s) => <StatusChip tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusChip>,
          }}
          empty={<EmptyBlock icon="CreditCard" title="No subscriptions yet" />}
        />
      )}

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
        errorMessage={errors.reason || null}
      />
    </FormDialog>
  );
}
