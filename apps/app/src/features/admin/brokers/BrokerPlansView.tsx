"use client";

import { Toast, toast } from "@heroui/react";
import {
  type AdminBrokerSubscription,
  type AdminBrokerSubscriptionList,
  BROKER_PAY_METHOD_LABEL,
  type BrokerPlan,
  type BrokerPlanCode,
  type BrokerPlanStatus,
} from "@injishi/contracts";
import {
  DataTable,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatMoney,
  type GridColumn,
  IconAction,
  MoneyInput,
  PageContent,
  type PlaceChain,
  ServerDataGrid,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { TextInput } from "@/features/rentals/fields";
import {
  ALL,
  AreaFilter,
  CountStrip,
  ListBar,
  ListFilter,
  ListSearch,
  ListUrlProvider,
  SinceFilter,
  useListUrl,
} from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";
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

/**
 * Broker plans in the admin console: the three plans with their monthly price and how many brokers hold
 * each, a new price with a reason (finance, `admin.fee.edit`), and every broker's subscription. A new
 * price applies to the next payment; a month already paid keeps its price.
 */
export function BrokerPlansView(props: {
  /** The Subscriptions tab or the Plan prices tab. */
  view: "subscriptions" | "prices";
  plans: BrokerPlan[];
  /** One page of subscriptions, filtered by the URL (the Subscriptions tab). */
  subscriptions: AdminBrokerSubscriptionList | null;
  /** Brokers on each plan now, active or in grace (the Plan prices tab). */
  holding: Partial<Record<BrokerPlanCode, number>>;
  areaChain: PlaceChain;
  canEdit: boolean;
}) {
  return (
    <ListUrlProvider>
      <BrokerPlans {...props} />
    </ListUrlProvider>
  );
}

function BrokerPlans({
  view,
  plans,
  subscriptions,
  holding: held,
  areaChain,
  canEdit,
}: {
  view: "subscriptions" | "prices";
  plans: BrokerPlan[];
  subscriptions: AdminBrokerSubscriptionList | null;
  holding: Partial<Record<BrokerPlanCode, number>>;
  areaChain: PlaceChain;
  canEdit: boolean;
}) {
  const url = useListUrl();
  const [editing, setEditing] = useState<BrokerPlan | null>(null);
  const holding = (code: BrokerPlanCode) => held[code] ?? 0;
  const counts = subscriptions?.statusCounts ?? {};
  const planName = (code: BrokerPlanCode) => plans.find((p) => p.code === code)?.name ?? code;

  const columns: GridColumn<AdminBrokerSubscription>[] = [
    {
      id: "broker",
      header: "Broker",
      isRowHeader: true,
      cell: (s) => (
        <span className="flex min-w-0 items-center gap-3">
          <EntityMark name={s.brokerName ?? "Broker"} />
          <span className="truncate font-medium">{s.brokerName ?? "No name yet"}</span>
        </span>
      ),
    },
    {
      id: "plan",
      header: "Plan",
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
        <>
          <CountStrip
            label="Subscriptions by status"
            param="status"
            items={[
              { id: "active", label: "Active", icon: "CircleCheck", value: counts.active ?? 0 },
              {
                id: "past_due",
                label: "In grace",
                icon: "Clock",
                value: counts.past_due ?? 0,
                status: (counts.past_due ?? 0) > 0 ? "warning" : undefined,
              },
              { id: "pending_payment", label: "Waiting to pay", icon: "Wallet", value: counts.pending_payment ?? 0 },
              { id: "cancelled", label: "Cancelled", icon: "CircleXmark", value: counts.cancelled ?? 0 },
              { id: "expired", label: "Ended", icon: "CircleXmark", value: counts.expired ?? 0 },
            ]}
          />
          <ListBar
            keys={["q", "status", "plan", "since"]}
            found={subscriptions?.meta.total ?? 0}
            noun={{ one: "subscription", many: "subscriptions" }}
            search={<ListSearch placeholder="Broker name or email" />}
          >
            <ListFilter
              param="status"
              name="Status"
              options={[
                { id: ALL, label: "All" },
                ...(Object.keys(STATUS) as BrokerPlanStatus[]).map((k) => ({
                  id: k,
                  label: STATUS[k].label,
                  count: counts[k] ?? 0,
                })),
              ]}
            />
            <ListFilter
              param="plan"
              name="Plan"
              icon="CreditCard"
              options={[{ id: ALL, label: "All" }, ...plans.map((p) => ({ id: p.code, label: p.name }))]}
            />
            <AreaFilter chain={areaChain} depth="province" />
            <SinceFilter name="Started" />
          </ListBar>
          <ServerDataGrid<AdminBrokerSubscription>
            label="Broker subscriptions"
            rows={subscriptions?.items ?? []}
            rowKey={(s) => s.id}
            columns={columns}
            isLoading={url.pending}
            paging={
              subscriptions
                ? {
                    page: subscriptions.meta.page,
                    pageSize: subscriptions.meta.pageSize,
                    total: subscriptions.meta.total,
                    onPageChange: (page) => url.set({ page: String(page) }),
                  }
                : undefined
            }
            mobile={{
              title: (s) => s.brokerName ?? "No name yet",
              description: (s) => `${planName(s.plan)} · ${s.area} · ${formatMoney(s.paidRwf)}`,
              trailing: (s) => <StatusChip tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusChip>,
            }}
            empty={<EmptyBlock size="sm" icon="CreditCard" title="No subscription matches" />}
          />
        </>
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
