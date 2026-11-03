"use client";

import { screenHref } from "@injishi/data";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  formatPhone,
  IconAction,
  type IconKey,
  Money,
  PageContent,
  PersonCell,
  RowActions,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import type { DeskRow, DeskRowKind } from "@/server/stays/desk";
import { DeskHeaderActions, type DeskRoomType } from "./NewBookingPanel";

const KIND: Record<DeskRowKind, { label: string; tone: StatusTone; rank: number }> = {
  request: { label: "Request", tone: "warning", rank: 0 },
  arriving: { label: "Arriving", tone: "info", rank: 1 },
  leaving: { label: "Leaving", tone: "warning", rank: 2 },
  in_house: { label: "In house", tone: "success", rank: 3 },
  left: { label: "Left", tone: "default", rank: 4 },
};

/** The one next step of a row at the desk. */
function nextStep(r: DeskRow): { icon: IconKey; label: string; href: string } | null {
  const stay = r.stayRef ? `/stays/${encodeURIComponent(r.stayRef)}` : null;
  switch (r.kind) {
    case "request":
      return r.bookingRef
        ? {
            icon: "CircleCheck",
            label: "Answer the request",
            href: `${screenHref("Reservations")}?booking=${encodeURIComponent(r.bookingRef)}`,
          }
        : null;
    case "arriving":
      return r.bookingRef
        ? {
            icon: "ArrowRightToSquare",
            label: "Check in",
            href: `${screenHref("CheckIn")}?booking=${encodeURIComponent(r.bookingRef)}`,
          }
        : null;
    case "leaving":
      return stay ? { icon: "ArrowRightFromSquare", label: "Check out", href: stay } : null;
    default:
      return stay ? { icon: "Receipt", label: "Open the bill", href: stay } : null;
  }
}

/**
 * The front desk's day for a stay business (2026-10-30): who arrives, who is in, who leaves and who left
 * today, in one table with a filter and a search. Each row's next step is its first action: check in,
 * check out, open the bill or answer a request.
 */
export function StayTodayView({
  rows,
  today,
  roomTypes,
  canBook,
}: {
  rows: DeskRow[];
  today: string;
  roomTypes: DeskRoomType[];
  canBook: boolean;
}) {
  const router = useRouter();
  const columns: DataColumn<DeskRow>[] = [
    {
      id: "guest",
      header: "Guest",
      isRowHeader: true,
      sortValue: (r) => r.guest,
      cell: (r) => <PersonCell name={r.guest} secondary={r.phone ? formatPhone(r.phone) : undefined} />,
    },
    {
      id: "room",
      header: "Room",
      sortValue: (r) => r.room ?? r.roomType,
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.room ?? "Not given yet"}</span>
          <span className="text-xs text-muted">{r.roomType}</span>
        </span>
      ),
    },
    {
      id: "stay",
      header: "Stay",
      sortValue: (r) => r.from ?? "",
      cell: (r) =>
        r.from && r.to ? (
          <span className="whitespace-nowrap tabular">
            <DateText value={r.from} /> to <DateText value={r.to} />
          </span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
    {
      id: "balance",
      header: "To pay",
      align: "end",
      sortValue: (r) => r.balanceRwf ?? -1,
      cell: (r) => (r.balanceRwf === null ? <span className="text-muted">-</span> : <Money value={r.balanceRwf} />),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (r) => KIND[r.kind].rank,
      cell: (r) => <StatusChip tone={KIND[r.kind].tone}>{KIND[r.kind].label}</StatusChip>,
    },
  ];
  const count = (k: DeskRowKind) => rows.filter((r) => r.kind === k).length;
  return (
    <PageContent>
      <AreaHeader
        eyebrow={formatDay(today, "long")}
        actions={<DeskHeaderActions roomTypes={roomTypes} today={today} canBook={canBook} />}
      />
      <DataTable
        label="Today at the desk"
        noun={{ one: "guest", many: "guests" }}
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        defaultSort={{ column: "status", direction: "ascending" }}
        search={{ placeholder: "Guest, phone or room", text: (r) => `${r.guest} ${r.phone ?? ""} ${r.room ?? ""}` }}
        filters={[
          {
            id: "kind",
            name: "Show",
            options: [
              { id: "all", label: "All", count: rows.length },
              ...(Object.keys(KIND) as DeskRowKind[])
                .filter((k) => count(k) > 0)
                .map((k) => ({ id: k, label: KIND[k].label, count: count(k) })),
            ],
            match: (r, v) => r.kind === v,
          },
        ]}
        onRowAction={(r) => {
          const step = nextStep(r);
          if (step) router.push(step.href);
        }}
        rowActions={(r) => {
          const step = nextStep(r);
          return step ? (
            <RowActions>
              <IconAction icon={step.icon} label={step.label} onPress={() => router.push(step.href)} />
            </RowActions>
          ) : null;
        }}
        mobile={{
          title: (r) => r.guest,
          description: (r) =>
            [r.room ?? r.roomType, r.from && r.to ? `${formatDay(r.from)} to ${formatDay(r.to)}` : null]
              .filter(Boolean)
              .join(" · "),
          trailing: (r) => <StatusChip tone={KIND[r.kind].tone}>{KIND[r.kind].label}</StatusChip>,
        }}
        empty={
          <EmptyBlock
            icon="Persons"
            title="Nobody arrives or leaves today"
            action={
              <ActionLink href={screenHref("WalkIn")} icon="PersonPlus">
                Walk in
              </ActionLink>
            }
          />
        }
      />
    </PageContent>
  );
}
