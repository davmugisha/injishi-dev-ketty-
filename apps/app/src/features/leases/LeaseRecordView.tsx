"use client";

import { Alert, Toast, toast } from "@heroui/react";
import {
  LEASE_PAYMENT_CHANNEL_LABEL,
  LEASE_PAYMENT_METHOD_LABEL,
  type LeaseChargeView,
  type LeaseContractView,
  type LeaseDetail,
  type LeaseEventView,
  type LeasePaymentView,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  EventTimeline,
  FilterTabs,
  formatDay,
  formatLocalPhone,
  formatMoney,
  Icon,
  KeyValueList,
  KpiStrip,
  Money,
  PageContent,
  PageHeader,
  PersonCell,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { MoveOutCard } from "../move-outs/MoveOutCard";
import { settingsHref } from "../rentals/shared";
import { reloadLeaseContract, requestLandlordSigningCode, signLeaseAsLandlord, startTenancy } from "./actions";
import { ContractDocument } from "./ContractDocument";
import { LeaseBrokerCard } from "./LeaseBrokerCard";
import { CancelDialog, EditLeasePanel, ReminderDialog, ResendDialog } from "./LeaseDialogs";
import { SigningPanel } from "./SigningPanel";
import {
  cancellable,
  contractOf,
  days,
  dueDayWords,
  editable,
  ID_WORDS,
  RECORD_TAB_LABEL,
  RECORD_TABS,
  type RecordTab,
  SIGNING_METHOD_WORDS,
  timelineOf,
} from "./shared";

export type RecordOpen = "sign" | "resend" | "start" | "remind" | "edit" | "cancel";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** The landlord's copy of the contract, from the app's own origin (the route adds the business). */
export const leasePdfHref = (leaseId: string, version?: number): string =>
  `/api/rentals/leases/${encodeURIComponent(leaseId)}/contract${version ? `?version=${version}` : ""}`;

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted">{children}</span>;
}

const chargeStatus = (c: LeaseChargeView): string => (c.overdue ? "overdue" : c.status);

function ChargesTable({ charges }: { charges: LeaseChargeView[] }) {
  const columns: DataColumn<LeaseChargeView>[] = [
    { id: "what", header: "Charge", isRowHeader: true, cell: (c) => c.label },
    { id: "due", header: "Due", sortValue: (c) => c.dueOn, cell: (c) => <DateText value={c.dueOn} /> },
    { id: "amount", header: "Amount", align: "end", cell: (c) => <Money value={c.amountRwf} /> },
    {
      id: "owed",
      header: "Still owed",
      align: "end",
      cell: (c) => (c.outstandingRwf > 0 ? <Money value={c.outstandingRwf} /> : <Muted>RWF 0</Muted>),
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => (
        <StatusChip kind="charge" status={chargeStatus(c)}>
          {c.overdue ? `${days(c.daysOverdue)} late` : undefined}
        </StatusChip>
      ),
    },
  ];
  return (
    <DataTable
      label="Charges"
      rows={charges}
      rowKey={(c) => c.id}
      columns={columns}
      defaultSort={{ column: "due", direction: "descending" }}
      mobile={{
        title: (c) => c.label,
        description: (c) =>
          `Due ${formatDay(c.dueOn)} · ${formatMoney(c.amountRwf)}${c.outstandingRwf > 0 && c.outstandingRwf < c.amountRwf ? `, ${formatMoney(c.outstandingRwf)} owed` : ""}`,
        trailing: (c) => <StatusChip kind="charge" status={chargeStatus(c)} />,
      }}
      empty={
        <EmptyBlock
          size="sm"
          icon="Receipt"
          title="No charges yet"
          description="Rent is raised a week before each due day once the tenancy runs."
        />
      }
    />
  );
}

function paymentHow(p: LeasePaymentView): string {
  return `${LEASE_PAYMENT_METHOD_LABEL[p.method]} · ${LEASE_PAYMENT_CHANNEL_LABEL[p.channel]}`;
}

function PaymentsTable({ payments }: { payments: LeasePaymentView[] }) {
  const columns: DataColumn<LeasePaymentView>[] = [
    {
      id: "on",
      header: "Paid on",
      isRowHeader: true,
      sortValue: (p) => p.paidOn ?? p.createdAt,
      cell: (p) => <DateText value={p.paidOn ?? p.createdAt} />,
    },
    { id: "how", header: "How", cell: (p) => paymentHow(p) },
    {
      id: "ref",
      header: "Receipt",
      hideBelow: "lg",
      cell: (p) => p.receiptNumber ?? p.reference ?? <Muted>-</Muted>,
    },
    { id: "amount", header: "Amount", align: "end", cell: (p) => <Money value={p.amountRwf} /> },
    { id: "status", header: "Status", cell: (p) => <StatusChip kind="payment" status={p.status} /> },
  ];
  return (
    <DataTable
      label="Payments"
      rows={payments}
      rowKey={(p) => p.id}
      columns={columns}
      defaultSort={{ column: "on", direction: "descending" }}
      mobile={{
        title: (p) => formatMoney(p.amountRwf),
        description: (p) => `${formatDay(p.paidOn ?? p.createdAt)} · ${paymentHow(p)}`,
        trailing: (p) => <StatusChip kind="payment" status={p.status} />,
      }}
      empty={<EmptyBlock size="sm" icon="Wallet" title="No payments yet" />}
    />
  );
}

/**
 * One lease (WP 2.4, 2.5): who and where, where it stands with the one next step for its stage, the
 * money on it, and tabs for the terms, the contract with its signatures, the rent, the deposit and the
 * timeline. Review and sign opens the signing panel; `?open=` (from the list) opens a step once.
 */
export function LeaseRecordView({
  lease,
  contract,
  events,
  charges,
  payments,
  tab,
  open,
  today,
  autoStart,
  can,
}: {
  lease: LeaseDetail;
  contract: LeaseContractView | null;
  events: LeaseEventView[];
  charges: LeaseChargeView[] | null;
  payments: LeasePaymentView[] | null;
  tab: RecordTab;
  open: RecordOpen | null;
  today: string;
  autoStart: boolean;
  can: { manage: boolean; sign: boolean; record: boolean; message?: boolean; settle?: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [panel, setPanel] = useState<RecordOpen | null>(null);
  const [pending, start] = useTransition();
  const doc = contractOf(contract);

  const ready = lease.contractProblems.length === 0 && doc !== null;
  const canStartNow = lease.terms.startDate <= today;
  // Rent is paid only through the payment integration; the landlord reminds, never records.
  const openCharges = (charges ?? []).filter((c) => c.status === "open" && c.outstandingRwf > 0);
  const canRemind = can.record && (lease.status === "active" || lease.status === "ending" || lease.status === "signed");

  // A step the list asked for (`?open=`) opens once, then leaves the URL.
  useEffect(() => {
    if (!open) return;
    const allowed =
      (open === "sign" && lease.status === "draft" && can.sign && ready) ||
      (open === "resend" && lease.status === "pending_signature" && can.manage) ||
      (open === "start" && lease.status === "signed" && can.manage && canStartNow) ||
      (open === "remind" && canRemind && openCharges.length > 0) ||
      (open === "edit" && editable(lease.status) && can.manage) ||
      (open === "cancel" && cancellable(lease.status) && can.manage);
    if (allowed) setPanel(open);
    const params = new URLSearchParams(window.location.search);
    params.delete("open");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [open, lease.status, can, ready, canStartNow, canRemind, openCharges.length, pathname, router]);

  const goTab = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    if (key === "overview") params.delete("tab");
    else params.set("tab", key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const confirmStart = () =>
    start(async () => {
      const result = await startTenancy(lease.id);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setPanel(null);
      toast.success("The tenancy has started");
      router.refresh();
    });

  // The one main action for the stage.
  let main: ReactNode = null;
  if (lease.status === "draft" && can.sign) {
    main = (
      <ActionButton icon="PencilToSquare" intent="primary" isDisabled={!ready} onPress={() => setPanel("sign")}>
        Review and sign
      </ActionButton>
    );
  } else if (lease.status === "pending_signature" && can.manage) {
    main = (
      <ActionButton icon="PaperPlane" intent="primary" onPress={() => setPanel("resend")}>
        Resend invitation
      </ActionButton>
    );
  } else if (lease.status === "signed" && can.manage) {
    main = (
      <ActionButton icon="CirclePlay" intent="primary" isDisabled={!canStartNow} onPress={() => setPanel("start")}>
        Start the tenancy
      </ActionButton>
    );
  } else if ((lease.status === "active" || lease.status === "ending") && canRemind) {
    main = (
      <ActionButton
        icon="Bell"
        intent="primary"
        isDisabled={openCharges.length === 0}
        onPress={() => setPanel("remind")}
      >
        Send a reminder
      </ActionButton>
    );
  }

  const stageLine =
    lease.status === "signed" && !canStartNow
      ? autoStart
        ? `Signed by both. Injishi starts it on ${formatDay(lease.terms.startDate, "long")}.`
        : `Signed by both. You can start it from ${formatDay(lease.terms.startDate, "long")}.`
      : lease.status === "pending_signature"
        ? lease.nextAction
        : lease.status === "cancelled" && lease.cancelReason
          ? `Cancelled: ${lease.cancelReason}`
          : null;

  const tabs: { id: RecordTab; label: string }[] = RECORD_TABS.map((id) => ({ id, label: RECORD_TAB_LABEL[id] }));
  const shownTab = tabs.some((t) => t.id === tab) ? tab : "overview";

  const t = lease.terms;
  const movedIn = t.billingStartsOn > t.startDate;
  const deposit = charges?.find((c) => c.kind === "deposit") ?? null;
  const signatures = lease.signatures.filter((s) => s.version === lease.currentVersion?.version);

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={
          <>
            <ActionLink href={screenHref("Leases")} icon="ArrowLeft" intent="ghost" size="sm" className="-ml-3">
              Leases
            </ActionLink>
            <span aria-hidden="true">·</span>
            <span className="tabular">{lease.reference}</span>
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {lease.tenant.fullName}
            <StatusChip kind="lease" status={lease.status} size="md" />
          </span>
        }
        description={[`Unit ${lease.unit.label}`, lease.property.name, stageLine].filter(Boolean).join(" · ")}
        actions={
          <>
            {editable(lease.status) && can.manage ? (
              <ActionButton icon="PencilToSquare" intent="ghost" onPress={() => setPanel("edit")}>
                Edit
              </ActionButton>
            ) : null}
            {cancellable(lease.status) && can.manage ? (
              <ActionButton icon="Xmark" intent="ghost" onPress={() => setPanel("cancel")}>
                Cancel lease
              </ActionButton>
            ) : null}
            {can.message && lease.status !== "draft" ? (
              <ActionLink href={`/messages?lease=${lease.id}`} icon="Comments" intent="ghost">
                Messages
              </ActionLink>
            ) : null}
            {main}
          </>
        }
      />

      {lease.status === "draft" && lease.contractProblems.length > 0 ? (
        <Alert status="warning">
          <Alert.Indicator>
            <Icon name="TriangleExclamation" />
          </Alert.Indicator>
          <Alert.Content className="gap-2">
            <Alert.Title>Before you can sign</Alert.Title>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm">
              {lease.contractProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {lease.contractProblems.some((p) => /signs leases/i.test(p)) ? (
                <ActionLink href={settingsHref("signatory")} size="sm" icon="Gear">
                  Signatory settings
                </ActionLink>
              ) : null}
              {lease.contractProblems.some((p) => /village/i.test(p)) ? (
                <ActionLink href={settingsHref("location")} size="sm" icon="MapPin">
                  Location settings
                </ActionLink>
              ) : null}
              {lease.contractProblems.some((p) => /tenant/i.test(p)) && can.manage ? (
                <ActionButton size="sm" icon="PencilToSquare" onPress={() => setPanel("edit")}>
                  Add the tenant&apos;s details
                </ActionButton>
              ) : null}
            </div>
          </Alert.Content>
        </Alert>
      ) : null}

      <KpiStrip
        label={`Lease ${lease.reference} at a glance`}
        items={[
          {
            id: "balance",
            label: "Balance owed",
            value: lease.charges.balanceRwf,
            icon: "Receipt",
            status: lease.charges.overdueRwf > 0 ? "danger" : lease.charges.balanceRwf > 0 ? "warning" : undefined,
            footnote:
              lease.charges.overdueRwf > 0
                ? `${formatMoney(lease.charges.overdueRwf)} overdue`
                : lease.charges.nextDue
                  ? lease.charges.nextDue.dueOn <= today
                    ? `Due since ${formatDay(lease.charges.nextDue.dueOn)}`
                    : `Next ${formatMoney(lease.charges.nextDue.amountRwf)} on ${formatDay(lease.charges.nextDue.dueOn)}`
                  : "Nothing due",
          },
          {
            id: "paid",
            label: "Rent paid",
            value: lease.charges.rentPaidRwf,
            icon: "CircleCheck",
            footnote: `of ${formatMoney(lease.charges.rentChargedRwf)} charged so far`,
          },
        ]}
      />

      <MoveOutCard lease={lease} today={today} can={{ manage: can.manage, settle: can.settle ?? false }} />

      <FilterTabs variant="tabs" label="Lease record" tabs={tabs} selectedKey={shownTab} onSelectionChange={goTab} />

      {shownTab === "overview" ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <SectionCard title="Terms" className="lg:col-span-2">
            <KeyValueList
              items={[
                {
                  label: "Term",
                  value: (
                    <span className="tabular">
                      <DateText value={t.startDate} style="long" /> to <DateText value={t.endDate} style="long" />
                    </span>
                  ),
                },
                ...(movedIn
                  ? [{ label: "Billing starts here", value: <DateText value={t.billingStartsOn} style="long" /> }]
                  : []),
                { label: "Rent a month", value: <Money value={t.monthlyRentRwf} /> },
                { label: "Rent is due", value: dueDayWords(t.rentDueDay) },
                { label: "Late after", value: `${days(t.graceDays)} of grace` },
                {
                  label: "Deposit",
                  value:
                    t.depositRwf === 0 ? (
                      <Muted>No deposit</Muted>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <Money value={t.depositRwf} />
                        {lease.charges.depositStatus ? (
                          <StatusChip kind="deposit" status={lease.charges.depositStatus} />
                        ) : null}
                      </span>
                    ),
                },
                { label: "Notice", value: days(t.noticeDays) },
                {
                  label: "Also living there",
                  value: t.occupants.length > 0 ? t.occupants.join(", ") : <Muted>Nobody else</Muted>,
                },
                ...(t.otherTerms
                  ? [{ label: "Other terms", value: <span className="whitespace-pre-line">{t.otherTerms}</span> }]
                  : []),
              ]}
            />
          </SectionCard>
          <div className="flex min-w-0 flex-col gap-5 *:last:flex-1">
            <SectionCard title="Tenant">
              <PersonCell
                name={lease.tenant.fullName}
                secondary={lease.tenant.hasAccount ? "Signed in to Injishi" : "Not signed in yet"}
                size="md"
              />
              <KeyValueList
                items={[
                  { label: "Email", value: lease.tenant.email ?? <Muted>Not given</Muted> },
                  {
                    label: "Phone",
                    value: lease.tenant.phone ? (
                      <a href={`tel:${lease.tenant.phone}`} className="tabular hover:underline">
                        {formatLocalPhone(lease.tenant.phone)}
                      </a>
                    ) : (
                      <Muted>Not given</Muted>
                    ),
                  },
                  {
                    label: lease.tenant.idKind ? ID_WORDS[lease.tenant.idKind] : "ID",
                    value: lease.tenant.idNumber ? (
                      <span className="tabular">{lease.tenant.idNumber}</span>
                    ) : (
                      <Muted>Not given</Muted>
                    ),
                  },
                ]}
              />
            </SectionCard>
            <LeaseBrokerCard lease={lease} canManage={can.manage} />
            {lease.invitation ? (
              <SectionCard
                title="Invitation"
                actions={
                  <StatusChip
                    tone={
                      lease.invitation.status === "accepted"
                        ? "success"
                        : lease.invitation.status === "sent"
                          ? "info"
                          : "default"
                    }
                  >
                    {lease.invitation.status === "accepted"
                      ? "Accepted"
                      : lease.invitation.status === "sent"
                        ? "Sent"
                        : lease.invitation.status === "expired"
                          ? "Expired"
                          : lease.status === "cancelled"
                            ? "Withdrawn"
                            : "Replaced"}
                  </StatusChip>
                }
              >
                <KeyValueList
                  items={[
                    { label: "Sent to", value: lease.invitation.email },
                    {
                      label: lease.invitation.sendCount > 1 ? "Last sent" : "Sent",
                      value: <DateText value={lease.invitation.lastSentAt} />,
                    },
                    ...(lease.invitation.acceptedAt
                      ? [{ label: "Accepted", value: <DateText value={lease.invitation.acceptedAt} /> }]
                      : lease.invitation.status === "sent"
                        ? [{ label: "Link works until", value: <DateText value={lease.invitation.expiresAt} /> }]
                        : lease.invitation.status === "expired"
                          ? [{ label: "Expired on", value: <DateText value={lease.invitation.expiresAt} /> }]
                          : []),
                  ]}
                />
              </SectionCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {shownTab === "contract" ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="The contract"
            description={
              lease.currentVersion
                ? `Version ${lease.currentVersion.version}${contract?.signed ? ", signed by both" : ""}`
                : undefined
            }
            actions={
              lease.currentVersion ? (
                <ActionLink href={leasePdfHref(lease.id)} target="_blank" rel="noopener" icon="FileArrowDown" size="sm">
                  PDF
                </ActionLink>
              ) : null
            }
          >
            {doc ? (
              <ContractDocument contract={doc} draft={lease.status === "draft"} hideParties={false} />
            ) : (
              <EmptyBlock
                size="sm"
                icon="FileText"
                title="No contract text to show"
                description={
                  lease.currentVersion
                    ? "This version came from before e-signatures. Open the PDF."
                    : "It is written once the draft is complete."
                }
              />
            )}
          </SectionCard>
          <div className="flex min-w-0 flex-col gap-5 *:last:flex-1">
            <SectionCard title="Signatures">
              {signatures.length === 0 ? (
                <p className="text-sm text-muted">Nobody has signed this version yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {signatures.map((s) => (
                    <li key={s.id} className={cx("flex flex-col gap-0.5", s.voidedAt && "opacity-60")}>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {s.role === "landlord" ? "Landlord" : "Tenant"}
                        {s.voidedAt ? <StatusChip tone="warning">Voided</StatusChip> : null}
                      </span>
                      <span className="text-sm">{s.typedName ?? "No typed name"}</span>
                      <span className="text-xs text-muted">
                        {formatDay(s.signedAt, "long")} · {SIGNING_METHOD_WORDS[s.method]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            {contract && contract.versions.length > 1 ? (
              <SectionCard title="Versions">
                <ul className="flex flex-col gap-2">
                  {[...contract.versions]
                    .sort((a, b) => b.version - a.version)
                    .map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium">Version {v.version}</span>
                          <span className="truncate text-xs text-muted">
                            {formatDay(v.createdAt)} · <span className="font-mono">{v.contentHash.slice(0, 12)}</span>
                          </span>
                        </span>
                        <ActionLink
                          href={leasePdfHref(lease.id, v.version)}
                          target="_blank"
                          rel="noopener"
                          icon="FileArrowDown"
                          intent="ghost"
                          size="sm"
                        >
                          PDF
                        </ActionLink>
                      </li>
                    ))}
                </ul>
              </SectionCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {shownTab === "rent" ? (
        charges === null || payments === null ? (
          <SectionCard title="Rent">
            <p className="text-sm text-muted">The rent on a lease is for people who look after the money here.</p>
          </SectionCard>
        ) : (
          <div className="flex min-w-0 flex-col gap-5 *:last:flex-1">
            <SectionCard title="Charges" contentClassName="gap-0">
              <ChargesTable charges={charges} />
            </SectionCard>
            <SectionCard title="Payments" contentClassName="gap-0">
              <PaymentsTable payments={payments} />
            </SectionCard>
          </div>
        )
      ) : null}

      {shownTab === "deposit" ? (
        <SectionCard
          title="Deposit"
          actions={
            lease.charges.depositStatus ? <StatusChip kind="deposit" status={lease.charges.depositStatus} /> : null
          }
        >
          {t.depositRwf === 0 ? (
            <p className="text-sm text-muted">This lease asks for no deposit.</p>
          ) : (
            <KeyValueList
              items={[
                { label: "Agreed", value: <Money value={lease.charges.depositAgreedRwf} /> },
                {
                  label: "Asked for",
                  value: deposit ? (
                    <>
                      Due <DateText value={deposit.dueOn} style="long" />
                    </>
                  ) : (
                    <Muted>When the tenant signs</Muted>
                  ),
                },
                ...(deposit
                  ? [
                      { label: "Paid", value: <Money value={deposit.paidRwf} /> },
                      {
                        label: "Still owed",
                        value:
                          deposit.outstandingRwf > 0 ? <Money value={deposit.outstandingRwf} /> : <Muted>RWF 0</Muted>,
                      },
                    ]
                  : []),
                { label: "Held by", value: "You, the landlord. It is settled when the tenant moves out." },
              ]}
            />
          )}
        </SectionCard>
      ) : null}

      {shownTab === "timeline" ? (
        <SectionCard title="Timeline" description="Everything that happened on this lease, oldest first.">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <EventTimeline label={`Lease ${lease.reference} history`} events={timelineOf(events)} />
          )}
        </SectionCard>
      ) : null}

      {panel === "sign" && contract ? (
        <SigningPanel
          side="landlord"
          view={contract}
          reference={`Lease ${lease.reference} · Unit ${lease.unit.label} · ${lease.tenant.fullName}`}
          pdfHref={leasePdfHref(lease.id)}
          calls={{
            requestCode: () => requestLandlordSigningCode(lease.id),
            reload: () => reloadLeaseContract(lease.id),
            sign: (body) => signLeaseAsLandlord(lease.id, body),
          }}
          onClose={() => {
            setPanel(null);
            router.refresh();
          }}
        />
      ) : null}
      {panel === "resend" ? <ResendDialog lease={lease} onClose={() => setPanel(null)} /> : null}
      {panel === "cancel" ? <CancelDialog lease={lease} onClose={() => setPanel(null)} /> : null}
      {panel === "remind" ? <ReminderDialog lease={lease} open={openCharges} onClose={() => setPanel(null)} /> : null}
      {panel === "edit" ? (
        <EditLeasePanel lease={lease} today={today} autoStart={autoStart} onClose={() => setPanel(null)} />
      ) : null}
      <ConfirmDialog
        isOpen={panel === "start"}
        onOpenChange={(o) => (o ? undefined : setPanel(null))}
        title="Start the tenancy?"
        confirmLabel="Start the tenancy"
        confirmIcon="CirclePlay"
        isPending={pending}
        onConfirm={confirmStart}
      >
        {lease.tenant.fullName} moves in to unit {lease.unit.label}. Rent is charged from{" "}
        {formatDay(t.billingStartsOn, "long")}, due {dueDayWords(t.rentDueDay).toLowerCase()}.
      </ConfirmDialog>
    </PageContent>
  );
}
