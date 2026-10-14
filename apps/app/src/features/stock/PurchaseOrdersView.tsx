"use client";

import { Box, CircleCheckFill, FilePlus, PaperPlane, Plus, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Table, Tabs } from "@heroui/react";
import { RadioButtonGroup, Stepper, Timeline } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ApprovalRule,
  BuyRequisition,
  DraftPoLine,
  PurchaseOrder,
  SupplierQuote,
} from "@injishi/data/fixtures/stock";
import { formatNumber, Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { type Key, useState } from "react";
import { KvRows, lineTab, Muted, money, selectableRow, TabCount, ToneChip } from "./shared";

export interface PurchaseOrdersData {
  orders: PurchaseOrder[];
  quotes: SupplierQuote[];
  lines: DraftPoLine[];
  rules: ApprovalRule[];
  requisitions: BuyRequisition[];
}

export type BuyingTab = "po" | "req";

const STEPS = ["Requisition", "Quotes", "Approval", "Sent", "Received", "Invoice matched"];

/** Number the next purchase order takes when a requisition is converted. */
const NEXT_PO = "PO-26-0148";

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

/** "USD 1,260" for a foreign-currency order, "RWF 684,000" otherwise. */
function orderTotal(o: PurchaseOrder): string {
  if (o.currency === "RWF") return money(o.amount);
  return formatNumber(o.amount, {
    style: "currency",
    currency: o.currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  });
}

function quoteTotal(lines: DraftPoLine[], quoteId: string): number {
  return lines.reduce((sum, l) => sum + l.qty * (l.prices[quoteId] ?? 0), 0);
}

export function PurchaseOrdersView({
  persona,
  data,
  initialTab,
}: {
  persona: Persona;
  data: PurchaseOrdersData;
  initialTab: BuyingTab;
}) {
  const [tab, setTab] = useState<BuyingTab>(initialTab);
  const [sel, setSel] = useState(data.orders.find((o) => o.draft)?.id ?? data.orders[0]?.id ?? "");
  const [vendor, setVendor] = useState(data.quotes[0]?.id ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [converted, setConverted] = useState<Record<string, string>>({});

  const quote = data.quotes.find((q) => q.id === vendor) ?? data.quotes[0];
  const expected = quoteTotal(data.lines, quote.id);
  const bandIndex = Math.max(
    0,
    data.rules.findIndex((r) => r.upTo === null || expected <= r.upTo),
  );
  const rule = data.rules[bandIndex];

  /** The list as it reads now: the draft follows the chosen quote and the submit state. */
  const orders = data.orders.map((o) =>
    o.draft
      ? {
          ...o,
          supplier: quote.supplier,
          amount: expected,
          state: submitted ? `Waiting for ${rule.who.toLowerCase()}` : o.state,
          tone: submitted ? ("warning" as const) : o.tone,
          approval: rule.listLabel,
        }
      : o,
  );
  const order = orders.find((o) => o.id === sel) ?? orders[0];

  const detail = (
    <PoDetail
      order={order}
      persona={persona}
      quote={quote}
      quotes={data.quotes}
      lines={data.lines}
      rules={data.rules}
      bandIndex={bandIndex}
      expected={expected}
      submitted={submitted}
      onSubmit={() => setSubmitted(true)}
      onVendor={setVendor}
    />
  );

  const tabs: { id: BuyingTab; label: string; count: number }[] = [
    { id: "po", label: "Purchase orders", count: data.orders.length },
    { id: "req", label: "Requisitions", count: data.requisitions.length },
  ];

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow="Buy › Purchase orders · Isangano main store"
        title="Purchase Orders"
        description="Approved requisitions become purchase orders. Orders above RWF 1,000,000 need the owner."
        actions={
          <>
            <LinkButton href={screenHref("GoodsReceipt")} variant="secondary">
              <Box className="size-4" />
              Receive a delivery
            </LinkButton>
            <Button
              onPress={() => {
                setTab("po");
                setSel(data.orders.find((o) => o.draft)?.id ?? sel);
              }}
            >
              <Plus className="size-4" />
              New purchase order
            </Button>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as BuyingTab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Buying">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                {t.label}
                <TabCount>{t.count}</TabCount>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="po" className="pt-4">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
            <section aria-label="List" className="flex min-w-0 flex-col gap-2.5">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content
                    aria-label="Purchase orders"
                    selectionMode="single"
                    selectionBehavior="replace"
                    disallowEmptySelection
                    selectedKeys={new Set([order.id])}
                    onSelectionChange={(keys) => {
                      const id = firstKey(keys as "all" | Set<Key>);
                      if (id) setSel(id);
                    }}
                  >
                    <Table.Header>
                      <Table.Column isRowHeader>Order</Table.Column>
                      <Table.Column className="text-right">Expected cost</Table.Column>
                      <Table.Column>Status</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {orders.map((o) => (
                        <Table.Row key={o.id} id={o.id} className={selectableRow}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-semibold whitespace-nowrap tabular">{o.id}</span>
                              <Muted>{o.supplier}</Muted>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">
                            <span className="flex flex-col items-end">
                              <span>{orderTotal(o)}</span>
                              <Muted>{o.rwfEquivalent ? `≈ ${money(o.rwfEquivalent)}` : "RWF"}</Muted>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col items-start gap-0.5">
                              <ToneChip tone={o.tone}>{o.state}</ToneChip>
                              <Muted>{o.approval}</Muted>
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </section>
            {detail}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="req" className="pt-4">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
            <section aria-label="List" className="flex min-w-0 flex-col gap-2.5">
              {data.requisitions.map((q) => {
                const on = converted[q.id];
                return (
                  <Card key={q.id} className="gap-2 px-4 py-3.5" aria-label={`${q.id} · ${q.from}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold tabular">
                          {q.id} · {q.from}
                        </span>
                        <Muted>{q.by}</Muted>
                      </span>
                      <ToneChip tone={on ? "info" : q.tone}>{on ? `On ${on}` : q.state}</ToneChip>
                    </div>
                    <span className="text-[13px] leading-[18px]">{q.lines}</span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Muted>{q.note}</Muted>
                      {q.convertible && !on ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setConverted((cur) => ({ ...cur, [q.id]: `${NEXT_PO} draft` }))}
                          aria-label={`Create a purchase order from ${q.id}`}
                        >
                          <FilePlus className="size-4" />
                          Create PO
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </section>
            {detail}
          </div>
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}

function PoDetail({
  order,
  persona,
  quote,
  quotes,
  lines,
  rules,
  bandIndex,
  expected,
  submitted,
  onSubmit,
  onVendor,
}: {
  order: PurchaseOrder;
  persona: Persona;
  quote: SupplierQuote;
  quotes: SupplierQuote[];
  lines: DraftPoLine[];
  rules: ApprovalRule[];
  bandIndex: number;
  expected: number;
  submitted: boolean;
  onSubmit: () => void;
  onVendor: (id: string) => void;
}) {
  const rule = rules[bandIndex];
  const approverName = rule.approver.split(",")[0];
  const chain = [
    {
      title: `Prepared by ${persona.name}`,
      detail: "Today 08:20 · quotes attached",
      status: "success" as const,
    },
    {
      title: submitted ? `Waiting for ${rule.approver}` : `Needs ${rule.approver}`,
      detail: submitted ? "Sent 08:31 · notified in Approvals" : "Not submitted yet",
      status: submitted ? ("current" as const) : ("default" as const),
    },
  ];
  const incomplete = lines.some((l) => l.prices[quote.id] === null);

  return (
    <Card className="min-w-0 gap-4 p-5" aria-labelledby="po-h">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Muted>{order.draft ? order.origin : "Purchase order"}</Muted>
          <h2 id="po-h" className="text-xl leading-[26px] font-semibold tabular">
            {order.id} · {order.supplier}
          </h2>
          <span className="text-[13px] text-muted">{order.draft ? order.purpose : order.approval}</span>
        </div>
        <Chip variant="soft" color={toneColor(order.tone)}>
          {order.state}
        </Chip>
      </div>

      <Stepper size="sm" currentStep={order.stage} aria-label="Purchase flow" className="w-full">
        {STEPS.map((s) => (
          <Stepper.Step key={s}>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{s}</Stepper.Title>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>

      {order.draft ? (
        <>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label={`${order.id} lines`}>
                <Table.Header>
                  <Table.Column isRowHeader>Item</Table.Column>
                  <Table.Column className="text-right">Order</Table.Column>
                  <Table.Column>Stock units</Table.Column>
                  <Table.Column className="text-right">Unit price</Table.Column>
                  <Table.Column className="text-right">Line</Table.Column>
                </Table.Header>
                <Table.Body>
                  {lines.map((l) => {
                    const price = l.prices[quote.id];
                    return (
                      <Table.Row key={l.id} id={l.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{l.name}</span>
                            <Muted className="tabular">
                              {quote.codePrefix}
                              {l.code}
                            </Muted>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{l.qtyLabel}</Table.Cell>
                        <Table.Cell>
                          <Muted className="tabular">{l.conversion}</Muted>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">
                          {price ? `${money(price)} a ${l.priceUnit}` : price === null ? "Not offered" : "Included"}
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium tabular">
                          {price ? money(l.qty * price) : "—"}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Muted>
              Currency RWF · tax as shown on the supplier's EBM invoice · October food budget RWF 9.0M, RWF 6.2M
              committed
            </Muted>
            <span className="text-[15px] font-semibold">
              Expected cost <span className="tabular">{money(expected)}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="q-h" className="text-[15px] leading-[22px] font-semibold">
                Supplier Quotes
              </h3>
              <Muted>3 quotes requested 11 Oct · same basket</Muted>
            </div>
            <RadioButtonGroup
              aria-labelledby="q-h"
              value={quote.id}
              onChange={(v) => v && onVendor(v)}
              isDisabled={submitted}
              layout="grid"
              className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]"
            >
              {quotes.map((q) => {
                const total = quoteTotal(lines, q.id);
                const part = lines.some((l) => l.prices[q.id] === null);
                return (
                  <RadioButtonGroup.Item key={q.id} value={q.id} className="gap-1.5 p-3.5">
                    <RadioButtonGroup.Indicator>
                      <CircleCheckFill className="size-4" />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent className="flex flex-col gap-1">
                      <Label className="pr-6 font-semibold">{q.supplier}</Label>
                      <span className="text-[17px] leading-6 font-semibold tabular">
                        {money(total)}
                        {part ? " · part" : ""}
                      </span>
                      <span className="text-xs leading-4 text-muted">{q.terms}</span>
                      <ToneChip tone={q.tagTone} className="self-start">
                        {q.tag}
                      </ToneChip>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                );
              })}
            </RadioButtonGroup>
            {incomplete ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <TriangleExclamation />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>This quote does not cover the order</Alert.Title>
                  <Alert.Description>
                    Gisenyi Fishers Cooperative cannot supply Nile perch and needs at least 200 kg of tilapia. You need
                    140 kg.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </div>

          <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            <Card variant="secondary" className="gap-2.5 p-3.5" aria-labelledby="ap-h">
              <div className="flex flex-col">
                <h3 id="ap-h" className="text-sm font-semibold">
                  Approval Rules
                </h3>
                <Muted>Set by Didier Mugenzi · effective 1 Sep 2026</Muted>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {rules.map((r, i) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] ${i === bandIndex ? "bg-accent-soft" : ""}`}
                    aria-current={i === bandIndex ? "true" : undefined}
                  >
                    <Icon name={r.icon} className="size-3.5 shrink-0" />
                    <span className="flex-1">{r.band}</span>
                    <span className={i === bandIndex ? "font-semibold" : ""}>{r.who}</span>
                  </li>
                ))}
              </ul>
              <Timeline size="sm" density="compact">
                {chain.map((c) => (
                  <Timeline.Item key={c.title} status={c.status}>
                    <Timeline.Rail>
                      <Timeline.Marker />
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col pb-0.5">
                      <span className="text-[13px] leading-[18px] font-medium">{c.title}</span>
                      <Muted>{c.detail}</Muted>
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
              <Button onPress={onSubmit} isDisabled={submitted}>
                <PaperPlane className="size-4" />
                {submitted ? `Submitted to ${approverName}` : `Submit for ${rule.short} approval`}
              </Button>
              <Muted>
                You prepared this order, so you cannot approve it. The owner sees the quotes and budget with it.
              </Muted>
            </Card>

            <Card variant="secondary" className="gap-2.5 p-3.5" aria-labelledby="cat-h">
              <div className="flex flex-col">
                <h3 id="cat-h" className="text-sm font-semibold">
                  Catalog · {quote.supplier}
                </h3>
                <Muted>{quote.catalogMeta}</Muted>
              </div>
              <KvRows items={quote.catalog.map((c) => ({ key: c.item, label: c.item, value: c.uom }))} />
              <Muted>
                Recipes use grams and millilitres; the store converts on receipt so stock is always held in its stock
                unit.
              </Muted>
            </Card>
          </div>
        </>
      ) : (
        <>
          <KeyValueList items={order.facts.map((f) => ({ label: f.label, value: f.value }))} />
          {order.toReceipt ? (
            <LinkButton href={screenHref("GoodsReceipt")} className="self-start">
              <Box className="size-4" />
              Open the receipt
            </LinkButton>
          ) : null}
        </>
      )}
    </Card>
  );
}
