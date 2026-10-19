"use client";

import {
  ArrowRight,
  ArrowRightArrowLeft,
  ArrowRightToSquare,
  Check,
  CircleCheck,
  CircleDashed,
  Clock,
  CloudSlash,
  Comment,
  Eye,
  FileExclamation,
  House,
  LayoutCells,
  Pencil,
  PersonPlus,
  Receipt,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Drawer,
  Kbd,
  Label,
  ProgressBar,
  SearchField,
  Table,
  Tabs,
  Toast,
  toast,
} from "@heroui/react";
import { ItemCard, KPIGroup, RadioButtonGroup } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type {
  Arrival,
  Departure,
  DeskKpi,
  DeskRoom,
  GuestRequest,
  InHouseStay,
  QueueTab,
  ReadinessRoom,
  RoomStatus,
  RoomType,
} from "@injishi/data/fixtures/frontdesk";
import {
  formatRwf,
  Icon,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  TextLink,
  type Tone,
  toneColor,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { assignArrivalRoom } from "./actions";
import { bookingHref, isReady, plural, ROOM_STATUS } from "./shared";

export interface FrontDeskTodayData {
  kpis: DeskKpi[];
  tabs: QueueTab[];
  arrivals: Arrival[];
  inHouse: InHouseStay[];
  departures: Departure[];
  requests: GuestRequest[];
  readiness: ReadinessRoom[];
  roomTypes: RoomType[];
  rooms: DeskRoom[];
  recordIds: string[];
  /** Today in Kigali (YYYY-MM-DD), as the page read it; the header's date. */
  today?: string;
}

type TabId = QueueTab["id"];

const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAME = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Monday 12 October 2026" for a calendar day. */
function longDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAY_NAME[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAME[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A stay's own page (Stay and folio), by the stay's id. */
const stayHref = (stayId: string) => `/stays/${encodeURIComponent(stayId)}`;

/** Where the check-in of one arrival opens. */
const checkInHref = (bookingId: string) => `${screenHref("CheckIn")}?booking=${encodeURIComponent(bookingId)}`;

/** One table row, whichever queue it comes from. */
interface QueueRow {
  id: string;
  name: string;
  sub: string;
  search: string;
  openHref: string;
  openLabel: string;
  room: { no: string; label: string; tone: Tone; reassign: boolean };
  status: { tone: Tone; icon: ReactNode; label: string };
  balance: number;
  balanceNote: string;
  balanceChip: boolean;
  time: string;
  note: string;
  primary:
    | { kind: "link"; href: string; label: string; variant: "primary" | "secondary" | "ghost" }
    | { kind: "assign" };
  extra: { href: string; label: string; icon: ReactNode } | null;
  /** Arrivals only: the arrival this row assigns a room to. */
  arrival: Arrival | null;
}

const ID_STATUS: Record<Arrival["idStatus"], { tone: Tone; icon: ReactNode; label: string }> = {
  received: { tone: "success", icon: <CircleCheck className="size-3" />, label: "Received" },
  missing: { tone: "default", icon: <CircleDashed className="size-3" />, label: "Not received" },
  review: { tone: "warning", icon: <Eye className="size-3" />, label: "To review" },
};

const CHECKOUT: Record<Departure["checkout"], { tone: Tone; icon: ReactNode }> = {
  due: { tone: "default", icon: <Clock className="size-3" /> },
  late: { tone: "info", icon: <Clock className="size-3" /> },
  out: { tone: "success", icon: <CircleCheck className="size-3" /> },
  fiscal: { tone: "warning", icon: <FileExclamation className="size-3" /> },
};

const COLUMNS: Record<TabId, { status: string; time: string }> = {
  arrivals: { status: "Pre-arrival ID", time: "ETA · notes" },
  inHouse: { status: "Stay", time: "Leaving · notes" },
  departures: { status: "Checkout", time: "Time · notes" },
};

/** Room tiles of the readiness grid (artifact: .ij-room[data-status]). */
const TILE: Record<RoomStatus, string> = {
  dirty: "border-warning bg-surface",
  clean: "border-success bg-surface",
  inspected: "border-transparent bg-success-soft",
  occupied: "border-separator bg-surface",
  ooo: "border-danger bg-surface",
};

const SHORTCUTS: [string, string][] = [
  ["↑↓", "move"],
  ["Enter", "open"],
  ["C", "check in"],
  ["A", "assign"],
  ["M", "message"],
];

export function FrontDeskTodayView({ data, offline = false }: { data: FrontDeskTodayData; offline?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("arrivals");
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [assigning, startAssign] = useTransition();
  const [nights, setNights] = useState(1);
  const [adults, setAdults] = useState(2);
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<QueueRow[]>(() => {
    if (tab === "arrivals") {
      return data.arrivals.map((r) => {
        const fresh = assigned[r.id];
        const room = fresh ?? r.room;
        const status = fresh ? "inspected" : r.roomStatus;
        const rs = status ? ROOM_STATUS[status] : null;
        return {
          id: r.id,
          name: r.name,
          sub: `${r.bookingId} · ${plural(r.nights, "night")} · ${r.source}`,
          search: `${r.name} ${r.bookingId} ${room ?? r.roomType}`,
          openHref: bookingHref(r.bookingId, data.recordIds),
          openLabel: `Open booking for ${r.name}`,
          room: room
            ? {
                no: room,
                label: fresh ? "Inspected · just assigned" : (r.roomStatusLabel ?? rs?.label ?? ""),
                tone: rs?.tone ?? "default",
                reassign: true,
              }
            : { no: r.roomType, label: "Unassigned", tone: "warning", reassign: false },
          status: ID_STATUS[r.idStatus],
          balance: r.balance,
          balanceNote: r.balanceNote,
          balanceChip: r.balanceFlag,
          time: r.eta,
          note: r.note,
          primary: room
            ? {
                kind: "link",
                href: checkInHref(r.bookingId),
                label: "Check in",
                variant: r.atDesk ? "primary" : "secondary",
              }
            : { kind: "assign" },
          extra: null,
          arrival: r,
        };
      });
    }
    if (tab === "inHouse") {
      return data.inHouse.map((r) => ({
        id: r.id,
        name: r.name,
        sub: `${r.bookingId} · night ${r.night} of ${r.of} · ${r.source}`,
        search: `${r.name} ${r.bookingId} ${r.room} ${r.stayId}`,
        openHref: stayHref(r.id),
        openLabel: `Open stay for ${r.name}`,
        room: { no: r.room, label: "Occupied", tone: "default", reassign: false },
        status: { tone: "success", icon: <House className="size-3" />, label: `${r.stayId} · In house` },
        balance: r.balance,
        balanceNote: `Folio ${r.folioId}`,
        balanceChip: false,
        time: r.leaving,
        note: r.note,
        primary: { kind: "link", href: stayHref(r.id), label: "Folio", variant: "secondary" },
        extra: {
          href: screenHref("RoomRack"),
          label: `Move ${r.name} to another room`,
          icon: <ArrowRightArrowLeft className="size-4" />,
        },
        arrival: null,
      }));
    }
    // Checkout opens on the first guest still due out; everyone else checks out from their stay's page.
    const next = data.departures.find((d) => d.checkout === "due" || d.checkout === "late")?.id;
    return data.departures.map((r) => {
      const done = r.checkout === "out" || r.checkout === "fiscal";
      return {
        id: r.id,
        name: r.name,
        sub: `${r.bookingId} · ${plural(r.nights, "night")} · ${r.source}`,
        search: `${r.name} ${r.bookingId} ${r.room}`,
        openHref: stayHref(r.id),
        openLabel: `Open stay for ${r.name}`,
        room: done
          ? { no: r.room, label: "Dirty · to clean", tone: "warning", reassign: false }
          : { no: r.room, label: "Occupied", tone: "default", reassign: false },
        status: { ...CHECKOUT[r.checkout], label: r.checkoutLabel },
        balance: r.balance,
        balanceNote: r.balanceNote,
        balanceChip: r.checkout === "fiscal",
        time: r.time,
        note: r.note,
        primary: done
          ? { kind: "link", href: stayHref(r.id), label: "View", variant: "ghost" }
          : {
              kind: "link",
              href: r.id === next ? screenHref("Checkout") : stayHref(r.id),
              label: "Check out",
              variant: r.id === next ? "primary" : "secondary",
            },
        extra: done
          ? null
          : { href: stayHref(r.id), label: `Open folio for ${r.name}`, icon: <Receipt className="size-4" /> },
        arrival: null,
      };
    });
  }, [tab, data, assigned]);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.search.toLowerCase().includes(q)) : rows;
  const tabDef = data.tabs.find((t) => t.id === tab) ?? data.tabs[0];
  const cols = COLUMNS[tab];

  const openRequests = data.requests.length;
  const readyCount = data.readiness.filter((r) => isReady(r.status)).length;
  const readyPct = data.readiness.length ? Math.round((readyCount / data.readiness.length) * 100) : 0;
  const unassigned = data.arrivals.filter((a) => !a.room && !assigned[a.id]);

  const target = data.arrivals.find((a) => a.id === assignFor) ?? null;
  // Who the header talks about: the guest at the desk, and the rest of today's arrivals.
  const atDesk = data.arrivals.find((a) => a.atDesk) ?? data.arrivals[0] ?? null;
  const others = data.arrivals.filter((a) => a !== atDesk);
  const stillCleaning = others.filter((a) => a.room && !isReady(a.roomStatus)).length;
  const headline = atDesk
    ? `${atDesk.name} is next. ${others.length} more ${others.length === 1 ? "guest arrives" : "guests arrive"} today and ${stillCleaning} of their rooms ${stillCleaning === 1 ? "is" : "are"} still being cleaned.`
    : "Nobody else arrives today.";
  const targetRooms = target ? data.rooms.filter((r) => r.roomType === target.roomType) : [];
  const walkInHref = `${screenHref("WalkIn")}?nights=${nights}&adults=${adults}`;

  const openAssign = (id: string) => {
    setAssignFor(id);
    setPick(null);
  };
  const closeAssign = () => {
    setAssignFor(null);
    setPick(null);
  };
  const confirmAssign = () => {
    if (!pick || !target) return;
    const chosen = pick;
    const arrival = target;
    // The hold is the API's: it refuses a room held for somebody else, or of another type.
    startAssign(async () => {
      const result = await assignArrivalRoom(arrival.bookingId, chosen);
      if (!result.ok) {
        toast.danger(`Room ${chosen} was not assigned: ${result.error}`);
        return;
      }
      setAssigned((a) => ({ ...a, [arrival.id]: chosen }));
      toast.success(`Room ${chosen} held for ${arrival.name} for the whole stay`, {
        indicator: <CircleCheck className="size-4" />,
      });
      closeAssign();
    });
  };

  // Desk shortcuts advertised under the search field: / search, ↑↓ move, Enter open, C check in,
  // A assign, M message, N quick walk-in.
  const keyState = useRef({ shown, current, router, walkInHref });
  keyState.current = { shown, current, router, walkInHref };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      const s = keyState.current;
      const row = s.shown[Math.min(s.current, s.shown.length - 1)];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === "ArrowDown" || key === "ArrowUp") {
        if (!s.shown.length) return;
        e.preventDefault();
        setCurrent((c) => Math.max(0, Math.min(s.shown.length - 1, c + (key === "ArrowDown" ? 1 : -1))));
      } else if (key === "Enter" && row && el === document.body) {
        s.router.push(row.openHref);
      } else if (key === "c" && row?.primary.kind === "link") {
        s.router.push(row.primary.href);
      } else if (key === "a" && row?.arrival) {
        setAssignFor(row.arrival.id);
        setPick(null);
      } else if (key === "m" && row) {
        s.router.push(screenHref("Messages"));
      } else if (key === "n") {
        s.router.push(s.walkInHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PageContent className="text-[14px] leading-5">
      <Toast.Provider placement="bottom" />
      {/* Offline: the top bar's connection chip (slot 0) shows the queue; online keeps the registry's chip. */}
      {offline ? (
        <TopbarStatus
          slot={0}
          kind="chip"
          tone="warning"
          icon="CloudSlash"
          label="Offline preview"
          board="OfflineDesk"
        />
      ) : null}
      <PageHeader
        eyebrow={`${data.today ? longDay(data.today) : "Monday 12 October 2026"} · Isangano Lakeside Hotel · Morning shift`}
        title="Today"
        description={headline}
        actions={
          <>
            <LinkButton href={screenHref("RoomRack")} variant="ghost">
              <LayoutCells className="size-4" />
              Room rack
            </LinkButton>
            <LinkButton href={screenHref("WalkIn")} variant="secondary">
              <PersonPlus className="size-4" />
              Walk-in
            </LinkButton>
            <LinkButton href={atDesk ? checkInHref(atDesk.bookingId) : screenHref("CheckIn")}>
              <ArrowRightToSquare className="size-4" />
              {atDesk ? `Check in ${atDesk.name}` : "Check in"}
            </LinkButton>
          </>
        }
      />

      {offline ? (
        <Alert status="warning" role="status">
          <Alert.Indicator>
            <CloudSlash />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Offline desk preview · nothing is queued on this computer</Alert.Title>
            <Alert.Description>
              Working offline is not available yet: this page still reads and writes through the connection, and no
              check-in or note is kept to send later.{" "}
              <TextLink href={screenHref("OfflineDesk")}>See the offline desk preview</TextLink>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <section aria-label="Today at a glance">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => {
            const value = k.id === "requests" ? openRequests : k.value;
            return (
              <Fragment key={k.id}>
                {i > 0 ? <KPIGroup.Separator /> : null}
                <KPI className="min-w-[min(170px,100%)] flex-[1_1_170px]">
                  <KPI.Header>
                    <KPI.Icon status={k.status === "warning" ? "warning" : undefined}>
                      <Icon name={k.icon} className="size-4" />
                    </KPI.Icon>
                    <KPI.Title>{k.label}</KPI.Title>
                  </KPI.Header>
                  <KPI.Content>
                    <KPI.Value value={value} className="text-[22px] tabular">
                      {(formatted) => (k.total === null ? formatted : `${formatted} of ${k.total}`)}
                    </KPI.Value>
                  </KPI.Content>
                  <KPI.Footer>
                    <p className="text-xs leading-4 text-muted">{k.foot}</p>
                  </KPI.Footer>
                </KPI>
              </Fragment>
            );
          })}
        </KPIGroup>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3" aria-label="Guest queues">
          <Tabs
            variant="secondary"
            selectedKey={tab}
            onSelectionChange={(k) => {
              setTab(k as TabId);
              setCurrent(0);
            }}
            className="gap-3"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Today's guests" className="justify-start">
                {data.tabs.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id} className="h-10 w-auto flex-none gap-2 px-3">
                    {t.label}
                    <Chip size="sm" variant="soft" color={tab === t.id ? "accent" : "default"}>
                      {t.count}
                    </Chip>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SearchField
                aria-label="Find guest, booking or room"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setCurrent(0);
                }}
                className="max-w-[360px] flex-[1_1_260px]"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input ref={searchRef} placeholder="Find guest, booking or room" />
                  {query ? (
                    <SearchField.ClearButton />
                  ) : (
                    <Kbd className="mr-2" aria-hidden="true">
                      /
                    </Kbd>
                  )}
                </SearchField.Group>
              </SearchField>
              <span className="flex-1" />
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {SHORTCUTS.map(([k, label]) => (
                  <Fragment key={k}>
                    <Kbd>{k}</Kbd>
                    {label}
                  </Fragment>
                ))}
              </span>
            </div>

            {data.tabs.map((t) => (
              <Tabs.Panel key={t.id} id={t.id} className="p-0">
                <QueueTable
                  label={tabDef.tableLabel}
                  cols={cols}
                  rows={shown}
                  current={current}
                  onAssign={openAssign}
                  empty={q ? `No ${t.label.toLowerCase()} match “${query}”` : "Nobody here yet"}
                />
              </Tabs.Panel>
            ))}
          </Tabs>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{tabDef.foot}</span>
            <LinkButton href={screenHref("Reservations")} size="sm" variant="ghost">
              All reservations
              <ArrowRight className="size-4" />
            </LinkButton>
          </div>
        </section>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4" aria-label="Desk side panel">
          <Card className="gap-2.5 p-4" aria-labelledby="req-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="req-h" className="text-[15px] leading-[22px] font-semibold">
                Guest Requests
              </h2>
              <Chip size="sm" variant="soft" color="warning">
                {openRequests} open
              </Chip>
            </div>
            <ul className="flex flex-col gap-1.5">
              {data.requests.map((rq) => {
                const done = false;
                return (
                  <li key={rq.id}>
                    <ItemCard variant="secondary" className="items-center gap-2.5 px-2.5 py-2">
                      <ItemCard.Icon>
                        <Icon name={rq.icon} />
                      </ItemCard.Icon>
                      <ItemCard.Content className="min-w-0 gap-0.5">
                        <ItemCard.Title className="max-w-full truncate">{rq.title}</ItemCard.Title>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Chip size="sm" variant="soft" color={toneColor(done ? "success" : rq.tone)}>
                            {done ? "Done" : rq.status}
                          </Chip>
                          <span className="truncate text-xs text-muted tabular">
                            {rq.meta} · {rq.age}
                          </span>
                        </span>
                      </ItemCard.Content>
                      <ItemCard.Action className="flex gap-0.5">
                        {rq.canComplete && !done ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            isIconOnly
                            aria-label={`Mark ${rq.title} done`}
                            onPress={() =>
                              // Guest requests have no workflow on threads yet (frontdesk.guestRequests is sample data).
                              toast.warning("Completing a guest request is not available yet. Nothing was changed.")
                            }
                          >
                            <Check className="size-4" />
                          </Button>
                        ) : null}
                        <LinkButton
                          href={screenHref(rq.board)}
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={rq.linkLabel}
                          title={rq.linkLabel}
                        >
                          <Icon name={rq.linkIcon} className="size-4" />
                        </LinkButton>
                      </ItemCard.Action>
                    </ItemCard>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="gap-2.5 p-4" aria-labelledby="hk-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="hk-h" className="text-[15px] leading-[22px] font-semibold">
                Housekeeping Readiness
              </h2>
              <LinkButton href={screenHref("HousekeepingBoard")} size="sm" variant="ghost">
                Board
              </LinkButton>
            </div>
            <ProgressBar
              value={readyPct}
              valueLabel={`${readyCount} of ${data.readiness.length} assigned`}
              className="gap-1.5"
            >
              <Label>Arrival rooms ready</Label>
              <ProgressBar.Output className="tabular" />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ul className="grid grid-cols-3 gap-2">
              {data.readiness.map((h) => (
                <li key={h.id} className="min-w-0">
                  <NextLink
                    href={screenHref("HousekeepingBoard")}
                    aria-label={`Room ${h.room}, ${h.label}, for ${h.guest}`}
                    className={`flex flex-col rounded-xl border px-2.5 py-2 text-inherit no-underline transition-colors hover:bg-default ${TILE[h.status]}`}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="text-[15px] font-semibold tabular">{h.room}</span>
                      <span className="truncate text-[11px] font-medium">{h.label}</span>
                    </span>
                    <span className="truncate text-[11px] text-muted">{h.guest}</span>
                  </NextLink>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-4 text-muted">
              Dirty rooms can't be checked into without a manager override.{" "}
              {unassigned.length
                ? unassigned.map((a) => `${a.name} (${a.roomType})`).join(", ") +
                  (unassigned.length === 1 ? " has no room yet." : " have no room yet.")
                : "Every arrival has a room."}
            </p>
          </Card>

          <Card className="gap-3 p-4" aria-labelledby="wi-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="wi-h" className="text-[15px] leading-[22px] font-semibold">
                Quick Walk-in
              </h2>
              <Kbd>N</Kbd>
            </div>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {data.roomTypes.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span>{t.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted tabular">{formatRwf(t.rate)}</span>
                    <Chip size="sm" variant="soft" color={t.left === 1 ? "warning" : "default"}>
                      {t.left} left
                    </Chip>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <NumberStepper
                size="sm"
                value={nights}
                onChange={setNights}
                minValue={1}
                maxValue={14}
                className="flex items-center gap-2"
              >
                <Label>Nights</Label>
                <NumberStepper.Group>
                  <NumberStepper.DecrementButton aria-label="Fewer nights" />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton aria-label="More nights" />
                </NumberStepper.Group>
              </NumberStepper>
              <NumberStepper
                size="sm"
                value={adults}
                onChange={setAdults}
                minValue={1}
                maxValue={6}
                className="flex items-center gap-2"
              >
                <Label>Adults</Label>
                <NumberStepper.Group>
                  <NumberStepper.DecrementButton aria-label="Fewer adults" />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton aria-label="More adults" />
                </NumberStepper.Group>
              </NumberStepper>
            </div>
            <LinkButton href={walkInHref} variant="secondary" fullWidth>
              Find a room · {plural(nights, "night")}, {plural(adults, "adult")}
              <ArrowRight className="size-4" />
            </LinkButton>
            <p className="text-xs leading-4 text-muted">
              Published walk-in rates, excluding VAT. Rates are managed by your general manager.
            </p>
          </Card>
        </aside>
      </div>

      <Drawer.Backdrop isOpen={!!target} onOpenChange={(open) => (open ? null : closeAssign())}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="as-h" className="w-[min(440px,100vw)]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header className="flex flex-col gap-0.5">
              <Drawer.Heading id="as-h" className="text-[15px] leading-[22px] font-semibold">
                Assign a Room
              </Drawer.Heading>
              {target ? (
                <p className="text-[13px] text-muted">
                  {target.name} · {target.bookingId} · {target.roomType}
                </p>
              ) : null}
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3">
              <p className="text-[13px] text-muted">
                Only clean or inspected rooms can be assigned. Dirty and out-of-order rooms are shown so you know why
                they're unavailable.
              </p>
              <RadioButtonGroup
                aria-label="Rooms of this type"
                value={pick ?? ""}
                onChange={(v) => setPick(v || null)}
                className="flex flex-col gap-2"
              >
                {targetRooms.map((o) => {
                  const st = ROOM_STATUS[o.status];
                  return (
                    <RadioButtonGroup.Item
                      key={o.id}
                      value={o.room}
                      isDisabled={!isReady(o.status)}
                      className="flex-row items-center gap-3 px-3.5 py-2.5"
                    >
                      <RadioButtonGroup.ItemContent className="flex flex-1 flex-row items-center gap-3">
                        <span className="w-10 text-[15px] font-semibold tabular">{o.room}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Label className="font-medium">{st.label}</Label>
                          <span className="text-xs text-muted">{o.note}</span>
                        </span>
                        <StatusDot tone={st.tone} />
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  );
                })}
              </RadioButtonGroup>
              <p className="text-xs text-muted">
                The room is held for this guest's whole stay. The rate doesn't change within the booked room type.
              </p>
            </Drawer.Body>
            <Drawer.Footer className="flex justify-end gap-2">
              <Button variant="secondary" onPress={closeAssign}>
                Cancel
              </Button>
              <Button isDisabled={!pick || assigning} onPress={confirmAssign}>
                {pick ? `Assign room ${pick}` : "Choose a room"}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </PageContent>
  );
}

function QueueTable({
  label,
  cols,
  rows,
  current,
  onAssign,
  empty,
}: {
  label: string;
  cols: { status: string; time: string };
  rows: QueueRow[];
  current: number;
  onAssign: (arrivalId: string) => void;
  empty: string;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            <Table.Column isRowHeader className="px-2.5 py-2">
              Guest
            </Table.Column>
            <Table.Column className="px-2.5 py-2">Room</Table.Column>
            <Table.Column className="px-2.5 py-2">{cols.status}</Table.Column>
            <Table.Column className="px-2.5 py-2 text-right">Balance due</Table.Column>
            <Table.Column className="px-2.5 py-2">{cols.time}</Table.Column>
            <Table.Column className="px-2.5 py-2 text-right">
              <span className="sr-only">Actions</span>
            </Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="p-6 text-center text-sm text-muted">{empty}</p>}>
            {rows.map((r, i) => (
              <Table.Row
                key={r.id}
                id={r.id}
                className={i === current ? "[&>td]:bg-surface-secondary" : undefined}
                aria-current={i === current ? "true" : undefined}
              >
                <Table.Cell className="px-2.5 py-2">
                  <span className="flex flex-col">
                    <NextLink
                      href={r.openHref}
                      aria-label={r.openLabel}
                      className="font-semibold whitespace-nowrap text-inherit no-underline hover:underline"
                    >
                      {r.name}
                    </NextLink>
                    <span className="text-xs leading-4 text-muted tabular">{r.sub}</span>
                  </span>
                </Table.Cell>
                <Table.Cell className="px-2.5 py-2">
                  {r.room.reassign && r.arrival ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => r.arrival && onAssign(r.arrival.id)}
                      aria-label={`Room ${r.room.no}, ${r.room.label}. Assign a different room to ${r.name}`}
                      className="-mx-1.5 h-auto flex-col items-start gap-0.5 px-1.5 py-1"
                    >
                      <span className="flex items-center gap-1">
                        <span className="font-semibold tabular">{r.room.no}</span>
                        <Pencil className="size-3 text-muted" aria-hidden="true" />
                      </span>
                      <Chip size="sm" variant="soft" color={toneColor(r.room.tone)} className="whitespace-nowrap">
                        {r.room.label}
                      </Chip>
                    </Button>
                  ) : (
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="font-semibold tabular">{r.room.no}</span>
                      <Chip size="sm" variant="soft" color={toneColor(r.room.tone)} className="whitespace-nowrap">
                        {r.room.label}
                      </Chip>
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell className="px-2.5 py-2">
                  <Chip size="sm" variant="soft" color={toneColor(r.status.tone)} className="whitespace-nowrap">
                    {r.status.icon}
                    <Chip.Label>{r.status.label}</Chip.Label>
                  </Chip>
                </Table.Cell>
                <Table.Cell className="px-2.5 py-2 text-right">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-medium whitespace-nowrap tabular">{formatRwf(r.balance)}</span>
                    {r.balanceChip ? (
                      <Chip size="sm" variant="soft" color="warning" className="whitespace-nowrap">
                        {r.balanceNote}
                      </Chip>
                    ) : (
                      <span className="text-xs whitespace-nowrap text-muted">{r.balanceNote}</span>
                    )}
                  </span>
                </Table.Cell>
                <Table.Cell className="px-2.5 py-2">
                  <span className="flex flex-col">
                    <span className="font-medium whitespace-nowrap tabular">{r.time}</span>
                    <span className="text-xs leading-4 text-muted">{r.note}</span>
                  </span>
                </Table.Cell>
                <Table.Cell className="px-2.5 py-2 text-right">
                  <span className="flex flex-nowrap items-center justify-end gap-0.5">
                    {r.primary.kind === "link" ? (
                      <LinkButton
                        href={r.primary.href}
                        size="sm"
                        variant={r.primary.variant}
                        className="whitespace-nowrap"
                      >
                        {r.primary.label}
                      </LinkButton>
                    ) : (
                      <Button
                        size="sm"
                        className="whitespace-nowrap"
                        onPress={() => r.arrival && onAssign(r.arrival.id)}
                      >
                        Assign room
                      </Button>
                    )}
                    {r.extra ? (
                      <LinkButton
                        href={r.extra.href}
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={r.extra.label}
                        title={r.extra.label}
                      >
                        {r.extra.icon}
                      </LinkButton>
                    ) : null}
                    <LinkButton
                      href={screenHref("Messages")}
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label={`Message ${r.name}`}
                      title={`Message ${r.name}`}
                    >
                      <Comment className="size-4" />
                    </LinkButton>
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
