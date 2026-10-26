"use client";

import { Clock, Printer } from "@gravity-ui/icons";
import { Button, Card, Tabs, Toast } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import type { PosOutlet, PosTicket, StationKind, TicketStatus } from "@/server/pos";
import { advanceTicketAction, reprintTicketAction } from "./actions";
import { PosNav } from "./PosNav";
import { clock, PosHeader, StatusChip, TICKET_COLOR, usePosAction } from "./shared";

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "queued", label: "Queued" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready at the pass" },
];

/**
 * The kitchen and bar displays (POS spec §6): each station's open tickets by status, oldest first, late ones
 * marked. A cook starts and readies a ticket; front of house serves it. A reprint is a simulated copy and
 * never a second ticket.
 */
export function PosStationsView({
  outlet,
  kind,
  tickets,
  can,
}: {
  outlet: PosOutlet;
  kind: StationKind;
  tickets: PosTicket[];
  can: string[];
}) {
  const router = useRouter();
  const { run, pending } = usePosAction();
  const cook = can.includes("kitchen.work");
  const pass = can.includes("pos.sell") || cook;

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);

  const served = tickets
    .filter((t) => t.status === "served" || t.status === "cancelled")
    .slice(-6)
    .reverse();

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title={kind === "kitchen" ? "Kitchen" : "Bar"} outlet={outlet}>
        <Tabs
          variant="secondary"
          selectedKey={kind}
          onSelectionChange={(k) => router.push(`/pos/stations?outlet=${outlet.id}&kind=${String(k)}`)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Station">
              <Tabs.Tab id="kitchen">
                Kitchen
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="bar">
                Bar
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <PosNav current="PosStations" outletId={outlet.id} can={can} />
      </PosHeader>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-hidden p-4">
        {COLUMNS.map((col) => {
          const list = tickets.filter((t) => t.status === col.status);
          return (
            <section key={col.status} aria-label={col.label} className="flex min-h-0 flex-col gap-2">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                {col.label}
                <span className="text-muted tabular">{list.length}</span>
              </h2>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {list.length === 0 ? (
                  <EmptyState size="sm">
                    <EmptyState.Header>
                      <EmptyState.Description>
                        Nothing {col.status === "ready" ? "waiting at the pass" : col.label.toLowerCase()}.
                      </EmptyState.Description>
                    </EmptyState.Header>
                  </EmptyState>
                ) : null}
                {list.map((t) => (
                  <Card key={t.id} className={`gap-2 p-3 ${t.late ? "ring-2 ring-danger" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[16px] font-semibold tabular">
                          {t.tableLabel
                            ? `Table ${t.tableLabel}`
                            : t.orderType === "takeaway"
                              ? "Takeaway"
                              : t.orderNumber}
                        </span>
                        <span className="text-[11px] text-muted tabular">
                          {t.ticketNumber} · {t.waiterName ?? "—"} · sent {clock(t.createdAt)}
                        </span>
                      </div>
                      <span
                        className={`flex items-center gap-1 text-[13px] font-semibold tabular ${t.late ? "text-danger" : "text-muted"}`}
                      >
                        <Clock className="size-4" />
                        {t.elapsedMinutes} min
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {t.items.map((i) => (
                        <li key={i.id} className={i.status === "cancelled" ? "text-muted line-through" : ""}>
                          <span className="text-[15px] font-semibold">
                            {i.quantity} × {i.name}
                          </span>
                          {i.options.length ? (
                            <span className="block text-[12px] text-muted">{i.options.join(" · ")}</span>
                          ) : null}
                          {i.note ? (
                            <span className="block text-[12px] font-semibold text-warning">⚠ {i.note}</span>
                          ) : null}
                          {i.status === "cancelled" ? (
                            <span className="block text-[12px] text-danger">Voided, do not make</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-1.5">
                      {t.status === "queued" && cook ? (
                        <Button
                          size="sm"
                          isDisabled={pending}
                          onPress={() => run(() => advanceTicketAction(t.id, "preparing"))}
                        >
                          Start
                        </Button>
                      ) : null}
                      {(t.status === "queued" || t.status === "preparing") && cook ? (
                        <Button
                          size="sm"
                          variant={t.status === "preparing" ? "primary" : "secondary"}
                          isDisabled={pending}
                          onPress={() => run(() => advanceTicketAction(t.id, "ready"), `${t.ticketNumber} ready`)}
                        >
                          Ready
                        </Button>
                      ) : null}
                      {t.status === "ready" && pass ? (
                        <Button
                          size="sm"
                          isDisabled={pending}
                          onPress={() => run(() => advanceTicketAction(t.id, "served"), `${t.ticketNumber} served`)}
                        >
                          Served
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        isDisabled={pending}
                        onPress={() =>
                          run(
                            () => reprintTicketAction(t.id),
                            (v) => `Simulated reprint · copy ${v.printCount}`,
                          )
                        }
                      >
                        <Printer className="size-4" />
                        Reprint
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {served.length ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-separator px-4 py-2 text-[12px] text-muted">
          <span>Recently done:</span>
          {served.map((t) => (
            <StatusChip key={t.id} color={TICKET_COLOR[t.status]}>
              {t.tableLabel ?? t.orderNumber} · {t.status}
            </StatusChip>
          ))}
        </footer>
      ) : null}
      <RegionOverlays>
        <Toast.Provider placement="bottom" />
      </RegionOverlays>
    </div>
  );
}
