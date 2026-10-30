import { Alert } from "@heroui/react";
import type { BrokerEarnings, BrokerPlanOverview, BrokerSummary } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  formatDay,
  formatMoney,
  Icon,
  KeyValueList,
  KpiStrip,
  PageContent,
  SectionCard,
} from "@injishi/ui";
import NextLink from "next/link";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { FeesChart } from "./FeesChart";
import { starsWords } from "./shared";

const PLAN_NAME = { district: "District", province: "Province", country: "Country" } as const;

/**
 * The broker's overview (2026-10-30): the figures (each opens its list), fees earned and paid over a
 * period, and the plan in force. Homes and placements are their own tabs, not repeated here.
 */
export function BrokerHomeView({
  firstName,
  summary,
  plan,
  earnings,
  today,
}: {
  firstName: string;
  summary: BrokerSummary;
  plan: BrokerPlanOverview;
  earnings: BrokerEarnings;
  today: string;
}) {
  const current = plan.current;
  // The name the broker registered with (their ID), else the account's.
  const first = summary.name?.trim().split(/\s+/)[0] || firstName;
  const findHomes = screenHref("BrokerDirectory");
  const reviews = screenHref("BrokerReviews");
  return (
    <PageContent>
      <AreaHeader size="hello" eyebrow={summary.scope.area} title={first ? `Welcome back, ${first}` : "Welcome back"} />
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
            href: reviews,
            footnote: starsWords(summary.ratingAverage, summary.ratingCount),
          },
        ]}
      />
      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        <FeesChart fees={earnings.fees} today={today} className="lg:col-span-2" />
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
      </div>
    </PageContent>
  );
}
