"use client";

import { BroomMotion, Check, ChevronRight, CircleInfo, Hourglass, Persons, Wrench } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Modal,
  ProgressBar,
  Select,
  Separator,
} from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, ListView, Segment, Timeline, Widget } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ManagerTodayEvent,
  ManagerTodayException,
  ManagerTodayKpi,
  ManagerTodayNoShow,
  ManagerTodayOutlet,
  ManagerTodayOutOfOrder,
  ManagerTodayRoomStatus,
  ManagerTodayStaffLine,
} from "@injishi/data/fixtures/commercial";
import { Icon, LinkButton, PageContent, PageHeader, StatusDot, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, type ReactNode, useState } from "react";

export interface ManagerTodayData {
  kpis: ManagerTodayKpi[];
  exceptions: ManagerTodayException[];
  roomStatus: ManagerTodayRoomStatus[];
  outOfOrder: ManagerTodayOutOfOrder[];
  staff: ManagerTodayStaffLine[];
  outlets: ManagerTodayOutlet[];
  events: ManagerTodayEvent[];
  noShows: ManagerTodayNoShow[];
}

type Filter = "all" | ManagerTodayException["category"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rooms", label: "Rooms" },
  { id: "guests", label: "Guests" },
  { id: "money", label: "Money" },
];

const NO_SHOW_REASONS = [
  { id: "unreachable", label: "Guest did not arrive and could not be reached" },
  { id: "late-cancel", label: "Guest cancelled after the cancellation deadline" },
  { id: "travel", label: "Guest reported a travel disruption" },
];

/** Card heading row: title + description on the left, a ghost link on the right (artifact card__header). */
function CardHead({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card.Header className="flex flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Card.Title id={id} className="text-[15px] font-semibold" render={(props) => <h2 {...props} />}>
          {title}
        </Card.Title>
        <Card.Description>{description}</Card.Description>
      </div>
      {action}
    </Card.Header>
  );
}

function KpiValue({ kpi }: { kpi: ManagerTodayKpi }) {
  if (kpi.total === undefined) return <KPI.Value value={kpi.value} className="tabular" />;
  return (
    <KPI.Value value={kpi.value} className="tabular">
      {(formatted) => `${formatted} / ${kpi.total}`}
    </KPI.Value>
  );
}

export function ManagerTodayView({ persona, data }: { persona: Persona; data: ManagerTodayData }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [reason, setReason] = useState<string>(NO_SHOW_REASONS[0].id);

  const all = data.exceptions;
  const openCount = all.filter((e) => !done[e.id]).length;
  const doneCount = all.length - openCount;
  const count = (f: Filter) => all.filter((e) => f === "all" || e.category === f).length;
  const visible = all.filter((e) => filter === "all" || e.category === filter);
  const markDone = (id: string) => setDone((d) => ({ ...d, [id]: true }));
  const act = (e: ManagerTodayException) => (e.opensDialog ? setNoShowOpen(true) : markDone(e.id));
  const ready = data.kpis.find((k) => k.id === "ready");
  const noShowException = all.find((e) => e.opensDialog);

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow="Monday 12 October 2026 · 10:45 · Isangano Lakeside Hotel"
        title={`Good morning, ${persona.firstName}`}
        description={`${openCount} exceptions open. Housekeeping is 5 rooms short for arrivals before 14:00.`}
        actions={
          <>
            <LinkButton href={screenHref("HousekeepingBoard")} variant="secondary">
              <BroomMotion className="size-4" aria-hidden="true" />
              Housekeeping board
            </LinkButton>
            <LinkButton href={screenHref("FrontDeskToday")}>
              <Persons className="size-4" aria-hidden="true" />
              Open front desk
            </LinkButton>
          </>
        }
      />

      <section aria-label="Today at a glance">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((kpi, i) => (
            <Fragment key={kpi.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[190px] flex-[1_1_190px]">
                <KPI.Header>
                  <KPI.Icon status={kpi.iconStatus === "default" ? undefined : kpi.iconStatus}>
                    <Icon name={kpi.icon} />
                  </KPI.Icon>
                  <KPI.Title>
                    <NextLink
                      href={screenHref(kpi.board)}
                      className="text-inherit no-underline after:absolute after:inset-0"
                    >
                      {kpi.label}
                    </NextLink>
                  </KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KpiValue kpi={kpi} />
                  {kpi.chipTone === "default" ? (
                    <KPI.Trend trend="neutral">{kpi.chip}</KPI.Trend>
                  ) : (
                    <Chip size="sm" variant="soft" color={toneColor(kpi.chipTone)} className="justify-self-end">
                      {kpi.chip}
                    </Chip>
                  )}
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{kpi.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <ItemCardGroup layout="list" aria-labelledby="exc-h" className="min-w-0 flex-[1_1_600px]">
          <ItemCardGroup.Header className="flex flex-wrap items-center gap-3">
            <div className="min-w-[min(220px,100%)] flex-1">
              <ItemCardGroup.Title id="exc-h" role="heading" aria-level={2}>
                Exceptions
              </ItemCardGroup.Title>
              <ItemCardGroup.Description>
                {openCount} open · {doneCount} handled · sorted by due time
              </ItemCardGroup.Description>
            </div>
            <Segment
              aria-label="Filter exceptions"
              selectedKey={filter}
              onSelectionChange={(k) => setFilter(String(k) as Filter)}
            >
              {FILTERS.map((f) => (
                <Segment.Item key={f.id} id={f.id}>
                  {`${f.label} ${count(f.id)}`}
                </Segment.Item>
              ))}
            </Segment>
          </ItemCardGroup.Header>
          {visible.map((e, i) => (
            <Fragment key={e.id}>
              {i > 0 ? <Separator /> : null}
              <ItemCard className="items-start">
                <ItemCard.Icon>
                  <Icon name={e.icon} />
                </ItemCard.Icon>
                <ItemCard.Content className="gap-1">
                  <span className="flex items-start justify-between gap-2">
                    <ItemCard.Title className="whitespace-normal">{e.title}</ItemCard.Title>
                    <Chip size="sm" variant="soft" color={toneColor(e.chipTone)} className="shrink-0">
                      {e.chip}
                    </Chip>
                  </span>
                  <ItemCard.Description className="whitespace-normal">{e.desc}</ItemCard.Description>
                  <span className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">{e.meta}</span>
                    <span className="flex items-center gap-1.5">
                      {done[e.id] ? (
                        <Chip size="sm" variant="soft">
                          <Check className="size-3" aria-hidden="true" />
                          <Chip.Label>{e.doneLabel}</Chip.Label>
                        </Chip>
                      ) : (
                        <>
                          <LinkButton
                            href={screenHref(e.board)}
                            size="sm"
                            variant="ghost"
                            aria-label={`${e.linkLabel}: ${e.title}`}
                          >
                            {e.linkLabel}
                          </LinkButton>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => act(e)}
                            aria-label={`${e.actionLabel}: ${e.title}`}
                          >
                            {e.actionLabel}
                          </Button>
                        </>
                      )}
                    </span>
                  </span>
                </ItemCard.Content>
              </ItemCard>
            </Fragment>
          ))}
        </ItemCardGroup>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Widget aria-labelledby="hk-h">
            <Widget.Header>
              <h2 id="hk-h">
                <Widget.Title>Housekeeping Bottleneck</Widget.Title>
              </h2>
              <LinkButton href={screenHref("HousekeepingBoard")} size="sm" variant="ghost">
                Board
                <ChevronRight className="size-4" aria-hidden="true" />
              </LinkButton>
            </Widget.Header>
            <Widget.Content className="flex flex-col gap-3">
              {ready ? (
                <ProgressBar
                  value={ready.value}
                  maxValue={ready.total ?? 1}
                  aria-label="Rooms ready for arrivals before 14:00"
                  className="gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label>Ready for arrivals before 14:00</Label>
                    <span className="text-sm font-medium tabular">
                      {ready.value} of {ready.total}
                    </span>
                  </div>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              ) : null}
              {data.roomStatus.map((s) => (
                <div key={s.id} className="flex items-start gap-2.5 border-t border-separator pt-2.5">
                  <span className="flex w-[104px] shrink-0 items-center gap-2 pt-0.5">
                    <StatusDot tone={s.tone} />
                    <span className="text-[13px] font-medium">{s.label}</span>
                    <span className="text-xs text-muted tabular">{s.rooms.length}</span>
                  </span>
                  <span className="flex flex-1 flex-wrap gap-1">
                    {s.rooms.map((r) => (
                      <Chip key={r.room} size="sm" variant="soft" color={r.arrival ? "warning" : "default"}>
                        <Chip.Label className="tabular">{r.arrival ? `${r.room} · ${r.arrival}` : r.room}</Chip.Label>
                      </Chip>
                    ))}
                  </span>
                </div>
              ))}
              <Alert status="warning">
                <Alert.Indicator>
                  <Hourglass />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Inspection is the slow step</Alert.Title>
                  <Alert.Description>
                    4 rooms are clean and waiting for Beatrice Mukandori. Oldest has waited 38 min against a 20 min
                    target.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <p className="text-xs leading-4 text-muted">
                Highlighted rooms are needed for an arrival; time is the guest’s expected arrival. Source: room status
                board, 10:45.
              </p>
            </Widget.Content>
          </Widget>

          <Card aria-labelledby="ooo-h" className="gap-3 p-[18px]">
            <CardHead
              id="ooo-h"
              title="Rooms Out of Order"
              description="Excluded from sellable availability until cleared"
              action={
                <LinkButton href={screenHref("Maintenance")} size="sm" variant="ghost">
                  Maintenance
                </LinkButton>
              }
            />
            <ListView aria-label="Rooms out of order" variant="secondary" items={data.outOfOrder}>
              {(o) => (
                <ListView.Item id={o.id} textValue={`Room ${o.room} · ${o.issue}`}>
                  <ListView.ItemContent>
                    <Wrench className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <ListView.Title className="whitespace-normal">
                        Room {o.room} · {o.issue}
                      </ListView.Title>
                      <ListView.Description className="whitespace-normal">{o.detail}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <Chip size="sm" variant="soft" color={toneColor(o.chipTone)}>
                      {o.chip}
                    </Chip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <Card aria-labelledby="staff-h" className="gap-2.5 p-[18px]">
          <CardHead
            id="staff-h"
            title="Staff on Shift"
            description="Clocked in against today’s roster · attendance kiosk, 10:45"
          />
          <Card.Content className="flex flex-col gap-2.5">
            {data.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium">{s.dept}</span>
                  <span className="truncate text-xs text-muted">{s.note}</span>
                </span>
                <ProgressBar
                  value={s.rostered ? (s.on / s.rostered) * 100 : 0}
                  size="sm"
                  aria-label={`${s.dept}: ${s.on} of ${s.rostered} clocked in`}
                  className="w-[90px] shrink-0"
                >
                  <ProgressBar.Track>{s.on > 0 ? <ProgressBar.Fill /> : null}</ProgressBar.Track>
                </ProgressBar>
                <span className="w-11 shrink-0 text-right text-[13px] font-medium tabular">
                  {s.on} / {s.rostered}
                </span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card aria-labelledby="out-h" className="gap-2.5 p-[18px]">
          <CardHead
            id="out-h"
            title="Outlets"
            description="Service status right now"
            action={
              <LinkButton href={screenHref("OutletsMenus")} size="sm" variant="ghost">
                Outlets
              </LinkButton>
            }
          />
          <ListView aria-label="Outlets" variant="secondary" items={data.outlets}>
            {(o) => (
              <ListView.Item id={o.id} textValue={o.name}>
                <ListView.ItemContent>
                  <StatusDot tone={o.dotTone} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <ListView.Title>{o.name}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{o.detail}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(o.chipTone)}>
                    {o.chip}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>

        <Card aria-labelledby="ev-h" className="gap-2.5 p-[18px]">
          <CardHead
            id="ev-h"
            title="Events Today"
            description="Kivu Hall and Garden Terrace"
            action={
              <LinkButton href={screenHref("SalesEvents")} size="sm" variant="ghost">
                Sales &amp; events
              </LinkButton>
            }
          />
          <Card.Content>
            <Timeline size="sm" density="compact">
              {data.events.map((v) => (
                <Timeline.Item key={v.id} status={v.status}>
                  <Timeline.Rail>
                    <Timeline.Marker />
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                    <span className="font-medium">
                      <span className="tabular">{v.time}</span> · {v.title}
                    </span>
                    <span className="text-xs leading-4 text-muted">{v.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card.Content>
        </Card>
      </div>

      <Modal.Backdrop isOpen={noShowOpen} onOpenChange={setNoShowOpen}>
        <Modal.Container size="md">
          <Modal.Dialog aria-labelledby="ns-h">
            <Modal.CloseTrigger aria-label="Close" />
            <Modal.Header className="flex flex-col gap-0.5">
              <Modal.Heading id="ns-h" className="text-lg leading-[26px] font-semibold">
                Confirm 2 no-shows
              </Modal.Heading>
              <p className="text-[13px] text-muted">
                Arrival Sunday 11 October · not checked in when night audit closed at 03:12
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <ListView aria-label="No-shows to confirm" variant="secondary" items={data.noShows}>
                {(n) => (
                  <ListView.Item id={n.id} textValue={`${n.guest} · ${n.booking}`}>
                    <ListView.ItemContent>
                      <Avatar size="sm" variant="soft">
                        <Avatar.Fallback>{n.initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <ListView.Title>
                          {n.guest} · {n.booking}
                        </ListView.Title>
                        <ListView.Description className="whitespace-normal">{n.detail}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <Chip size="sm" variant="soft">
                        {n.outcome}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
              <Select
                fullWidth
                value={reason}
                onChange={(k) => setReason(String(k))}
                aria-label="Reason"
                className="flex flex-col gap-1"
              >
                <Label>Reason</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {NO_SHOW_REASONS.map((r) => (
                      <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                        {r.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Alert>
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Rooms return to inventory tonight</Alert.Title>
                  <Alert.Description>
                    Remaining nights are released. The retained amount follows cancellation policy v3 and is posted by
                    Finance as a separate step; nothing is charged from here.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="secondary" slot="close">
                Cancel
              </Button>
              <Button
                onPress={() => {
                  if (noShowException) markDone(noShowException.id);
                  setNoShowOpen(false);
                }}
              >
                Confirm no-shows
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
