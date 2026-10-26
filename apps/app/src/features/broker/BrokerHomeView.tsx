import { Card } from "@heroui/react";
import type { BrokerHomes, BrokerPlacementList, BrokerPlanOverview, BrokerSummary } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  EmptyBlock,
  formatDay,
  formatMoney,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
} from "@injishi/ui";
import NextLink from "next/link";
import { HomeCard } from "./HomeCard";
import { PlacementChip, starsWords } from "./shared";

const PLAN_NAME = { district: "District", province: "Province", country: "Country" } as const;

/**
 * The broker's home (2026-10-25): figures that click through to their lists, the newest homes on offer,
 * the plan in force with the next one up, and the latest placements.
 */
export function BrokerHomeView({
  firstName,
  summary,
  homes,
  placements,
  plan,
}: {
  firstName: string;
  summary: BrokerSummary;
  homes: BrokerHomes;
  placements: BrokerPlacementList;
  plan: BrokerPlanOverview;
}) {
  const newest = homes.homes.slice(0, 4);
  const recent = placements.placements.slice(0, 5);
  const current = plan.current;
  // The name the broker registered with (their ID), else the account's.
  const first = summary.name?.trim().split(/\s+/)[0] || firstName;
  return (
    <PageContent>
      <PageHeader
        size="hello"
        title={first ? `Welcome back, ${first}` : "Welcome back"}
        actions={
          <ActionLink href={screenHref("BrokerDirectory")} icon="Magnifier" intent="primary">
            Find homes
          </ActionLink>
        }
      />
      <KpiStrip
        label="Your work"
        items={[
          {
            id: "homes",
            label: "Homes on offer",
            value: summary.homesInScope,
            format: "count",
            icon: "FolderHouse",
            href: screenHref("BrokerDirectory"),
            footnote: summary.scope.area,
          },
          {
            id: "open",
            label: "Open placements",
            value: summary.openPlacements,
            format: "count",
            icon: "Persons",
            href: screenHref("BrokerPlacements"),
          },
          {
            id: "owed",
            label: "Fees owed to you",
            value: summary.owedRwf,
            icon: "Wallet",
            href: screenHref("BrokerEarnings"),
            footnote: `${formatMoney(summary.paidRwf)} paid`,
          },
          {
            id: "rating",
            label: "Rating",
            value: summary.ratingAverage ?? 0,
            format: "count",
            icon: "Star",
            href: screenHref("BrokerReviews"),
            footnote: starsWords(summary.ratingAverage, summary.ratingCount),
          },
        ]}
      />
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <SectionCard
          title="Newest homes"
          className="lg:col-span-2"
          actions={
            <ActionLink href={screenHref("BrokerDirectory")} size="sm" icon="ArrowRight">
              All homes
            </ActionLink>
          }
        >
          {newest.length === 0 ? (
            <EmptyBlock
              size="sm"
              icon="FolderHouse"
              title={
                summary.scope.needsDistrict
                  ? "Choose the district you work in"
                  : `No homes on offer in ${summary.scope.area} yet`
              }
              action={
                summary.scope.needsDistrict || summary.scope.upgrade ? (
                  <ActionLink
                    href={screenHref("BrokerPlan")}
                    icon={summary.scope.needsDistrict ? "MapPin" : "ArrowUpRight"}
                  >
                    {summary.scope.needsDistrict ? "Choose a district" : "See more of Rwanda"}
                  </ActionLink>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {newest.map((h) => (
                <li key={h.unitId} className="flex">
                  <HomeCard home={h} href={`${screenHref("BrokerDirectory")}?home=${h.unitId}`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Your plan"
            actions={
              <ActionLink href={screenHref("BrokerPlan")} size="sm" icon="CreditCard">
                {current.plan === "country" ? "Manage" : "Upgrade"}
              </ActionLink>
            }
          >
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{PLAN_NAME[current.plan]}</span>
              <span className="text-sm text-muted">{current.area}</span>
              {current.graceUntil ? (
                <span className="text-sm text-warning">Pay by {formatDay(current.graceUntil, "long")} to keep it.</span>
              ) : current.nextPaymentOn && current.nextAmountRwf ? (
                <span className="text-xs text-muted">
                  Renews {formatDay(current.nextPaymentOn, "long")} for {formatMoney(current.nextAmountRwf)}
                </span>
              ) : summary.scope.upgrade ? (
                <span className="text-xs text-muted">
                  {summary.scope.upgrade.area} for {formatMoney(summary.scope.upgrade.priceRwf)} a month
                </span>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard
            title="Latest placements"
            className="flex-1"
            actions={
              recent.length > 0 ? (
                <ActionLink href={screenHref("BrokerPlacements")} size="sm" icon="ArrowRight">
                  All
                </ActionLink>
              ) : null
            }
          >
            {recent.length === 0 ? (
              <EmptyBlock
                size="sm"
                icon="Persons"
                title="No placements yet"
                description="Open a home and say you have a tenant."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {p.unit ? `${p.unit.label} · ${p.unit.propertyName}` : (p.landlordName ?? "A home")}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {p.lease
                          ? `${p.lease.tenantName}, lease ${p.lease.reference}`
                          : (p.tenantName ?? formatDay(p.startedAt, "long"))}
                      </span>
                    </span>
                    <PlacementChip status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
      {summary.status === "suspended" ? (
        <Card className="p-4 text-sm text-danger">
          Your broker account is suspended. You can read your work but not reveal landlords or start placements.{" "}
          <NextLink href="/help" className="underline">
            Contact Injishi
          </NextLink>
        </Card>
      ) : null}
    </PageContent>
  );
}
