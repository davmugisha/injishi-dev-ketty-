"use client";

import { Avatar, Card, Chip } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type {
  RentalsAttentionItem,
  RentalsAttentionKind,
  RentalsOverview,
  RentalsSetupView,
  RentalsSummary,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  CollectedVsExpectedBar,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  type KpiItem,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  toneColor,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { SetupChecklist } from "./SetupChecklist";
import { ATTENTION_HREF, ATTENTION_ICON, settingsHref } from "./shared";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const monthName = (key: string): string => MONTH.format(new Date(`${key}-15T12:00:00Z`));

function kpis(o: RentalsOverview): KpiItem[] {
  const last = o.months.at(-2);
  const change = o.rent.collectedChangePercent;
  return [
    { id: "properties", label: "Properties", value: o.properties, format: "count", icon: "House" },
    {
      id: "units",
      label: "Units",
      value: o.units,
      format: "count",
      icon: "FolderHouse",
      footnote: `${formatNumber(o.occupiedUnits)} occupied, ${formatNumber(o.vacantUnits)} vacant`,
    },
    { id: "tenants", label: "Tenants", value: o.tenants, format: "count", icon: "Persons" },
    {
      id: "occupancy",
      label: "Occupancy",
      value: o.occupancyPercent ?? 0,
      format: "percent",
      icon: "ChartColumn",
      progress: o.occupancyPercent ?? 0,
      footnote: o.occupancyPercent === null ? "No units yet" : undefined,
    },
    {
      id: "collected",
      label: "Collected",
      value: o.rent.collectedThisMonthRwf,
      icon: "Wallet",
      footnote: `of ${formatMoney(o.rent.expectedThisMonthRwf)} due in ${monthName(o.month)}`,
      ...(change !== null && last ? { trend: { percent: change, versus: `vs ${monthName(last.month)}` } } : {}),
      ...(o.months.filter((m) => m.collectedRwf > 0).length > 1 ? { spark: o.months.map((m) => m.collectedRwf) } : {}),
    },
    {
      id: "overdue",
      label: "Overdue",
      value: o.overdue.amountRwf,
      icon: "TriangleExclamation",
      status: o.overdue.amountRwf > 0 ? "danger" : undefined,
      footnote:
        o.overdue.charges > 0
          ? `${formatNumber(o.overdue.leases)} ${o.overdue.leases === 1 ? "tenant" : "tenants"} late`
          : "Nobody is late",
    },
  ];
}

function NeedsAttention({ items }: { items: RentalsAttentionItem[] }) {
  const router = useRouter();
  return (
    <SectionCard
      title="Needs attention"
      actions={items.length > 0 ? <Chip size="sm">{formatNumber(items.length)}</Chip> : null}
      contentClassName="gap-0"
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Icon name="CircleCheck" className="size-4 text-success" />
          Nothing needs you right now.
        </p>
      ) : (
        <ListView
          aria-label="Needs attention"
          variant="secondary"
          items={items.map((i) => ({ ...i, id: i.kind }))}
          onAction={(key) => {
            const link = ATTENTION_HREF[String(key) as RentalsAttentionKind];
            if (link) router.push(link.href);
          }}
        >
          {(item) => {
            const link = ATTENTION_HREF[item.kind];
            return (
              <ListView.Item
                id={item.id}
                textValue={item.title}
                className={link ? "cursor-pointer items-start" : "items-start"}
              >
                <ListView.ItemContent className="items-start gap-3">
                  <Avatar size="sm" variant="soft" color={toneColor(item.tone)} className="shrink-0">
                    <Avatar.Fallback>
                      <Icon name={ATTENTION_ICON[item.kind]} />
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <ListView.Title className="whitespace-normal">{item.title}</ListView.Title>
                    {item.detail ? (
                      <ListView.Description className="whitespace-normal">{item.detail}</ListView.Description>
                    ) : null}
                  </span>
                </ListView.ItemContent>
                {link ? (
                  <ListView.ItemAction className="self-center text-muted">
                    <Icon name="ChevronRight" />
                    <span className="sr-only">{link.label}</span>
                  </ListView.ItemAction>
                ) : null}
              </ListView.Item>
            );
          }}
        </ListView>
      )}
    </SectionCard>
  );
}

/**
 * The landlord's home (WP 2.2, after Dwella): a greeting with the business, the month's figures, rent
 * collected against expected over a year, what needs attention, the first-run checklist while setup is
 * not done, and the next things to do. Every figure is the API's; nothing here is sample data.
 */
export function LandlordHomeView({
  firstName,
  businessName,
  today,
  overview,
  summary,
  setup,
  canAddUnits,
}: {
  firstName: string;
  businessName: string;
  today: string;
  overview: RentalsOverview | null;
  summary: RentalsSummary | null;
  setup: RentalsSetupView | null;
  canAddUnits: boolean;
}) {
  const noUnits = overview ? overview.units === 0 : false;
  const setupOpen = setup !== null && !setup.complete;
  // While the checklist shows, setup and getting paid are on it: they are not listed twice.
  const attention = (summary?.attention ?? []).filter(
    (a) => !setupOpen || (a.kind !== "setup_incomplete" && a.kind !== "no_payout_account"),
  );
  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={
          <>
            {businessName} · {formatDay(today, "long")}
          </>
        }
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={noUnits ? "Add your units to start." : undefined}
        actions={
          <>
            {canAddUnits ? (
              <ActionLink href={`${screenHref("Units")}?blocks=1`} icon="LayoutCells" intent="ghost">
                Add a block
              </ActionLink>
            ) : null}
            <ActionLink href={settingsHref("getting-paid")} icon="Wallet">
              Getting paid
            </ActionLink>
            {canAddUnits ? (
              <ActionLink href={`${screenHref("Units")}?add=1`} icon="Plus" intent="primary">
                Add unit
              </ActionLink>
            ) : null}
          </>
        }
      />

      {overview ? (
        <KpiStrip label={`Your homes in ${monthName(overview.month)}`} items={kpis(overview)} />
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted">The money figures are for people who look after the money here.</p>
        </Card>
      )}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        {overview ? (
          <CollectedVsExpectedBar
            className="lg:col-span-2"
            title="Rent collected"
            description="Expected against collected, the last 12 months"
            data={overview.months.map((m) => ({ month: m.month, expected: m.expectedRwf, collected: m.collectedRwf }))}
            emptyAction={
              canAddUnits && noUnits ? (
                <ActionLink href={`${screenHref("Units")}?add=1`} icon="Plus" size="sm">
                  Add unit
                </ActionLink>
              ) : undefined
            }
          />
        ) : null}
        {/* On a phone, setup and what needs attention come before the chart. */}
        <div className={cx("order-first flex min-w-0 flex-col gap-5 lg:order-none", !overview && "lg:col-span-3")}>
          {setupOpen ? <SetupChecklist setup={setup} /> : null}
          {summary ? <NeedsAttention items={attention} /> : null}
        </div>
      </div>
    </PageContent>
  );
}
