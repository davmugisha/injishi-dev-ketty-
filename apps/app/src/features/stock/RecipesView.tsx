"use client";

import {
  ArrowsRotateRight,
  Check,
  CircleCheck,
  CirclePlay,
  FilePlus,
  Plus,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Description, Label, ListBox, Table } from "@heroui/react";
import { ItemCard, KPIGroup, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import type { PosEvent, ProductionBatch, Recipe, RecipeIngredient } from "@injishi/data/fixtures/stock";
import { formatNumber, Icon, KeyValueList, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, type Key, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { KvRows, Muted, money, SectionTitle, ToneChip } from "./shared";

interface RecipesData {
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  batch: ProductionBatch;
  events: PosEvent[];
}

type Basis = "avg" | "inv";
type BatchState = "planned" | "running" | "done";

const BATCH: Record<BatchState, { label: string; tone: "default" | "accent" | "success" }> = {
  planned: { label: "Planned", tone: "default" },
  running: { label: "In progress · inputs reserved", tone: "accent" },
  done: { label: "Completed", tone: "success" },
};

/** Replays the storekeeper may trigger in the demo; each is ignored as a duplicate. */
const MAX_REPLAYS = 3;

const RWF = { style: "currency", currency: "RWF" } as const;

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

export function RecipesView({ data }: { data: RecipesData }) {
  const [rec, setRec] = useState(data.recipes[0]?.id ?? "");
  const [portions, setPortions] = useState(1);
  const [basis, setBasis] = useState<Basis>("avg");
  const [batch, setBatch] = useState<BatchState>("planned");
  const [yieldL, setYieldL] = useState(data.batch.plannedYield);
  const [replays, setReplays] = useState(0);
  const [mapped, setMapped] = useState(false);

  // Costed recipe: every ingredient converted from recipe units to stock units at the chosen cost basis.
  const costed = data.recipes.find((r) => r.costed) ?? data.recipes[0];
  const ings = data.ingredients.filter((g) => g.recipe === costed.id);
  const costOf = (g: RecipeIngredient) => (g.qty / g.perStockUnit) * (basis === "avg" ? g.costAvg : g.costLatest);
  const unitCost = ings.reduce((sum, g) => sum + costOf(g), 0);
  const net = (costed.menuPrice ?? 0) / (1 + (costed.vatRate ?? 0));
  const pct = net ? (unitCost / net) * 100 : 0;
  const target = costed.target ?? 0;
  const lead = ings[0];

  const metaOf = (r: Recipe) => {
    if (r.costed) return `Menu ${money(r.menuPrice ?? 0)} · food cost ${pct.toFixed(0)}%`;
    if (r.unmapped && mapped) return r.mappedMeta ?? r.meta ?? "";
    return r.meta ?? "";
  };
  const warnOf = (r: Recipe) => (r.costed ? pct > target : r.unmapped ? !mapped : r.warn);

  const recipe = data.recipes.find((r) => r.id === rec) ?? data.recipes[0];
  const facts = recipe.facts.map((f) => ({
    label: f.label,
    value: mapped && f.mappedValue ? f.mappedValue : f.value,
  }));

  const inputCost = data.batch.inputs.reduce((sum, i) => sum + i.cost, 0);
  const perL = money(inputCost / yieldL);
  const yieldTxt = `${yieldL.toFixed(1)} L`;

  const replayEvents: PosEvent[] = Array.from({ length: replays }, (_, i) => ({
    id: `replay-${i + 1}`,
    title: `${data.events[0]?.title ?? ""} · replay ${i + 1}`,
    icon: "CopyCheck",
    detail: `Replayed by you at 20:0${i} · already posted, no second deduction · logged for audit`,
    state: "Duplicate ignored",
    tone: "default",
    needsRecipe: false,
    resolved: null,
  }));
  const events = [...replayEvents, ...data.events].map((e) =>
    e.needsRecipe && mapped && e.resolved ? { ...e, ...e.resolved, needsRecipe: false } : e,
  );

  const econ = [
    {
      id: "cost",
      label: "Cost per portion",
      value: unitCost,
      format: RWF,
      foot:
        portions > 1
          ? `${portions} portions: ${money(unitCost * portions)}`
          : basis === "avg"
            ? "Weighted average stock cost"
            : `${lead?.name.split(",")[0] ?? "Main item"} at the latest invoice price`,
    },
    {
      id: "price",
      label: "Menu price",
      value: costed.menuPrice ?? 0,
      format: RWF,
      foot: `Includes VAT 18% · net ${money(net)}`,
    },
    {
      id: "food",
      label: "Food cost",
      value: pct / 100,
      format: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 } as const,
      foot: `Cost against net price · target ${target}%`,
    },
    {
      id: "margin",
      label: "Margin per portion",
      value: net - unitCost,
      format: RWF,
      foot: `${(100 - pct).toFixed(0)}% of net price`,
    },
  ];

  return (
    <PageContent className="text-sm">
      {mapped ? <TopbarStatus kind="chip" tone="success" icon="CircleCheck" label="All sales have a recipe" /> : null}
      <PageHeader
        eyebrow="Stock › Recipes and production · Isangano Terrace kitchen"
        title="Recipes and Production"
        description="Recipes turn confirmed sales into stock consumption. Batches turn ingredients into prepared stock. Neither is a sale."
        actions={
          <>
            <Button variant="secondary">
              <Plus className="size-4" />
              New batch
            </Button>
            <Button>
              <FilePlus className="size-4" />
              New recipe
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="Recipes">
          <ListBox
            aria-label="Choose a recipe"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([recipe.id])}
            onSelectionChange={(keys) => {
              const id = firstKey(keys as "all" | Set<Key>);
              if (id) setRec(id);
            }}
            className="gap-1 p-0"
          >
            {data.recipes.map((r) => (
              <ListBox.Item
                key={r.id}
                id={r.id}
                textValue={r.name}
                className="min-h-14 items-start gap-2.5 rounded-xl px-2.5 py-2 data-[selected=true]:bg-default"
              >
                <Icon name={r.icon} className="mt-0.5 size-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <Label className="leading-[18px] font-medium">{r.name}</Label>
                  <Description className="text-xs leading-4 tabular">{metaOf(r)}</Description>
                </span>
                {warnOf(r) ? (
                  <TriangleExclamation
                    role="img"
                    aria-label="Needs attention"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                ) : null}
              </ListBox.Item>
            ))}
          </ListBox>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-3.5 p-5" aria-labelledby="rec-h">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 id="rec-h" className="text-xl leading-[26px] font-semibold">
                  {recipe.name}
                </h2>
                <span className="text-[13px] text-muted">{recipe.context}</span>
              </div>
              <Chip variant="soft">{recipe.version}</Chip>
            </div>

            {recipe.costed ? (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  <NumberStepper
                    size="sm"
                    value={portions}
                    onChange={(v) => setPortions(Number.isNaN(v) ? 1 : v)}
                    minValue={1}
                    maxValue={20}
                    className="flex flex-row items-center gap-2"
                  >
                    <Label>Portions</Label>
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label="Fewer portions" />
                      <NumberStepper.Value />
                      <NumberStepper.IncrementButton aria-label="More portions" />
                    </NumberStepper.Group>
                  </NumberStepper>
                  <Muted>{recipe.yieldNote}</Muted>
                  <span className="flex-1" />
                  <Segment
                    size="sm"
                    aria-label="Cost basis"
                    selectedKey={basis}
                    onSelectionChange={(k) => setBasis(String(k) as Basis)}
                  >
                    <Segment.Item id="avg">Average cost {money(lead?.costAvg ?? 0)}</Segment.Item>
                    <Segment.Item id="inv">Latest invoice {money(lead?.costLatest ?? 0)}</Segment.Item>
                  </Segment>
                </div>

                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label={`${recipe.name} ingredients`}>
                      <Table.Header>
                        <Table.Column isRowHeader>Ingredient</Table.Column>
                        <Table.Column className="text-right">Recipe quantity</Table.Column>
                        <Table.Column>Stock unit and conversion</Table.Column>
                        <Table.Column className="text-right">Cost per stock unit</Table.Column>
                        <Table.Column className="text-right">Line cost</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {ings.map((g) => (
                          <Table.Row key={g.id} id={g.id}>
                            <Table.Cell>
                              <span className="flex flex-col">
                                <span className="font-medium">{g.name}</span>
                                {g.note ? <Muted>{g.note}</Muted> : null}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular">
                              {formatNumber(g.qty * portions, { maximumFractionDigits: 2 })} {g.unit}
                            </Table.Cell>
                            <Table.Cell className="text-[13px] tabular">{g.conversion}</Table.Cell>
                            <Table.Cell className="text-right tabular">
                              {money(basis === "avg" ? g.costAvg : g.costLatest)} a {g.stockUnit}
                            </Table.Cell>
                            <Table.Cell className="text-right font-medium tabular">
                              {money(costOf(g) * portions)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>

                <section aria-label="Recipe economics">
                  <KPIGroup className="flex-wrap">
                    {econ.map((e, i) => (
                      <Fragment key={e.id}>
                        {i > 0 ? <KPIGroup.Separator /> : null}
                        <KPI className="min-w-[min(160px,100%)] flex-[1_1_160px]">
                          <KPI.Header>
                            <KPI.Title>{e.label}</KPI.Title>
                          </KPI.Header>
                          <KPI.Content>
                            <KPI.Value value={e.value} formatOptions={e.format} className="text-[22px] tabular" />
                          </KPI.Content>
                          <KPI.Footer>
                            <p className="text-xs leading-4 text-muted">{e.foot}</p>
                          </KPI.Footer>
                        </KPI>
                      </Fragment>
                    ))}
                  </KPIGroup>
                </section>

                {pct > target ? (
                  <Alert status="warning">
                    <Alert.Indicator>
                      <TriangleExclamation />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>
                        Food cost {pct.toFixed(1)}% is above target
                        {basis === "inv" ? " at the latest invoice price" : ""}
                      </Alert.Title>
                      <Alert.Description>
                        Target 32% for mains. Options: a smaller fish (550 g), a price review in Menus and offers, or
                        the credit note requested on KFF-INV-2210.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </>
            ) : (
              <KeyValueList items={facts} />
            )}
          </Card>

          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <Card className="gap-3 p-[18px]" aria-labelledby="pb-h">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle id="pb-h" title={`Batch ${data.batch.id} · ${data.batch.product}`}>
                  {data.batch.plan}
                </SectionTitle>
                <ToneChip tone={BATCH[batch].tone} size="md" className="shrink-0">
                  {BATCH[batch].label}
                </ToneChip>
              </div>
              <KvRows
                items={data.batch.inputs.map((i) => ({ key: i.label, label: i.label, value: money(i.cost) }))}
                footer={{ label: "Input cost", value: money(inputCost) }}
              />
              {batch === "running" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <NumberStepper
                    size="sm"
                    value={yieldL}
                    onChange={(v) => !Number.isNaN(v) && setYieldL(Math.round(v * 10) / 10)}
                    minValue={data.batch.minYield}
                    maxValue={data.batch.maxYield}
                    step={0.1}
                    className="flex flex-row items-center gap-2"
                  >
                    <Label>Actual yield</Label>
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label="Less yield" />
                      <NumberStepper.Value className="min-w-11">{() => yieldTxt}</NumberStepper.Value>
                      <NumberStepper.IncrementButton aria-label="More yield" />
                    </NumberStepper.Group>
                  </NumberStepper>
                  <Muted className="tabular">{perL} a litre</Muted>
                </div>
              ) : null}
              {batch === "done" ? (
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      Batch completed · {yieldTxt} added at {perL} a litre
                    </Alert.Title>
                    <Alert.Description>
                      {data.batch.inputs.length} input movements and 1 output movement posted ({data.batch.movements}).
                      Internal production: no sale, no fiscal document.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {batch === "planned" ? (
                  <Button onPress={() => setBatch("running")}>
                    <CirclePlay className="size-4" />
                    Start batch · reserve inputs
                  </Button>
                ) : null}
                {batch === "running" ? (
                  <Button onPress={() => setBatch("done")}>
                    <Check className="size-4" />
                    Complete batch
                  </Button>
                ) : null}
                <Muted>{data.batch.lastBatch}</Muted>
              </div>
            </Card>

            <Card className="gap-3 p-[18px]" aria-labelledby="ev-h">
              <div className="flex items-start justify-between gap-2">
                <SectionTitle id="ev-h" title="Consumption From POS">
                  Each confirmed sale line has one event ID. Stock is deducted once per ID.
                </SectionTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onPress={() => setReplays((n) => Math.min(MAX_REPLAYS, n + 1))}
                  isDisabled={replays >= MAX_REPLAYS}
                >
                  <ArrowsRotateRight className="size-4" />
                  Replay last event
                </Button>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite">
                {events.map((e) => (
                  <li key={e.id}>
                    <ItemCard variant="secondary" className="items-start">
                      <ItemCard.Icon>
                        <Icon name={e.icon} />
                      </ItemCard.Icon>
                      <ItemCard.Content className="gap-0.5">
                        <ItemCard.Title className="text-[13px] whitespace-normal tabular">{e.title}</ItemCard.Title>
                        <ItemCard.Description className="whitespace-normal">{e.detail}</ItemCard.Description>
                      </ItemCard.Content>
                      <ItemCard.Action className="flex flex-col items-end gap-1.5">
                        <Chip size="sm" variant="soft" color={toneColor(e.tone)} className="whitespace-nowrap">
                          {e.state}
                        </Chip>
                        {e.needsRecipe ? (
                          <Button size="sm" variant="ghost" onPress={() => setMapped(true)}>
                            Map recipe
                          </Button>
                        ) : null}
                      </ItemCard.Action>
                    </ItemCard>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </PageContent>
  );
}
