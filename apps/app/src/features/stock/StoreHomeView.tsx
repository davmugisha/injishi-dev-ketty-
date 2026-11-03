"use client";

import { Check, ListCheck, Plus, ShieldExclamation, TriangleExclamation } from "@gravity-ui/icons";
import { Button, Card, Separator, Table, ToggleButton } from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, ListView, Segment, Widget } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  CountVariance,
  Delivery,
  ReorderAlert,
  StoreKpi,
  StoreRequisition,
  StoreValueRow,
} from "@injishi/data/fixtures/stock";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useState } from "react";
import { Bar, Muted, money, qty, SectionTitle, signedMoney, signedQty, ToneChip } from "./shared";

interface StoreHomeData {
  kpis: StoreKpi[];
  reorder: ReorderAlert[];
  deliveries: Delivery[];
  values: StoreValueRow[];
  requisitions: StoreRequisition[];
  variances: CountVariance[];
}

type Measure = StoreValueRow["measure"];

const MEASURES: { id: Measure; label: string }[] = [
  { id: "value", label: "Stock value" },
  { id: "cogs", label: "Cost of goods" },
];

/** First transfer number issued today; each issue takes the next one (TR-0093, TR-0094…). */
const NEXT_TRANSFER = 93;

function kpiHref(k: StoreKpi): string {
  return k.anchor ? `${screenHref(k.board)}#${k.anchor}` : screenHref(k.board);
}

export function StoreHomeView({ persona, data }: { persona: Persona; data: StoreHomeData }) {
  const [picks, setPicks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.reorder.map((r) => [r.id, r.onDraftPo])),
  );
  const [measure, setMeasure] = useState<Measure>("value");
  const [issued, setIssued] = useState<Record<string, string>>({});

  const nPicks = data.reorder.filter((r) => picks[r.id]).length;
  const issuedCount = Object.keys(issued).length;
  const valRows = data.values.filter((v) => v.measure === measure);
  const net = data.variances.reduce((sum, v) => sum + (v.counted - v.system) * v.unitCost, 0);

  const issue = (id: string) =>
    setIssued((cur) => ({ ...cur, [id]: `TR-${String(NEXT_TRANSFER + Object.keys(cur).length).padStart(4, "0")}` }));

  return (
    <PageContent className="text-sm">
      <PageHeader
        size="hello"
        eyebrow="Monday 12 October 2026 · 08:15 · Isangano main store"
        title={`Good morning, ${persona.firstName}`}
        actions={
          <>
            <LinkButton href={`${screenHref("StockLedger")}?tab=count`} variant="secondary">
              <ListCheck className="size-4" />
              Continue count
            </LinkButton>
            <LinkButton href={screenHref("PurchaseOrders")}>
              <Plus className="size-4" />
              New purchase order
            </LinkButton>
          </>
        }
      />

      <section aria-label="Store figures">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => {
            const value = k.id === "requisitions" ? Math.max(0, k.value - issuedCount) : k.value;
            return (
              <Fragment key={k.id}>
                {i > 0 ? <KPIGroup.Separator /> : null}
                <KPI className="relative min-w-[min(190px,100%)] flex-[1_1_190px]">
                  <KPI.Header>
                    {k.warn ? (
                      <KPI.Icon status="warning">
                        <TriangleExclamation />
                      </KPI.Icon>
                    ) : null}
                    <KPI.Title>
                      <NextLink href={kpiHref(k)} className="text-inherit no-underline after:absolute after:inset-0">
                        {k.label}
                      </NextLink>
                    </KPI.Title>
                  </KPI.Header>
                  <KPI.Content>
                    <KPI.Value value={value} formatOptions={k.format} className="tabular">
                      {(formatted: string) => formatted.replace(/^-/, "−")}
                    </KPI.Value>
                  </KPI.Content>
                  <KPI.Footer>
                    <p className="text-xs leading-4 text-muted">{k.foot}</p>
                  </KPI.Footer>
                </KPI>
              </Fragment>
            );
          })}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <ItemCardGroup layout="list" aria-labelledby="reo-h">
          <ItemCardGroup.Header className="flex items-center gap-2">
            <div className="flex-1">
              <h2 id="reo-h" className="text-sm font-semibold text-foreground">
                Reorder Alerts
              </h2>
              <ItemCardGroup.Description>
                On hand against reorder point, from the stock ledger at 08:00
              </ItemCardGroup.Description>
            </div>
            {nPicks ? (
              <LinkButton href={screenHref("PurchaseOrders")} size="sm">
                Draft PO for {nPicks} items
              </LinkButton>
            ) : (
              <Button size="sm" isDisabled>
                Pick items to order
              </Button>
            )}
          </ItemCardGroup.Header>
          {data.reorder.map((r) => {
            const sel = !!picks[r.id];
            return (
              <Fragment key={r.id}>
                <Separator />
                <ItemCard className="items-start">
                  <ItemCard.Icon>
                    <Icon name={r.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content className="gap-1.5">
                    <ItemCard.Title className="whitespace-normal">{r.name}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal tabular">
                      {qty(r.onHand)} {r.unit} on hand · reorder at {r.reorderAt} · par {r.par} · uses {r.use}
                    </ItemCard.Description>
                    <Bar
                      value={Math.round((r.onHand / r.par) * 100)}
                      color={r.onHand === 0 ? "danger" : "warning"}
                      label={`${qty(r.onHand)} of par ${r.par} ${r.unit}`}
                      className="max-w-[260px]"
                    />
                    <Muted>{r.cover}</Muted>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ToggleButton
                      size="sm"
                      isSelected={sel}
                      onChange={(v) => setPicks((cur) => ({ ...cur, [r.id]: v }))}
                      aria-label={`Put ${r.name} on the draft PO`}
                    >
                      {sel ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                      {sel ? "On draft PO" : "Add to PO"}
                    </ToggleButton>
                  </ItemCard.Action>
                </ItemCard>
              </Fragment>
            );
          })}
        </ItemCardGroup>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-3 p-[18px]" aria-labelledby="del-h">
            <Card.Header>
              <h2 id="del-h" className="text-[15px] leading-[22px] font-semibold">
                Deliveries Today
              </h2>
              <Card.Description>
                Receive against the purchase order so quantities and prices can be matched
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <ListView aria-label="Deliveries today" variant="secondary" items={data.deliveries}>
                {(d) => (
                  <ListView.Item id={d.id} textValue={`${d.po} · ${d.supplier}`}>
                    <ListView.ItemContent>
                      <Icon name={d.icon} className="size-4 shrink-0" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>
                          {d.po} · {d.supplier}
                        </ListView.Title>
                        <ListView.Description>{d.detail}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-2">
                      <ToneChip tone={d.tone}>{d.state}</ToneChip>
                      {d.canReceive ? (
                        <LinkButton href={screenHref("GoodsReceipt")} size="sm" aria-label={`Receive ${d.po}`}>
                          Receive
                        </LinkButton>
                      ) : null}
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </Card.Content>
          </Card>

          <Widget aria-labelledby="val-h">
            <Widget.Header className="flex flex-wrap items-center gap-2">
              <h2 id="val-h" className="flex-1 text-sm font-semibold text-foreground">
                {measure === "value" ? "Stock Value at Cost by Store" : "Cost of Goods by Outlet · October to date"}
              </h2>
              <Segment
                size="sm"
                aria-label="Measure"
                selectedKey={measure}
                onSelectionChange={(k) => setMeasure(String(k) as Measure)}
              >
                {MEASURES.map((m) => (
                  <Segment.Item key={m.id} id={m.id}>
                    {m.label}
                  </Segment.Item>
                ))}
              </Segment>
            </Widget.Header>
            <Widget.Content className="flex flex-col gap-2.5">
              {valRows.map((v) => (
                <div key={v.id} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span>{v.name}</span>
                    <span className="font-medium tabular">{v.value}</span>
                  </div>
                  <Bar value={v.share} label={`${v.name} ${v.value}`} />
                  <Muted>{v.note}</Muted>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Muted>
                  {measure === "value"
                    ? "Total RWF 20.0M at weighted average cost · Ikawa Corner is a separate merchant and not included."
                    : "Consumption posted from confirmed sales and production, divided by net sales."}
                </Muted>
                <GateChip icon={<ShieldExclamation className="size-3" />}>
                  Costing method awaiting finance sign-off
                </GateChip>
              </div>
            </Widget.Content>
          </Widget>
        </div>
      </div>

      <section id="requisitions" className="flex scroll-mt-4 flex-col gap-2.5" aria-labelledby="req-h">
        <SectionTitle id="req-h" title="Requisitions From Outlets and Housekeeping">
          Issuing moves stock between your own locations at cost. It is not a sale and creates no fiscal receipt.
        </SectionTitle>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="req-h">
              <Table.Header>
                <Table.Column isRowHeader>Requisition</Table.Column>
                <Table.Column>From</Table.Column>
                <Table.Column>Lines</Table.Column>
                <Table.Column className="text-right">Value at cost</Table.Column>
                <Table.Column>Needed by</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column className="text-right">
                  <span className="sr-only">Action</span>
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {data.requisitions.map((q) => {
                  const tr = issued[q.id];
                  return (
                    <Table.Row key={q.id} id={q.id}>
                      <Table.Cell className="font-medium tabular">{q.id}</Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span>{q.from}</span>
                          <Muted>{q.by}</Muted>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="max-w-[280px] whitespace-normal">{q.lines}</Table.Cell>
                      <Table.Cell className="text-right tabular">{money(q.value)}</Table.Cell>
                      <Table.Cell>{q.need}</Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={tr ? "info" : q.tone}>{tr ? `Issued · ${tr}` : q.state}</ToneChip>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {q.issuable && !tr ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => issue(q.id)}
                            aria-label={`Issue stock for ${q.id}`}
                          >
                            Issue stock
                          </Button>
                        ) : (
                          <Muted>{tr ? "Internal transfer · no fiscal receipt" : q.waitWhy}</Muted>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="var-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle id="var-h" title="Variances From the Last Count">
            CNT-0412 · dry store, linen and beverages · counted 5 Oct by Patrick Nshimiyimana and Beatrice Mukandori
          </SectionTitle>
          <ToneChip tone="danger" size="md">
            Net {money(net)} · 1.9% of counted value
          </ToneChip>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="var-h">
              <Table.Header>
                <Table.Column isRowHeader>Item</Table.Column>
                <Table.Column className="text-right">System</Table.Column>
                <Table.Column className="text-right">Counted</Table.Column>
                <Table.Column className="text-right">Difference</Table.Column>
                <Table.Column className="text-right">Value</Table.Column>
                <Table.Column>Reason</Table.Column>
                <Table.Column>Adjustment</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.variances.map((v) => {
                  const diff = v.counted - v.system;
                  return (
                    <Table.Row key={v.id} id={v.id}>
                      <Table.Cell className="font-medium">{v.item}</Table.Cell>
                      <Table.Cell className="text-right tabular">{qty(v.system, v.unit)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{qty(v.counted, v.unit)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{signedQty(diff, v.unit)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{signedMoney(diff * v.unitCost)}</Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={v.reasonTone}>{v.reason}</ToneChip>
                      </Table.Cell>
                      <Table.Cell>
                        <Muted>{v.adjustment}</Muted>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>
    </PageContent>
  );
}
