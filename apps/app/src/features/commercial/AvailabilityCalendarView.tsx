"use client";

import { ArrowsRotateRight, ChevronLeft, ChevronRight, Clock, Pencil, Tag } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Popover } from "@heroui/react";
import { ItemCard, ListView, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import { Icon, LinkButton, PageContent, PageHeader, StatusDot, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useMemo, useRef, useState } from "react";
import { AvailabilityCalendarEditPanel } from "./AvailabilityCalendarEditPanel";
import { AvailabilityCalendarGrid } from "./AvailabilityCalendarGrid";
import {
  type AvailabilityCalendarData,
  buildCalendar,
  type CalendarSelection,
  type CalendarUserChanges,
  fmt,
  nightLabel,
  nightsText,
} from "./AvailabilityCalendarModel";

/** Board state on arrival: Deluxe Lake View, Mon 20 – Wed 22 Oct selected with the edit popover open. */
const INITIAL_SELECTION: CalendarSelection = { type: "dlv", a: 8, b: 10 };
const INITIAL_PRICE = "132,000";
const INITIAL_MIN_STAY = 2;

const LEGEND = [
  { label: "Price override", swatch: "bg-accent-soft" },
  { label: "Awaiting approval", swatch: "outline-1 outline-offset-[-1px] outline-warning outline-dashed" },
  { label: "Stop-sell", swatch: "bg-surface-tertiary" },
  { label: "Overbooked", swatch: "bg-danger-soft" },
];

export function AvailabilityCalendarView({ persona, data }: { persona: Persona; data: AvailabilityCalendarData }) {
  const { nights, ratePlans, roomTypes, issues, channels, holds, reasons } = data;

  const [planId, setPlanId] = useState(ratePlans[0]?.id ?? "bar");
  const [selection, setSelection] = useState<CalendarSelection>(INITIAL_SELECTION);
  const [anchor, setAnchor] = useState<{ type: string; night: number } | null>(null);
  const [pop, setPop] = useState(true);
  const [price, setPrice] = useState(INITIAL_PRICE);
  const [stopSell, setStopSell] = useState(false);
  const [minStay, setMinStay] = useState(INITIAL_MIN_STAY);
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? "");
  const [changes, setChanges] = useState<CalendarUserChanges>({});
  const [queued, setQueued] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<{ title: string; reason: string } | null>(null);
  const [retried, setRetried] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const plan = ratePlans.find((p) => p.id === planId) ?? ratePlans[0];
  const calendar = useMemo(
    () => (plan ? buildCalendar({ data, plan, selection, changes, queued, retried }) : null),
    [data, plan, selection, changes, queued, retried],
  );

  const selType = roomTypes.find((t) => t.id === selection.type) ?? roomTypes[0];
  const first = nights[0];
  const last = nights[nights.length - 1];
  const selNights = selection.b - selection.a + 1;
  const selRangeText = `${nightLabel(nights[selection.a])} – ${nightLabel(nights[selection.b])} ${nights[selection.a]?.month ?? ""}`;
  const priceNum = Number.parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
  const nrfPlan = ratePlans.find((p) => p.basis === "bar" && p.factor);
  const bbPlan = ratePlans.find((p) => p.basis === "bar" && p.supplement);
  const reasonLabel = reasons.find((r) => r.id === reasonId)?.label ?? "";
  const priceHint = [
    `Now ${fmt(selType?.bar ?? 0)}.`,
    nrfPlan?.factor
      ? ` ${nrfPlan.label} follows at ${fmt(Math.round((priceNum * nrfPlan.factor) / 1000) * 1000)};`
      : "",
    bbPlan?.supplement ? ` ${bbPlan.label} adds ${fmt(bbPlan.supplement)} for 2 guests.` : "",
  ].join("");

  const pickCell = (type: string, night: number) => {
    if (anchor && anchor.type === type) {
      setSelection({ type, a: Math.min(anchor.night, night), b: Math.max(anchor.night, night) });
      setAnchor(null);
      setPop(true);
    } else {
      setAnchor({ type, night });
      setSelection({ type, a: night, b: night });
      setPop(false);
    }
  };
  const openPop = () => {
    setPop(true);
    setAnchor(null);
  };
  const closePop = () => setPop(false);
  const apply = () => {
    if (!selType) return;
    const current = { ...(changes[selection.type] ?? {}) };
    const nextQueued = { ...queued };
    for (let i = selection.a; i <= selection.b; i++) {
      current[i] = { price: priceNum, close: stopSell, min: minStay };
      nextQueued[i] = true;
    }
    setChanges({ ...changes, [selection.type]: current });
    setQueued(nextQueued);
    setPop(false);
    setSaved({
      title: `${selType.name} · ${nightsText(selNights)} saved: RWF ${fmt(priceNum)}${stopSell ? ", stop-sell" : ""}, minimum stay ${minStay}`,
      reason: reasonLabel,
    });
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Commercial"
        title="Availability"
        description="Rooms left, price and restrictions per night. Click the first and last night in a row to edit them together."
        actions={
          <>
            <LinkButton href={screenHref("RatesInventory")} variant="secondary">
              <Tag className="size-4" />
              Rate plans
            </LinkButton>
            <Popover isOpen={pop} onOpenChange={(open) => (open ? openPop() : closePop())}>
              <Button onPress={openPop}>
                <Pencil className="size-4" />
                Edit selected nights
              </Button>
              {selType ? (
                <AvailabilityCalendarEditPanel
                  anchorRef={anchorRef}
                  title={selType.name}
                  range={`${selRangeText} · ${nightsText(selNights)}`}
                  nightsLabel={nightsText(selNights)}
                  hint={priceHint}
                  price={price}
                  onPriceChange={setPrice}
                  stopSell={stopSell}
                  onStopSellChange={setStopSell}
                  minStay={minStay}
                  onMinStayChange={setMinStay}
                  reasons={reasons}
                  reasonId={reasonId}
                  onReasonChange={setReasonId}
                  onClose={closePop}
                  onApply={apply}
                />
              ) : null}
            </Popover>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="flex items-center gap-[4px]">
          <Button size="sm" variant="ghost" isIconOnly aria-label="Previous 14 nights">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[150px] text-center text-[14px] font-semibold tabular">
            {data.window?.label ??
              `${nightLabel(first)} – ${nightLabel(last)} ${last?.month ?? ""} ${last?.year ?? ""}`}
          </span>
          <Button size="sm" variant="ghost" isIconOnly aria-label="Next 14 nights">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segment aria-label="Rate plan shown" selectedKey={planId} onSelectionChange={(k) => setPlanId(String(k))}>
            {ratePlans.map((p) => (
              <Segment.Item key={p.id} id={p.id}>
                <Segment.Separator />
                {p.label}
              </Segment.Item>
            ))}
          </Segment>
        </div>
        <span className="flex-1" />
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-[6px] text-[12px] text-muted">
            <span aria-hidden="true" className={`inline-block size-[10px] rounded-[3px] ${l.swatch}`} />
            {l.label}
          </span>
        ))}
      </div>

      {issues.map((issue) => (
        <Alert key={issue.id} status={toneColor(issue.tone)} role="alert" className="flex-wrap">
          <Alert.Indicator>
            <Icon name={issue.icon} />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-[1_1_260px]">
            <Alert.Title>{issue.title}</Alert.Title>
            <Alert.Description>{issue.description}</Alert.Description>
          </Alert.Content>
          <div className="flex flex-none flex-wrap gap-2">
            {issue.actions.map((a) => (
              <LinkButton key={a.label} href={screenHref(a.board)} size="sm" variant={a.variant}>
                {a.label}
              </LinkButton>
            ))}
          </div>
        </Alert>
      ))}

      {saved ? (
        <Alert status="accent" role="status">
          <Alert.Indicator>
            <Clock />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{saved.title}</Alert.Title>
            <Alert.Description>
              Recorded by {persona.name} at 10:58 with reason “{saved.reason}”. Channel updates are queued and show as
              synced only when each channel acknowledges.
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="ghost" onPress={() => setSaved(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}

      <section aria-labelledby="cal-h">
        <Card className="gap-[8px] p-[12px]">
          <div className="flex items-center justify-between gap-3 px-[6px] pt-[4px]">
            <h2 id="cal-h" className="text-[15px] leading-[22px] font-semibold">
              Rooms Left and Price per Night
            </h2>
            <span className="text-[12px] text-muted">
              {anchor
                ? "Now click the last night in the same row"
                : `Selected: ${selType?.name ?? ""}, ${selRangeText}`}
            </span>
          </div>
          {calendar && plan ? (
            <AvailabilityCalendarGrid
              nights={nights}
              planLabel={plan.label}
              rows={calendar.rows}
              occupancy={calendar.occupancy}
              sync={calendar.sync}
              groupBlocks={data.groupBlocks}
              selection={selection}
              anchorRef={anchorRef}
              onPick={pickCell}
            />
          ) : null}
        </Card>
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <section aria-labelledby="sync-h">
          <Card className="gap-[10px] p-[18px]">
            <Card.Header className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Card.Title id="sync-h" className="text-[15px] font-semibold">
                  Channel Sync
                </Card.Title>
                <Card.Description>Availability and rate pushes for these 14 nights</Card.Description>
              </div>
              <LinkButton href={screenHref("Channels")} size="sm" variant="ghost">
                Distribution
              </LinkButton>
            </Card.Header>
            <ListView aria-label="Channels" variant="secondary">
              {channels.map((ch) => {
                const state = retried && ch.retry ? ch.retry : ch;
                const canRetry = !!ch.retry && !retried;
                return (
                  <ListView.Item key={ch.id} id={ch.id} textValue={ch.name}>
                    <ListView.ItemContent>
                      <StatusDot tone={state.tone} />
                      <div className="flex min-w-0 flex-col gap-[2px]">
                        <ListView.Title>{ch.name}</ListView.Title>
                        <ListView.Description>{state.detail}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-[6px]">
                      {canRetry ? (
                        <Button size="sm" variant="secondary" onPress={() => setRetried(true)}>
                          <ArrowsRotateRight className="size-4" />
                          Retry
                        </Button>
                      ) : null}
                      <Chip size="sm" variant="soft" color={toneColor(state.tone)}>
                        <Chip.Label>{state.status}</Chip.Label>
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                );
              })}
            </ListView>
          </Card>
        </section>

        <section aria-labelledby="hold-h">
          <Card className="gap-[10px] p-[18px]">
            <Card.Header>
              <Card.Title id="hold-h" className="text-[15px] font-semibold">
                Holds Affecting These Nights
              </Card.Title>
              <Card.Description>Inventory that is committed but not yet a stay</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-[10px]">
              {holds.map((h) => (
                <NextLink key={h.id} href={screenHref(h.board)} className="block text-inherit no-underline">
                  <ItemCard variant="secondary">
                    <ItemCard.Icon>
                      <Icon name={h.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title className="whitespace-normal">{h.title}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">{h.detail}</ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                    </ItemCard.Action>
                  </ItemCard>
                </NextLink>
              ))}
            </Card.Content>
          </Card>
        </section>
      </div>
    </PageContent>
  );
}
