"use client";

import {
  ArrowDownToLine,
  Ban,
  CircleCheckFill,
  CircleInfo,
  CircleMinus,
  Clock,
  Medal,
  PersonPlus,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Label,
  NumberField,
  ProgressBar,
  SearchField,
  Separator,
  Switch,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { KPIGroup, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  LoyaltyCandidate,
  LoyaltyLiability,
  LoyaltyMember,
  LoyaltyProgramme,
  LoyaltyTier,
  LoyaltyTierName,
  LoyaltyTransaction,
  LoyaltyTxType,
  Tone,
} from "@injishi/data/fixtures/operations";
import { formatNumber, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, useState } from "react";
import { downloadCsv, FieldLabel, FooterHint, FormDialog, firstKey, SelectField } from "./shared";

export interface LoyaltyData {
  programme: LoyaltyProgramme;
  tiers: LoyaltyTier[];
  members: LoyaltyMember[];
  candidates: LoyaltyCandidate[];
  transactions: LoyaltyTransaction[];
  liability: LoyaltyLiability[];
}

const fmt = (n: number) => formatNumber(n);
const TIER_TONE: Record<LoyaltyTierName, Tone> = {
  Gold: "warning",
  Silver: "default",
  Circle: "accent",
  Pending: "default",
};
const TX_TONE: Record<LoyaltyTxType, Tone> = {
  Earn: "success",
  Redeem: "accent",
  Reverse: "warning",
  Adjust: "default",
};
const TX_FILTERS: { id: "all" | LoyaltyTxType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Earn", label: "Earn" },
  { id: "Redeem", label: "Redeem" },
  { id: "Reverse", label: "Reverse" },
  { id: "Adjust", label: "Adjust" },
];
const CONSENT_METHODS = [
  { id: "desk", label: "Asked at the desk, guest said yes", short: "asked at the desk" },
  { id: "form", label: "Guest signed the paper form", short: "paper form" },
  { id: "app", label: "Guest accepted in the guest app", short: "in the guest app" },
];
const ADJUST_REASONS = ["Goodwill", "Correction", "Service recovery", "Missing stay"];
const FREE_NIGHT = 30000;
/** A manager may adjust up to this many points; above it the owner approves. */
const MANAGER_LIMIT = 2000;

type BenefitState = "yes" | "no" | "maybe";
interface Benefit {
  name: string;
  why: string;
  state: BenefitState;
}

/** Benefit eligibility of a member, from tier, points and whether redemptions are open. */
function benefitsFor(m: LoyaltyMember, redeemOpen: boolean): Benefit[] {
  if (m.tier === "Pending")
    return [
      { state: "no", name: "No benefits yet", why: "Benefits start after the guest accepts the programme terms" },
    ];
  const circle = m.tier === "Circle";
  const gold = m.tier === "Gold";
  return [
    {
      state: circle ? "no" : "maybe",
      name: gold ? "Late checkout to 14:00" : "Late checkout to 13:00",
      why: circle ? "Silver and Gold only" : "Confirmed on the departure morning if the room has no same-day arrival",
    },
    {
      state: gold && !m.topCategory ? "maybe" : "no",
      name: "Upgrade on arrival",
      why: !gold
        ? "Gold only"
        : m.topCategory
          ? "Already booked in the top category"
          : "Next category is Family Suite · 1 unsold tonight, offered at check-in if still free",
    },
    {
      state: circle ? "no" : "yes",
      name: "Welcome drink at Lake Bar",
      why: circle ? "Silver and Gold only" : "Once per stay · Lake Bar opens 16:00",
    },
    {
      state: m.points >= FREE_NIGHT && redeemOpen ? "yes" : "no",
      name: "Free night, 30,000 points",
      why: !redeemOpen
        ? "Redemptions are paused"
        : m.points >= FREE_NIGHT
          ? "Enough points · not in a blackout period"
          : `Needs ${fmt(FREE_NIGHT - m.points)} more points`,
    },
  ];
}

function BenefitIcon({ state }: { state: BenefitState }) {
  const common = { className: "mt-0.5 size-4 shrink-0", role: "img" } as const;
  if (state === "yes")
    return <CircleCheckFill {...common} aria-label="Eligible" className={`${common.className} text-success`} />;
  if (state === "maybe")
    return <Clock {...common} aria-label="Depends on availability" className={`${common.className} text-warning`} />;
  return <CircleMinus {...common} aria-label="Not eligible" className={`${common.className} text-muted`} />;
}

const signed = (n: number) => `${n < 0 ? "−" : "+"}${fmt(Math.abs(n))}`;

/**
 * What this screen cannot do yet, said plainly. The programme, its members and its transactions are sample data
 * (`operations.loyalty*` are deferred: no loyalty tables or routes exist), so enrolling, adjusting points and
 * pausing redemptions change nothing on screen: no member is added, no points are posted and nobody is asked.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. The loyalty programme is sample data; nothing was recorded.`);

// Loyalty writes would act as the signed-in person; none exists yet.
export function LoyaltyView({ persona: _persona, data }: { persona: Persona; data: LoyaltyData }) {
  const { programme: p } = data;
  const [tab, setTab] = useState("members");
  const [memberId, setMemberId] = useState(data.members[0]?.id ?? "");
  const [txFilter, setTxFilter] = useState<string>("all");
  // Enrolment form (never sent: enrolling is not available yet)
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [method, setMethod] = useState(CONSENT_METHODS[0].id);
  // Point adjustment form (never sent: adjusting is not available yet)
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjDirection, setAdjDirection] = useState<"add" | "remove">("add");
  const [adjPoints, setAdjPoints] = useState(500);
  const [adjReason, setAdjReason] = useState(ADJUST_REASONS[0]);
  const [adjNote, setAdjNote] = useState("");

  const candidate = data.candidates[0];
  const members = data.members;
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const memberCount = p.members;
  const consented = p.consented;
  const transactions = data.transactions.filter((t) => txFilter === "all" || t.type === txFilter);

  const kpis = [
    {
      id: "members",
      label: "Members",
      value: memberCount as number | null,
      foot: `${fmt(consented)} with programme consent`,
    },
    {
      id: "active",
      label: "Active, last 12 months",
      value: p.activeTwelveMonths,
      foot: "Earned or redeemed at least once",
    },
    { id: "outstanding", label: "Points outstanding", value: p.pointsOutstanding, foot: "All tiers · both properties" },
    { id: "earned", label: `Earned in ${p.month}`, value: p.earnedThisMonth, foot: "From settled, Verified folios" },
    {
      id: "redeemed",
      label: `Redeemed in ${p.month}`,
      value: p.redeemedThisMonth,
      foot: `${p.redemptionsThisMonth} redemptions · ${p.approvedAboveLimit} approved above limit`,
    },
    {
      id: "value",
      label: "Value per point",
      value: p.pointValue,
      foot: p.pointValue === null ? "Finance has not set a valuation" : "Set and approved by Finance",
    },
  ];
  const tabs = [
    { id: "members", label: "Members", count: fmt(memberCount) },
    { id: "tx", label: "Points transactions", count: `${p.transactionsToday} today` },
    {
      id: "liab",
      label: "Points liability",
      count: formatNumber(p.pointsOutstanding, { notation: "compact", maximumFractionDigits: 1 }),
    },
  ];

  const enrol = () => unavailable("Enrolling a guest");
  const exportLiability = () =>
    downloadCsv("amahoro-circle-points-liability.csv", [
      ["Breakdown", "Group", "Points"],
      ...data.liability.flatMap((l) => l.rows.map((r) => [l.title, r.label, r.points])),
      ["Total", "Points outstanding", p.pointsOutstanding],
      ["Valuation", "Value per point", p.pointValue ?? "Not configured"],
    ]);

  const openAdjust = () => {
    setAdjDirection("add");
    setAdjPoints(500);
    setAdjReason(ADJUST_REASONS[0]);
    setAdjNote("");
    setAdjustOpen(true);
  };
  const adjAmount = Number.isFinite(adjPoints) ? Math.round(adjPoints) : 0;
  const adjSigned = adjDirection === "add" ? adjAmount : -adjAmount;
  const overLimit = adjAmount > MANAGER_LIMIT;
  const overdraw = member ? adjDirection === "remove" && adjAmount > member.points : false;
  const canAdjust = Boolean(member) && adjAmount >= 1 && adjNote.trim().length > 0 && !overdraw;
  const submitAdjust = () =>
    unavailable(overLimit ? "Sending a points adjustment to the owner" : "Posting a points adjustment");

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`${p.name} · run by ${p.operator} · earns at ${p.earnsAt}`}
        title="Loyalty"
        description="Points on eligible spend, redeemed for stays and services. Points have no cash value until Finance sets one."
        actions={
          <>
            <Button variant="secondary" onPress={exportLiability}>
              <ArrowDownToLine className="size-4" />
              Export liability
            </Button>
            <Button onPress={() => setEnrolOpen(true)}>
              <PersonPlus className="size-4" />
              Enrol a guest
            </Button>
          </>
        }
      />

      <section aria-label="Programme figures">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[160px] flex-[1_1_160px]">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  {k.value === null ? (
                    <span className="text-[18px] leading-7 font-semibold">Not configured</span>
                  ) : (
                    <KPI.Value value={k.value} className="tabular" />
                  )}
                </KPI.Content>
                <KPI.Footer className="mt-1.5">
                  <p className="text-[12px] leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <Card aria-labelledby="tier-h" className="gap-2.5 p-[18px]">
          <Card.Header>
            <Card.Title id="tier-h" className="text-[15px] font-semibold">
              Tiers and Benefits
            </Card.Title>
            <Card.Description>Qualifying period: rolling 12 months</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-2.5">
            {data.tiers.map((t) => (
              <div key={t.id} className="flex flex-col gap-1 border-t border-separator pt-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Medal className="size-4" style={{ color: `var(--chart-${t.chart})` }} aria-hidden="true" />
                    <span className="text-[14px] font-semibold">{t.name}</span>
                    <Chip size="sm" variant="soft">
                      ×{formatNumber(t.multiplier, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </Chip>
                  </span>
                  <span className="text-[12px] text-muted tabular">{fmt(t.members)} members</span>
                </div>
                <span className="text-[12px] leading-4 text-muted">{t.qualify}</span>
                <span className="text-[13px] leading-[18px]">{t.benefits}</span>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card aria-labelledby="earn-h" className="gap-3 p-[18px]">
          <Card.Header className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Card.Title id="earn-h" className="text-[15px] font-semibold">
                Earn Rule
              </Card.Title>
              <Card.Description>Version 2 · effective 1 Jul 2026</Card.Description>
            </div>
            <Chip size="sm" variant="soft" color="success">
              Active
            </Chip>
          </Card.Header>
          <Card.Content>
            <KeyValueList
              items={[
                { label: "Rate", value: "1 point per RWF 1,000 of eligible spend" },
                {
                  label: "Eligible",
                  value:
                    "Rooms at BAR, Non-refundable and Bed & Breakfast; food and drink at Isangano Terrace and Lake Bar",
                },
                {
                  label: "Not eligible",
                  value:
                    "Taxes and levies, group and corporate contract rates, third-party package parts, Ikawa Corner (separate merchant)",
                },
                { label: "Posted when", value: "The folio is settled and its payment is Verified" },
                { label: "Reversed when", value: "The stay is cancelled or refunded; the original entry is kept" },
                { label: "Expiry", value: "24 months after the member’s last activity" },
              ]}
            />
          </Card.Content>
        </Card>

        <Card aria-labelledby="red-h" className="gap-3 p-[18px]">
          <Card.Header>
            <Card.Title id="red-h" className="text-[15px] font-semibold">
              Redemption Controls
            </Card.Title>
            <Card.Description>Applied at the desk, in outlets and online</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <Switch isSelected onChange={() => unavailable("Pausing redemptions")}>
              <Switch.Content className="text-[14px]">
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Redemptions open
              </Switch.Content>
            </Switch>
            <KeyValueList
              items={[
                { label: "Minimum", value: "2,000 points" },
                { label: "Maximum", value: "50% of a folio" },
                { label: "Approval", value: "General manager above 20,000 points" },
                {
                  label: "Rewards",
                  value: "Free night, Standard Queen 30,000 · dinner for two 6,000 · late checkout 1,500",
                },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Blackout dates</FieldLabel>
              <span className="flex flex-wrap gap-1.5">
                <Chip size="sm" variant="soft">
                  <Ban className="size-3" />
                  <Chip.Label>23–26 Oct · EAC Health Forum</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft">
                  <Ban className="size-3" />
                  <Chip.Label>24 Dec – 2 Jan</Chip.Label>
                </Chip>
              </span>
            </div>
          </Card.Content>
        </Card>
      </div>

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="gap-4">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Loyalty records" className="w-full justify-start">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className="h-10 w-auto flex-none gap-2 px-3 text-[14px] font-medium">
                {t.label}
                <Chip size="sm">{t.count}</Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="members" className="flex flex-wrap items-start gap-[16px] p-0">
          <Table className="min-w-0 flex-[1_1_600px]">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Members"
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([member?.id ?? ""])}
                onSelectionChange={(keys) => {
                  const k = firstKey(keys);
                  if (k) setMemberId(k);
                }}
              >
                <Table.Header>
                  <Table.Column isRowHeader>Member</Table.Column>
                  <Table.Column>Tier</Table.Column>
                  <Table.Column className="text-right">Points</Table.Column>
                  <Table.Column>Last activity</Table.Column>
                  <Table.Column>Consent</Table.Column>
                </Table.Header>
                <Table.Body>
                  {members.map((m) => (
                    <Table.Row key={m.id} id={m.id} className="cursor-pointer">
                      <Table.Cell>
                        <span className="flex items-center gap-2.5">
                          <Avatar size="sm" variant="soft">
                            <Avatar.Fallback>{m.initials}</Avatar.Fallback>
                          </Avatar>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-[12px] text-muted tabular">{m.account}</span>
                          </span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(TIER_TONE[m.tier])}>
                          {m.tier}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium tabular">{fmt(m.points)}</Table.Cell>
                      <Table.Cell className="text-[13px]">{m.lastActivity}</Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-wrap gap-1">
                          <Chip size="sm" variant="soft" color={m.programmeConsent ? "success" : "warning"}>
                            {m.programmeConsent ? "Programme" : "No consent"}
                          </Chip>
                          <Chip size="sm" variant="soft">
                            {m.marketing ? "Offers on" : "Offers off"}
                          </Chip>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          {member ? (
            <aside aria-labelledby="mem-h" className="min-w-0 flex-[1_1_340px]">
              <Card className="gap-3 p-[18px]">
                <div className="flex items-start gap-3">
                  <Avatar variant="soft" color="accent">
                    <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 id="mem-h" className="text-base leading-[22px] font-semibold">
                      {member.name}
                    </h2>
                    <span className="text-[12px] text-muted tabular">
                      {member.account} · {member.tier} · {fmt(member.points)} points
                    </span>
                  </div>
                  <LinkButton href={screenHref("Guests")} size="sm" variant="ghost">
                    Profile
                  </LinkButton>
                </div>
                <KeyValueList
                  items={[
                    { label: "Programme consent", value: member.consent },
                    { label: "Marketing", value: member.marketingDetail },
                    { label: "Current stay", value: member.stay },
                  ]}
                />
                <Separator />
                <h3 className="text-[15px] leading-[22px] font-semibold">Benefit Eligibility</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {benefitsFor(member, true).map((b) => (
                    <li key={b.name} className="flex items-start gap-2.5">
                      <BenefitIcon state={b.state} />
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-[13px] font-medium">{b.name}</span>
                        <span className="text-[12px] leading-4 text-muted">{b.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" isDisabled={member.tier === "Pending"} onPress={openAdjust}>
                    Adjust points
                  </Button>
                  <span className="text-[12px] text-muted">
                    {member.tier === "Pending"
                      ? "Enrol the guest before adjusting points"
                      : "Needs a reason · above 2,000 needs the owner"}
                  </span>
                </div>
              </Card>
            </aside>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="tx" className="flex flex-col gap-4 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segment
              aria-label="Transaction type"
              selectedKey={txFilter}
              onSelectionChange={(k) => setTxFilter(String(k))}
            >
              {TX_FILTERS.map((f) => (
                <Segment.Item key={f.id} id={f.id}>
                  {f.label}
                </Segment.Item>
              ))}
            </Segment>
            <span className="text-[12px] text-muted">
              Entries are never edited or deleted; corrections are new entries that point to the original.
            </span>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Points transactions">
                <Table.Header>
                  <Table.Column isRowHeader>When</Table.Column>
                  <Table.Column>Member</Table.Column>
                  <Table.Column>Type</Table.Column>
                  <Table.Column>Source</Table.Column>
                  <Table.Column className="text-right">Points</Table.Column>
                  <Table.Column>Recorded by</Table.Column>
                  <Table.Column>Audit note</Table.Column>
                </Table.Header>
                <Table.Body>
                  {transactions.map((x) => (
                    <Table.Row key={x.id} id={x.id}>
                      <Table.Cell className="text-[13px] whitespace-nowrap tabular">
                        <span className="flex flex-col gap-0.5">
                          <span>{x.when}</span>
                          <span className="text-[12px] text-muted">{x.id}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-[13px]">{x.member}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(TX_TONE[x.type])}>
                          {x.type}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-[13px] tabular">{x.source}</Table.Cell>
                      <Table.Cell
                        className={`text-right font-semibold tabular ${x.points < 0 ? "text-muted" : "text-foreground"}`}
                      >
                        {signed(x.points)}
                      </Table.Cell>
                      <Table.Cell className="text-[13px]">{x.by}</Table.Cell>
                      <Table.Cell className="min-w-[min(220px,100%)] text-[12px] leading-4 whitespace-normal text-muted">
                        {x.note}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel id="liab" className="flex flex-col gap-4 p-0">
          <Alert>
            <Alert.Indicator>
              <CircleInfo />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Reported in points only</Alert.Title>
              <Alert.Description>
                Monetary valuation: Not configured. Finance has not set or approved a value per point, so no currency
                amount or breakage estimate is shown. As at 12 Oct 2026, 06:00, from the loyalty ledger.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            {data.liability.map((l) => (
              <Card key={l.id} className="gap-2.5 p-[18px]" aria-label={l.title}>
                <Card.Header>
                  <h3 className="text-[15px] leading-[22px] font-semibold">{l.title}</h3>
                  <Card.Description>{l.description}</Card.Description>
                </Card.Header>
                <Card.Content className="flex flex-col gap-2.5">
                  {l.rows.map((r) => (
                    <ProgressBar
                      key={r.label}
                      value={Math.round((r.points / p.pointsOutstanding) * 100)}
                      size="sm"
                      aria-label={`${r.label}: ${fmt(r.points)} points`}
                      className="gap-1"
                    >
                      <span className="flex w-full items-center justify-between gap-2 text-[13px]">
                        <span>{r.label}</span>
                        <span className="font-semibold tabular">{fmt(r.points)}</span>
                      </span>
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  ))}
                </Card.Content>
                <Card.Footer className="flex items-center justify-between gap-2 border-t border-separator pt-2">
                  <span className="text-[12px] text-muted">{l.footLabel}</span>
                  <span className="text-[13px] font-semibold tabular">
                    {l.footPoints === null ? "Not configured" : fmt(l.footPoints)}
                  </span>
                </Card.Footer>
              </Card>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>

      <FormDialog
        isOpen={enrolOpen}
        onOpenChange={setEnrolOpen}
        title={`Enrol in ${p.name}`}
        description="Ask the guest first. Nothing is earned until they accept the programme terms."
        footer={
          <>
            {!terms ? <FooterHint>Programme terms must be accepted</FooterHint> : null}
            <Button variant="secondary" onPress={() => setEnrolOpen(false)}>
              Cancel
            </Button>
            <Button isDisabled={!terms} onPress={enrol}>
              Enrol guest
            </Button>
          </>
        }
      >
        {candidate ? (
          <SearchField fullWidth defaultValue={`${candidate.name} · ${candidate.arrival} · ${candidate.booking}`}>
            <Label>Guest</Label>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input />
              <SearchField.ClearButton />
            </SearchField.Group>
            <Description>Phone on file {candidate.phone} · ID details are not shown here</Description>
          </SearchField>
        ) : null}
        <SelectField label="How consent was given" value={method} options={CONSENT_METHODS} onChange={setMethod} />
        <Checkbox isSelected={terms} onChange={setTerms}>
          <Checkbox.Content className="items-start">
            <Checkbox.Control className="mt-0.5">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-[13px] leading-[18px]">
              The guest accepts the {p.name} terms, version 2 of 1 Jul 2026 (required)
            </span>
          </Checkbox.Content>
        </Checkbox>
        <Checkbox isSelected={marketing} onChange={setMarketing}>
          <Checkbox.Content className="items-start">
            <Checkbox.Control className="mt-0.5">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-[13px] leading-[18px]">
              The guest wants offers by SMS and email (optional, off unless they say yes)
            </span>
          </Checkbox.Content>
        </Checkbox>
      </FormDialog>

      {member ? (
        <FormDialog
          isOpen={adjustOpen}
          onOpenChange={setAdjustOpen}
          title={`Adjust points · ${member.name}`}
          description={`${member.account} · ${fmt(member.points)} points. The adjustment is a new ledger entry; earlier entries are never changed.`}
          footer={
            <>
              <FooterHint>
                {overdraw
                  ? `Cannot remove more than the ${fmt(member.points)} points on the account`
                  : overLimit
                    ? `Above ${fmt(MANAGER_LIMIT)} points needs the owner. Adjusting points is not available yet.`
                    : "Adjusting points is not available yet: the programme is sample data."}
              </FooterHint>
              <Button variant="secondary" onPress={() => setAdjustOpen(false)}>
                Cancel
              </Button>
              <Button isDisabled={!canAdjust} onPress={submitAdjust}>
                {overLimit ? "Send to owner" : "Post adjustment"}
              </Button>
            </>
          }
        >
          <Segment
            aria-label="Add or remove points"
            selectedKey={adjDirection}
            onSelectionChange={(k) => setAdjDirection(k === "remove" ? "remove" : "add")}
            className="self-start"
          >
            <Segment.Item id="add">Add points</Segment.Item>
            <Segment.Item id="remove">Remove points</Segment.Item>
          </Segment>
          <NumberField fullWidth value={adjPoints} onChange={setAdjPoints} minValue={1} className="gap-1">
            <Label>Points</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input className="tabular" />
              <NumberField.IncrementButton />
            </NumberField.Group>
            <Description>
              Balance after: {fmt(Math.max(0, member.points + adjSigned))} points
              {overLimit ? " once the owner approves" : ""}
            </Description>
          </NumberField>
          <SelectField label="Reason" value={adjReason} options={ADJUST_REASONS} onChange={setAdjReason} />
          <TextField fullWidth value={adjNote} onChange={setAdjNote} isRequired className="gap-1">
            <Label>Audit note</Label>
            <TextArea rows={3} placeholder="What happened, and who agreed it with the guest" />
            <Description>Kept with the entry in the loyalty ledger</Description>
          </TextField>
        </FormDialog>
      ) : null}
    </PageContent>
  );
}
