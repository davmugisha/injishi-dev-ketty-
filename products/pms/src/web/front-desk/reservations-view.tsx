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
  Toast,
  toast,
} from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { formatRwf, GateChip, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useMemo, useState, useTransition } from "react";
import type { BookingRequest, Reservation, ReservationsSummary, ReservationView } from "../../model/frontdesk.ts";
import type { Persona } from "../../model/shared.ts";
import { useBoardHref, usePmsActions } from "../mount.tsx";
import { ChoiceSelect, plural } from "./shared.tsx";

interface ReservationsData {
  bookings: Reservation[];
  views: ReservationView[];
  summary: ReservationsSummary;
  requests: BookingRequest[];
  /** Today's day number, including when the live desk has no bookings. */
  today?: number;
  /** The property the desk's day is read for, as the API names it. */
  property: string;
}

type Mode = "view" | "cancel" | "cancelled" | "modify" | "noshow" | "noshowDone";

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

/** Today in the prototype's fixtures: Monday 12 October 2026. The live list sends its own day (`today`). */
const FIXTURE_TODAY = 12;
const ANY_STATUS = "Any status";
const ALL_CHANNELS = "All channels";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A day number as "12 Oct": a day of October in the fixtures, days since 1970-01-01 from the live list. */
function dayLabel(n: number): string {
  if (n < 1000) return `${n} Oct`;
  const d = new Date(n * 86_400_000);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "12 Oct 2026" for a day number. */
function dayLabelYear(n: number): string {
  return n < 1000 ? `${n} Oct 2026` : `${dayLabel(n)} ${new Date(n * 86_400_000).getUTCFullYear()}`;
}

/** The saved views, read against the day the list was read on. */
function savedFilters(today: number): Record<ReservationView["id"], (r: Reservation) => boolean> {
  return {
    all: () => true,
    today: (r) => r.arrivalDay === today,
    payment: (r) => r.paymentTone === "warning",
    noRoom: (r) => !r.room && r.kind !== "cancelled",
    notArrived: (r) => r.kind === "noshow",
  };
}

/** The arrival date presets: the fixtures' own, or the same three cut from the live list's today. */
function datePresets(summary: ReservationsSummary, today: number): ReservationsSummary["dateRanges"] {
  if (today === FIXTURE_TODAY) return summary.dateRanges;
  return [
    {
      id: "month",
      label: `Arriving ${dayLabel(today - 3)} – ${dayLabel(today + 19)}`,
      from: today - 3,
      to: today + 19,
    },
    { id: "today", label: `Arriving ${dayLabel(today)}`, from: today, to: today },
    { id: "week", label: `Arriving ${dayLabel(today)} – ${dayLabel(today + 6)}`, from: today, to: today + 6 },
  ];
}

/** "10:49": the time a decision was taken on this screen, in Kigali. */
const nowClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

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
  const screenHref = useBoardHref();
  const { bookings, summary } = data;
  const TODAY = data.today ?? bookings.find((b) => b.today !== undefined)?.today ?? FIXTURE_TODAY;
  const SAVED_FILTER = savedFilters(TODAY);
  const dateRanges = datePresets(summary, TODAY);
  const windowLabel =
    TODAY === FIXTURE_TODAY ? summary.window : `${dayLabel(dateRanges[0].from)} to ${dayLabel(dateRanges[0].to)}`;
  const totalBookings = TODAY === FIXTURE_TODAY ? summary.totalBookings : bookings.length;
  const linked = initialBooking ? bookings.find((b) => b.id === initialBooking) : undefined;
  const [view, setView] = useState<"all" | "requests">(initialView);
  const [sel, setSel] = useState(linked?.id ?? bookings.find((b) => b.kind === "future")?.id ?? bookings[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>(linked?.kind === "noshow" ? "noshow" : "view");
  const [actedAt, setActedAt] = useState(TODAY === FIXTURE_TODAY ? summary.actedAt : "");
  const defaultRange = dateRanges[0]?.id ?? "";
  const [filters, setFilters] = useState<Filters>({
    base: "all",
    status: ANY_STATUS,
    channel: ALL_CHANNELS,
    query: initialBooking && !linked ? initialBooking : "",
    range: defaultRange,
  });
  const [activeView, setActiveView] = useState<string>("all");
  // Saved views are not kept anywhere yet (see saveView), so there are none to list.
  const custom: CustomView[] = [];
  const [cancelReason, setCancelReason] = useState(summary.cancelReasons[0] ?? "");
  const [noShowReason, setNoShowReason] = useState(summary.noShowReasons[0] ?? "");
  const [req, setReq] = useState<Record<string, RequestState>>({});

  const statuses = useMemo(() => [ANY_STATUS, ...new Set(bookings.map((b) => b.status))], [bookings]);
  const channels = useMemo(() => [ALL_CHANNELS, ...new Set(bookings.map((b) => b.channel))], [bookings]);
  const rangeOf = (id: string) => dateRanges.find((d) => d.id === id) ?? dateRanges[0];
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
  /**
   * Saved views live in `list_saved_views` per list, and this list has no key there yet; a view kept only in
   * this browser would vanish on reload while saying it was saved. So nothing is saved, and the screen says so.
   */
  const saveView = () => {
    if (!filtersLabel) return;
    toast.warning("Saving a view is not available yet. Your filters stay until you leave this page.");
  };

  return (
    <PageContent className="gap-4 text-[14px] leading-5">
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`Front office · ${data.property}`}
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
                  {totalBookings}
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
                    {urgent.name}'s request {urgent.autoDeclines.toLowerCase()}, in {urgent.left}. The room stays held
                    until then.
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
              options={dateRanges.map((d) => d.label)}
              value={dateRange?.label ?? ""}
              onChange={(label) => setFilter({ range: dateRanges.find((d) => d.label === label)?.id ?? filters.range })}
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
                        No bookings match{q ? ` “${q}”` : " these filters"} between {windowLabel}.
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
                today={TODAY}
                actedAt={actedAt}
                onActed={() => setActedAt(nowClock())}
                cancelReason={cancelReason}
                setCancelReason={setCancelReason}
                noShowReason={noShowReason}
                setNoShowReason={setNoShowReason}
                onReview={() => setView("requests")}
              />
            ) : null}
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            Showing {rows.length} of {totalBookings} bookings from {windowLabel} · booking status and stay status are
            separate records
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
              actedAt={actedAt}
              onActed={() => setActedAt(nowClock())}
              decidedBy={persona.name}
              setState={(s) => setReq((m) => ({ ...m, [r.id]: s }))}
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
  cancelReason,
  setCancelReason,
  noShowReason,
  setNoShowReason,
  onReview,
  today,
  actedAt,
  onActed,
}: {
  b: Reservation;
  mode: Mode;
  setMode: (m: Mode) => void;
  summary: ReservationsSummary;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  noShowReason: string;
  setNoShowReason: (v: string) => void;
  onReview: () => void;
  today: number;
  actedAt: string;
  onActed: () => void;
}) {
  const screenHref = useBoardHref();
  const { cancelBooking, recordNoShow } = usePmsActions();
  const TODAY = today;
  const [busy, startBusy] = useTransition();
  const [outcome, setOutcome] = useState<{ refund: number; kept: number; rule: string } | null>(null);
  /** Cancel at the guest's request: the API refunds on the booking's tier, and says what it did. */
  const confirmCancel = () =>
    startBusy(async () => {
      const result = await cancelBooking(b.id, cancelReason);
      if (!result.ok) {
        toast.danger(`${b.id} was not cancelled: ${result.error}`);
        return;
      }
      setOutcome({ refund: result.value.refundRwf, kept: result.value.keptRwf, rule: result.value.rule });
      onActed();
      setMode("cancelled");
      toast.success(`${b.id} cancelled · ${formatRwf(result.value.refundRwf)} refunded`);
    });
  const confirmNoShow = () =>
    startBusy(async () => {
      const result = await recordNoShow(b.id, noShowReason);
      if (!result.ok) {
        toast.danger(`No-show not recorded: ${result.error}`);
        return;
      }
      onActed();
      setMode("noshowDone");
      toast.success(`${b.guest} recorded as a no-show`);
    });
  const k = b.kind;
  const canChange = k === "future" || k === "today";
  const nights = plural(b.nights, "night");
  const roomLabel = b.room ? `Room ${b.room}` : "No room yet";
  const quote = b.cancelQuote ?? null;
  // The tier is locked when the booking (or the request) is made; the API refunds on it.
  const terms = "Cancellation tier locked at booking · refunds follow it";

  // What cancelling or recording a no-show would refund is the API's quote on the booking's own tier. Without
  // one the API would refuse the command, so the desk is told so and offered nothing to press.
  const kept = quote?.kept ?? 0;
  const refund = quote?.refund ?? 0;
  const cxNote = quote
    ? `${quote.rule} The refund goes back to the wallet the guest paid from; it shows Pending until the provider confirms.`
    : "This booking cannot be cancelled from the desk now: the platform gives no refund quote for it (its payment may no longer be held). Nothing was changed.";
  const cxAfter = outcome
    ? `${outcome.refund > 0 ? `${formatRwf(outcome.refund)} back to the guest's wallet` : "No refund due"} · ${formatRwf(outcome.kept)} kept. ${outcome.rule}`
    : "Cancelled.";
  const change = b.change ?? {
    arrival: dayLabelYear(b.arrivalDay),
    departure: dayLabelYear(b.arrivalDay + b.nights),
  };
  const noShow = b.noShowQuote ?? null;

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
        {/* The full reservation record (parties, saved terms, payment history) is still the prototype's sample,
            so a live booking is never opened there: this panel is the booking as the API holds it. */}
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast.warning(
              "The full reservation record is not available yet. This panel shows the booking as it is saved.",
            )
          }
        >
          Open
        </Button>
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
              {quote ? "At the guest's request · the tier this booking locked" : "No refund quote for this booking"}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5 text-[13px]" hidden={!quote}>
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
            <Button size="sm" variant="danger" isDisabled={busy || !quote} onPress={confirmCancel}>
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
              Cancelled {actedAt} · {b.roomType} released for {b.dates}
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
          {/* Nothing checks the new dates (no route changes a booking's dates), so nothing claims they are free. */}
          <Chip size="sm" variant="soft" color="default" className="self-start">
            <CircleInfo className="size-3" />
            <Chip.Label>Availability for new dates is not checked here</Chip.Label>
          </Chip>
          <p className="text-xs text-muted">
            New nights are priced at today's published rate; the cancellation policy stays at the booking's version.
            Upgrades and rate overrides go to your general manager.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={() => setMode("view")}>
              Back
            </Button>
            <Button
              size="sm"
              onPress={() =>
                // Changing dates reprices the stay and moves money; no route does it yet, so nothing is changed.
                toast.warning("Changing dates is not available yet. Cancel and rebook, or ask your general manager.")
              }
            >
              Save change
            </Button>
          </div>
        </Card>
      ) : null}
      {k === "noshow" && mode === "noshow" ? (
        <Card variant="secondary" className="gap-2.5 p-3.5">
          <span className="font-semibold">Mark {b.guest} as a no-show?</span>
          <p className="text-[13px]">
            {noShow
              ? `Arrival was ${dayLabel(b.arrivalDay)} and nobody checked in. ${noShow.rule} ${formatRwf(noShow.kept)} is kept and ${formatRwf(noShow.refund)} goes back; the rooms held from ${dayLabel(TODAY)} are released.`
              : `Arrival was ${dayLabel(b.arrivalDay)} and nobody checked in, but a no-show cannot be recorded for this booking now: the platform gives no refund quote for it (its payment may no longer be held). Nothing was changed.`}
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
            <Button size="sm" variant="danger" isDisabled={busy || !noShow} onPress={confirmNoShow}>
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
            <Alert.Title>Marked no-show {actedAt}</Alert.Title>
            <Alert.Description>
              {dayLabel(TODAY)} released to inventory. {noShow ? noShow.rule : "Recorded as a no-show."}
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
  actedAt,
  onActed,
  decidedBy,
  setState,
}: {
  r: BookingRequest;
  st: RequestState;
  actedAt: string;
  onActed: () => void;
  decidedBy: string;
  setState: (s: RequestState) => void;
}) {
  const screenHref = useBoardHref();
  const { approveBookingRequest, declineBookingRequest } = usePmsActions();
  const [busy, startBusy] = useTransition();
  /** Approve or decline on the API; the request leaves the queue once it is answered. */
  const decide = (answer: "approved" | "declined") =>
    startBusy(async () => {
      const result = answer === "approved" ? await approveBookingRequest(r.id) : await declineBookingRequest(r.id);
      if (!result.ok) {
        toast.danger(`${r.id} was not ${answer}: ${result.error}`);
        return;
      }
      onActed();
      setState(answer);
      toast.success(
        answer === "approved" ? `${r.name}'s booking is confirmed` : `${r.name}'s request is declined and refunded`,
      );
    });
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
          <Button size="sm" isDisabled={busy} onPress={() => decide("approved")}>
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
          {/* The decline command carries no reason (POST /ops/reservations/:id/decline takes no body), so none is asked for. */}
          <p className="text-[13px]">
            Decline {r.name}'s request? The guest is emailed that it was declined, the hold is released and the payment
            taken with the request goes back in full.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onPress={() => setState("open")}>
              Back
            </Button>
            <Button size="sm" variant="danger" isDisabled={busy} onPress={() => decide("declined")}>
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
            <Alert.Title>Approved {actedAt} · booking confirmed</Alert.Title>
            <Alert.Description>
              The payment taken with the request now pays for the booking. The guest is emailed the confirmation and
              sees it in their trips.
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
            <Alert.Title>Declined {actedAt}</Alert.Title>
            <Alert.Description>
              The guest is emailed the decision and the hold was released. The payment taken with the request goes back
              in full.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </Card>
  );
}
