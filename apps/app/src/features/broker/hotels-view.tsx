"use client";

import { toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  BROKER_COMMISSION_INJISHI_SHARE,
  type BrokerDeal,
  type BrokerDealList,
  type BrokerDealTerms,
  type BrokerHotel,
  type BrokerHotels,
  brokerCommissionSplit,
  brokerDealTermsLine,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  KpiStrip,
  PageContent,
  PageHeader,
  SearchBar,
  SectionCard,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CountInput, fieldErrorsOnly, TextInput } from "../rentals/fields";
import { closeDeal, proposeDeal } from "./actions";
import { DealChip } from "./deal-shared";

const SHARE = `${Math.round(BROKER_COMMISSION_INJISHI_SHARE * 100)}%`;
/** The booking the example under the form is worked on. */
const EXAMPLE_BOOKING_RWF = 1_000_000;

/**
 * Hotels (0124, 2026-11-02): the broker's commission deals with hotels. A hotel inside the plan's area can be
 * offered terms (a percent of each booking, or one sum for a bulk booking); its owner accepts or declines.
 * Injishi keeps 15% of every commission and the broker gets the rest. Booking for clients is the next phase.
 */
export function HotelsView({ data, deals }: { data: BrokerHotels; deals: BrokerDealList }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [proposing, setProposing] = useState<BrokerHotel | null>(null);
  const [closing, setClosing] = useState<{ deal: BrokerDeal; move: "withdraw" | "end" } | null>(null);
  const [pending, start] = useTransition();

  const waiting = deals.deals.filter((d) => d.status === "proposed");
  const running = deals.deals.filter((d) => d.status === "active");
  const hotels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.hotels;
    return data.hotels.filter((h) =>
      [h.name, h.district, h.sector, h.kindLabel].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [search, data.hotels]);

  const suspended = data.brokerStatus !== "active";

  const hotelColumns: DataColumn<BrokerHotel>[] = [
    {
      id: "hotel",
      header: "Hotel",
      cell: (h) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">
            {h.name}
            {h.stars ? <span className="ml-1.5 text-xs text-muted">{"★".repeat(h.stars)}</span> : null}
          </span>
          <span className="text-xs text-muted">{[h.kindLabel, h.sector, h.district].filter(Boolean).join(", ")}</span>
        </span>
      ),
      sortValue: (h) => h.name,
      isRowHeader: true,
    },
    {
      id: "rooms",
      header: "Room types",
      cell: (h) => <span className="tabular">{h.roomTypes}</span>,
      sortValue: (h) => h.roomTypes,
      hideBelow: "lg",
    },
    {
      id: "from",
      header: "From",
      align: "end",
      cell: (h) => (h.fromRwf ? <span className="tabular">{formatMoney(h.fromRwf)}</span> : "-"),
      sortValue: (h) => h.fromRwf ?? 0,
      hideBelow: "lg",
    },
    {
      id: "deal",
      header: "Your deal",
      cell: (h) =>
        h.deal ? (
          <span className="flex flex-col gap-1">
            <DealChip status={h.deal.status} />
            <span className="text-xs text-muted">{brokerDealTermsLine(h.deal.terms)}</span>
          </span>
        ) : (
          <span className="text-muted">None yet</span>
        ),
    },
  ];

  const dealColumns: DataColumn<BrokerDeal>[] = [
    {
      id: "hotel",
      header: "Hotel",
      cell: (d) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{d.hotel.name}</span>
          <span className="text-xs text-muted">{d.hotel.district ?? ""}</span>
        </span>
      ),
      sortValue: (d) => d.hotel.name,
      isRowHeader: true,
    },
    { id: "terms", header: "Commission", cell: (d) => brokerDealTermsLine(d.terms) },
    {
      id: "when",
      header: "Proposed",
      cell: (d) => formatDay(d.proposedAt, "short"),
      sortValue: (d) => d.proposedAt,
      hideBelow: "lg",
    },
    {
      id: "answer",
      header: "Answer",
      cell: (d) => dealAnswer(d) ?? <span className="text-muted">Waiting</span>,
      hideBelow: "lg",
    },
    { id: "status", header: "Status", cell: (d) => <DealChip status={d.status} /> },
  ];

  const confirmClose = () => {
    if (!closing) return;
    start(async () => {
      const result = await closeDeal(closing.deal.id, closing.move, "");
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(closing.move === "withdraw" ? "Proposal withdrawn" : "Deal ended");
      setClosing(null);
      router.refresh();
    });
  };

  return (
    <PageContent>
      <PageHeader
        title="Hotels"
        description={`Agree a commission with a hotel, then bring it bookings. The hotel pays the commission on every stay; Injishi keeps ${SHARE} of it and the rest is yours.`}
      />
      <KpiStrip
        label="Your hotel deals"
        items={[
          {
            id: "hotels",
            label: `Hotels in ${data.scope.area}`,
            value: data.hotels.length,
            format: "count",
            icon: "House",
          },
          { id: "waiting", label: "Waiting for an answer", value: waiting.length, format: "count", icon: "Clock" },
          { id: "running", label: "Running deals", value: running.length, format: "count", icon: "CircleCheck" },
        ]}
      />

      {deals.deals.length > 0 ? (
        <SectionCard title="Your deals">
          <DataTable
            label="Your deals"
            rows={deals.deals}
            rowKey={(d) => d.id}
            columns={dealColumns}
            defaultSort={{ column: "when", direction: "descending" }}
            rowActions={(d) =>
              d.status === "proposed" ? (
                <ActionButton
                  size="sm"
                  icon="ArrowRotateLeft"
                  onPress={() => setClosing({ deal: d, move: "withdraw" })}
                >
                  Withdraw
                </ActionButton>
              ) : d.status === "active" ? (
                <ActionButton size="sm" icon="Xmark" onPress={() => setClosing({ deal: d, move: "end" })}>
                  End deal
                </ActionButton>
              ) : null
            }
            mobile={{
              title: (d) => d.hotel.name,
              description: (d) => brokerDealTermsLine(d.terms),
              trailing: (d) => <DealChip status={d.status} />,
            }}
          />
        </SectionCard>
      ) : null}

      <SectionCard title={`Hotels in ${data.scope.area}`}>
        <div className="mb-3 flex justify-end">
          <SearchBar
            label="Search hotels"
            value={search}
            onChange={setSearch}
            placeholder="Hotel, sector or district"
          />
        </div>
        <DataTable
          label="Hotels"
          rows={hotels}
          rowKey={(h) => h.orgId}
          columns={hotelColumns}
          defaultSort={{ column: "hotel", direction: "ascending" }}
          rowActions={(h) =>
            h.deal || suspended ? null : (
              <ActionButton size="sm" icon="Plus" onPress={() => setProposing(h)}>
                Propose a deal
              </ActionButton>
            )
          }
          mobile={{
            title: (h) => h.name,
            description: (h) => [h.kindLabel, h.district].filter(Boolean).join(", "),
            trailing: (h) => (h.deal ? <DealChip status={h.deal.status} /> : null),
          }}
          empty={
            data.scope.needsDistrict ? (
              <EmptyBlock
                icon="House"
                title="Choose your home district first"
                description="Your free plan shows the hotels in your home district. Choose it in your plan settings."
                action={
                  <ActionLink href="/account?plan=1" icon="Plus">
                    Choose a district
                  </ActionLink>
                }
              />
            ) : (
              <EmptyBlock
                icon="House"
                title={search ? "No hotel matches" : `No hotels in ${data.scope.area} yet`}
                description={
                  search
                    ? undefined
                    : data.scope.upgrade
                      ? `A wider plan shows the hotels in ${data.scope.upgrade.area}.`
                      : "Hotels show here once they are approved and listed on Injishi."
                }
                action={
                  !search && data.scope.upgrade ? (
                    <ActionLink href="/account?plan=1" icon="Plus">
                      See plans
                    </ActionLink>
                  ) : undefined
                }
              />
            )
          }
        />
      </SectionCard>

      <ProposePanel hotel={proposing} onClose={() => setProposing(null)} />

      <ConfirmDialog
        isOpen={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing?.move === "withdraw" ? "Withdraw this proposal?" : "End this deal?"}
        confirmLabel={closing?.move === "withdraw" ? "Withdraw proposal" : "End deal"}
        intent="danger"
        isPending={pending}
        onConfirm={confirmClose}
      >
        {closing?.move === "withdraw"
          ? `${closing.deal.hotel.name} will no longer see it. You can propose new terms afterwards.`
          : `Bookings you make at ${closing?.deal.hotel.name ?? "this hotel"} from now on earn no commission. You can propose a new deal afterwards.`}
      </ConfirmDialog>
    </PageContent>
  );
}

/** What the hotel said, or how it closed, in one short line; null while it waits. */
function dealAnswer(d: BrokerDeal): string | null {
  if (d.status === "withdrawn") return "You withdrew it";
  if (d.status === "ended") {
    const who =
      d.closedBy === "hotel" ? "The hotel ended it" : d.closedBy === "broker" ? "You ended it" : "Its end date passed";
    return d.closeNote ? `${who}: ${d.closeNote}` : who;
  }
  if (!d.decidedAt) return null;
  const said = d.status === "declined" ? "Declined" : `Accepted ${formatDay(d.decidedAt, "short")}`;
  return d.decisionNote ? `${said}: ${d.decisionNote}` : said;
}

/** Terms as typed, before they are checked: strings for what is typed, numbers for counts. */
interface Draft {
  kind: BrokerDealTerms["kind"];
  percent: string;
  amount: string;
  minRooms: number | null;
  note: string;
}

const EMPTY: Draft = { kind: "percent", percent: "", amount: "", minRooms: null, note: "" };

/** "10", "7.5", "200,000" → a number, or null while it is not one. */
function typedNumber(text: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function ProposePanel({ hotel, onClose }: { hotel: BrokerHotel | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setDraft(EMPTY);
    setErrors({});
    setFormError(null);
  };
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setFormError(null);
  };

  const percent = typedNumber(draft.percent);
  const amount = typedNumber(draft.amount);
  const commission =
    draft.kind === "percent"
      ? percent !== null && percent > 0
        ? Math.round((EXAMPLE_BOOKING_RWF * percent) / 100)
        : null
      : amount !== null && amount > 0
        ? Math.round(amount)
        : null;
  const split = commission !== null ? brokerCommissionSplit(commission) : null;

  const submit = () => {
    if (!hotel) return;
    const terms =
      draft.kind === "percent"
        ? { kind: "percent" as const, percent: percent ?? Number.NaN }
        : { kind: "bulk_fixed" as const, amountRwf: amount ?? Number.NaN, minRooms: draft.minRooms ?? Number.NaN };
    start(async () => {
      const result = await proposeDeal(hotel.orgId, { terms, note: draft.note.trim() || null });
      if (!result.ok) {
        const fields = fieldErrorsOnly(result.fieldErrors);
        // The form's fields are named after the terms' own keys, so "terms.percent" lands on "percent".
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace(/^terms\./, ""), v])));
        setFormError(result.fieldErrors && Object.keys(fields).length > 0 ? null : result.error);
        return;
      }
      toast.success(`Proposal sent to ${hotel.name}`);
      reset();
      onClose();
      router.refresh();
    });
  };

  return (
    <SidePanel
      isOpen={hotel !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
      title={hotel ? `Propose a deal to ${hotel.name}` : "Propose a deal"}
      description="The hotel's owner accepts or declines. Nothing is paid until a guest you booked checks out."
      submitLabel="Send proposal"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Commission</span>
        <Segment
          aria-label="Kind of commission"
          selectedKey={draft.kind}
          onSelectionChange={(k) => set({ kind: String(k) === "bulk_fixed" ? "bulk_fixed" : "percent" })}
          className="w-full"
        >
          <Segment.Item id="percent">Percent of each booking</Segment.Item>
          <Segment.Item id="bulk_fixed">Fixed sum, bulk booking</Segment.Item>
        </Segment>
      </div>

      {draft.kind === "percent" ? (
        <TextInput
          label="Percent of what the guest pays for the room"
          name="percent"
          value={draft.percent}
          onChange={(percent) => set({ percent })}
          inputMode="numeric"
          placeholder="10"
          description="Between 1% and 30%, in whole or half percents."
          errorMessage={errors.percent}
          isRequired
        />
      ) : (
        <>
          <TextInput
            label="Amount for the whole booking, in RWF"
            name="amountRwf"
            value={draft.amount}
            onChange={(amount) => set({ amount })}
            inputMode="numeric"
            placeholder="200,000"
            errorMessage={errors.amountRwf}
            isRequired
          />
          <CountInput
            label="Fewest rooms booked together"
            name="minRooms"
            value={draft.minRooms}
            onChange={(minRooms) => set({ minRooms })}
            minValue={2}
            maxValue={500}
            unit="rooms"
            description="A booking with fewer rooms earns nothing under this deal."
            errorMessage={errors.minRooms}
            isRequired
          />
        </>
      )}

      <TextInput
        label="Note to the hotel"
        name="note"
        value={draft.note}
        onChange={(note) => set({ note })}
        multiline
        placeholder="Who you bring, how many rooms and when."
        errorMessage={errors.note}
      />

      <div className="flex flex-col gap-1 rounded-xl bg-surface-secondary px-4 py-3 text-sm">
        <span className="font-medium">How it divides</span>
        {split && commission !== null ? (
          <span className="text-muted">
            {draft.kind === "percent"
              ? `On a ${formatMoney(EXAMPLE_BOOKING_RWF)} booking, the commission is `
              : "The commission is "}
            <span className="tabular text-foreground">{formatMoney(commission)}</span>: you get{" "}
            <span className="tabular text-foreground">{formatMoney(split.brokerRwf)}</span> and Injishi keeps{" "}
            <span className="tabular text-foreground">{formatMoney(split.injishiRwf)}</span> ({SHARE}).
          </span>
        ) : (
          <span className="text-muted">Injishi keeps {SHARE} of every commission; the rest is yours.</span>
        )}
      </div>
    </SidePanel>
  );
}
