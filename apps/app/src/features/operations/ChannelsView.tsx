"use client";

import {
  ArrowsRotateRight,
  Copy,
  CopyCheck,
  Eye,
  PlugConnection,
  Plus,
  ShieldExclamation,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Switch,
  Table,
  Tabs,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { KPIGroup, ListView, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, personas, screenHref } from "@injishi/data";
import type {
  Channel,
  ChannelSource,
  ChannelSyncEntry,
  DistributionSettings,
  SyncStatus,
  Tone,
} from "@injishi/data/fixtures/operations";
import {
  formatNumber,
  formatRwf,
  GateChip,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  SectionHeader,
  StatusDot,
  toneColor,
} from "@injishi/ui";
import { Fragment, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { FieldLabel, FooterHint, FormDialog, firstKey } from "./form-parts";

interface ChannelsData {
  channels: Channel[];
  syncLog: ChannelSyncEntry[];
  sources: ChannelSource[];
  settings: DistributionSettings;
}

const LOG_STATUS: Record<SyncStatus, { label: string; tone: Tone }> = {
  ok: { label: "Delivered", tone: "success" },
  failed: { label: "Failed · retrying", tone: "danger" },
  unknown: { label: "Unknown · checking", tone: "warning" },
  dup: { label: "Duplicate ignored", tone: "default" },
};

/**
 * What this screen cannot do yet, said plainly. Channels, the sync log and the distribution settings are
 * sample data (`operations.channels`, `channelSyncLog` and `distributionSettings` are deferred: no channel
 * manager is connected and no route stops sell, retries a push, tests a connection, saves a mapping or asks for
 * a connection), so these controls change nothing on screen.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. No channel manager is connected; nothing was sent or changed.`);
const COMPACT_RWF = { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 } as const;
const rwfM = (n: number) => formatNumber(n, { ...COMPACT_RWF, minimumFractionDigits: 1 });
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

// The channels act as the signed-in person once a channel manager is connected; nothing here writes yet.
export function ChannelsView({ persona: _persona, data }: { persona: Persona; data: ChannelsData }) {
  const { syncLog, sources, settings } = data;
  const ownerName = personas.owner.name;
  const failing = data.channels.find((c) => c.tone === "danger" && c.canStopSell) ?? null;
  const [selectedId, setSelectedId] = useState(failing?.id ?? data.channels[0]?.id ?? "");
  const [tab, setTab] = useState("log");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  // The mapping a person types before saving; saving is not available yet, so it is never applied.
  const [fixOpen, setFixOpen] = useState(false);
  const [fixDraft, setFixDraft] = useState<Record<string, string>>({});
  const [connectOpen, setConnectOpen] = useState(false);

  const channels = data.channels;
  const connectable = data.channels.filter((c) => c.connection === "Not connected");

  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? id;
  const selected = channels.find((c) => c.id === selectedId) ?? channels[0];

  const log = syncLog.map((l) => ({ ...l, shown: l.status, isIssue: l.status === "failed" || l.status === "unknown" }));
  const issueCount = log.filter((l) => l.isIssue).length;
  const visibleLog = log.filter((l) => !issuesOnly || l.isIssue);
  const failingPull = failing ? log.find((l) => l.channel === failing.id && l.isIssue) : undefined;

  const total = sources.reduce(
    (a, r) => ({
      bookings: a.bookings + r.bookings,
      revenue: a.revenue + r.revenue,
      cancelled: a.cancelled + r.cancelled,
      fee: a.fee + (r.fee ?? 0),
      direct: a.direct + (r.direct ? r.bookings : 0),
    }),
    { bookings: 0, revenue: 0, cancelled: 0, fee: 0, direct: 0 },
  );
  // The source losing the most bookings to cancellation.
  const worst = [...sources].sort((a, b) => b.cancelled - a.cancelled)[0];
  const kpis = [
    {
      id: "bookings",
      label: "Bookings, 30 days",
      value: total.bookings,
      format: {},
      foot: `${rwfM(total.revenue)} room revenue, all sources`,
    },
    {
      id: "direct",
      label: "Direct share",
      value: total.direct / total.bookings,
      format: { style: "percent" } as const,
      foot: "Booking page, walk-in and phone",
    },
    {
      id: "fees",
      label: "Channel fees, 30 days",
      value: total.fee,
      format: { ...COMPACT_RWF, minimumFractionDigits: 1 },
      foot: "Estimated from agreements · marketplace fee not set",
    },
    {
      id: "cancel",
      label: "Cancellation rate",
      value: total.cancelled / total.bookings,
      format: { style: "percent" } as const,
      foot: worst ? `Highest: ${worst.source}, ${pct(worst.cancelled, worst.bookings)}%` : "",
    },
  ];

  const attemptNote = failingPull ? `attempt ${failingPull.attempts}` : "";
  const unmapped = selected ? selected.mapping.filter((m) => !m.mapped) : [];
  const openFix = () => {
    setFixDraft({});
    setFixOpen(true);
  };
  const fixReady = unmapped.length > 0 && unmapped.every((m) => (fixDraft[m.ours] ?? "").trim().length > 0);
  const saveFix = () => unavailable("Saving a channel mapping");
  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(`https://${settings.bookingUrl}`);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the link stays selectable.
    }
    setCopied(true);
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      {issueCount ? (
        <TopbarStatus
          kind="chip"
          tone="danger"
          dot="danger"
          label={`${issueCount} ${issueCount === 1 ? "sync issue" : "sync issues"}`}
        />
      ) : (
        <TopbarStatus kind="chip" tone="success" dot="success" label="No sync issues" />
      )}
      <PageHeader
        eyebrow={`${settings.property} · Commercial`}
        title="Distribution"
        description="Channels sell copies of Injishi inventory. Bookings, rates and availability stay owned here."
        actions={
          <>
            <LinkButton href={screenHref("Integrations")} variant="secondary">
              <PlugConnection className="size-4" />
              Integrations
            </LinkButton>
            <Button onPress={() => setConnectOpen(true)}>
              <Plus className="size-4" />
              Connect a channel
            </Button>
          </>
        }
      />

      {failing ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content className="flex-1">
            <Alert.Title>
              {failing.name} reservations have not reached Injishi since {failing.lastIn}
            </Alert.Title>
            <Alert.Description>
              Availability is still being sent, so a booking made on {failing.name} now could overbook. The channel
              manager rejects our token; Injishi retries every 5 minutes ({attemptNote}). Renew the token with the
              channel manager, or stop selling on {failing.name} until it is fixed.
            </Alert.Description>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onPress={() => unavailable(`Stopping sales on ${failing.name}`)}>
                Stop sell on {failing.name}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={!failingPull}
                onPress={() => unavailable("Retrying the reservation pull")}
              >
                <ArrowsRotateRight className="size-4" />
                Retry now
              </Button>
            </div>
          </Alert.Content>
        </Alert>
      ) : null}

      <section aria-label="Last 30 days">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px]">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <KPI.Value value={k.value} formatOptions={k.format} className="tabular" />
                </KPI.Content>
                <KPI.Footer className="mt-1.5">
                  <p className="text-[12px] leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          <section className="flex flex-col gap-2.5" aria-labelledby="ch-h">
            <SectionHeader id="ch-h" title="Channels" />
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Channels"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={new Set([selected?.id ?? ""])}
                  onSelectionChange={(keys) => {
                    const k = firstKey(keys);
                    if (k) setSelectedId(k);
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Channel</Table.Column>
                    <Table.Column>Connection</Table.Column>
                    <Table.Column>Rooms mapped</Table.Column>
                    <Table.Column>Rates mapped</Table.Column>
                    <Table.Column>Last success</Table.Column>
                    <Table.Column className="text-right">Fee</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {channels.map((c) => {
                      return (
                        <Table.Row key={c.id} id={c.id} className="cursor-pointer">
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-medium">{c.name}</span>
                              <span className="text-[12px] text-muted">{c.via}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(c.tone)}>
                              {c.connection}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="text-[13px] tabular">{c.roomsMapped}</Table.Cell>
                          <Table.Cell className="text-[13px] tabular">{c.ratesMapped}</Table.Cell>
                          <Table.Cell className="text-[12px] leading-4 tabular">
                            <span className="flex flex-col">
                              <span>Out {c.lastOut}</span>
                              <span>In {c.lastIn}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right text-[13px] tabular">{c.fee}</Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>

          <Tabs
            variant="secondary"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k))}
            className="gap-3"
            aria-label="Sync and acquisition"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Sync and acquisition" className="w-full justify-start">
                <Tabs.Tab id="log" className="h-10 w-auto flex-none gap-2 px-3 text-[14px] font-medium">
                  Sync log
                  <Chip size="sm">{issueCount} issues</Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="acq" className="h-10 w-auto flex-none gap-2 px-3 text-[14px] font-medium">
                  Acquisition and fees
                  <Chip size="sm">30 days</Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="log" className="p-0 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-[12px] text-muted">
                  Today, newest first · availability, rates and restrictions go out; reservations, changes and
                  cancellations come in
                </span>
                <Segment
                  size="sm"
                  aria-label="Filter sync log"
                  selectedKey={issuesOnly ? "issues" : "all"}
                  onSelectionChange={(k) => setIssuesOnly(k === "issues")}
                >
                  <Segment.Item id="all">All</Segment.Item>
                  <Segment.Item id="issues">Issues only</Segment.Item>
                </Segment>
              </div>
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Sync log">
                    <Table.Header>
                      <Table.Column isRowHeader>Time</Table.Column>
                      <Table.Column>Channel · type</Table.Column>
                      <Table.Column>Detail</Table.Column>
                      <Table.Column>Attempts</Table.Column>
                      <Table.Column>Status</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {visibleLog.map((l) => {
                        const st = LOG_STATUS[l.shown];
                        const canRetry = l.shown === "failed" || l.shown === "unknown";
                        return (
                          <Table.Row key={l.id} id={l.id}>
                            <Table.Cell className="text-[13px] tabular">{l.time}</Table.Cell>
                            <Table.Cell className="text-[12px] leading-4">
                              <span className="flex flex-col">
                                <span className="text-[13px] font-medium">{nameOf(l.channel)}</span>
                                <span className="text-muted">{l.type}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="min-w-[min(220px,100%)] text-[13px] leading-[18px] whitespace-normal">
                              {l.detail}
                            </Table.Cell>
                            <Table.Cell className="text-[12px] text-muted tabular">{l.attempts}</Table.Cell>
                            <Table.Cell>
                              <span className="flex flex-col items-start gap-1">
                                <span className="flex items-center gap-1.5 text-[13px]">
                                  <StatusDot tone={st.tone} />
                                  {st.label}
                                </span>
                                {canRetry ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Retry ${nameOf(l.channel)} ${l.type.toLowerCase()} at ${l.time}`}
                                    onPress={() => unavailable("Retrying a sync")}
                                  >
                                    <ArrowsRotateRight className="size-4" />
                                    Retry
                                  </Button>
                                ) : null}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel id="acq" className="p-0 flex flex-col gap-2.5">
              <span className="text-[12px] text-muted">
                13 Sep – 12 Oct 2026 · by booking source on the reservation · revenue is posted room revenue before tax
              </span>
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Acquisition and fees by source">
                    <Table.Header>
                      <Table.Column isRowHeader>Source</Table.Column>
                      <Table.Column className="text-right">Bookings</Table.Column>
                      <Table.Column className="text-right">Revenue</Table.Column>
                      <Table.Column>Conversion</Table.Column>
                      <Table.Column>Cancelled</Table.Column>
                      <Table.Column className="text-right">Fees</Table.Column>
                      <Table.Column className="text-right">Net</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {[
                        ...sources.map((r) => (
                          <Table.Row key={r.id} id={r.id}>
                            <Table.Cell className="text-[13px] font-medium">{r.source}</Table.Cell>
                            <Table.Cell className="text-right text-[13px] tabular">{r.bookings}</Table.Cell>
                            <Table.Cell className="text-right text-[13px] tabular">{rwfM(r.revenue)}</Table.Cell>
                            <Table.Cell className="text-[12px] text-muted">{r.conversion}</Table.Cell>
                            <Table.Cell className="text-[13px] tabular">
                              {r.cancelled} · {pct(r.cancelled, r.bookings)}%
                            </Table.Cell>
                            <Table.Cell className="text-right text-[13px] tabular">
                              <span className="flex flex-col items-end">
                                <span>{r.fee === null ? "—" : formatRwf(r.fee)}</span>
                                <span className="text-[11px] text-muted">{r.feeNote}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="text-right text-[13px] font-medium tabular">
                              {rwfM(r.revenue - (r.fee ?? 0))}
                            </Table.Cell>
                          </Table.Row>
                        )),
                        <Table.Row key="total" id="total">
                          <Table.Cell className="font-semibold">Total</Table.Cell>
                          <Table.Cell className="text-right font-semibold tabular">{total.bookings}</Table.Cell>
                          <Table.Cell className="text-right font-semibold tabular">{rwfM(total.revenue)}</Table.Cell>
                          <Table.Cell>
                            <span className="sr-only">Not applicable</span>
                          </Table.Cell>
                          <Table.Cell className="tabular">
                            {total.cancelled} · {pct(total.cancelled, total.bookings)}%
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold tabular">{formatRwf(total.fee)}</Table.Cell>
                          <Table.Cell className="text-right font-semibold tabular">
                            {rwfM(total.revenue - total.fee)}
                          </Table.Cell>
                        </Table.Row>,
                      ]}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <p className="text-[12px] leading-4 text-muted">
                Fees are estimates from each agreement until the channel invoice is matched by Finance. OTAs do not
                share visit data, so conversion is shown only for Injishi pages.
              </p>
            </Tabs.Panel>
          </Tabs>
        </div>

        <div className="flex min-w-0 flex-col gap-[16px]">
          {selected ? (
            <Card aria-labelledby="sel-h" className="gap-3 p-[18px]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id="sel-h" className="text-[15px] leading-[22px] font-semibold">
                    {selected.name}
                  </h2>
                  <span className="text-[12px] text-muted">{selected.via}</span>
                </div>
                <Chip size="sm" variant="soft" color={toneColor(selected.tone)}>
                  {selected.connection}
                </Chip>
              </div>
              <p className="text-[13px] leading-[18px]">{selected.note}</p>
              {selected.mapping.length ? (
                <div className="flex flex-col gap-2">
                  <FieldLabel id="map-l">Room and rate mapping</FieldLabel>
                  <ListView
                    variant="secondary"
                    aria-labelledby="map-l"
                    items={selected.mapping.map((m) => ({ ...m, id: m.ours }))}
                  >
                    {(m) => (
                      <ListView.Item id={m.id} textValue={`${m.ours}: ${m.theirs}`} className="min-h-0 py-[3px]">
                        <ListView.ItemContent>
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title className="text-[13px]">{m.ours}</ListView.Title>
                            <ListView.Description>{m.theirs}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          <Chip size="sm" variant="soft" color={m.mapped ? "default" : "danger"}>
                            {m.mapped ? "Mapped" : "Not mapped"}
                          </Chip>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                </div>
              ) : null}
              {selected.mapping.some((m) => !m.mapped) || selected.canStopSell ? (
                <div className="flex flex-wrap items-center gap-2">
                  {selected.mapping.some((m) => !m.mapped) ? (
                    <Button size="sm" onPress={openFix}>
                      Fix mapping
                    </Button>
                  ) : null}
                  {selected.canStopSell ? (
                    <Switch size="sm" isSelected onChange={() => unavailable(`Stopping sales on ${selected.name}`)}>
                      <Switch.Content className="text-[14px]">
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Selling on this channel
                      </Switch.Content>
                    </Switch>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card aria-labelledby="cm-h" className="gap-3 p-[18px]">
            <Card.Header className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Card.Title id="cm-h" className="text-[15px] font-semibold">
                  Channel Manager
                </Card.Title>
                <Card.Description>{settings.adapter}</Card.Description>
              </div>
              <Chip size="sm" variant="soft" color="success">
                Heartbeat {settings.heartbeat}
              </Chip>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <KeyValueList
                items={[
                  { label: "Connected since", value: settings.connectedSince },
                  {
                    label: "Agreement",
                    value: <GateChip icon={<ShieldExclamation className="size-3" />}>{settings.agreement}</GateChip>,
                  },
                  { label: "Duplicates", value: settings.duplicates },
                  { label: "Retry policy", value: settings.retryPolicy },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onPress={() => unavailable("Testing the connection")}>
                  Test connection
                </Button>
                <span className="text-[12px] text-muted">{settings.lastTest}</span>
              </div>
            </Card.Content>
          </Card>

          <Card aria-labelledby="dl-h" className="gap-3 p-[18px]">
            <Card.Header className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Card.Title id="dl-h" className="text-[15px] font-semibold">
                  Direct Booking Page
                </Card.Title>
                <Card.Description>Live availability, no commission</Card.Description>
              </div>
              <Chip size="sm" variant="soft" color="accent">
                Published
              </Chip>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <TextField fullWidth isReadOnly value={settings.bookingUrl} className="gap-1">
                <Label>Booking link</Label>
                <div className="flex items-center gap-2">
                  <Input className="min-w-0 flex-1 tabular" />
                  <Button variant="secondary" isIconOnly aria-label="Copy booking link" onPress={copyLink}>
                    {copied ? <CopyCheck className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <Description role="status">
                  {copied ? "Link copied" : "Share on WhatsApp, Instagram or your email signature"}
                </Description>
              </TextField>
              <KeyValueList
                items={[
                  { label: "Seller", value: settings.seller },
                  { label: "Payment", value: settings.payment },
                  { label: "Cancellation", value: settings.cancellation },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <LinkButton href={screenHref("MarketProperty")} size="sm" variant="secondary">
                  <Eye className="size-4" />
                  Preview page
                </LinkButton>
                <LinkButton href={screenHref("Listing")} size="sm" variant="ghost">
                  Edit listing
                </LinkButton>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
      {selected ? (
        <FormDialog
          isOpen={fixOpen}
          onOpenChange={setFixOpen}
          title={`Fix mapping · ${selected.name}`}
          description="Match each Injishi room type or rate plan to the one set up on the channel. The channel manager checks the name before anything is pushed."
          footer={
            <>
              <FooterHint>
                Until a plan is mapped, it is not sold on {selected.name} and its rate pushes are rejected.
              </FooterHint>
              <Button variant="secondary" onPress={() => setFixOpen(false)}>
                Cancel
              </Button>
              <Button isDisabled={!fixReady} onPress={saveFix}>
                Save mapping
              </Button>
            </>
          }
        >
          {unmapped.map((m) => (
            <TextField
              key={m.ours}
              fullWidth
              value={fixDraft[m.ours] ?? ""}
              onChange={(v) => setFixDraft((d) => ({ ...d, [m.ours]: v }))}
              isRequired
              className="gap-1"
            >
              <Label>
                {m.ours} · {m.kind === "room" ? "room type" : "rate plan"}
              </Label>
              <Input
                placeholder={m.kind === "room" ? "Room type name on the channel" : "Rate plan name on the channel"}
              />
              <Description>Now: {m.theirs}</Description>
            </TextField>
          ))}
        </FormDialog>
      ) : null}

      <FormDialog
        isOpen={connectOpen}
        onOpenChange={setConnectOpen}
        title="Connect a channel"
        description={`New channels connect through the channel manager. Each needs a signed channel agreement and ${ownerName}’s approval of the commission.`}
        footer={
          <Button variant="secondary" onPress={() => setConnectOpen(false)}>
            Close
          </Button>
        }
      >
        {connectable.length ? (
          <ListView variant="secondary" aria-label="Channels you can connect" items={connectable}>
            {(c) => (
              <ListView.Item id={c.id} textValue={c.name}>
                <ListView.ItemContent>
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{c.name}</ListView.Title>
                    <ListView.Description>
                      {c.via} · commission {c.fee.toLowerCase()}
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Button
                    size="sm"
                    aria-label={`Request approval to connect ${c.name}`}
                    onPress={() => unavailable(`Requesting approval to connect ${c.name}`)}
                  >
                    Request approval
                  </Button>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        ) : (
          <p className="text-[13px] text-muted">Every channel on the channel manager is connected.</p>
        )}
        <p className="text-[12px] leading-4 text-muted">
          Travel agents with an allotment book by email and need no connection; the front desk enters their bookings.
        </p>
      </FormDialog>
    </PageContent>
  );
}
