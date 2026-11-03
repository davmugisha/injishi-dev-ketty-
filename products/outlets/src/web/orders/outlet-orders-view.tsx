"use client";

import { Check, Display, Flame, Lock, Printer, ShieldExclamation, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Switch } from "@heroui/react";
import { ItemCard, Kanban, KPIGroup, ListView, Segment, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import {
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  SectionHeader,
  toneBg,
  toneColor,
} from "@injishi/ui";
import { type CSSProperties, Fragment, useState } from "react";
import type {
  FiscalReport,
  LiveOrder,
  OrderSource,
  OrderStage,
  Refund,
  ServiceKpi,
  StockOut,
  VoidRequest,
} from "../../model/outlets.ts";
import { useBoardHref } from "../mount.tsx";
import { money, SourceChip } from "../parts.tsx";

interface OutletOrdersData {
  kpis: ServiceKpi[];
  stages: OrderStage[];
  orders: LiveOrder[];
  voids: VoidRequest[];
  refunds: Refund[];
  reports: FiscalReport[];
  stockOuts: StockOut[];
}

const SOURCES: { id: "all" | OrderSource; label: string }[] = [
  { id: "all", label: "All" },
  { id: "table", label: "Terrace" },
  { id: "room", label: "Room service" },
  { id: "qr", label: "QR" },
];

const VOID_STATE: Record<VoidRequest["status"], { label: string; tone: "warning" | "success" | "default" }> = {
  open: { label: "Awaiting you", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "default" },
};

/** Outlet supervisor's live orders, voids, refund and fiscal reports (artifact: OutletOrders). */
export function OutletOrdersView({ data }: { data: OutletOrdersData }) {
  const screenHref = useBoardHref();
  const refund = data.refunds[0];
  const [source, setSource] = useState<(typeof SOURCES)[number]["id"]>("all");
  const [voids, setVoids] = useState<Record<string, VoidRequest["status"]>>(() =>
    Object.fromEntries(data.voids.map((v) => [v.id, v.status])),
  );
  const [reportId, setReportId] = useState<FiscalReport["id"]>("x");
  const [readAt, setReadAt] = useState(data.reports.find((r) => r.id === "x")?.readAt ?? "19:55");
  const [menus, setMenus] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.stockOuts.map((s) => [s.id, s.onMenus])),
  );

  const pending = Object.values(voids).filter((s) => s === "open").length;
  const report = data.reports.find((r) => r.id === reportId) ?? data.reports[0];
  const lead =
    report?.id === "x"
      ? `Read at ${readAt} by ${report.readBy}. An X report does not reset the counters.`
      : (report?.lead ?? "");

  return (
    <PageContent>
      <PageHeader
        eyebrow="Monday 12 October 2026 · Isangano Terrace · dinner service"
        title="Orders"
        actions={
          <>
            <LinkButton href={screenHref("KitchenDisplay")} variant="secondary">
              <Flame className="size-4" />
              Kitchen display
            </LinkButton>
            <LinkButton href={screenHref("POS")}>
              <Display className="size-4" />
              Open POS
            </LinkButton>
          </>
        }
      />

      <section aria-label="Service figures">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((kpi, i) => {
            const value = kpi.live === "voids" ? pending : kpi.value;
            const warn = kpi.live === "voids" ? pending > 0 : Boolean(kpi.warn);
            return (
              <Fragment key={kpi.id}>
                {i > 0 ? <KPIGroup.Separator /> : null}
                <KPI className="min-w-[180px] flex-[1_1_180px]">
                  <KPI.Header>
                    {warn ? (
                      <KPI.Icon status="warning">
                        <TriangleExclamation />
                      </KPI.Icon>
                    ) : null}
                    <KPI.Title>{kpi.label}</KPI.Title>
                  </KPI.Header>
                  <KPI.Content>
                    <KPI.Value value={value} formatOptions={kpi.format} className="tabular">
                      {(formatted: string) => (kpi.unit ? `${formatted} ${kpi.unit}` : formatted)}
                    </KPI.Value>
                  </KPI.Content>
                  <KPI.Footer>
                    <p className="mt-1.5 text-[12px] leading-4 text-muted">{kpi.foot}</p>
                  </KPI.Footer>
                </KPI>
              </Fragment>
            );
          })}
        </KPIGroup>
      </section>

      <section aria-labelledby="board-h" className="flex flex-col gap-2.5">
        <SectionHeader
          id="board-h"
          title="Live Orders"
          description="Updated 19:52 · from POS, room service and QR ordering"
          action={
            <Segment
              size="sm"
              aria-label="Source"
              selectedKey={source}
              onSelectionChange={(k) => {
                const next = String(k);
                if (next === "all" || next === "table" || next === "room" || next === "qr") setSource(next);
              }}
            >
              {SOURCES.map((s) => (
                <Segment.Item key={s.id} id={s.id}>
                  {s.label}
                </Segment.Item>
              ))}
            </Segment>
          }
        />
        <div className="overflow-x-auto">
          <Kanban
            size="sm"
            aria-label="Live orders"
            className="w-max"
            style={{ "--kanban-column-min-width": "230px", "--kanban-column-gap": "12px" } as CSSProperties}
          >
            {data.stages.map((stage) => {
              const cards = data.orders.filter(
                (o) => o.stage === stage.id && (source === "all" || o.source === source),
              );
              return (
                <Kanban.Column key={stage.id} className="w-[230px] max-w-[230px] min-w-[230px]">
                  <Kanban.ColumnHeader>
                    <Kanban.ColumnIndicator className={toneBg(stage.tone)} />
                    <Kanban.ColumnTitle>{stage.label}</Kanban.ColumnTitle>
                    <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
                  </Kanban.ColumnHeader>
                  <Kanban.ColumnBody>
                    <Kanban.CardList
                      aria-label={stage.label}
                      items={cards}
                      renderEmptyState={() => (
                        <p className="p-2 text-center text-[12px] text-muted">No orders from this source</p>
                      )}
                    >
                      {(o) => (
                        <Kanban.Card id={o.id} textValue={`${o.label} ${o.items} ${o.meta}`} className="cursor-default">
                          <span className="flex items-center justify-between gap-1.5">
                            <SourceChip source={o.source} label={o.label} size="sm" />
                            <span className={`text-[12px] tabular ${o.late ? "font-bold" : "font-medium"}`}>
                              {o.age}
                            </span>
                          </span>
                          <span className="text-[13px] leading-[18px] font-medium">{o.items}</span>
                          <span className="text-[12px] text-muted tabular">{o.meta}</span>
                        </Kanban.Card>
                      )}
                    </Kanban.CardList>
                  </Kanban.ColumnBody>
                </Kanban.Column>
              );
            })}
          </Kanban>
        </div>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="void-h">
          <Card.Header>
            <h2 id="void-h" className="text-[15px] font-semibold">
              Void Requests
            </h2>
            <Card.Description>
              {pending
                ? `${pending} waiting · each needs a reason code and a second person`
                : "Nothing waiting · all decisions recorded"}
            </Card.Description>
          </Card.Header>
          <div className="flex flex-col gap-2.5">
            {data.voids.map((v) => {
              const st = voids[v.id] ?? v.status;
              const chip = VOID_STATE[st];
              return (
                <ItemCard key={v.id} variant="secondary" className="items-stretch">
                  <ItemCard.Content className="w-full gap-2">
                    <div className="flex items-start gap-2">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold">
                          {v.item} · <span className="tabular">{money(v.amount)}</span>
                        </span>
                        <span className="text-[12px] leading-4 text-muted">{v.meta}</span>
                      </span>
                      <Chip size="sm" variant="soft" color={toneColor(chip.tone)} className="shrink-0">
                        <Chip.Label>{chip.label}</Chip.Label>
                      </Chip>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip size="sm" variant="soft">
                        <Chip.Label>{v.code}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft">
                        <Icon name="Boxes3" className="size-3" />
                        <Chip.Label>{v.stock}</Chip.Label>
                      </Chip>
                    </div>
                    {st === "open" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => setVoids((s) => ({ ...s, [v.id]: "rejected" }))}
                        >
                          Reject
                        </Button>
                        <Button size="sm" onPress={() => setVoids((s) => ({ ...s, [v.id]: "approved" }))}>
                          <Check className="size-3.5" />
                          Approve void
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[12px] leading-4 text-muted">
                        {st === "approved"
                          ? v.approvedNote
                          : "Rejected by you · the item stays on the bill and the waiter is told why."}
                      </p>
                    )}
                  </ItemCard.Content>
                </ItemCard>
              );
            })}
          </div>
          <p className="text-[12px] leading-4 text-muted">
            Reason codes: VD-01 entered in error · VD-02 guest changed mind · VD-03 quality complaint · VD-04 kitchen
            error · VD-05 sold out. You cannot approve a void you requested.
          </p>
        </Card>

        {refund ? (
          <Card className="gap-3 p-[18px]" aria-labelledby="ref-h">
            <Card.Header>
              <h2 id="ref-h" className="text-[15px] font-semibold">
                Refund {refund.id} · Bill {refund.bill}
              </h2>
              <Card.Description>{refund.summary}</Card.Description>
            </Card.Header>
            <Alert status="accent">
              <Alert.Indicator>
                <Icon name="ArrowUturnCcwLeft" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Refunds are reversals</Alert.Title>
                <Alert.Description>
                  The original sale and its fiscal receipt stay as they are. The refund is a new record linked to them,
                  with its own refund receipt.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <Timeline size="sm" density="compact">
              {refund.events.map((ev) => (
                <Timeline.Item key={ev.id} status={ev.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name={ev.icon} className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5">
                    <span className="font-medium">{ev.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{ev.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        ) : null}
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="xz-h">
          <Card.Header className="flex-row items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="xz-h" className="text-[15px] font-semibold">
                X and Z Reports
              </h2>
              <Card.Description>
                Fiscal profile Isangano Terrace · Amahoro Hospitality Ltd · TIN 102 345 678 · device SDC-ISG-02
              </Card.Description>
            </div>
            <GateChip icon={<ShieldExclamation className="size-3" />}>Depends on VSDC partner support</GateChip>
          </Card.Header>
          <Segment
            size="sm"
            aria-label="Report"
            selectedKey={reportId}
            onSelectionChange={(k) => {
              const next = String(k);
              if (next === "x" || next === "z") setReportId(next);
            }}
            className="self-start"
          >
            {data.reports.map((r) => (
              <Segment.Item key={r.id} id={r.id}>
                {r.label}
              </Segment.Item>
            ))}
          </Segment>
          <p className="text-[13px] leading-[18px]">{lead}</p>
          {report ? (
            <KeyValueList
              items={report.rows.map((row) => ({
                label: row.label,
                value: <span className="text-right font-medium tabular">{row.value}</span>,
              }))}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setReportId("x");
                setReadAt("19:56");
              }}
            >
              <Printer className="size-3.5" />
              Run X report now
            </Button>
            <Button variant="secondary" size="sm" isDisabled>
              <Lock className="size-3.5" />
              Close day with Z report
            </Button>
            <span className="text-[12px] text-muted">
              Z is available when bills on Till 2 and Till 3 are closed (2 open).
            </span>
          </div>
          <p className="text-[12px] leading-4 text-muted">
            Room charges are not in these totals; they are fiscalised on the guest folio at checkout. Ikawa Corner
            reports under its own profile, Ikawa Corner Ltd, TIN 108 221 457.
          </p>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="out-h">
          <Card.Header className="flex-row items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="out-h" className="text-[15px] font-semibold">
                Stock-outs From Sales
              </h2>
              <Card.Description>
                Calculated from recipes as sales are confirmed. Store counts can differ until the next count.
              </Card.Description>
            </div>
            <LinkButton href={screenHref("StoreHome")} variant="ghost" size="sm">
              Open stock
            </LinkButton>
          </Card.Header>
          <ListView variant="secondary" aria-labelledby="out-h" items={data.stockOuts}>
            {(ot) => (
              <ListView.Item id={ot.id} textValue={`${ot.name} ${ot.left} ${ot.detail}`}>
                <ListView.ItemContent className="items-start gap-2.5">
                  <Icon
                    name={ot.icon}
                    className={`mt-0.5 size-4 shrink-0 ${ot.icon === "Ban" ? "text-danger" : "text-warning"}`}
                  />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>
                      {ot.name} · <span className="tabular">{ot.left}</span>
                    </ListView.Title>
                    <ListView.Description>{ot.detail}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Switch
                    size="sm"
                    isSelected={menus[ot.id] ?? ot.onMenus}
                    onChange={(on) => setMenus((m) => ({ ...m, [ot.id]: on }))}
                    aria-label={`Show ${ot.name} on menus`}
                  >
                    <Switch.Content className="gap-2 text-[12px] font-normal">
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span>On menus</span>
                    </Switch.Content>
                  </Switch>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>
      </div>
    </PageContent>
  );
}
