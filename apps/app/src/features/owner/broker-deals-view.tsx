"use client";

import { toast } from "@heroui/react";
import {
  BROKER_COMMISSION_INJISHI_SHARE,
  type BrokerDeal,
  type BrokerDealList,
  brokerDealTermsLine,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  KpiStrip,
  SectionCard,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DealChip } from "../broker/deal-shared";
import { TextInput } from "../rentals/fields";
import { decideDeal, endHotelDeal } from "./broker-deal-actions";

type Move = "accept" | "decline" | "end";

const MOVE: Record<Move, { title: string; submit: string; done: string; note: string; hint: string }> = {
  accept: {
    title: "Accept this deal?",
    submit: "Accept deal",
    done: "Deal accepted",
    note: "Note to the broker",
    hint: "From now on, the stays this broker books with you carry this commission.",
  },
  decline: {
    title: "Decline this proposal?",
    submit: "Decline",
    done: "Proposal declined",
    note: "Why, for the broker",
    hint: "The broker can propose different terms afterwards.",
  },
  end: {
    title: "End this deal?",
    submit: "End deal",
    done: "Deal ended",
    note: "Why, for the broker",
    hint: "Bookings this broker makes from now on carry no commission. Stays already booked keep the deal they were booked under.",
  },
};

const SHARE = `${Math.round(BROKER_COMMISSION_INJISHI_SHARE * 100)}%`;

/**
 * Brokers, for a hotel's owner (0125, 2026-11-02): the commission deals brokers proposed, to accept or
 * decline, the ones running, to end, and what became of the rest. The broker's phone and email are shown
 * so the owner can talk the terms over before answering.
 */
export function BrokerDealsView({ workspaceId, data }: { workspaceId: string; data: BrokerDealList }) {
  const router = useRouter();
  const [acting, setActing] = useState<{ deal: BrokerDeal; move: Move } | null>(null);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const waiting = data.deals.filter((d) => d.status === "proposed");
  const running = data.deals.filter((d) => d.status === "active");
  const past = data.deals.filter((d) => d.status !== "proposed" && d.status !== "active");

  const open = (deal: BrokerDeal, move: Move) => {
    setActing({ deal, move });
    setNote("");
    setFormError(null);
  };

  const submit = () => {
    if (!acting) return;
    const { deal, move } = acting;
    start(async () => {
      const result =
        move === "end"
          ? await endHotelDeal(workspaceId, deal.id, note)
          : await decideDeal(workspaceId, deal.id, move, note);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(MOVE[move].done);
      setActing(null);
      router.refresh();
    });
  };

  const columns = (actions: boolean): DataColumn<BrokerDeal>[] => [
    {
      id: "broker",
      header: "Broker",
      cell: (d) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{d.broker.name ?? "A broker"}</span>
          <span className="text-xs text-muted">{[d.broker.phone, d.broker.email].filter(Boolean).join(" · ")}</span>
        </span>
      ),
      sortValue: (d) => d.broker.name ?? "",
      isRowHeader: true,
    },
    {
      id: "terms",
      header: "Commission",
      cell: (d) => (
        <span className="flex min-w-0 flex-col">
          <span>{brokerDealTermsLine(d.terms)}</span>
          {d.note && actions ? <span className="text-xs text-muted">“{d.note}”</span> : null}
        </span>
      ),
    },
    {
      id: "when",
      header: "Proposed",
      cell: (d) => formatDay(d.proposedAt, "short"),
      sortValue: (d) => d.proposedAt,
      hideBelow: "lg",
    },
    { id: "status", header: "Status", cell: (d) => <DealChip status={d.status} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip
        label="Broker deals"
        items={[
          { id: "waiting", label: "Waiting for your answer", value: waiting.length, format: "count", icon: "Clock" },
          { id: "running", label: "Running deals", value: running.length, format: "count", icon: "CircleCheck" },
        ]}
      />

      <SectionCard title="Waiting for your answer">
        <DataTable
          label="Proposals waiting for an answer"
          rows={waiting}
          rowKey={(d) => d.id}
          columns={columns(true)}
          defaultSort={{ column: "when", direction: "descending" }}
          rowActions={(d) => (
            <span className="flex gap-2">
              <ActionButton size="sm" intent="primary" icon="CircleCheck" onPress={() => open(d, "accept")}>
                Accept
              </ActionButton>
              <ActionButton size="sm" icon="Xmark" onPress={() => open(d, "decline")}>
                Decline
              </ActionButton>
            </span>
          )}
          mobile={{
            title: (d) => d.broker.name ?? "A broker",
            description: (d) => brokerDealTermsLine(d.terms),
            trailing: (d) => <DealChip status={d.status} />,
          }}
          empty={
            <EmptyBlock
              icon="Briefcase"
              title="No proposals waiting"
              description="When a broker proposes a commission deal, it shows here for you to accept or decline."
            />
          }
        />
      </SectionCard>

      {running.length > 0 ? (
        <SectionCard title="Running deals">
          <DataTable
            label="Running deals"
            rows={running}
            rowKey={(d) => d.id}
            columns={columns(false)}
            rowActions={(d) => (
              <ActionButton size="sm" icon="Xmark" onPress={() => open(d, "end")}>
                End deal
              </ActionButton>
            )}
            mobile={{
              title: (d) => d.broker.name ?? "A broker",
              description: (d) => brokerDealTermsLine(d.terms),
              trailing: (d) => <DealChip status={d.status} />,
            }}
          />
        </SectionCard>
      ) : null}

      {past.length > 0 ? (
        <SectionCard title="Earlier">
          <DataTable
            label="Earlier deals"
            rows={past}
            rowKey={(d) => d.id}
            columns={columns(false)}
            defaultSort={{ column: "when", direction: "descending" }}
            mobile={{
              title: (d) => d.broker.name ?? "A broker",
              description: (d) => brokerDealTermsLine(d.terms),
              trailing: (d) => <DealChip status={d.status} />,
            }}
          />
        </SectionCard>
      ) : null}

      <SidePanel
        isOpen={acting !== null}
        onOpenChange={(isOpen) => !isOpen && setActing(null)}
        title={acting ? MOVE[acting.move].title : ""}
        description={
          acting ? `${acting.deal.broker.name ?? "A broker"} · ${brokerDealTermsLine(acting.deal.terms)}` : undefined
        }
        submitLabel={acting ? MOVE[acting.move].submit : "Save"}
        isPending={pending}
        formError={formError}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {acting ? (
          <>
            <p className="text-sm text-muted">{MOVE[acting.move].hint}</p>
            {acting.move === "accept" ? (
              <p className="text-sm text-muted">
                The commission is taken from what you are paid for those stays. The broker receives it, less
                Injishi&apos;s {SHARE}.
              </p>
            ) : null}
            <TextInput
              label={MOVE[acting.move].note}
              name="note"
              value={note}
              onChange={(v) => {
                setNote(v);
                setFormError(null);
              }}
              multiline
            />
          </>
        ) : null}
      </SidePanel>
    </div>
  );
}
