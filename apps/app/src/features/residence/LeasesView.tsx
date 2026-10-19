"use client";

import {
  ArrowDownToLine,
  ArrowsRotateRight,
  Camera,
  CircleCheck,
  Clock,
  FileArrowUp,
  FilePlus,
  Files,
  ListCheck,
  Lock,
  Pencil,
  ScalesBalanced,
  ShieldExclamation,
  ShieldKeyhole,
  Vault,
  Wallet,
  Wrench,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, SearchField, Separator, Tabs, Toast, toast } from "@heroui/react";
import { DropZone, EmptyState, ItemCard, ItemCardGroup, ListView, Stepper, Timeline } from "@heroui-pro/react";
import { type BoardId, type Persona, screenHref } from "@injishi/data";
import type {
  AcceptedRenewal,
  FilingStage,
  Lease,
  LeaseClause,
  ResidenceUnit,
  Tone,
} from "@injishi/data/fixtures/residence";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, type ReactNode, useState } from "react";
import { remindAboutOfferAction, withdrawOfferAction } from "./actions";
import { downloadCsv, firstKey, kigaliCalendar, lineTab, money, SubHeading, TabCount, ToneChip } from "./shared";

export interface LeasesData {
  leases: Lease[];
  clauses: LeaseClause[];
  accepted: AcceptedRenewal[];
  units: ResidenceUnit[];
}

type Tab = "overview" | "contract" | "renewals" | "filings";
/**
 * Why the acknowledgement cannot be attached: a filing record is the filing service's (pending, filed, failed),
 * with no field for a delivered paper or its stamp, and the API's upload route takes phone photographs for records
 * that name them, not a filing's evidence. So choosing a file keeps nothing and says so.
 */
const ACK_UNAVAILABLE =
  "Attaching the acknowledgement is not available yet. Nothing was uploaded; keep the stamped copy on file.";
/** Drafting the contract happens outside the app: no route edits a lease's clauses. */
const CLAUSES_UNAVAILABLE = "Editing clauses is not available yet. The draft keeps the building's standard lease.";

/** How a filing stage reads, and how far along the filing steps it is (5 = every step complete). */
const FILING: Record<FilingStage, { state: string; tone: Tone; step: number }> = {
  followup: { state: "Sent · needs follow-up", tone: "warning", step: 3 },
  ack: { state: "Acknowledged", tone: "success", step: 5 },
  draft: { state: "Draft · 5 days left", tone: "warning", step: 0 },
  none: { state: "Not started", tone: "default", step: -1 },
};
const FILING_STEPS = ["Draft", "Internal review", "Approved to send", "Sent", "Acknowledged"];

const DEPOSIT_RULES: { icon: ReactNode; text: string }[] = [
  {
    icon: <Vault />,
    text: "Held by Amahoro Residences Ltd as a liability. It is never counted as rent or income.",
  },
  {
    icon: <ListCheck />,
    text: "Settled after a joint move-out inspection, within 30 days of handing back the keys.",
  },
  {
    icon: <Camera />,
    text: "Deductions only for unpaid rent, utilities, or damage beyond fair wear, each with evidence.",
  },
  {
    icon: <ScalesBalanced />,
    text: "The resident can accept or dispute each deduction. An authorised approver signs off before any refund.",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("");

export function LeasesView({ data }: { persona: Persona; data: LeasesData }) {
  const [sel, setSel] = useState(data.leases[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");

  const activeLeases = data.units.filter((u) => u.lease).length;
  const drafts = data.leases.filter((l) => !l.signedOn).length;
  const renewing = data.leases.filter((l) => l.offer).length;
  const registerSize = activeLeases + drafts;

  const q = query.trim().toLowerCase();
  const list = data.leases.filter((l) => !q || `${l.id} ${l.unit} ${l.resident}`.toLowerCase().includes(q));
  const lease = data.leases.find((l) => l.id === sel) ?? data.leases[0];
  if (!lease) return null;

  const isDraft = !lease.signedOn;
  const isCompany = lease.resident.includes("Ltd");
  const stage: FilingStage = lease.filing.stage;
  const filing = FILING[stage];
  const term = `${lease.start} – ${lease.end} · 12 months`;

  const parties = [
    {
      role: "Landlord",
      name: "Amahoro Residences Ltd",
      sub: "TIN 102 345 990 · represented by Solange Uwimana",
      initials: "AR",
    },
    {
      role: "Tenant",
      name: lease.resident,
      sub: isCompany
        ? "Company tenant · staff housing for one named occupant"
        : "Resident profile · ID checked in person",
      initials: initials(lease.resident),
    },
    ...(lease.occupant ? [{ role: "Occupant", ...lease.occupant }] : []),
  ];

  const links: { icon: ReactNode; title: string; desc: string; chip: string; tone: Tone; board: BoardId }[] = [
    {
      icon: <Wallet />,
      title: "Rent schedule",
      desc: isDraft
        ? "Generated when the lease is signed"
        : `Next charge ${money(lease.rent)} due on the ${lease.dueDay}`,
      chip: lease.rentChip?.label ?? (isDraft ? "Not started" : "Up to date"),
      tone: lease.rentChip?.tone ?? (isDraft ? "default" : "success"),
      board: "RentRoll",
    },
    {
      icon: <Vault />,
      title: "Caution deposit",
      desc: isDraft
        ? `${money(lease.rent * 2)} to be collected at signing`
        : `${money(lease.rent * 2)} held as a liability`,
      chip: isDraft ? "Not collected" : "Held",
      tone: isDraft ? "default" : "success",
      board: "MoveOuts",
    },
    {
      icon: <Wrench />,
      title: "Maintenance",
      desc: lease.maintenance?.desc ?? "No open tickets",
      chip: lease.maintenance?.chip ?? "None",
      tone: lease.maintenance?.tone ?? "default",
      board: "ResidenceService",
    },
  ];

  const sigs = isDraft
    ? [
        {
          name: lease.resident,
          party: "Tenant",
          state: "Not sent",
          tone: "default" as Tone,
          evidence: "Send for signature once the clauses are final.",
        },
        {
          name: "Solange Uwimana",
          party: "Landlord · Amahoro Residences Ltd",
          state: "Not sent",
          tone: "default" as Tone,
          evidence: "Landlord signs after the tenant.",
        },
      ]
    : [
        {
          name: lease.resident,
          party: "Tenant",
          state: "Signed",
          tone: "success" as Tone,
          evidence: lease.signatures?.tenant ?? `Signed ${lease.signedOn}`,
        },
        {
          name: "Solange Uwimana",
          party: "Landlord · Amahoro Residences Ltd",
          state: "Signed",
          tone: "success" as Tone,
          evidence: lease.signatures?.landlord ?? `Signed ${lease.signedOn}`,
        },
      ];

  const clauses = data.clauses.map((c, i) => {
    const edit = lease.edits?.find((e) => e.index === i);
    let chip = "Standard";
    let tone: Tone = "default";
    if (edit) [chip, tone] = ["Edited for this lease", "accent"];
    if (c.review) [chip, tone] = ["Needs legal review", "warning"];
    return { ...c, n: i + 1, note: edit?.note ?? c.note, chip, tone };
  });

  const noOfferText = isDraft
    ? "Renewals are possible once the lease is active."
    : (lease.renewalNote ?? `Lease ends ${lease.end}. Offers are prepared from 90 days before the end date.`);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "overview", label: "Overview", count: 0 },
    { id: "contract", label: "Contract & e-signature", count: 0 },
    { id: "renewals", label: "Renewals", count: lease.offer ? 1 : 0 },
    { id: "filings", label: "Filings & declarations", count: stage === "followup" || stage === "draft" ? 1 : 0 },
  ];

  const attach = () => toast.warning(ACK_UNAVAILABLE);

  /** Chase the resident about the open offer (`POST /ops/residence/offers/:id/remind`). */
  const remindOffer = async () => {
    const result = await remindAboutOfferAction(lease.id);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    toast.success(`Reminder recorded for ${lease.resident} · shown in the resident app if they use it`, {
      indicator: <CircleCheck className="size-4" />,
    });
  };

  /** Withdraw the open offer (`POST /ops/residence/offers/:id/withdraw`). */
  const withdrawOffer = async () => {
    const result = await withdrawOfferAction(lease.id);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    toast.success(`Renewal offer to ${lease.resident} withdrawn`, { indicator: <CircleCheck className="size-4" /> });
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Tenancy · Kacyiru Court Residences"
        title="Leases"
        description={`${activeLeases} active leases, ${drafts} draft, ${renewing} renewals in progress. Each lease is its own record, separate from rent charges and deposits.`}
        actions={
          <>
            <LinkButton href={screenHref("SettingsBusiness")} variant="ghost">
              <Files className="size-4" />
              Contract templates
            </LinkButton>
            <LinkButton href={screenHref("Applicants")}>
              <FilePlus className="size-4" />
              Open applicants
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-[16px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <SearchField aria-label="Search leases" value={query} onChange={setQuery} fullWidth>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Unit, resident or lease ID" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListView
            aria-label="Leases"
            items={list}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={new Set([lease.id])}
            onSelectionChange={(keys) => {
              const k = firstKey(keys);
              if (k) setSel(k);
            }}
            renderEmptyState={() => <p className="px-3 py-4 text-[13px] text-muted">No lease matches “{query}”.</p>}
          >
            {(l) => (
              <ListView.Item
                id={l.id}
                textValue={`${l.unit} ${l.resident}`}
                className="data-[selected=true]:bg-default"
              >
                <ListView.ItemContent>
                  <span className="min-w-10 text-[15px] font-semibold tabular">{l.unit}</span>
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{l.resident}</ListView.Title>
                    <ListView.Description className="tabular">
                      {l.id} · {l.signedOn ? `ends ${l.end}` : `starts ${l.start}`}
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={l.statusTone} className="whitespace-nowrap">
                    {l.status}
                  </ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <span className="text-[12px] text-muted tabular">
            Showing {list.length} of {registerSize} · sorted by next action
          </span>
        </div>

        <Card className="min-w-0 gap-4 p-5" aria-labelledby="ld-h" render={(p) => <section {...p} />}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-muted tabular">
                {lease.id} · {lease.unit} · {lease.type}
              </span>
              <h2 id="ld-h" className="text-[20px] leading-7 font-semibold">
                {lease.resident}
              </h2>
              <span className="text-[13px] text-muted tabular">{term}</span>
            </div>
            <div className="flex items-center gap-2">
              <ToneChip tone={lease.statusTone} size="md">
                {lease.status}
              </ToneChip>
              <LinkButton href={screenHref("RentRoll")} size="sm" variant="secondary">
                Rent roll
              </LinkButton>
            </div>
          </div>

          <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as Tab)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Lease sections">
                {tabs.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                    {t.label}
                    {t.count ? <TabCount tone="warning">{t.count}</TabCount> : null}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="overview" className="pt-4">
              <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
                <div className="flex min-w-0 flex-col gap-2.5">
                  <SubHeading>Terms</SubHeading>
                  <KeyValueList
                    items={[
                      { label: "Term", value: <span className="tabular">{term}</span> },
                      { label: "Rent", value: <span className="tabular">{money(lease.rent)} a month</span> },
                      {
                        label: "Rent cycle",
                        value: `Monthly, due on the ${lease.dueDay} · 5-day grace · MoMo or bank transfer`,
                      },
                      { label: "Notice period", value: "30 days in writing, either party" },
                      {
                        label: "Caution deposit",
                        value: <span className="tabular">{money(lease.rent * 2)} · two months’ rent</span>,
                      },
                    ]}
                  />
                  <SubHeading className="mt-2 text-[15px] leading-[22px]">Parties</SubHeading>
                  <ListView aria-label="Parties" variant="secondary" items={parties.map((p) => ({ ...p, id: p.role }))}>
                    {(pt) => (
                      <ListView.Item id={pt.id} textValue={pt.name}>
                        <ListView.ItemContent>
                          <Avatar size="sm" variant="soft" className="shrink-0">
                            <Avatar.Fallback>{pt.initials}</Avatar.Fallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title>{pt.name}</ListView.Title>
                            <ListView.Description>{pt.sub}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          <ToneChip tone="default">{pt.role}</ToneChip>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                </div>
                <div className="flex min-w-0 flex-col gap-2.5">
                  <SubHeading>Caution deposit conditions</SubHeading>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-5">
                    {DEPOSIT_RULES.map((r) => (
                      <li key={r.text} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-muted [&_svg]:size-4" aria-hidden="true">
                          {r.icon}
                        </span>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                  <SubHeading className="mt-2 text-[15px] leading-[22px]">Linked records</SubHeading>
                  <ItemCardGroup layout="list">
                    {links.map((lk, i) => (
                      <Fragment key={lk.title}>
                        {i > 0 ? <Separator /> : null}
                        <ItemCard<"a">
                          render={(p) => <NextLink {...p} href={screenHref(lk.board)} />}
                          className="text-inherit no-underline"
                        >
                          <ItemCard.Icon>{lk.icon}</ItemCard.Icon>
                          <ItemCard.Content className="min-w-0">
                            <ItemCard.Title>{lk.title}</ItemCard.Title>
                            <ItemCard.Description className="whitespace-normal tabular">{lk.desc}</ItemCard.Description>
                          </ItemCard.Content>
                          <ItemCard.Action>
                            <ToneChip tone={lk.tone}>{lk.chip}</ToneChip>
                          </ItemCard.Action>
                        </ItemCard>
                      </Fragment>
                    ))}
                  </ItemCardGroup>
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="contract" className="pt-4">
              <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                <div className="flex min-w-0 flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <SubHeading>Contract clauses</SubHeading>
                      <span className="text-[12px] text-muted">
                        Kacyiru Court residential lease v3 ·{" "}
                        {isDraft ? "Draft · editable" : "Signed version 2 · locked"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={!isDraft}
                      onPress={() => toast.warning(CLAUSES_UNAVAILABLE)}
                    >
                      <Pencil className="size-4" />
                      Edit clauses
                    </Button>
                  </div>
                  {!isDraft ? (
                    <p className="text-[12px] leading-4 text-muted">
                      Signed contracts are locked. Changes are made through a renewal or an amendment that both parties
                      sign.
                    </p>
                  ) : null}
                  <ListView aria-label="Contract clauses" variant="secondary" items={clauses}>
                    {(c) => (
                      <ListView.Item id={c.id} textValue={c.title}>
                        <ListView.ItemContent className="items-start">
                          <span className="w-5 shrink-0 text-muted tabular">{c.n}</span>
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title className="whitespace-normal">{c.title}</ListView.Title>
                            <ListView.Description className="whitespace-normal">{c.note}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          <ToneChip tone={c.tone} className="whitespace-nowrap">
                            {c.chip}
                          </ToneChip>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                </div>
                <div className="flex min-w-0 flex-col gap-2.5">
                  <SubHeading>E-signature</SubHeading>
                  {sigs.map((s) => (
                    <Card key={s.party} variant="secondary" className="gap-2 p-[14px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-[12px] text-muted">{s.party}</span>
                        </div>
                        <ToneChip tone={s.tone}>{s.state}</ToneChip>
                      </div>
                      <p className="text-[12px] leading-4 text-muted tabular">{s.evidence}</p>
                    </Card>
                  ))}
                  <Alert>
                    <Alert.Indicator>
                      <ShieldKeyhole />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Signature evidence kept 7 years</Alert.Title>
                      <Alert.Description>
                        One-time code, time, device and document fingerprint are stored with the signed PDF. The
                        retention period is your configured policy and has not been verified as a legal requirement.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <div className="flex flex-wrap items-center gap-2">
                    <GateChip icon={<ShieldExclamation className="size-3" />}>
                      7-year retention · Configured · not verified
                    </GateChip>
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={isDraft}
                      onPress={() =>
                        downloadCsv(`${lease.id}-signature-evidence.csv`, [
                          ["Lease", "Signer", "Party", "State", "Evidence"],
                          ...sigs.map((s) => [lease.id, s.name, s.party, s.state, s.evidence]),
                        ])
                      }
                    >
                      <ArrowDownToLine className="size-4" />
                      Evidence pack
                    </Button>
                  </div>
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="renewals" className="pt-4">
              <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                {lease.offer ? (
                  <Card variant="secondary" className="gap-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <SubHeading>Renewal offer</SubHeading>
                      <ToneChip tone={lease.offer.tone}>{lease.offer.state}</ToneChip>
                    </div>
                    <KeyValueList
                      items={[
                        { label: "New term", value: <span className="tabular">{lease.offer.term}</span> },
                        { label: "New rent", value: <span className="tabular">{lease.offer.rent}</span> },
                        { label: "Deposit top-up", value: <span className="tabular">{lease.offer.topup}</span> },
                        { label: "Answer by", value: lease.offer.by },
                      ]}
                    />
                    <Timeline size="sm" density="compact" aria-label="Renewal history">
                      {lease.offer.events.map((e) => (
                        <Timeline.Item key={e.title} status={e.status}>
                          <Timeline.Rail>
                            <Timeline.Marker />
                            <Timeline.Connector />
                          </Timeline.Rail>
                          <Timeline.Content className="flex flex-col pb-0.5">
                            <span className="text-[13px] leading-[18px] font-medium">{e.title}</span>
                            <span className="text-[12px] leading-4 text-muted tabular">{e.when}</span>
                          </Timeline.Content>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                    <p className="text-[12px] leading-4 text-muted">{lease.offer.note}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onPress={remindOffer}>
                        Send a reminder
                      </Button>
                      <Button size="sm" variant="ghost" onPress={withdrawOffer}>
                        Withdraw offer
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card variant="secondary" className="p-4">
                    <EmptyState size="sm">
                      <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                          <ArrowsRotateRight />
                        </EmptyState.Media>
                        <EmptyState.Title>No renewal in progress</EmptyState.Title>
                        <EmptyState.Description>{noOfferText}</EmptyState.Description>
                      </EmptyState.Header>
                    </EmptyState>
                  </Card>
                )}
                <div className="flex min-w-0 flex-col gap-2">
                  <SubHeading>Accepted renewals · this property</SubHeading>
                  <ListView aria-label="Accepted renewals" variant="secondary" items={data.accepted}>
                    {(a) => (
                      <ListView.Item id={a.id} textValue={a.title}>
                        <ListView.ItemContent>
                          <CircleCheck className="size-4 shrink-0 text-muted" aria-hidden="true" />
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title>{a.title}</ListView.Title>
                            <ListView.Description>{a.desc}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          <ToneChip tone={a.chipTone}>{a.chip}</ToneChip>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="filings" className="pt-4">
              <div className="flex flex-col gap-4">
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <SubHeading>Lease filing</SubHeading>
                      <span className="text-[12px] text-muted">
                        Policy: file the signed lease within 15 days of the last signature · version 1, effective 1 Jan
                        2026
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <GateChip icon={<ShieldExclamation className="size-3" />}>Unverified rule</GateChip>
                      <GateChip icon={<Clock className="size-3" />}>Awaiting legal sign-off</GateChip>
                    </div>
                  </div>
                  <Stepper size="sm" currentStep={filing.step} aria-label="Filing progress">
                    {FILING_STEPS.map((label) => (
                      <Stepper.Step key={label}>
                        <Stepper.Indicator />
                        <Stepper.Content>
                          <Stepper.Title>{label}</Stepper.Title>
                        </Stepper.Content>
                        <Stepper.Separator />
                      </Stepper.Step>
                    ))}
                  </Stepper>
                  <KeyValueList
                    items={[
                      { label: "Last signature", value: lease.signedOn || "Not signed yet" },
                      {
                        label: "Deadline (configured)",
                        value: stage === "ack" ? "Met" : lease.filing.deadline,
                      },
                      {
                        label: "Delivery",
                        value: stage === "ack" ? "Signed acknowledgement on file" : lease.filing.delivery,
                      },
                      { label: "Status", value: <ToneChip tone={filing.tone}>{filing.state}</ToneChip> },
                    ]}
                  />
                  {stage === "followup" ? (
                    <DropZone>
                      <DropZone.Area
                        className="p-[18px]"
                        onDrop={async (e) => {
                          if (e.items.some((item) => item.kind === "file")) attach();
                        }}
                      >
                        <DropZone.Icon>
                          <FileArrowUp />
                        </DropZone.Icon>
                        <DropZone.Label>Upload the signed or stamped acknowledgement</DropZone.Label>
                        <DropZone.Description>
                          Not available yet. Nothing is marked acknowledged without this evidence.
                        </DropZone.Description>
                        <DropZone.Trigger>Choose file</DropZone.Trigger>
                      </DropZone.Area>
                      <DropZone.Input
                        accept="application/pdf,image/*"
                        onSelect={(files) => {
                          if (files[0]) attach();
                        }}
                      />
                    </DropZone>
                  ) : null}
                  <span className="text-[12px] leading-4 text-muted">
                    Injishi does not file leases with any authority. It tracks your configured deadline.
                  </span>
                </Card>

                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <SubHeading>Rental-income declaration support</SubHeading>
                      <span className="text-[12px] text-muted">Only where verified rules require it</span>
                    </div>
                    <GateChip icon={<Lock className="size-3" />}>Tax treatment · Configured · not verified</GateChip>
                  </div>
                  <KeyValueList
                    items={[
                      {
                        label: `Verified rent, ${kigaliCalendar().year} to date`,
                        value: <span className="tabular">{lease.income}</span>,
                      },
                      { label: "Legal entity", value: "Amahoro Residences Ltd · TIN 102 345 990" },
                      {
                        label: "Tax rules applied",
                        value: "None until verified. Hotel tourism and EBM rules are not applied to residential rent.",
                      },
                    ]}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        downloadCsv(`${lease.id}-rent-summary-${kigaliCalendar().year}.csv`, [
                          [
                            "Lease",
                            "Unit",
                            "Tenant",
                            "Legal entity",
                            `Verified rent, ${kigaliCalendar().year} to date`,
                          ],
                          [lease.id, lease.unit, lease.resident, "Amahoro Residences Ltd", lease.income],
                        ])
                      }
                    >
                      <ArrowDownToLine className="size-4" />
                      Export rent summary for your adviser
                    </Button>
                    <span className="text-[12px] text-muted">Injishi does not calculate or file declarations.</span>
                  </div>
                </Card>
              </div>
            </Tabs.Panel>
          </Tabs>
        </Card>
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
