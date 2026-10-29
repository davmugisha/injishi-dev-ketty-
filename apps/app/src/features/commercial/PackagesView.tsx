"use client";

import { Cup, Plus, ShieldExclamation, TrashBin, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Table } from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, KPIGroup, ListView, Segment } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import type {
  PackagesItem,
  PackagesNoticeTier,
  PackagesNoticeTierId,
  PackagesSellerKind,
  PackagesStatus,
  PackagesWeekend,
  Tone,
} from "@injishi/product-pms";
import { useBoardHref, usePmsActions } from "@injishi/product-pms/web";
import {
  formatNumber,
  formatRwf,
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  toneColor,
} from "@injishi/ui";
import { Fragment, useMemo, useState, useTransition } from "react";
import { PackagesNewDialog } from "./PackagesNewDialog";

const PACKAGES_STATUS: Record<PackagesStatus, { label: string; tone: Tone }> = {
  "on-sale": { label: "On sale", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  draft: { label: "Draft", tone: "default" },
};

const PACKAGES_SELLER_KIND: Record<PackagesSellerKind, { label: string; tone: Tone }> = {
  hotel: { label: "Hotel", tone: "default" },
  outlet: { label: "In-house outlet", tone: "default" },
  tenant: { label: "Tenant outlet", tone: "info" },
  "third-party": { label: "Third party", tone: "warning" },
  none: { label: "No seller", tone: "danger" },
};

/** Component colours, in order (price build-up bar and table legend). */
const PACKAGES_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const colorAt = (i: number) => PACKAGES_COLORS[i % PACKAGES_COLORS.length];

function StatusChip({ status }: { status: PackagesStatus }) {
  const s = PACKAGES_STATUS[status];
  return (
    <Chip size="sm" variant="soft" color={toneColor(s.tone)}>
      {s.label}
    </Chip>
  );
}

function listSummary(packages: PackagesItem[]): string {
  const count = (status: PackagesStatus) => packages.filter((p) => p.status === status).length;
  const drafts = count("draft");
  return `${count("on-sale")} on sale · ${count("paused")} paused · ${drafts} ${drafts === 1 ? "draft" : "drafts"}`;
}

export function PackagesView({
  packages,
  weekends,
  tiers,
}: {
  packages: PackagesItem[];
  weekends: PackagesWeekend[];
  tiers: PackagesNoticeTier[];
}) {
  const screenHref = useBoardHref();
  const [selectedId, setSelectedId] = useState(packages[0]?.id ?? "");
  const [tier, setTier] = useState<PackagesNoticeTierId>(tiers[0]?.id ?? "over-7-days");
  const [isNewOpen, setNewOpen] = useState(false);

  const pkg = packages.find((p) => p.id === selectedId) ?? packages[0];
  const weekendPackage = packages.find((p) => p.id === weekends[0]?.packageId);
  const perOptions = useMemo(() => [...new Set(packages.map((p) => p.per))], [packages]);

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Commercial"
        title="Packages"
        description="Rooms sold together with meals, activities or events. Each part keeps its own seller, tax treatment and refund share."
        actions={
          <>
            <LinkButton href={screenHref("RatesInventory")} variant="secondary">
              <Cup className="size-4" />
              Meal plans
            </LinkButton>
            <Button onPress={() => setNewOpen(true)}>
              <Plus className="size-4" />
              New package
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex max-w-[360px] min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="list-h">
            <ItemCardGroup layout="list" className="overflow-hidden">
              <ItemCardGroup.Header>
                <ItemCardGroup.Title id="list-h" aria-level={2}>
                  All Packages
                </ItemCardGroup.Title>
                <ItemCardGroup.Description>{listSummary(packages)}</ItemCardGroup.Description>
              </ItemCardGroup.Header>
              {packages.map((p) => {
                const selected = p.id === pkg?.id;
                return (
                  <ItemCard<"button">
                    key={p.id}
                    // Selectable package row: HeroUI's documented pressable ItemCard (render as a button).
                    render={(props) => <button type="button" {...props} />} // heroui-ok
                    aria-pressed={selected}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full cursor-pointer flex-wrap border-t border-separator text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset ${
                      selected ? "bg-surface-secondary" : "hover:bg-surface-secondary/60"
                    }`}
                  >
                    <ItemCard.Icon>
                      <Icon name={p.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content className="basis-[calc(100%-48px)]">
                      <ItemCard.Title>{p.name}</ItemCard.Title>
                      <ItemCard.Description className="max-w-full tabular">
                        {p.code} · {formatRwf(p.price)} · {p.sold}
                      </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action className="ml-auto">
                      <StatusChip status={p.status} />
                    </ItemCard.Action>
                  </ItemCard>
                );
              })}
            </ItemCardGroup>
          </section>

          {weekendPackage && weekends.length ? (
            <Card aria-labelledby="wk-h" className="gap-2.5 p-[18px]">
              <Card.Header>
                <Card.Title<"h2"> id="wk-h" render={(props) => <h2 {...props} />} className="text-[15px] font-semibold">
                  Sellable Weekends
                </Card.Title>
                <Card.Description>{weekendPackage.name} · lowest availability of any component</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                {weekends.map((w) => (
                  <div key={w.id} className="flex items-center gap-2.5 border-t border-separator pt-2">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[13px] font-medium tabular">{w.dates}</span>
                      <span className="text-xs leading-4 text-muted">{w.reason}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={toneColor(w.tone)} className="tabular">
                      {w.availability}
                    </Chip>
                  </div>
                ))}
              </Card.Content>
            </Card>
          ) : null}
        </div>

        {pkg ? (
          <PackagesDetail
            pkg={pkg}
            tiers={tiers}
            tier={tier}
            onTierChange={setTier}
            onDiscarded={() => setSelectedId(packages[0]?.id ?? "")}
          />
        ) : null}
      </div>

      <PackagesNewDialog
        isOpen={isNewOpen}
        onOpenChange={setNewOpen}
        perOptions={perOptions}
        onCreated={(id) => setSelectedId(id)}
      />
    </PageContent>
  );
}

function PackagesDetail({
  pkg,
  tiers,
  tier,
  onTierChange,
  onDiscarded,
}: {
  pkg: PackagesItem;
  tiers: PackagesNoticeTier[];
  tier: PackagesNoticeTierId;
  onTierChange: (tier: PackagesNoticeTierId) => void;
  onDiscarded: () => void;
}) {
  const { discardPackagesDraft } = usePmsActions();
  const [discarding, startDiscard] = useTransition();
  const comps = pkg.components;
  const aloneTotal = comps.reduce((a, c) => a + c.alone, 0);
  const shareTotal = comps.reduce((a, c) => a + c.share, 0);
  const saving = aloneTotal - pkg.price;
  const savingPct = aloneTotal ? Math.round((saving / aloneTotal) * 100) : 0;
  const barLabel = `Package price split: ${comps.map((c) => `${c.name} ${formatRwf(c.share)}`).join(", ")}`;

  const refundRows = comps.map((c) => ({
    id: c.id,
    name: c.name,
    rule: `${c.seller} · ${c.refundRule}`,
    amount: c.refunds ? formatNumber(c.refunds[tier]) : "Unknown",
  }));
  const unknown = comps.filter((c) => !c.refunds).length;
  const refundTotal = comps.reduce((a, c) => a + (c.refunds ? c.refunds[tier] : 0), 0);
  const keptBy = new Map<string, number>();
  for (const c of comps) {
    if (!c.refunds) continue;
    const kept = c.share - c.refunds[tier];
    if (kept > 0) keptBy.set(c.seller, (keptBy.get(c.seller) ?? 0) + kept);
  }
  const kept = keptBy.size
    ? [...keptBy].map(([seller, amount]) => `${seller} ${formatRwf(amount)}`).join(" · ")
    : "Nothing kept";
  const refundOwed = `${formatRwf(refundTotal)}${
    unknown ? ` plus ${unknown} ${unknown === 1 ? "component" : "components"} with unknown terms` : ""
  }`;

  return (
    <section className="flex min-w-0 flex-[999_1_620px] flex-col gap-4" aria-labelledby="pk-h">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-[min(260px,100%)] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pk-h" className="text-xl leading-7 font-semibold">
              {pkg.name}
            </h2>
            <StatusChip status={pkg.status} />
          </div>
          <span className="text-[13px] text-muted tabular">
            {pkg.code} · {pkg.summary}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[22px] leading-[30px] font-[650] tabular">{formatRwf(pkg.price)}</span>
          <span className="text-xs text-muted">{pkg.per}</span>
        </div>
      </div>

      {pkg.alert ? (
        <Alert status={pkg.alert.tone} role="status">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{pkg.alert.title}</Alert.Title>
            <Alert.Description>{pkg.alert.description}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <KPIGroup className="flex-wrap" aria-label="Package terms">
        {pkg.facts.map((f, i) => (
          <Fragment key={f.label}>
            {i > 0 ? <KPIGroup.Separator /> : null}
            <KPI className="min-w-[180px] flex-[1_1_180px] gap-0">
              <KPI.Title>{f.label}</KPI.Title>
              <dd className="mt-1 text-[13px] leading-[18px] font-medium">{f.value}</dd>
            </KPI>
          </Fragment>
        ))}
      </KPIGroup>

      {comps.length === 0 ? (
        <Card>
          <EmptyState>
            <EmptyState.Media variant="icon">
              <Icon name="Gift" className="size-5" />
            </EmptyState.Media>
            <EmptyState.Header>
              <EmptyState.Title>No components yet</EmptyState.Title>
              <EmptyState.Description>
                Add each room, meal or activity this package sells. The price build-up and cancellation refunds appear
                once every part has a seller, a tax classification and refund terms.
              </EmptyState.Description>
            </EmptyState.Header>
            {pkg.status === "draft" ? (
              <EmptyState.Content>
                <Button
                  size="sm"
                  variant="danger-soft"
                  isPending={discarding}
                  onPress={() =>
                    startDiscard(async () => {
                      await discardPackagesDraft(pkg.id);
                      onDiscarded();
                    })
                  }
                >
                  <TrashBin className="size-4" />
                  Discard draft
                </Button>
              </EmptyState.Content>
            ) : null}
          </EmptyState>
        </Card>
      ) : (
        <>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={`${pkg.name} components`}>
                <Table.Header>
                  <Table.Column isRowHeader>Component</Table.Column>
                  <Table.Column>Seller</Table.Column>
                  <Table.Column>Tax classification</Table.Column>
                  <Table.Column>Availability</Table.Column>
                  <Table.Column className="text-right">Share (RWF)</Table.Column>
                </Table.Header>
                <Table.Body>
                  {comps.map((c, i) => {
                    const kind = PACKAGES_SELLER_KIND[c.sellerKind];
                    return (
                      <Table.Row key={c.id} id={c.id}>
                        <Table.Cell>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="size-2.5 shrink-0 rounded-[3px]"
                              style={{ background: colorAt(i) }}
                            />
                            <span className="font-medium">{c.name}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-0.5">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px]">{c.seller}</span>
                              <Chip size="sm" variant="soft" color={toneColor(kind.tone)}>
                                {kind.label}
                              </Chip>
                            </span>
                            <span className="text-xs text-muted tabular">{c.sellerDetail}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col items-start gap-1">
                            <span className="text-[13px] tabular">{c.tax}</span>
                            {c.taxNeedsVerification ? (
                              <GateChip icon={<ShieldExclamation className="size-3" />}>Needs verification</GateChip>
                            ) : null}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex items-start gap-1.5">
                            <StatusDot tone={c.availabilityTone} className="mt-[6px]" />
                            <span className="text-[13px] leading-[18px]">{c.availability}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="font-semibold">{formatNumber(c.share)}</span>
                            <span className="text-xs text-muted">alone {formatNumber(c.alone)}</span>
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
            <Card aria-labelledby="pb-h" className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="pb-h" className="text-[15px] font-semibold">
                  Price Build-up
                </Card.Title>
                <Card.Description>How the package price is split between components</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <div role="img" aria-label={barLabel} className="overflow-hidden rounded-full">
                  <BarChart
                    data={[Object.fromEntries([["label", "split"], ...comps.map((c) => [c.id, c.share])])]}
                    height={14}
                    layout="vertical"
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  >
                    <BarChart.XAxis type="number" hide domain={[0, shareTotal]} />
                    <BarChart.YAxis type="category" dataKey="label" hide />
                    {comps.map((c, i) => (
                      <BarChart.Bar
                        key={c.id}
                        dataKey={c.id}
                        name={c.name}
                        stackId="split"
                        barSize={14}
                        fill={colorAt(i)}
                        stroke="var(--surface)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                    <BarChart.Tooltip
                      cursor={false}
                      content={<BarChart.TooltipContent valueFormatter={(v) => formatRwf(Number(v))} />}
                    />
                  </BarChart>
                </div>
                <KeyValueList
                  items={[
                    { label: "Bought separately", value: <span className="tabular">{formatRwf(aloneTotal)}</span> },
                    { label: "Package price", value: <span className="tabular">{formatRwf(pkg.price)}</span> },
                    {
                      label: "Package saving",
                      value: (
                        <span className="tabular">
                          {formatRwf(saving)} · {savingPct}%
                        </span>
                      ),
                    },
                    { label: "Discount taken from", value: pkg.discountFrom },
                  ]}
                />
                <p className="text-xs leading-4 text-muted">
                  Each seller’s share is what its fiscal receipt and revenue posting will show. Prices include taxes as
                  configured per classification.
                </p>
              </Card.Content>
            </Card>

            <Card aria-labelledby="rf-h" className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="rf-h" className="text-[15px] font-semibold">
                  If the Guest Cancels
                </Card.Title>
                <Card.Description>Refund owed per component, by notice given</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <Segment
                  aria-label="Notice given before arrival"
                  size="sm"
                  className="max-w-full self-start"
                  selectedKey={tier}
                  onSelectionChange={(k) => onTierChange(k as PackagesNoticeTierId)}
                >
                  {tiers.map((t) => (
                    <Segment.Item key={t.id} id={t.id}>
                      {t.label}
                    </Segment.Item>
                  ))}
                </Segment>
                <ListView
                  aria-label="Refund owed per component"
                  variant="secondary"
                  items={refundRows}
                  dependencies={[tier]}
                >
                  {(r) => (
                    <ListView.Item id={r.id} textValue={r.name}>
                      <ListView.ItemContent>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <ListView.Title>{r.name}</ListView.Title>
                          <ListView.Description>{r.rule}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction className="font-semibold tabular">{r.amount}</ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
                <KeyValueList
                  items={[
                    { label: "Refund owed", value: <span className="tabular">{refundOwed}</span> },
                    { label: "Kept by sellers", value: <span className="tabular">{kept}</span> },
                  ]}
                />
                <p className="text-xs leading-4 text-muted">
                  This works out eligibility only. Finance issues each refund against that seller’s payment; a
                  third-party refund waits for the operator’s confirmation.
                </p>
              </Card.Content>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
