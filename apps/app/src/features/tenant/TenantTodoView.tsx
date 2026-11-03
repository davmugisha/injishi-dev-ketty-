"use client";

import { Toast } from "@heroui/react";
import type { LeaseChargeView, TenancyDetail, TenantChargeList } from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  Icon,
  type IconKey,
  PageContent,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { placeWords, tenantGuestsHref, tenantLeaseHref } from "../leases/shared";
import { PayPanel } from "./PayPanel";
import { RateBrokerDialog } from "./TenantBrokerCard";
import { owedWords } from "./TenantOverviewView";

interface Todo {
  id: string;
  title: string;
  detail: string;
  icon: IconKey;
  verb: string;
  href?: string;
  press?: () => void;
}

/** What waits for the tenant (2026-10-30): sign, pay, rate the broker, register a guest; one row each. */
export function TenantTodoView({ tenancy, charges }: { tenancy: TenancyDetail; charges: TenantChargeList | null }) {
  const router = useRouter();
  const [paying, setPaying] = useState<{ only: LeaseChargeView | null } | null>(null);
  const [rating, setRating] = useState(false);
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";
  const canPay = Boolean(charges && charges.maxPaymentRwf > 0 && live);
  const deposit = charges?.charges.find((c) => c.kind === "deposit" && c.outstandingRwf > 0) ?? null;

  const rows: Todo[] = [];
  if (tenancy.needsMySignature)
    rows.push({
      id: "sign",
      title: "Sign your lease",
      detail: `${tenancy.landlord.name} signed it`,
      icon: "FileText",
      verb: "Sign",
      href: `${tenantLeaseHref(tenancy.id)}?sign=1`,
    });
  if (canPay && deposit)
    rows.push({
      id: "deposit",
      title: "Pay your deposit",
      detail: `${formatMoney(deposit.outstandingRwf)}, due ${formatDay(deposit.dueOn, "long")}`,
      icon: "Wallet",
      verb: "Pay",
      press: () => setPaying({ only: deposit }),
    });
  if (canPay && charges && charges.overdueRwf > 0)
    rows.push({
      id: "overdue",
      title: "Pay what is overdue",
      detail: owedWords(charges).title,
      icon: "Wallet",
      verb: "Pay",
      press: () => setPaying({ only: null }),
    });
  if (tenancy.broker?.canRate && !tenancy.broker.rating)
    rows.push({
      id: "rate",
      title: "Rate your broker",
      detail: tenancy.broker.name ?? "Your broker",
      icon: "Star",
      verb: "Rate",
      press: () => setRating(true),
    });
  if (tenancy.status === "active" || tenancy.status === "signed")
    rows.push({
      id: "guests",
      title: "Register an overnight guest",
      detail: "Shared with the local leaders",
      icon: "PersonPlus",
      verb: "Register",
      href: tenantGuestsHref(tenancy.id),
    });

  const run = (t: Todo) => (t.href ? router.push(t.href) : t.press?.());
  const columns: DataColumn<Todo>[] = [
    {
      id: "what",
      header: "To do",
      isRowHeader: true,
      cell: (t) => (
        <span className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name={t.icon} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{t.title}</span>
            <span className="text-xs text-muted">{t.detail}</span>
          </span>
        </span>
      ),
    },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader eyebrow={placeWords(tenancy)} />
      <DataTable
        label="To do"
        noun={{ one: "item", many: "items" }}
        rows={rows}
        rowKey={(t) => t.id}
        columns={columns}
        onRowAction={run}
        rowActions={(t) => (
          <ActionButton size="sm" onPress={() => run(t)}>
            {t.verb}
          </ActionButton>
        )}
        mobile={{ title: (t) => t.title, description: (t) => t.detail }}
        empty={<EmptyBlock icon="CircleCheck" title="You are all caught up" />}
      />
      {paying && charges ? (
        <PayPanel
          leaseId={tenancy.id}
          charges={charges}
          phone={tenancy.tenant.phone}
          waitingId={charges.pendingPaymentId}
          only={paying.only}
          onClose={() => setPaying(null)}
        />
      ) : null}
      {tenancy.broker ? <RateBrokerDialog tenancy={tenancy} isOpen={rating} onOpenChange={setRating} /> : null}
    </PageContent>
  );
}
