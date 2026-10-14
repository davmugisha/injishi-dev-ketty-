"use client";

import {
  Bookmark,
  Calendar,
  CalendarXmark,
  Check,
  CircleCheck,
  CircleInfo,
  CircleXmark,
  Comment,
  Hourglass,
  Lock,
  Pencil,
  PersonXmark,
  Plus,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ProgressBar,
  SearchField,
  Table,
  Tag,
  TagGroup,
  TextField,
} from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  BookingRequest,
  CancellationTier,
  Reservation,
  ReservationsSummary,
  ReservationView,
} from "@injishi/data/fixtures/frontdesk";
import { formatRwf, GateChip, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useMemo, useState } from "react";
import { ChoiceSelect, PolicyTiers, plural } from "./shared";

export interface ReservationsData {
  bookings: Reservation[];
  views: ReservationView[];
  summary: ReservationsSummary;
  requests: BookingRequest[];
  tiers: CancellationTier[];
  recordIds: string[];
}

type Mode = "view" | "cancel" | "cancelled" | "modify" | "modified" | "noshow" | "noshowDone";

/** What the list shows: a saved view plus the filters above the table. */
interface Filters {
  base: ReservationView["id"];
  status: string;
  channel: string;
  query: string;
  range: string;
}

/** A view the desk saved from the current filters ("Save this view"). */
interface CustomView {
  id: string;
  label: string;
  filters: Filters;
}
type RequestState = "open" | "declining" | "approved" | "declined";

/** Today in the prototype: Monday 12 October 2026. */
const TODAY = 12;
const ANY_STATUS = "Any status";
const ALL_CHANNELS = "All channels";

const SAVED_FILTER: Record<ReservationView["id"], (r: Reservation) => boolean> = {
  all: () => true,
  today: (r) => r.arrivalDay === TODAY,
  payment: (r) => r.paymentTone === "warning",
  noRoom: (r) => !r.room && r.kind !== "cancelled",
  notArrived: (r) => r.kind === "noshow",
};

/** Mobile money or card provider named in the payment detail. */
function providerOf(detail: string): string {
  if (detail.includes("MTN")) return "MTN";
  if (detail.includes("Airtel")) return "Airtel";
  return "the provider";
}

export function ReservationsView({
  persona,
  data,
  initialBooking,
  initialView,
}: {
  persona: Persona;
  data: ReservationsData;
  initialBooking: string | null;
  initialView: "all" | "requests";
}) {
  const { bookings, summary } = data;
  const linked = initialBooking ? bookings.find((b) => b.id === initialBooking) : undefined;
  const [view, setView] = useState<"all" | "requests">(initialView);
  const [sel, setSel] = useState(linked?.id ?? "BK-20439");
  const [mode, setMode] = useState<Mode>(linked ? (linked.kind === "noshow" ? "noshow" : "view") : "cancel");
  const defaultRange = summary.dateRanges[0]?.id ?? "";
  const [filters, setFilters] = useState<Filters>({
    base: "all",
    status: ANY_STATUS,
    channel: ALL_CHANNELS,
    query: initialBooking && !linked ? initialBooking : "",
    range: defaultRange,
  });
  const [activeView, setActiveView] = useState<string>("all");
  const [custom, setCustom] = useState<CustomView[]>([]);
  const [cancelReason, setCancelReason] = useState(summary.cancelReasons[0] ?? "");
  const [noShowReason, setNoShowReason] = useState(summary.noShowReasons[0] ?? "");
  const [req, setReq] = useState<Record<string, RequestState>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const statuses = useMemo(() => [ANY_STATUS, ...new Set(bookings.map((b) => b.status))], [bookings]);
  const channels = useMemo(() => [ALL_CHANNELS, ...new Set(bookings.map((b) => b.channel))], [bookings]);
  const rangeOf = (id: string) => summary.dateRanges.find((d) => d.id === id) ?? summary.dateRanges[0];
  const dateRange = rangeOf(filters.range);
  const matches = (r: Reservation, f: Filters) => {
    const q = f.query.trim().toLowerCase();
    const dr = rangeOf(f.range);
    return (
      SAVED_FILTER[f.base](r) &&
      (f.status === ANY_STATUS || r.status === f.status) &&
      (f.channel === ALL_CHANNELS || r.channel === f.channel) &&
      (!dr || (r.arrivalDay >= dr.from && r.arrivalDay <= dr.to) || r.kind === "inhouse") &&
      (!q || [r.guest, r.id, r.channel, r.phone ?? ""].some((v) => v.toLowerCase().includes(q)))
    );
  };
  const rows = bookings.filter((r) => matches(r, filters));
  const q = filters.query.trim();
  /** Change one filter; a saved custom view no longer applies once its filters change. */
  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setActiveView(patch.base ?? filters.base);
  };

  const b = bookings.find((r) => r.id === sel) ?? bookings[0];
  const reqStates = data.requests.map((r) => ({ r, st: req[r.id] ?? "open" }));
  const openReqs = reqStates.filter((x) => x.st === "open" || x.st === "declining");
  const urgent = openReqs.find((x) => x.r.urgent)?.r;

  const pick = (id: string) => {
    const r = bookings.find((x) => x.id === id);
    if (!r) return;
    setSel(id);
    setMode(r.kind === "noshow" ? "noshow" : "view");
  };

  const filtersLabel = [
    filters.status !== ANY_STATUS ? filters.status : null,
    filters.channel !== ALL_CHANNELS ? filters.channel : null,
    filters.range !== defaultRange ? dateRange?.label : null,
    q ? `“${q}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const saveView = () => {
    if (!filtersLabel) return;
    const existing = custom.find((c) => c.label === filtersLabel);
    if (existing) {
      setActiveView(existing.id);
      return;
    }
    const view: CustomView = { id: `custom-${custom.length + 1}`, label: filtersLabel, filters };
    setCustom((c) => [...c, view]);
    setActiveView(view.id);
  };

  return (
    <PageContent className="gap-4 text-[14px] leading-5">
      <PageHeader
        eyebrow="Front office · Isangano Lakeside Hotel"
        title="Reservations"
        description="Find, change and approve bookings. Refunds follow the booking's policy and are paid out by Payments, not from the desk."
        actions={
          <>
            <Segment
              aria-label="Reservation lists"
              selectedKey={view}
              onSelectionChange={(k) => setView(k === "requests" ? "requests" : "all")}
            >
              <Segment.Item id="all" className="gap-1.5">
                Bookings
                <Chip size="sm" variant="soft">
                  {summary.totalBookings}
                </Chip>
              </Segment.Item>
              <Segment.Item id="requests" className="gap-1.5">
                Requests
                <Chip size="sm" variant="soft" color={openReqs.length ? "danger" : "default"}>
                  {openReqs.length}
                </Chip>
              </Segment.Item>
            </Segment>
            <LinkButton href={screenHref("WalkIn")}>
              <Plus className="size-4" />
              New booking
            </LinkButton>
          </>
        }
      />

      {view === "all" ? (
        <div className="flex flex-col gap-3.5">
          {openReqs.length ? (
            <Alert status="warning" role="status">
              <Alert.Indicator>
                <Hourglass />
              </Alert.Indicator>
              <Alert.Content className="flex-1">
                <Alert.Title>
                  {openReqs.length === 1
                    ? "1 booking request is waiting for a decision"
                    : `${openReqs.length} booking requests are waiting for a decision`}
                </Alert.Title>
                {urgent ? (
                  <Alert.Description>
                    {urgent.name}'s request auto-declines at 12:00 today, in {urgent.left}. The room stays held until
                    then.
                  </Alert.Description>
                ) : null}
              </Alert.Content>
              <Button size="sm" variant="secondary" className="self-center" onPress={() => setView("requests")}>
                Review requests
              </Button>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              aria-label="Search reservations"
              value={filters.query}
              onChange={(v) => setFilter({ query: v })}
              className="max-w-[320px] flex-[1_1_240px]"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Guest, booking, phone or company" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ChoiceSelect
              aria-label="Status filter"
              options={statuses}
              value={filters.status}
              onChange={(v) => setFilter({ status: v })}
              className="min-w-[140px]"
            />
            <ChoiceSelect
              aria-label="Channel filter"
              options={channels}
              value={filters.channel}
              onChange={(v) => setFilter({ channel: v })}
              className="min-w-[150px]"
            />
            <ChoiceSelect
              aria-label="Arrival dates"
              options={summary.dateRanges.map((d) => d.label)}
              value={dateRange?.label ?? ""}
              onChange={(label) =>
                setFilter({ range: summary.dateRanges.find((d) => d.label === label)?.id ?? filters.range })
              }
              indicator={<Calendar className="size-4" />}
              className="min-w-[170px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">Saved views</span>
            <TagGroup
              aria-label="Saved views"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[activeView]}
              onSelectionChange={(keys) => {
                const k = String([...keys][0] ?? "");
                const saved = custom.find((c) => c.id === k);
                if (saved) {
                  setFilters(saved.filters);
                  setActiveView(saved.id);
                } else if (k) setFilter({ base: k as ReservationView["id"] });
              }}
              size="sm"
            >
              <TagGroup.List className="flex flex-wrap gap-1.5">
                {data.views.map((v) => (
                  <Tag key={v.id} id={v.id}>
                    {v.label} · {bookings.filter(SAVED_FILTER[v.id]).length}
                  </Tag>
                ))}
                {custom.map((c) => (
                  <Tag key={c.id} id={c.id} textValue={c.label}>
                    <Bookmark className="size-3" aria-hidden="true" />
                    {c.label} · {bookings.filter((r) => matches(r, c.filters)).length}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={!filtersLabel}
              onPress={saveView}
              aria-label={filtersLabel ? `Save this view: ${filtersLabel}` : "Save this view"}
            >
              <Bookmark className="size-4" />
              Save this view
            </Button>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <Table className="min-w-0 flex-[999_1_620px]">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Reservations"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={[sel]}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    const k = [...keys][0];
                    if (k) pick(String(k));
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Guest · booking</Table.Column>
                    <Table.Column>Dates</Table.Column>
                    <Table.Column>Room</Table.Column>
                    <Table.Column>Channel</Table.Column>
                    <Table.Column>Booking · stay</Table.Column>
                    <Table.Column>Payment</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <p className="p-6 text-center text-sm text-muted">
                        No bookings match{q ? ` “${q}”` : " these filters"} between {summary.window}.
                      </p>
                    )}
                  >
                    {rows.map((r) => (
                      <Table.Row
                        key={r.id}
                        id={r.id}
                        textValue={`${r.guest} ${r.id}`}
                        className={`cursor-pointer ${r.id === sel ? "[&>td]:bg-surface-secondary" : ""}`}
                      >
                        <Table.Cell>
                          <span className="flex items-center gap-2.5">
                            <Avatar size="sm" variant="soft">
                              <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                            </Avatar>
                            <span className="flex flex-col">
                              <span className="font-medium whitespace-nowrap">{r.guest}</span>
                              <span className="text-xs text-muted tabular">{r.id}</span>
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="whitespace-nowrap tabular">{r.dates}</span>
                            <span className="text-xs text-muted">{plural(r.nights, "night")}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="whitespace-nowrap">{r.roomType}</span>
                            <span className="text-xs text-muted tabular">
                              {r.room ? `Room ${r.room}` : "No room yet"}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px]">{r.channel}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col items-start gap-0.5">
                            <Chip size="sm" variant="soft" color={toneColor(r.statusTone)}>
                              {r.status}
                            </Chip>
                            <span className="text-xs whitespace-nowrap text-muted">{r.stay}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={toneColor(r.paymentTone)} className="whitespace-nowrap">
                            {r.payment}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>

            {b ? (
              <BookingInspector
                key={b.id}
                b={b}
                mode={mode}
                setMode={setMode}
                summary={summary}
                tiers={data.tiers}
                cancelReason={cancelReason}
                setCancelReason={setCancelReason}
                noShowReason={noShowReason}
                setNoShowReason={setNoShowReason}
                onReview={() => setView("requests")}
              />
            ) : null}
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            Showing {rows.length} of {summary.totalBookings} bookings from {summary.window} · booking status and stay
            status are separate records
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted">
              Request-to-book: decide within 24 hours or the request declines itself and the hold is released.
            </p>
            <GateChip icon={<Lock className="size-3" />}>Booking mode and window set by your general manager</GateChip>
          </div>
          {reqStates.map(({ r, st }) => (
            <RequestCard
              key={r.id}
              r={r}
              st={st}
              reasons={summary.declineReasons}
              reason={reason[r.id] ?? null}
              actedAt={summary.actedAt}
              decidedBy={persona.name}
              setState={(s) => setReq((m) => ({ ...m, [r.id]: s }))}
              setReason={(v) => setReason((m) => ({ ...m, [r.id]: v }))}
            />
          ))}
        </div>
      )}
    </PageContent>
  );
}

function BookingInspector({
  b,
  mode,
  setMode,
  summary,
  tiers,
  cancelReason,
  setCancelReason,
  noShowReason,
  setNoShowReason,
  onReview,
}: {
  b: Reservation;
  mode: Mode;
  setMode: (m: Mode) => void;
  summary: ReservationsSummary;
  tiers: CancellationTier[];
  cancelReason: string;
  setCancelReason: (v: string) => void;
  noShowReason: string;
  setNoShowReason: (v: string) => void;
  onReview: () => void;
}) {
  const k = b.kind;
  const canChange = k === "future" || k === "today";
  const nights = plural(b.nights, "night");
  const roomLabel = b.room ? `Room ${b.room}` : "No room yet";
  const terms =
    k === "request" ? "Quote only · terms saved on approval" : `${summary.policy} · DEP-STD v2 · saved at booking`;

  const days = b.arrivalDay - TODAY;
  const tierIx = days > 7 ? 0 : days >= 2 ? 1 : 2;
  const kept = tierIx === 0 ? 0 : tierIx === 1 ? b.deposit / 2 : Math.min(b.deposit, b.firstNight);
  const refund = b.deposit - kept;
  const provider = providerOf(b.paymentDetail);
  const cxNote =
    b.deposit > 0
      ? `Today is ${days} days before arrival, so tier ${tierIx + 1} applies. The refund is decided here by policy and paid by Payments to the original wallet; it shows Pending until the provider confirms.`
      : "No verified payment to refund. Any pending payment request is cancelled with the provider; nothing is marked refunded.";
  const cxAfter =
    refund > 0
      ? `Refund ${summary.refundId} for ${formatRwf(refund)} sent to Payments · Pending until ${provider} confirms. Kept ${formatRwf(kept)} under ${summary.policy}. Logged with your name.`
      : "No refund due. Pending payment requests were cancelled. Logged with your name.";
  const change = b.change ?? {
    arrival: `${b.arrivalDay} Oct 2026`,
    departure: `${b.arrivalDay + b.nights} Oct 2026`,
  };

  return (
    <Card className="min-w-0 flex-[1_1_340px] gap-3.5 p-[18px]" aria-labelledby="ins-h">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="ins-h" className="text-[15px] leading-[22px] font-semibold">
            {b.guest}
          </h2>
          <span className="text-xs text-muted tabular">
            {b.id} · {b.channel}
          </span>
        </div>
        <LinkButton
          href={screenHref("Messages")}
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Message ${b.guest}`}
          title={`Message ${b.guest}`}
        >
          <Comment className="size-4" />
        </LinkButton>
        <LinkButton href={`${screenHref("Reservations")}/${b.id}`} size="sm" variant="secondary">
          Open
        </LinkButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" variant="soft" color={toneColor(b.statusTone)}>
          Booking · {b.status}
        </Chip>
        <Chip size="sm" variant="soft" color={toneColor(b.paymentTone)}>
          {b.payment}
        </Chip>
      </div>
      <KeyValueList
        items={[
          { label: "Dates", value: <span className="tabular">{`${b.dates} · ${nights}`}</span> },
          { label: "Room", value: `${b.roomType} · ${roomLabel}` },
          { label: "Guests", value: b.guests },
          { label: "Terms", value: terms },
          { label: "Payment", value: b.paymentDetail },
        ]}
      />

      {canChange && mode === "view" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onPress={() => setMode("modify")}>
            <Pencil className="size-4" />
            Modify
          </Button>
          <Button size="sm" variant="danger-soft" onPress={() => setMode("cancel")}>
            <CalendarXmark className="size-4" />
            Cancel booking
          </Button>
        </div>
      ) : null}
      {k === "noshow" && mode === "view" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="danger-soft" onPress={() => setMode("noshow")}>
            <PersonXmark className="size-4" />
            Mark no-show
          </Button>
          <LinkButton href={screenHref("Messages")} size="sm" variant="ghost">
            Message guest first
          </LinkButton>
        </div>
      ) : null}
      {(k === "inhouse" || k === "cancelled") && b.info ? (
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{b.info}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {k === "request" ? (
        <div>
          <Button size="sm" onPress={onReview}>
            Review this request
          </Button>
        </div>
      ) : null}

      {canChange && mode === "cancel" ? (
        <Card variant="secondary" className="gap-3 p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Cancel {b.id}</span>
            <span className="text-xs text-muted">
              Policy {summary.policy}, the version saved in this booking's terms
            </span>
          </div>
          <PolicyTiers tiers={tiers} current={tierIx} label={`Cancellation tiers of ${summary.policy}`} />
          <ul className="flex flex-col gap-1.5 text-[13px]">
            <li className="flex justify-between gap-2">
              <span>Verified payments</span>
              <span className="tabular">{formatRwf(b.deposit)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Kept by policy</span>
              <span className="tabular">{formatRwf(kept)}</span>
            </li>
            <li className="flex justify-between gap-2 border-t border-separator pt-1.5 font-semibold">
              <span>Refund to guest</span>
              <span className="tabular">{formatRwf(refund)}</span>
            </li>
          </ul>
          <p className="text-xs text-muted">{cxNote}</p>
          <ChoiceSelect
            label="Reason"
            options={summary.cancelReasons}
            value={cancelReason}
            onChange={setCancelReason}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={() => setMode("view")}>
              Keep booking
            </Button>
            <Button size="sm" variant="danger" onPress={() => setMode("cancelled")}>
              Cancel booking
            </Button>
          </div>
        </Card>
      ) : null}
      {canChange && mode === "cancelled" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <CalendarXmark />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              Cancelled {summary.actedAt} · {b.roomType} released for {b.dates}
            </Alert.Title>
            <Alert.Description>{cxAfter}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {canChange && mode === "modify" ? (
        <Card variant="secondary" className="gap-3 p-3.5">
          <span className="font-semibold">Change dates</span>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
            <TextField defaultValue={change.arrival} className="flex flex-col gap-1">
              <Label>Arrival</Label>
              <Input className="tabular" />
            </TextField>
            <TextField defaultValue={change.departure} className="flex flex-col gap-1">
              <Label>Departure</Label>
              <Input className="tabular" />
            </TextField>
          </div>
          <Chip size="sm" variant="soft" color="success" className="self-start">
            <CircleCheck className="size-3" />
            <Chip.Label>{b.roomType} free for the new dates</Chip.Label>
          </Chip>
          <p className="text-xs text-muted">
            New nights are priced at today's published rate; the cancellation policy stays at the booking's version.
            Upgrades and rate overrides go to your general manager.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={() => setMode("view")}>
              Back
            </Button>
            <Button size="sm" onPress={() => setMode("modified")}>
              Save change
            </Button>
          </div>
        </Card>
      ) : null}
      {canChange && mode === "modified" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <Pencil />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Dates changed {summary.actedAt}</Alert.Title>
            <Alert.Description>
              Saved in the change history with your name. The guest gets an updated confirmation.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {k === "noshow" && mode === "noshow" ? (
        <Card variant="secondary" className="gap-2.5 p-3.5">
          <span className="font-semibold">Mark {b.guest} as a no-show?</span>
          <p className="text-[13px]">
            Arrival was {b.arrivalDay} Oct; night audit flagged it at 02:00. Under {summary.policy} the first night (
            {formatRwf(b.deposit)}) is kept from the verified deposit and {TODAY} Oct is released.
          </p>
          <ChoiceSelect
            label="Reason"
            options={summary.noShowReasons}
            value={noShowReason}
            onChange={setNoShowReason}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={() => setMode("view")}>
              Guest is still coming
            </Button>
            <Button size="sm" variant="danger" onPress={() => setMode("noshowDone")}>
              Mark no-show
            </Button>
          </div>
        </Card>
      ) : null}
      {k === "noshow" && mode === "noshowDone" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <PersonXmark />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Marked no-show {summary.actedAt}</Alert.Title>
            <Alert.Description>
              {TODAY} Oct released to inventory. First night kept under {summary.policy}; Finance sees it in night
              audit.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </Card>
  );
}

function RequestCard({
  r,
  st,
  reasons,
  reason,
  actedAt,
  decidedBy,
  setState,
  setReason,
}: {
  r: BookingRequest;
  st: RequestState;
  reasons: string[];
  reason: string | null;
  actedAt: string;
  decidedBy: string;
  setState: (s: RequestState) => void;
  setReason: (v: string) => void;
}) {
  const open = st === "open" || st === "declining";
  const leftTone = st === "approved" ? "success" : st === "declined" ? "default" : r.urgent ? "danger" : "warning";
  return (
    <Card className="gap-3 px-[18px] py-4" aria-label={`Request from ${r.name}`} role="article">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5">
        <Avatar variant="soft" color="accent">
          <Avatar.Fallback>{r.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
          <span className="font-semibold">{r.name}</span>
          <span className="text-xs text-muted tabular">
            {r.id} · {r.channel}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Chip size="sm" variant="soft" color={leftTone}>
            <Hourglass className="size-3" />
            <Chip.Label>{open ? `Decide in ${r.left}` : st === "approved" ? "Approved" : "Declined"}</Chip.Label>
          </Chip>
          <span className="text-xs text-muted">{open ? r.autoDeclines : `Decided by ${decidedBy}`}</span>
        </div>
      </div>
      <dl className="grid gap-2.5 text-[13px] [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Dates</dt>
          <dd className="tabular">{r.dates}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Room type</dt>
          <dd>{r.roomType}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Guests</dt>
          <dd>{r.guests}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted">Quote incl. VAT</dt>
          <dd className="tabular">{formatRwf(r.total)}</dd>
        </div>
      </dl>
      <Card variant="secondary" className="px-3 py-2.5 text-[13px]">
        <blockquote>“{r.message}”</blockquote>
      </Card>
      <ProgressBar
        value={r.windowUsed}
        color={r.urgent ? "danger" : "accent"}
        valueLabel={`${r.windowUsed}% used`}
        aria-label="Decision window used"
        className="gap-1"
      >
        <Label className="text-xs">Decision window · 24 h · room held</Label>
        <ProgressBar.Output className="text-xs tabular" />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      {st === "open" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onPress={() => setState("approved")}>
            <Check className="size-4" />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setState("declining")}>
            Decline
          </Button>
          <LinkButton href={screenHref("Messages")} size="sm" variant="ghost">
            <Comment className="size-4" />
            Ask a question
          </LinkButton>
        </div>
      ) : null}
      {st === "declining" ? (
        <Card variant="secondary" className="gap-2.5 px-3.5 py-3">
          <TagGroup
            selectionMode="single"
            selectedKeys={reason ? [reason] : []}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k) setReason(String(k));
            }}
            size="sm"
            className="flex flex-col gap-2"
          >
            <Label>Reason the guest will see</Label>
            <TagGroup.List className="flex flex-wrap gap-1.5">
              {reasons.map((x) => (
                <Tag key={x} id={x}>
                  {x}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onPress={() => setState("open")}>
              Back
            </Button>
            <Button size="sm" variant="danger" isDisabled={!reason} onPress={() => reason && setState("declined")}>
              Decline request
            </Button>
          </div>
        </Card>
      ) : null}
      {st === "approved" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Approved {actedAt} · booking confirmed, deposit not paid yet</Alert.Title>
            <Alert.Description>
              The guest has 24 h to pay the deposit through the marketplace. The room stays held; nothing is marked paid
              until the provider confirms.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {st === "declined" ? (
        <Alert status="default" role="status">
          <Alert.Indicator>
            <CircleXmark />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              Declined {actedAt} · {reason}
            </Alert.Title>
            <Alert.Description>
              The guest was told and the hold was released. Nothing had been charged.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </Card>
  );
}
