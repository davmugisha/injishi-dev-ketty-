"use client";

import { ArrowDownToLine, ArrowRightArrowLeft, ArrowRightFromSquare, ArrowUturnCcwLeft, Lock } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  SearchField,
  Select,
  Table,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { ItemCard, Timeline } from "@heroui-pro/react";
import type {
  CountLine,
  MovementType,
  ReasonOption,
  StockLocation,
  StockMovement,
  StockTransfer,
  Tone,
} from "@injishi/data/fixtures/stock";
import { KeyValueList, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { type Key, useMemo, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { KvRows, lineTab, Muted, money, SectionTitle, selectableRow, signedQty, TabCount, ToneChip } from "./shared";

interface StockLedgerData {
  movements: StockMovement[];
  locations: StockLocation[];
  countLines: CountLine[];
  reasons: ReasonOption[];
  transfers: StockTransfer[];
}

export type LedgerTab = "mv" | "count" | "tr";

const TYPES: Record<MovementType, { label: string; tone: Tone }> = {
  receipt: { label: "Receipt", tone: "success" },
  transfer: { label: "Transfer", tone: "info" },
  adjustment: { label: "Adjustment", tone: "warning" },
  wastage: { label: "Wastage", tone: "danger" },
  sale: { label: "Sale consumption", tone: "default" },
  production: { label: "Production", tone: "accent" },
  return: { label: "Return", tone: "default" },
};
const TYPE_ORDER = Object.keys(TYPES) as MovementType[];

const ALL = "all";

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

function movementValue(m: StockMovement): string {
  return m.type === "transfer" ? "At cost · net 0" : money(m.value);
}

/** Facts of the movement panel (artifact: ij-kv under the movement id). */
function movementFacts(m: StockMovement) {
  const facts = [
    { label: "Recorded", value: `Today ${m.time}:12 · ${m.by}` },
    { label: "Item", value: m.item },
    { label: "Location", value: m.location },
    { label: "Quantity", value: m.recipeUnit ? `${m.qty} · recipe unit ${m.recipeUnit}` : m.qty },
    { label: "Value at cost", value: m.type === "transfer" ? `${money(m.value)} moved, net 0` : money(m.value) },
    { label: "Source", value: m.source },
    { label: "Note", value: m.note },
  ];
  if (m.type === "sale" && !m.reversal)
    facts.push({ label: "Event ID", value: "Unique · a retried event is ignored, never deducted twice" });
  return facts;
}

/** Downloads the listed movements as a CSV file. */
function exportCsv(rows: StockMovement[]) {
  const head = [
    "Movement",
    "Time",
    "Type",
    "Item",
    "Location",
    "Quantity",
    "Value (RWF)",
    "Source",
    "Recorded by",
    "Note",
  ];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((m) =>
    [
      m.id,
      m.time,
      m.reversal ? "Reversal" : TYPES[m.type].label,
      m.item,
      m.location,
      m.qty,
      m.value,
      m.source,
      m.by,
      m.note,
    ]
      .map(cell)
      .join(","),
  );
  const blob = new Blob([[head.map(cell).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stock-movements-2026-10-12.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function StockLedgerView({ data, initialTab }: { data: StockLedgerData; initialTab: LedgerTab }) {
  const [tab, setTab] = useState<LedgerTab>(initialTab);
  const [sel, setSel] = useState("MV-26-21890");
  const [off, setOff] = useState<Partial<Record<MovementType, boolean>>>({});
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState(ALL);
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.countLines.map((c) => [c.id, String(c.counted)])),
  );
  const [reasons, setReasons] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(data.countLines.map((c) => [c.id, c.reason])),
  );
  const [countSent, setCountSent] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.movements.filter(
      (m) =>
        !off[m.type] &&
        (location === ALL || m.locations.includes(location)) &&
        (!needle || [m.id, m.item, m.source, m.location].some((s) => s.toLowerCase().includes(needle))),
    );
  }, [data.movements, off, location, search]);
  const mv = data.movements.find((m) => m.id === sel) ?? data.movements[0];

  // Blind count CNT-0418: variance per line at cost; every variance needs a reason before submitting.
  let net = 0;
  let missing = 0;
  let entered = 0;
  const countRows = data.countLines.map((c) => {
    const text = counts[c.id] ?? "";
    if (text.trim()) entered += 1;
    const n = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
    const counted = Number.isNaN(n) ? 0 : n;
    const d = counted - c.system;
    const value = d * c.unitCost;
    net += value;
    const reason = reasons[c.id] ?? null;
    if (d !== 0 && !reason) missing += 1;
    return { ...c, text, d, value, reason };
  });
  const canSubmit = !missing && !countSent;
  const countHint = missing
    ? `${missing} ${missing === 1 ? "line needs" : "lines need"} a reason before you can submit`
    : countSent
      ? "Adjustments post after approval"
      : "Goes to Aline Uwase, general manager, for review";

  const tabs: { id: LedgerTab; label: string; badge: string }[] = [
    { id: "mv", label: "Movements", badge: `${data.movements.length} today` },
    { id: "count", label: "Count CNT-0418", badge: countSent ? "Submitted" : "Open" },
    { id: "tr", label: "Transfers", badge: String(data.transfers.length) },
  ];

  return (
    <PageContent className="text-sm">
      {countSent ? (
        <TopbarStatus kind="chip" tone="default" icon="ListCheck" label="Count CNT-0418 submitted · dry store" />
      ) : null}
      <PageHeader
        eyebrow="Stock › Ledger · all Isangano locations · Monday 12 October 2026"
        title="Stock Ledger"
        actions={
          <>
            <Button variant="secondary" onPress={() => exportCsv(rows)}>
              <ArrowDownToLine className="size-4" />
              Export
            </Button>
            <Button onPress={() => setTab("tr")}>
              <ArrowRightArrowLeft className="size-4" />
              New transfer
            </Button>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as LedgerTab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Ledger views">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                {t.label}
                <TabCount>{t.badge}</TabCount>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="mv" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField aria-label="Search movements" value={search} onChange={setSearch} className="w-[240px]">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Item, movement or source" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ToggleButtonGroup
              aria-label="Movement types"
              selectionMode="multiple"
              isDetached
              size="sm"
              selectedKeys={TYPE_ORDER.filter((t) => !off[t])}
              onSelectionChange={(keys) =>
                setOff(Object.fromEntries(TYPE_ORDER.map((t) => [t, !keys.has(t)])) as Record<MovementType, boolean>)
              }
              className="flex-wrap"
            >
              {TYPE_ORDER.map((t) => (
                <ToggleButton key={t} id={t}>
                  {TYPES[t].label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Select
              aria-label="Location and period"
              value={location}
              onChange={(k) => k != null && setLocation(String(k))}
              className="ml-auto min-w-[170px]"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={ALL} textValue="All locations · today">
                    All locations · today
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {data.locations.map((l) => (
                    <ListBox.Item key={l.id} id={l.id} textValue={`${l.name} · today`}>
                      {l.name} · today
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,8fr)_minmax(300px,4fr)]">
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Stock movements"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={new Set([mv.id])}
                  onSelectionChange={(keys) => {
                    const id = firstKey(keys as "all" | Set<Key>);
                    if (id) setSel(id);
                  }}
                >
                  <Table.Header>
                    <Table.Column>Time</Table.Column>
                    <Table.Column isRowHeader>Movement</Table.Column>
                    <Table.Column>Item and location</Table.Column>
                    <Table.Column className="text-right">Quantity</Table.Column>
                    <Table.Column className="text-right">Value</Table.Column>
                    <Table.Column>Source</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <p className="py-6 text-center text-sm text-muted">No movements match these filters.</p>
                    )}
                  >
                    {rows.map((m) => (
                      <Table.Row key={m.id} id={m.id} className={selectableRow}>
                        <Table.Cell className="tabular">{m.time}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col items-start gap-0.5">
                            <span className="font-semibold whitespace-nowrap tabular">{m.id}</span>
                            <ToneChip tone={TYPES[m.type].tone}>
                              {m.reversal ? "Reversal" : TYPES[m.type].label}
                            </ToneChip>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{m.item}</span>
                            <Muted>{m.location}</Muted>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">{m.qty}</Table.Cell>
                        <Table.Cell className="text-right tabular">{movementValue(m)}</Table.Cell>
                        <Table.Cell className="text-xs tabular">{m.source}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>

            <Card className="gap-3 p-[18px]" aria-labelledby="mv-h">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <Muted>Movement</Muted>
                  <h2 id="mv-h" className="text-lg leading-6 font-semibold tabular">
                    {mv.id}
                  </h2>
                </div>
                <Chip variant="soft" color={toneColor(TYPES[mv.type].tone)}>
                  {TYPES[mv.type].label}
                </Chip>
              </div>
              <KeyValueList items={movementFacts(mv)} />
              <ItemCard variant="secondary">
                <ItemCard.Icon>
                  <Lock />
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>Locked record</ItemCard.Title>
                  <ItemCard.Description className="whitespace-normal">
                    It cannot be edited or deleted. A correction is a new adjustment that references it, needs a reason
                    and, above RWF 50,000, the general manager.
                  </ItemCard.Description>
                </ItemCard.Content>
              </ItemCard>
              <Button variant="secondary" className="self-start">
                <ArrowUturnCcwLeft className="size-4" />
                Post a correcting adjustment
              </Button>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="count" className="pt-4">
          <Card className="gap-3.5 p-[18px]" aria-labelledby="cnt-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle id="cnt-h" title="Count CNT-0418 · dry store">
                Blind count started 07:30 by Patrick Nshimiyimana · second counter Beatrice Mukandori · stock frozen for
                this location while counting
              </SectionTitle>
              <Chip variant="soft" color={countSent ? "warning" : "accent"}>
                {countSent
                  ? "Waiting for Aline Uwase"
                  : `Counting · ${entered} of ${data.countLines.length} lines entered`}
              </Chip>
            </div>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-labelledby="cnt-h">
                  <Table.Header>
                    <Table.Column isRowHeader>Item</Table.Column>
                    <Table.Column className="text-right">System</Table.Column>
                    <Table.Column>Counted</Table.Column>
                    <Table.Column className="text-right">Variance</Table.Column>
                    <Table.Column className="text-right">Value at cost</Table.Column>
                    <Table.Column>Reason</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {countRows.map((c) => (
                      <Table.Row key={c.id} id={c.id}>
                        <Table.Cell className="font-medium">{c.item}</Table.Cell>
                        <Table.Cell className="text-right tabular">{c.system}</Table.Cell>
                        <Table.Cell>
                          <TextField
                            aria-label={`Counted ${c.item}`}
                            value={c.text}
                            onChange={(v) => setCounts((cur) => ({ ...cur, [c.id]: v }))}
                            isReadOnly={countSent}
                          >
                            <Input className="w-24 tabular" inputMode="decimal" />
                          </TextField>
                        </Table.Cell>
                        <Table.Cell className={`text-right tabular ${c.d ? "font-semibold" : ""}`}>
                          {signedQty(c.d)}
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{c.d ? money(c.value) : "—"}</Table.Cell>
                        <Table.Cell className="min-w-[200px]">
                          {c.d !== 0 ? (
                            <Select
                              fullWidth
                              aria-label={`Reason for ${c.item}`}
                              placeholder="Choose a reason"
                              value={c.reason}
                              isInvalid={!c.reason}
                              isDisabled={countSent}
                              onChange={(k) => k != null && setReasons((cur) => ({ ...cur, [c.id]: String(k) }))}
                            >
                              <Select.Trigger className="text-[13px]">
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {data.reasons.map((r) => (
                                    <ListBox.Item key={r.id} id={r.label} textValue={r.label}>
                                      {r.label}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          ) : (
                            <Muted>Agrees</Muted>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="font-semibold">
                Net variance <span className="tabular">{money(net)}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Muted className={missing ? "text-danger" : ""}>
                  <span role="status">{countHint}</span>
                </Muted>
                <Button onPress={() => setCountSent(true)} isDisabled={!canSubmit}>
                  {countSent ? "Submitted" : "Submit variances"}
                </Button>
              </div>
            </div>
            <p className="text-xs leading-4 text-muted">
              The count never changes stock by itself. Approved variances post as adjustment movements with the reason,
              and the count is kept as evidence.
            </p>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="tr" className="flex flex-col gap-4 pt-4">
          <Alert status="accent">
            <Alert.Indicator>
              <ArrowRightArrowLeft />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Internal transfer · not a sale</Alert.Title>
              <Alert.Description>
                Stock moves at cost between locations of Amahoro Hospitality Ltd. No fiscal receipt, no VAT invoice and
                no revenue are created.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
            {data.transfers.map((t) => {
              const after = t.onDispatch && dispatched ? t.onDispatch : null;
              const state = after ? after.state : t.state;
              const tone = after ? after.tone : t.tone;
              const steps = after ? after.steps : t.steps;
              const total = t.lines.reduce((sum, l) => sum + l.value, 0);
              return (
                <Card key={t.id} className="gap-3 p-[18px]" aria-labelledby={`${t.id}-h`}>
                  <div className="flex items-start justify-between gap-3">
                    <SectionTitle id={`${t.id}-h`} title={<span className="tabular">{t.id}</span>}>
                      {t.route}
                    </SectionTitle>
                    <Chip variant="soft" color={toneColor(tone)} className="shrink-0">
                      {state}
                    </Chip>
                  </div>
                  <KvRows
                    items={[
                      ...t.lines.map((l) => ({ key: l.label, label: l.label, value: money(l.value) })),
                      { key: "total", label: "Total at weighted average cost", value: money(total) },
                    ]}
                  />
                  <Timeline size="sm" density="compact">
                    {steps.map((s) => (
                      <Timeline.Item key={s.title} status={s.status}>
                        <Timeline.Rail>
                          <Timeline.Marker />
                          <Timeline.Connector />
                        </Timeline.Rail>
                        <Timeline.Content className="flex flex-col pb-0.5">
                          <span className="text-[13px] leading-[18px] font-medium">{s.title}</span>
                          <Muted>{s.detail}</Muted>
                        </Timeline.Content>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                  {t.onDispatch && !dispatched ? (
                    <Button onPress={() => setDispatched(true)} className="self-start">
                      <ArrowRightFromSquare className="size-4" />
                      Dispatch
                    </Button>
                  ) : null}
                  <Muted>{t.tax}</Muted>
                </Card>
              );
            })}
          </div>
          <p className="text-[13px] leading-[18px] text-muted">
            Supplying another legal entity, such as Ikawa Corner Ltd, is not a transfer. It is a sale that Finance
            invoices with a fiscal receipt.
          </p>
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}
