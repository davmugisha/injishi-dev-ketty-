"use client";

import {
  ArrowRotateLeft,
  Ban,
  Check,
  CheckDouble,
  Clock,
  CloudSlash,
  HandOk,
  Hourglass,
  TriangleExclamationFill,
} from "@gravity-ui/icons";
import { Alert, Button, Chip, Toast, toast } from "@heroui/react";
import { EmptyState, Kanban, Segment } from "@heroui-pro/react";
import type { KitchenStation, KitchenTicket, OrderSource } from "@injishi/data/fixtures/outlets";
import { Icon, StatusDot, toneColor } from "@injishi/ui";
import { type CSSProperties, useState } from "react";
import { BrandMark } from "@/components/brand";
import { FrameOverlays, SourceChip } from "./shared";

type StationId = KitchenStation["id"] | "all";

const STATUS: Record<
  Exclude<KitchenTicket["status"], "bumped">,
  { label: string; tone: "accent" | "default" | "warning" }
> = {
  new: { label: "New · not acknowledged", tone: "accent" },
  ack: { label: "Acknowledged · cooking", tone: "default" },
  held: { label: "Course held", tone: "warning" },
};

function urgency(minutes: number, held: boolean) {
  if (held) {
    return {
      label: "Held",
      icon: "CirclePause" as const,
      ring: "[&_[data-slot=kanban-card-content]]:shadow-[inset_0_0_0_1px_var(--separator)]",
      band: "",
      weight: "font-medium",
    };
  }
  if (minutes >= 18) {
    return {
      label: `Late · +${minutes - 18} min`,
      icon: "TriangleExclamationFill" as const,
      ring: "[&_[data-slot=kanban-card-content]]:shadow-[inset_0_0_0_3px_var(--danger)]",
      band: "bg-danger-soft",
      weight: "font-bold",
    };
  }
  if (minutes >= 12) {
    return {
      label: "Due soon",
      icon: "Hourglass" as const,
      ring: "[&_[data-slot=kanban-card-content]]:shadow-[inset_0_0_0_2px_var(--warning)]",
      band: "bg-warning-soft",
      weight: "font-semibold",
    };
  }
  return {
    label: "On time",
    icon: "Clock" as const,
    ring: "[&_[data-slot=kanban-card-content]]:shadow-[inset_0_0_0_1px_var(--separator)]",
    band: "",
    weight: "font-medium",
  };
}

/** Kitchen pass: tickets by station, oldest first, with acknowledge and bump (artifact: KitchenDisplay). */
export function KitchenDisplayView({
  stations,
  tickets,
  offline,
}: {
  stations: KitchenStation[];
  tickets: KitchenTicket[];
  offline: boolean;
}) {
  const [station, setStation] = useState<StationId>("all");
  const [status, setStatus] = useState<Record<string, KitchenTicket["status"]>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, t.status])),
  );
  const [bumped, setBumped] = useState<string[]>(() => tickets.filter((t) => t.status === "bumped").map((t) => t.id));

  const visible = tickets.filter((t) => status[t.id] !== "bumped");
  const fresh = visible.filter((t) => status[t.id] === "new").length;
  const late = visible.filter((t) => t.minutes >= 18 && status[t.id] !== "held").length;
  const single = station !== "all";
  const columns = stations
    .filter((s) => !single || s.id === station)
    .map((s) => {
      const list = visible.filter((t) => t.station === s.id).sort((a, b) => b.minutes - a.minutes);
      const avg = list.length ? Math.round(list.reduce((a, t) => a + t.minutes, 0) / list.length) : 0;
      return { station: s, list, avg };
    });
  const filters: { id: StationId; label: string }[] = [
    { id: "all", label: "All stations" },
    ...stations.map((s) => ({ id: s.id, label: s.short })),
  ];
  const last = bumped[bumped.length - 1];

  const recall = () => {
    if (!last) return;
    const t = tickets.find((x) => x.id === last);
    setStatus((s) => ({ ...s, [last]: "ack" }));
    setBumped((b) => b.slice(0, -1));
    if (t) toast(`Recalled ${t.label} · ${t.meta.split(" · ")[0]}`, { indicator: <ArrowRotateLeft /> });
  };

  return (
    <div
      data-theme="mouve-dark"
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="flex flex-none items-center gap-3.5 bg-surface px-[18px] py-2.5 shadow-[0_1px_0_var(--separator)]">
        <BrandMark size={28} />
        <div className="flex flex-col">
          <h1 className="text-[17px] leading-[22px] font-semibold">Kitchen display · Isangano Terrace</h1>
          <span className="text-[13px] leading-[18px] text-muted tabular">
            {visible.length} open · {fresh} new · {late} late · target 18 min
          </span>
        </div>
        <Segment
          aria-label="Station"
          selectedKey={station}
          onSelectionChange={(k) => {
            const next = String(k);
            if (next === "all" || next === "grill" || next === "cold" || next === "bar") setStation(next);
          }}
          className="ml-2"
        >
          {filters.map((f) => (
            <Segment.Item key={f.id} id={f.id} className="h-10">
              {f.label}
            </Segment.Item>
          ))}
        </Segment>
        <span className="flex-1" />
        <Chip size="sm" variant="soft" color={offline ? "warning" : "success"}>
          <StatusDot tone={offline ? "warning" : "success"} />
          <Chip.Label>{offline ? "Offline since 19:50" : "Live · updated 2 s ago"}</Chip.Label>
        </Chip>
        <Button variant="secondary" size="lg" isDisabled={!last} onPress={recall}>
          <ArrowRotateLeft className="size-4" />
          Recall last
        </Button>
        <span role="timer" className="text-[22px] leading-7 font-semibold tabular" aria-label="Time now 19:52">
          19:52
        </span>
      </header>

      <div
        role="note"
        aria-label="Urgency legend"
        className="flex flex-none items-center justify-end gap-4 px-[18px] pt-2 text-[12px]"
      >
        <span className="text-muted">Ticket age</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" />
          On time, thin border
        </span>
        <span className="flex items-center gap-1">
          <Hourglass className="size-3.5" />
          Due soon from 12 min, double border
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <TriangleExclamationFill className="size-3.5" />
          Late from 18 min, heavy border and bold
        </span>
      </div>

      {offline ? (
        <Alert status="warning" role="alert" className="mx-[18px] mt-2.5">
          <Alert.Indicator>
            <CloudSlash />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Connection lost at 19:50 · showing tickets received until then</Alert.Title>
            <Alert.Description>
              New orders print at the pass printer. Bumps made now are saved here and sent when the connection returns;
              timers keep running.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Kanban
        size="lg"
        aria-label="Kitchen tickets"
        className="min-h-0 flex-1 px-[18px] pt-3 pb-3.5"
        style={{ "--kanban-column-gap": "12px" } as CSSProperties}
      >
        {columns.map((col) => (
          <Kanban.Column key={col.station.id} aria-labelledby={`col-${col.station.id}`} className="min-w-0">
            <Kanban.ColumnHeader>
              <Icon name={col.station.icon} className="size-5" />
              <Kanban.ColumnTitle id={`col-${col.station.id}`} className="text-[16px]">
                {col.station.label}
              </Kanban.ColumnTitle>
              <Kanban.ColumnCount className="text-[13px] tabular">{col.list.length} open</Kanban.ColumnCount>
              <span className="flex-1" />
              {col.list.length ? <span className="text-[12px] text-muted tabular">avg {col.avg} min</span> : null}
            </Kanban.ColumnHeader>
            <Kanban.ColumnBody>
              <Kanban.CardList
                aria-label={col.station.label}
                items={col.list}
                className={single ? "grid grid-cols-3 content-start gap-2.5 p-2.5" : "content-start gap-2.5 p-2.5"}
                renderEmptyState={() => (
                  <EmptyState size="sm">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <CheckDouble />
                      </EmptyState.Media>
                      <EmptyState.Title>All caught up</EmptyState.Title>
                      <EmptyState.Description>
                        New {col.station.label.toLowerCase()} tickets appear here.
                      </EmptyState.Description>
                    </EmptyState.Header>
                  </EmptyState>
                )}
              >
                {(t) => {
                  const st = status[t.id] === "held" ? "held" : status[t.id] === "ack" ? "ack" : "new";
                  const u = urgency(t.minutes, st === "held");
                  const chip = STATUS[st];
                  return (
                    <Kanban.Card
                      id={t.id}
                      textValue={`${t.label}, ${t.minutes} minutes, ${u.label}${t.allergy ? ", allergy alert" : ""}`}
                      className={`cursor-default [&_[data-slot=kanban-card-content]]:gap-0 [&_[data-slot=kanban-card-content]]:overflow-hidden [&_[data-slot=kanban-card-content]]:p-0 ${u.ring}`}
                    >
                      <div className={`flex items-start gap-2.5 px-3 py-2.5 ${u.band}`}>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <SourceChip source={t.source as OrderSource} label={t.label} className="self-start" />
                          <span className="text-[12px] leading-4 text-muted tabular">{t.meta}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[24px] leading-7 font-bold tabular">{t.timer}</span>
                          <span className={`flex items-center gap-1 text-[12px] ${u.weight}`}>
                            <Icon name={u.icon} className="size-3" />
                            {u.label}
                          </span>
                        </div>
                      </div>
                      <ul className="m-0 flex list-none flex-col gap-2 px-3 pt-2.5 pb-1">
                        {t.items.map((item) => (
                          <li
                            key={`${t.id}-${item.name}`}
                            className={`flex items-start gap-2.5 ${item.voided ? "opacity-70" : ""}`}
                          >
                            <span className="min-w-7 text-[18px] leading-6 font-bold tabular">{item.qty}×</span>
                            <span className="flex flex-1 flex-col">
                              <span
                                className={`text-[17px] leading-[23px] font-semibold ${item.voided ? "line-through" : ""}`}
                              >
                                {item.name}
                              </span>
                              {item.mods ? (
                                <span className="text-[14px] leading-[19px] text-muted">{item.mods}</span>
                              ) : null}
                              {item.voided ? (
                                <span className="text-[13px] leading-[18px] font-semibold">
                                  <Ban className="mr-1 inline size-3" aria-hidden="true" />
                                  {item.voided}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {t.allergy ? (
                        <div
                          role="note"
                          className="mx-3 mt-1.5 flex items-start gap-2 rounded-[10px] bg-danger-soft px-2.5 py-2 text-[14px] leading-[19px] text-danger-soft-foreground shadow-[inset_3px_0_0_var(--danger)]"
                        >
                          <TriangleExclamationFill className="mt-0.5 size-4 shrink-0" />
                          <span>
                            <strong>Allergy</strong> · {t.allergy}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-3">
                        <Chip size="sm" variant="soft" color={toneColor(chip.tone)}>
                          <Chip.Label>{chip.label}</Chip.Label>
                        </Chip>
                        <span className="flex-1" />
                        {st === "new" ? (
                          <Button
                            size="lg"
                            className="min-w-[150px]"
                            onPress={() => setStatus((s) => ({ ...s, [t.id]: "ack" }))}
                          >
                            <HandOk className="size-4" />
                            Acknowledge
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="lg"
                            className="min-w-[150px]"
                            onPress={() => {
                              setStatus((s) => ({ ...s, [t.id]: "bumped" }));
                              setBumped((b) => [...b, t.id]);
                            }}
                          >
                            <Check className="size-4" />
                            Bump · ready
                          </Button>
                        )}
                      </div>
                    </Kanban.Card>
                  );
                }}
              </Kanban.CardList>
            </Kanban.ColumnBody>
          </Kanban.Column>
        ))}
      </Kanban>
      <FrameOverlays>
        <Toast.Provider placement="bottom" />
      </FrameOverlays>
    </div>
  );
}
