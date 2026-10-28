import type { BrokerFeeRecord, BrokerFeeTerms, PlacementStatus } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import { ActionLink, EmptyBlock, formatMoney, PageContent, PageHeader, StatusChip, type StatusTone } from "@injishi/ui";

/** "50% of the first month" or "RWF 100,000". */
export function feeTermsWords(terms: BrokerFeeTerms): string {
  return terms.kind === "percent" ? `${terms.percent}% of the first month` : formatMoney(terms.amountRwf);
}

/** "2 bedrooms", "Studio", null when not said. */
export function roomsWords(bedrooms: number | null): string | null {
  if (bedrooms === null) return null;
  if (bedrooms === 0) return "Studio";
  return `${bedrooms} ${bedrooms === 1 ? "bedroom" : "bedrooms"}`;
}

const PLACEMENT: Record<PlacementStatus, { tone: StatusTone; label: string }> = {
  initiated: { tone: "info", label: "Open" },
  converted: { tone: "success", label: "Leased" },
  abandoned: { tone: "default", label: "Closed" },
  unavailable: { tone: "default", label: "Unit taken" },
};

export function PlacementChip({ status }: { status: PlacementStatus }) {
  const s = PLACEMENT[status];
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>;
}

const FEE: Record<BrokerFeeRecord["status"], { tone: StatusTone; label: string }> = {
  owed: { tone: "warning", label: "Owed" },
  paid: { tone: "success", label: "Paid" },
  void: { tone: "default", label: "Void" },
};

export function FeeChip({ status }: { status: BrokerFeeRecord["status"] }) {
  const s = FEE[status];
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>;
}

/** Stars out of five, as text and for screen readers: "4.5 ★". */
export function starsWords(average: number | null, count: number): string {
  if (average === null || count === 0) return "No ratings yet";
  return `${average.toFixed(1)} of 5, ${count} ${count === 1 ? "rating" : "ratings"}`;
}

/** A broker page opened by someone with no broker registration. */
export function NotABroker({ title }: { title: string }) {
  return (
    <PageContent>
      <PageHeader title={title} />
      <EmptyBlock
        icon="Briefcase"
        title="There is no broker registration here"
        description="Register as a broker to offer homes to tenants."
        action={
          <ActionLink href={screenHref("Register")} icon="Plus">
            Register as a broker
          </ActionLink>
        }
      />
    </PageContent>
  );
}
