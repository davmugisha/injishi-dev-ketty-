"use client";

import { Card, Chip, Description, Label, Spinner, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import {
  type BrokerPayMethod,
  type BrokerPlanCode,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  momoNetworkOf,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  Icon,
  PageContent,
  PageHeader,
  PhoneInput,
  type PlaceChain,
  PlacePicker,
  SectionCard,
  SelectField,
  SidePanel,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { fieldErrorsOnly } from "../rentals/fields";
import { loadPlaces } from "../rentals/places";
import { cancelPlan, changePlan, checkoutPlan, pollPlanPayment, setHomeDistrict } from "./actions";

const NAME: Record<BrokerPlanCode, string> = { district: "District", province: "Province", country: "Country" };
const RANK: Record<BrokerPlanCode, number> = { district: 0, province: 1, country: 2 };
const METHODS: { id: BrokerPayMethod; title: string; hint: string }[] = [
  { id: "mtn_momo", title: "MTN MoMo", hint: "078 or 079" },
  { id: "airtel_money", title: "Airtel Money", hint: "072 or 073" },
  { id: "card", title: "Card", hint: "On the payment page" },
];
const PAYMENT: Record<BrokerPlanPayment["status"], { tone: StatusTone; label: string }> = {
  pending: { tone: "info", label: "Waiting" },
  paid: { tone: "success", label: "Paid" },
  failed: { tone: "danger", label: "Failed" },
};

/**
 * The broker's plan (2026-10-25): District is free and shows the home district; Province and Country are
 * paid by the month by MoMo, Airtel or card. An upgrade starts once the money lands (a waiting state
 * follows the phone); a cheaper plan or ending the plan takes effect when the month ends. The home
 * district changes once per 30 days on the free plan.
 */
export type PlanSection = "plan" | "payments" | "district";

export function PlanView({
  data,
  openPaymentId,
  embedded = false,
  section = "plan",
}: {
  data: BrokerPlanOverview;
  openPaymentId: string | null;
  /** Inside the Account plan dialog — no outer page chrome. */
  embedded?: boolean;
  /** Which left-rail tab is active when embedded (Cursor-style settings). */
  section?: PlanSection;
}) {
  const router = useRouter();
  const [buying, setBuying] = useState<"province" | "country" | null>(null);
  const [watching, setWatching] = useState<string | null>(openPaymentId ?? null);
  const [cancelling, setCancelling] = useState(false);
  const [pending, start] = useTransition();
  const current = data.current;
  const paid = current.plan !== "district";
  const quote = (plan: BrokerPlanCode) => data.quotes.find((q) => q.plan === plan)?.amountRwf ?? null;

  const downgrade = (plan: BrokerPlanCode) =>
    start(async () => {
      const r = await changePlan({ plan });
      if (!r.ok) return void toast.danger(r.error);
      toast.success(plan === current.plan ? "Your plan stays as it is" : `${NAME[plan]} starts when this month ends`);
      router.refresh();
    });

  const area = (code: BrokerPlanCode): string =>
    code === "district"
      ? (data.home.districtName ?? "Your district")
      : code === "province"
        ? current.plan === "province"
          ? current.area
          : data.home.provinceName
            ? `All of ${data.home.provinceName}`
            : "One province"
        : "All of Rwanda";

  const columns: DataColumn<BrokerPlanPayment>[] = [
    {
      id: "on",
      header: "Date",
      cell: (p) => formatDay(p.createdAt, "short"),
      sortValue: (p) => p.createdAt,
      isRowHeader: true,
    },
    { id: "plan", header: "Plan", cell: (p) => `${NAME[p.planCode]}${p.kind === "renewal" ? ", renewal" : ""}` },
    {
      id: "period",
      header: "Month",
      cell: (p) => `${formatDay(p.periodStart, "short")} to ${formatDay(p.periodEnd, "short")}`,
      hideBelow: "lg",
    },
    { id: "method", header: "Paid with", cell: (p) => p.methodWords, hideBelow: "lg" },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      cell: (p) => <span className="tabular">{formatMoney(p.amountRwf)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => <StatusChip tone={PAYMENT[p.status].tone}>{PAYMENT[p.status].label}</StatusChip>,
    },
  ];

  const header = embedded ? (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Your plan</h2>
        <p className="text-sm text-muted">{current.area}</p>
      </div>
      {paid && !current.endsInto && current.status !== "past_due" ? (
        <ActionButton icon="CircleXmark" onPress={() => setCancelling(true)}>
          End at month end
        </ActionButton>
      ) : null}
    </div>
  ) : (
    <PageHeader
      title="Plan"
      actions={
        paid && !current.endsInto && current.status !== "past_due" ? (
          <ActionButton icon="CircleXmark" onPress={() => setCancelling(true)}>
            End at month end
          </ActionButton>
        ) : null
      }
    />
  );

  const showPlan = !embedded || section === "plan";
  const showPayments = !embedded || section === "payments";
  const showDistrict = !embedded || section === "district";

  const body = (
    <>
      {showPlan ? header : null}

      {showPlan && current.status === "past_due" && current.graceUntil ? (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-3 border border-warning p-4">
          <span className="flex items-center gap-2 text-sm">
            <Icon name="TriangleExclamation" className="text-warning" />
            This month did not renew. Pay by {formatDay(current.graceUntil, "long")} to keep {current.area}.
          </span>
          <ActionButton
            intent="primary"
            icon="Wallet"
            onPress={() => setBuying(current.plan === "country" ? "country" : "province")}
          >
            Pay now
          </ActionButton>
        </Card>
      ) : null}
      {showPlan && data.pending && !watching ? (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 text-sm">
            <Spinner size="sm" />A payment of {formatMoney(data.pending.amountRwf)} is waiting.
          </span>
          <ActionButton onPress={() => setWatching(data.pending?.id ?? null)}>See it</ActionButton>
        </Card>
      ) : null}

      {showPlan ? (
        <ul className="grid items-stretch gap-4 md:grid-cols-3" aria-label="Plans">
          {data.plans.map((p) => {
            const isCurrent = p.code === current.plan;
            const higher = RANK[p.code] > RANK[current.plan];
            const scheduled = current.endsInto === p.code;
            const today = higher ? quote(p.code) : null;
            return (
              <li key={p.code} className="flex">
                <Card
                  className={
                    isCurrent ? "flex w-full flex-col gap-4 p-5 ring-2 ring-accent" : "flex w-full flex-col gap-4 p-5"
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-lg font-semibold">{p.name}</span>
                      <span className="text-sm text-muted">{area(p.code)}</span>
                    </span>
                    {isCurrent ? (
                      <Chip size="sm" variant="soft" color="accent">
                        Your plan
                      </Chip>
                    ) : scheduled ? (
                      <Chip size="sm" variant="soft" color="warning">
                        From {current.periodEnd ? formatDay(current.periodEnd, "short") : "next month"}
                      </Chip>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tabular">
                      {p.priceRwf === 0 ? "Free" : formatMoney(p.priceRwf)}
                    </span>
                    {p.priceRwf > 0 ? <span className="text-sm text-muted">a month</span> : null}
                  </div>
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                    <li className="flex items-start gap-2">
                      <Icon name="CircleCheck" className="mt-0.5 text-success" />
                      {p.code === "district"
                        ? "Homes in your district"
                        : p.code === "province"
                          ? "Homes in one province"
                          : "Homes anywhere in Rwanda"}
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="CircleCheck" className="mt-0.5 text-success" />
                      Free landlord contacts
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="CircleCheck" className="mt-0.5 text-success" />
                      {p.code === "district" ? "Change district once a month" : "Renews by itself, 3 days' grace"}
                    </li>
                  </ul>
                  {isCurrent ? (
                    current.nextPaymentOn && current.nextAmountRwf ? (
                      <p className="text-xs text-muted">
                        Renews {formatDay(current.nextPaymentOn, "long")} for {formatMoney(current.nextAmountRwf)}
                      </p>
                    ) : current.endsInto ? (
                      <ActionButton icon="ArrowRotateLeft" onPress={() => downgrade(current.plan)} isPending={pending}>
                        Keep {p.name}
                      </ActionButton>
                    ) : null
                  ) : higher ? (
                    <ActionButton
                      intent="primary"
                      icon="ArrowUpRight"
                      onPress={() => setBuying(p.code as "province" | "country")}
                    >
                      {today !== null && today !== p.priceRwf
                        ? `Upgrade for ${formatMoney(today)}`
                        : `Upgrade to ${p.name}`}
                    </ActionButton>
                  ) : scheduled ? null : (
                    <ActionButton icon="ArrowDown" onPress={() => downgrade(p.code)} isPending={pending}>
                      Switch when the month ends
                    </ActionButton>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showDistrict && !showPayments ? <HomeDistrict data={data} /> : null}
      {showPayments && !showDistrict ? (
        <SectionCard title="Payments">
          <DataTable
            label="Plan payments"
            rows={data.payments}
            rowKey={(p) => p.id}
            columns={columns}
            defaultSort={{ column: "on", direction: "descending" }}
            mobile={{
              title: (p) => NAME[p.planCode],
              description: (p) => `${formatDay(p.createdAt, "short")} · ${p.methodWords}`,
              trailing: (p) => (
                <span className="flex flex-col items-end gap-1">
                  <span className="tabular">{formatMoney(p.amountRwf)}</span>
                  <StatusChip tone={PAYMENT[p.status].tone}>{PAYMENT[p.status].label}</StatusChip>
                </span>
              ),
            }}
            empty={<EmptyBlock size="sm" icon="Wallet" title="No payments yet" description="District is free." />}
          />
        </SectionCard>
      ) : null}
      {!embedded ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <HomeDistrict data={data} />
          <SectionCard title="Payments" className="lg:col-span-2">
            <DataTable
              label="Plan payments"
              rows={data.payments}
              rowKey={(p) => p.id}
              columns={columns}
              defaultSort={{ column: "on", direction: "descending" }}
              mobile={{
                title: (p) => NAME[p.planCode],
                description: (p) => `${formatDay(p.createdAt, "short")} · ${p.methodWords}`,
                trailing: (p) => (
                  <span className="flex flex-col items-end gap-1">
                    <span className="tabular">{formatMoney(p.amountRwf)}</span>
                    <StatusChip tone={PAYMENT[p.status].tone}>{PAYMENT[p.status].label}</StatusChip>
                  </span>
                ),
              }}
              empty={<EmptyBlock size="sm" icon="Wallet" title="No payments yet" description="District is free." />}
            />
          </SectionCard>
        </div>
      ) : null}

      {buying ? (
        <CheckoutPanel
          plan={buying}
          data={data}
          onClose={() => setBuying(null)}
          onWaiting={(id) => {
            setBuying(null);
            setWatching(id);
          }}
        />
      ) : null}
      {watching ? <WaitingPanel paymentId={watching} onClose={() => setWatching(null)} /> : null}
      <ConfirmDialog
        isOpen={cancelling}
        onOpenChange={setCancelling}
        title={`End ${NAME[current.plan]} when this month ends?`}
        confirmLabel="End at month end"
        isPending={pending}
        onConfirm={() =>
          start(async () => {
            const r = await cancelPlan();
            setCancelling(false);
            if (!r.ok) return void toast.danger(r.error);
            toast.success("You go back to District when this month ends");
            router.refresh();
          })
        }
      >
        {current.periodEnd
          ? `You keep ${current.area} until ${formatDay(current.periodEnd, "long")}, then see your district only.`
          : null}
      </ConfirmDialog>
    </>
  );
  return embedded ? <div className="flex flex-col gap-4">{body}</div> : <PageContent>{body}</PageContent>;
}

function HomeDistrict({ data }: { data: BrokerPlanOverview }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [chain, setChain] = useState<PlaceChain>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const locked = data.home.changeFrom;
  return (
    <SectionCard
      title="Home district"
      actions={
        <ActionButton
          size="sm"
          icon="MapPin"
          isDisabled={Boolean(locked)}
          onPress={() => {
            setChain({});
            setError(null);
            setEditing(true);
          }}
        >
          {data.home.districtId ? "Change" : "Choose"}
        </ActionButton>
      }
    >
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{data.home.districtName ?? "Not chosen yet"}</span>
        {data.home.provinceName ? <span className="text-sm text-muted">{data.home.provinceName}</span> : null}
        <span className="text-xs text-muted">
          {locked
            ? `You can change it again from ${formatDay(locked, "long")}.`
            : "The free plan shows the homes here."}
        </span>
      </div>
      <SidePanel
        isOpen={editing}
        onOpenChange={setEditing}
        title="Home district"
        description={current(data) === "district" ? "On the free plan it can change once a month." : undefined}
        submitLabel="Save"
        isPending={pending}
        formError={error}
        onSubmit={(event) => {
          event.preventDefault();
          const id = chain.district?.id;
          if (!id) return setError("Choose the district.");
          start(async () => {
            const r = await setHomeDistrict(Number(id));
            if (!r.ok) return setError(r.error);
            setEditing(false);
            toast.success(`Home district: ${chain.district?.name ?? ""}`);
            router.refresh();
          });
        }}
      >
        <PlacePicker
          value={chain}
          onChange={setChain}
          loadPlaces={loadPlaces}
          depth="district"
          label="Where you work"
        />
      </SidePanel>
    </SectionCard>
  );
}

const current = (data: BrokerPlanOverview) => data.current.plan;

function CheckoutPanel({
  plan,
  data,
  onClose,
  onWaiting,
}: {
  plan: "province" | "country";
  data: BrokerPlanOverview;
  onClose: () => void;
  onWaiting: (paymentId: string) => void;
}) {
  const router = useRouter();
  const price = data.plans.find((p) => p.code === plan)?.priceRwf ?? 0;
  const amount =
    data.current.plan === plan && data.current.status === "past_due"
      ? price
      : (data.quotes.find((q) => q.plan === plan)?.amountRwf ?? price);
  const [method, setMethod] = useState<BrokerPayMethod | null>(data.current.method);
  const [phone, setPhone] = useState<string | null>(null);
  const [provinceId, setProvinceId] = useState<string | null>(
    String(data.current.provinceId ?? data.home.provinceId ?? data.provinces[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (!method) next.method = "Pick how to pay.";
      if (method && method !== "card" && !phone) next.phone = "Enter the number the prompt goes to.";
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0) return;
      const r = await checkoutPlan({
        plan,
        method,
        ...(method !== "card" && phone ? { phone } : {}),
        ...(plan === "province" && provinceId ? { provinceId: Number(provinceId) } : {}),
      });
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      if (r.value.status === "pending" && r.value.checkoutUrl) {
        window.location.assign(r.value.checkoutUrl);
        return;
      }
      if (r.value.status === "pending") return onWaiting(r.value.id);
      if (r.value.status === "paid") toast.success(`You are on ${NAME[plan]}`);
      else toast.danger(r.value.failureReason ?? "The payment did not go through.");
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`${NAME[plan]} plan`}
      description={
        amount !== price
          ? `${formatMoney(price)} a month. Less what is left of this month today.`
          : `${formatMoney(price)} a month`
      }
      submitLabel={`Pay ${formatMoney(amount)}`}
      submitIcon="Wallet"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {plan === "province" ? (
        <SelectField
          label="Province"
          name="provinceId"
          options={data.provinces.map((p) => ({ id: String(p.id), label: p.label }))}
          value={provinceId}
          onChange={setProvinceId}
          isRequired
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pay with</span>
        <RadioButtonGroup
          aria-label="Pay with"
          layout="grid"
          value={method ?? ""}
          onChange={(v) => {
            setMethod(v as BrokerPayMethod);
            setErrors((e) => ({ ...e, method: "" }));
          }}
          className="grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {METHODS.map((m) => (
            <RadioButtonGroup.Item key={m.id} value={m.id} className="gap-1 px-3.5 py-3">
              <RadioButtonGroup.Indicator>
                <Icon name="CircleCheckFill" />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemContent>
                <Label className="font-semibold">{m.title}</Label>
                <Description className="text-xs">{m.hint}</Description>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        {errors.method ? <p className="text-xs text-danger">{errors.method}</p> : null}
      </div>
      {method && method !== "card" ? (
        <PhoneInput
          label="Number the prompt goes to"
          name="phone"
          value={phone}
          onChange={(e164) => {
            setPhone(e164);
            setErrors((e) => ({ ...e, phone: "" }));
            const net = e164 ? momoNetworkOf(e164) : null;
            if (net) setMethod(net === "airtel" ? "airtel_money" : "mtn_momo");
          }}
          errorMessage={errors.phone || null}
          isRequired
        />
      ) : method === "card" ? (
        <p className="text-sm text-muted">You go to the payment page, then come back here.</p>
      ) : null}
      <p className="text-xs text-muted">
        The plan starts once the payment is approved. It renews each month the same way.
      </p>
    </SidePanel>
  );
}

/** A plan payment waiting on a phone or a card page, asked about every two seconds until it settles. */
function WaitingPanel({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const router = useRouter();
  const [payment, setPayment] = useState<BrokerPlanPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await pollPlanPayment(paymentId);
      if (!live) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPayment(r.value);
      if (r.value.status !== "pending") {
        router.refresh();
        return;
      }
      timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [paymentId, router]);

  const status = error ? "failed" : (payment?.status ?? "pending");
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={status === "paid" ? "Paid" : status === "pending" ? "Approve on your phone" : "Not paid"}
      description={payment ? `${formatMoney(payment.amountRwf)} · ${payment.methodWords}` : undefined}
      footer={
        <ActionButton intent={status === "pending" ? "secondary" : "primary"} onPress={onClose}>
          {status === "pending" ? "Close, keep waiting" : "Done"}
        </ActionButton>
      }
    >
      <div className="flex items-start gap-3" aria-live="polite">
        <span
          className={
            status === "paid"
              ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
              : status === "pending"
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                : "flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
          }
        >
          {status === "pending" ? (
            <Spinner size="sm" color="current" />
          ) : (
            <Icon name={status === "paid" ? "CircleCheck" : "CircleXmark"} className="size-5" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">
            {status === "paid"
              ? `You are on ${payment ? NAME[payment.planCode] : "your new plan"}`
              : status === "pending"
                ? "A prompt is on its way to your phone"
                : "The payment did not go through"}
          </span>
          <span className="text-sm text-pretty text-muted">
            {status === "paid" && payment
              ? `Until ${formatDay(payment.periodEnd, "long")}.`
              : status === "pending"
                ? "Enter your PIN on the phone. This page updates by itself."
                : (error ?? payment?.failureReason ?? "Nothing was taken.")}
          </span>
        </span>
      </div>
    </SidePanel>
  );
}
