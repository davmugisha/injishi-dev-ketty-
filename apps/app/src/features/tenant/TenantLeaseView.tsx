"use client";

import { Toast } from "@heroui/react";
import type { LeaseContractView, LeaseEventView, TenancyDetail } from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DateText,
  EmptyBlock,
  EventTimeline,
  formatDay,
  Icon,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContractDocument } from "../leases/ContractDocument";
import { SigningPanel } from "../leases/SigningPanel";
import { contractOf, placeWords, tenantPdfHref, timelineOf } from "../leases/shared";
import { reloadTenancyContract, requestTenantSigningCode, signLeaseAsTenant } from "./actions";
import { TenantBrokerCard } from "./TenantBrokerCard";

const SIGNED_WITH: Record<TenancyDetail["signatures"][number]["method"], string> = {
  email_code: "emailed code",
  password: "password",
  legacy: "on paper",
};

/**
 * The tenant's lease (P3.2): the contract as it was frozen, the PDF (the signed copy once both signed),
 * who signed and how, the deposit, and the lease's timeline. While it waits for their signature, Review
 * and sign opens the same signing panel the landlord uses; `?sign=1` (from the invitation) opens it.
 */
export function TenantLeaseView({
  tenancy,
  contract,
  events,
  openSign,
}: {
  tenancy: TenancyDetail;
  contract: LeaseContractView | null;
  events: LeaseEventView[];
  openSign: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [signing, setSigning] = useState(false);
  const [allEvents, setAllEvents] = useState(false);
  const doc = contractOf(contract);

  useEffect(() => {
    if (!openSign) return;
    if (tenancy.needsMySignature && contract) setSigning(true);
    router.replace(pathname, { scroll: false });
  }, [openSign, tenancy.needsMySignature, contract, pathname, router]);

  const t = tenancy.terms;
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={placeWords(tenancy)}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Lease {tenancy.reference}
            <StatusChip kind="lease" status={tenancy.status} size="md">
              {tenancy.needsMySignature ? "Waiting for you" : undefined}
            </StatusChip>
          </span>
        }
        description={
          tenancy.needsMySignature
            ? `${tenancy.landlord.name} signed it. Read it through, then sign.`
            : tenancy.status === "pending_signature"
              ? "Waiting for your landlord."
              : undefined
        }
        actions={
          <>
            {tenancy.currentVersion ? (
              <ActionLink
                href={tenantPdfHref(tenancy.id)}
                target="_blank"
                rel="noopener"
                icon="FileArrowDown"
                intent="ghost"
              >
                {tenancy.signedCopyReady ? "Signed PDF" : "PDF"}
              </ActionLink>
            ) : null}
            {tenancy.needsMySignature && contract ? (
              <ActionButton icon="PencilToSquare" intent="primary" onPress={() => setSigning(true)}>
                Review and sign
              </ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="The contract">
          {doc ? (
            <ContractDocument contract={doc} />
          ) : (
            <EmptyBlock size="sm" icon="FileText" title="No contract text to show" description="Open the PDF." />
          )}
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Signatures">
            {tenancy.signatures.length === 0 ? (
              <p className="text-sm text-muted">Nobody has signed yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-separator">
                {tenancy.signatures.map((s) => (
                  <li key={`${s.role}-${s.version}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Icon name="Check" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{s.typedName ?? "No typed name"}</span>
                      <span className="text-xs text-muted">
                        {s.role === "landlord" ? "Landlord" : "You"} · {formatDay(s.signedAt)} · {SIGNED_WITH[s.method]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard
            title="Deposit"
            actions={
              tenancy.charges.depositStatus ? (
                <StatusChip kind="deposit" status={tenancy.charges.depositStatus} />
              ) : null
            }
          >
            <KeyValueList
              items={[
                { label: "Agreed", value: <Money value={t.depositRwf} /> },
                { label: "Due", value: <DateText value={t.startDate} style="long" /> },
                { label: "Held by", value: tenancy.landlord.name },
              ]}
            />
          </SectionCard>
          <TenantBrokerCard tenancy={tenancy} />
          <SectionCard title="Timeline">
            {events.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <>
                <EventTimeline
                  label={`Lease ${tenancy.reference} history`}
                  events={allEvents ? timelineOf(events) : timelineOf(events).slice(-5)}
                />
                {events.length > 5 ? (
                  <ActionButton size="sm" intent="ghost" className="self-start" onPress={() => setAllEvents((v) => !v)}>
                    {allEvents ? "Show the latest" : `Show all ${events.length}`}
                  </ActionButton>
                ) : null}
              </>
            )}
          </SectionCard>
        </div>
      </div>

      {signing && contract ? (
        <SigningPanel
          side="tenant"
          view={contract}
          reference={`Lease ${tenancy.reference} · ${placeWords(tenancy)}`}
          pdfHref={tenantPdfHref(tenancy.id)}
          calls={{
            requestCode: () => requestTenantSigningCode(tenancy.id),
            reload: () => reloadTenancyContract(tenancy.id),
            sign: (body) => signLeaseAsTenant(tenancy.id, body),
          }}
          onClose={() => {
            setSigning(false);
            router.refresh();
          }}
        />
      ) : null}
    </PageContent>
  );
}
