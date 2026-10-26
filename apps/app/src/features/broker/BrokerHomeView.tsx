import { Alert, Avatar } from "@heroui/react";
import type {
  BrokerEarnings,
  BrokerHomes,
  BrokerPlacementList,
  BrokerPlanOverview,
  BrokerSummary,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  EmptyBlock,
  formatDay,
  formatMoney,
  Icon,
  KeyValueList,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  toneColor,
} from "@injishi/ui";
import NextLink from "next/link";
import { canMessagePlacement, placementMessageHref } from "../messages/links";
import { FeesChart } from "./FeesChart";
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
  earnings,
  today,
  desk = false,
}: {
  firstName: string;
  summary: BrokerSummary;
  homes: BrokerHomes;
  placements: BrokerPlacementList;
  plan: BrokerPlanOverview;
  earnings: BrokerEarnings;
  today: string;
  /** When true, Overview sits under Homes desk tabs — no second page chrome. */
  desk?: boolean;
}) {
  const newest = homes.homes.slice(0, 2);
  const recent = placements.placements.slice(0, 5);
  const current = plan.current;
  // The name the broker registered with (their ID), else the account's.
  const first = summary.name?.trim().split(/\s+/)[0] || firstName;
  const findHomes = "/broker?tab=homes";
  const body = (
    <>
      {desk ? null : (
      <PageHeader
        size="hello"
        title={first ? `Welcome back, ${first}` : "Welcome back"}
        actions={
          <ActionLink href={findHomes} icon="Magnifier" intent="primary">
            Find homes
          </ActionLink>
        }
      />
      )}
      {desk ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {first ? `Welcome back, ${first}` : "Welcome back"}
            </h1>
            <p className="text-sm text-muted">{summary.scope.area}</p>
          </div>
          <ActionLink href={findHomes} icon="Magnifier" intent="primary">
            Find homes
          </ActionLink>
        </div>
      ) : null}
      {summary.status === "suspended" ? (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>Your broker account is suspended</Alert.Title>
            <Alert.Description>
              You can read your work but not reveal landlords or start placements.{" "}
              <NextLink href="/help" className="underline">
                Contact Injishi
              </NextLink>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <KpiStrip
        label="Your work"
        items={[
          {
            id: "homes",
            label: "Homes on offer",
            value: summary.homesInScope,
            format: "count",
            icon: "FolderHouse",
            href: findHomes,
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
          summary.ratingAverage === null || summary.ratingCount === 0
            ? {
                id: "rating",
                label: "Ratings",
                value: 0,
                format: "count",
                icon: "Star",
                href: screenHref("BrokerReviews"),
                footnote: "None yet",
              }
            : {
                id: "rating",
                label: "Rating",
                value: summary.ratingAverage,
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
            <ActionLink href={findHomes} size="sm" icon="ArrowRight">
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
                    href="/account?plan=1"
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
                  <HomeCard home={h} href={`${findHomes}&home=${h.unitId}`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard
          title="Your plan"
          className="h-full"
          contentClassName="flex-1"
          actions={
            <ActionLink href="/account?plan=1" size="sm" icon="CreditCard">
              {current.plan === "country" ? "Manage" : "Upgrade"}
            </ActionLink>
          }
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold">{PLAN_NAME[current.plan]}</span>
            <span className="text-sm text-muted">{current.area}</span>
          </div>
          <KeyValueList
            items={[
              { label: "Homes", value: `${summary.homesInScope} on offer` },
              current.graceUntil
                ? {
                    label: "Pay by",
                    value: <span className="text-warning">{formatDay(current.graceUntil, "long")}</span>,
                  }
                : current.nextPaymentOn && current.nextAmountRwf
                  ? {
                      label: "Renews",
                      value: `${formatDay(current.nextPaymentOn)} · ${formatMoney(current.nextAmountRwf)}`,
                    }
                  : { label: "Price", value: "Free" },
            ]}
          />
          {summary.scope.upgrade ? (
            <NextLink
              href="/account?plan=1"
              className="mt-auto flex items-center justify-between gap-3 rounded-2xl bg-default/60 px-3 py-2.5 text-sm transition-colors hover:bg-default"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{summary.scope.upgrade.area}</span>
                <span className="text-xs text-muted">{formatMoney(summary.scope.upgrade.priceRwf)} a month</span>
              </span>
              <Icon name="ArrowUpRight" className="shrink-0 text-muted" />
            </NextLink>
          ) : null}
        </SectionCard>
        <FeesChart fees={earnings.fees} today={today} className="lg:col-span-2" />
        <SectionCard
          title="Latest placements"
          className="h-full"
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
            <ul className="flex flex-col divide-y divide-separator">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar size="sm" variant="soft" color={toneColor("default")} className="hidden shrink-0 sm:flex">
                    <Avatar.Fallback>
                      <Icon name="FolderHouse" />
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {p.unit ? `${p.unit.label} · ${p.unit.propertyName}` : (p.landlordName ?? "A home")}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {p.lease
                        ? `${p.lease.tenantName}, lease ${p.lease.reference}`
                        : (p.tenantName ?? formatDay(p.startedAt, "long"))}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PlacementChip status={p.status} />
                    {canMessagePlacement(p.status) ? (
                      <ActionLink
                        href={placementMessageHref(p.id)}
                        size="sm"
                        icon="Comments"
                        aria-label={`Message the landlord of ${p.unit?.label ?? "this home"}`}
                      >
                        <span className="max-sm:sr-only">Message</span>
                      </ActionLink>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
  return desk ? <div className="flex flex-col gap-6">{body}</div> : <PageContent>{body}</PageContent>;
}
