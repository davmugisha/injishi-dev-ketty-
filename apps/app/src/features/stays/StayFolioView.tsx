"use client";

import {
  ArrowRightFromSquare,
  ArrowUturnCcwLeft,
  Briefcase,
  Calendar,
  ChevronDown,
  CircleCheck,
  Clock,
  Key,
  Lock,
  PaperPlane,
  Plus,
  Tag,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  Drawer,
  FieldError,
  Input,
  Label,
  ProgressBar,
  Table,
  TextField,
} from "@heroui/react";
import { ItemCard, ListView, RadioButtonGroup, Segment, Timeline } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ChargeDepartment,
  DeskTender,
  FolioDepartment,
  FolioLine,
  FolioPayment,
  LateCheckoutOption,
  Stay,
  StayAccess,
  StayDocument,
  StayEvent,
  StayRecord,
} from "@injishi/data/fixtures/stays";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, TextLink } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useState } from "react";
import type { Selection } from "react-aria-components";
import { CardHeading, IconTile, InfoRow, Note, parseAmount, rwf, SelectField, StatTile, ToneChip } from "./parts";

export interface StayFolioData {
  stay: Stay;
  records: StayRecord[];
  lines: FolioLine[];
  payments: FolioPayment[];
  history: StayEvent[];
  access: StayAccess[];
  documents: StayDocument[];
  lateOptions: LateCheckoutOption[];
  chargeDepartments: ChargeDepartment[];
  tenders: DeskTender[];
}

const DEPT_COLOR: Record<FolioDepartment, string> = {
  Rooms: "var(--chart-1)",
  "Isangano Terrace": "var(--chart-2)",
  "Lake Bar": "var(--chart-3)",
  Laundry: "var(--chart-4)",
  Minibar: "var(--chart-5)",
};
const DEPTS: FolioDepartment[] = ["Rooms", "Isangano Terrace", "Lake Bar", "Laundry", "Minibar"];
const DEPT_FILTERS: { id: "all" | FolioDepartment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Rooms", label: "Rooms" },
  { id: "Isangano Terrace", label: "Terrace" },
  { id: "Lake Bar", label: "Lake Bar" },
  { id: "Laundry", label: "Laundry" },
];
const VOID_REASONS = ["Posted to wrong room", "Duplicate posting", "Guest did not receive service", "Wrong amount"];
const CHARGE_REASONS = [
  "Service without POS ticket",
  "Minibar count",
  "Laundry ticket",
  "Damage or loss",
  "Under-charge correction",
];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Desk permissions of the receptionist role. */
const DESK_VOID_LIMIT = 20000;
const DESK_CHARGE_LIMIT = 50000;

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

function DeptDot({ dept }: { dept: FolioDepartment }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: DEPT_COLOR[dept] }}
    />
  );
}

/** One linked record (booking, stay, folio, fiscal receipt) with its state track. */
function RecordCard({ record, current, desc }: { record: StayRecord; current: number; desc: string }) {
  const href = record.board ? screenHref(record.board) : `#${record.anchor}`;
  return (
    <NextLink href={href} className="block text-inherit no-underline">
      <ItemCard variant="secondary" className="h-full items-start">
        <ItemCard.Icon>
          <Icon name={record.icon} />
        </ItemCard.Icon>
        <ItemCard.Content className="gap-1">
          <span className="flex items-center justify-between gap-1.5">
            <ItemCard.Title className="tabular">{record.title}</ItemCard.Title>
            <span className="text-[12px] text-muted">{record.kind}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1 text-[12px] leading-5">
            <span className="sr-only">State:</span>
            {record.steps.map((label, i) => (
              <Fragment key={label}>
                {i === current ? (
                  <ToneChip tone="accent" size="sm">
                    {label}
                  </ToneChip>
                ) : (
                  <span className={i < current ? "text-muted" : "text-muted opacity-60"}>{label}</span>
                )}
                {i < record.steps.length - 1 ? (
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                ) : null}
              </Fragment>
            ))}
          </span>
          <ItemCard.Description className="whitespace-normal">{desc}</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </NextLink>
  );
}

interface Row {
  id: string;
  date: string;
  title: string;
  sub: string;
  dept: FolioDepartment;
  amount: number;
  struck: boolean;
  chip: { label: string; tone: "danger" | "default" } | null;
  action: { label: string; icon: "lock" | "void" | "show"; aria: string; run: () => void };
}

export function StayFolioView({ persona, data }: { persona: Persona; data: StayFolioData }) {
  const { stay } = data;
  const [dept, setDept] = useState<"all" | FolioDepartment>("all");
  const [sel, setSel] = useState("l3");
  const [vReason, setVReason] = useState("");
  const [voided, setVoided] = useState<Record<string, boolean>>({});
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<FolioLine[]>([]);
  const [seq, setSeq] = useState(7739);
  const [drawer, setDrawer] = useState<"charge" | "payment">("charge");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cDept, setCDept] = useState<FolioDepartment>("Lake Bar");
  const [cAmt, setCAmt] = useState("");
  const [cReason, setCReason] = useState("");
  const [cNote, setCNote] = useState("");
  const [tender, setTender] = useState<DeskTender["id"]>("mtn");
  const [pAmt, setPAmt] = useState("65000");
  const [pays, setPays] = useState<FolioPayment[]>([]);
  const [change, setChange] = useState<"late" | "extend">("late");
  const [late, setLate] = useState("15:00");
  const [lateDone, setLateDone] = useState(false);
  const [ext, setExt] = useState(2);
  const [extDone, setExtDone] = useState(false);
  const [resent, setResent] = useState(false);

  // ── Folio ──
  const lines = [...data.lines, ...extra];
  const charges = sum(lines);
  const byDept = DEPTS.map((d) => ({ d, v: sum(lines.filter((l) => l.dept === d)) })).filter((x) => x.v !== 0);
  const deptAria = `Charges by department: ${byDept.map((x) => `${x.d} ${rwf(x.v)}`).join(", ")}`;

  const why = (l: FolioLine): string => {
    if (l.voided || voided[l.id]) return "Already voided. The reversal line keeps the history.";
    if (l.reversal) return "A reversal cannot be voided. Finance handles corrections to reversals.";
    if (l.night) return "Room nights post at night audit. Only a manager or Finance can correct them.";
    if (!l.mine)
      return `Posted by ${l.by}. Outlet and housekeeping charges are corrected by their supervisor or a manager.`;
    if (l.amount > DESK_VOID_LIMIT)
      return "Desk voids are limited to RWF 20,000 per line. A manager must approve this one.";
    return "";
  };

  const pick = (id: string) => {
    setSel(id);
    setVReason("");
  };
  const toRow = (l: FolioLine): Row => {
    const w = why(l);
    const isVoided = !!(l.voided || voided[l.id]);
    return {
      id: l.id,
      date: l.date,
      title: l.title,
      sub: `${l.src} · ${l.by}`,
      dept: l.dept,
      amount: l.amount,
      struck: isVoided,
      chip: isVoided
        ? { label: "Voided", tone: "danger" }
        : l.reversal
          ? { label: "Reversal", tone: "default" }
          : l.mine
            ? { label: "Desk", tone: "default" }
            : null,
      action: {
        label: w ? "Details" : "Void",
        icon: w ? "lock" : "void",
        aria: `${w ? "Details for " : "Void "}${l.title}, ${l.date}`,
        run: () => pick(l.id),
      },
    };
  };
  const visible = lines.filter((l) => dept === "all" || l.dept === dept);
  let rows = visible.map(toRow);
  if (dept === "all") {
    const nights = visible.filter((l) => l.night);
    const byRoom = new Map<string, number>();
    for (const n of nights) byRoom.set(n.room ?? "", (byRoom.get(n.room ?? "") ?? 0) + 1);
    const rooms = [...byRoom].map(([room, count]) => `${room} × ${count}`).join(" · ");
    const audits = `night audit ${nights[0]?.audit} to ${nights[nights.length - 1]?.audit}`;
    rows = [
      {
        id: "nights",
        date: `${nights[0]?.date.split(" ")[0]}–${nights[nights.length - 1]?.date}`,
        title: `Room nights × ${nights.length}`,
        sub: `${rooms} · ${audits} · Night audit`,
        dept: "Rooms",
        amount: sum(nights),
        struck: false,
        chip: null,
        action: {
          label: "Show nights",
          icon: "show",
          aria: "Show the five room nights one per line",
          run: () => setDept("Rooms"),
        },
      },
      ...rows.filter((r) => !lines.find((l) => l.id === r.id)?.night),
    ];
  }

  const selLine = lines.find((l) => l.id === sel);
  const selWhy = selLine ? why(selLine) : "";
  const canAsk =
    !!selLine && !!selWhy && !asked[selLine.id] && !selLine.voided && !voided[selLine.id] && !selLine.reversal;

  const doVoid = () => {
    if (!selLine || !vReason || selWhy) return;
    const n = seq + 1;
    const reversal: FolioLine = {
      id: `v${n}`,
      stayId: stay.id,
      date: "12 Oct",
      title: `Reversal of ${selLine.src.split(" · ")[0]}`,
      src: `Void VD-0${n - 7300} · ${vReason}`,
      dept: selLine.dept,
      by: persona.name,
      amount: -selLine.amount,
      reversal: true,
    };
    setVoided({ ...voided, [selLine.id]: true });
    setExtra([...extra, reversal]);
    setSeq(n);
    setVReason("");
  };

  // ── Payments ──
  const allPays = [...data.payments, ...pays];
  const paid = sum(allPays.filter((p) => p.counted));
  const pend = sum(allPays.filter((p) => !p.counted));
  const balance = charges - paid;
  const uncounted = allPays.filter((p) => !p.counted).length;

  // ── Change the stay ──
  const lateOpt = data.lateOptions.find((o) => o.id === late) ?? data.lateOptions[0];
  const extDay = stay.departureDay + ext;
  const extDate = `${WEEKDAY[new Date(Date.UTC(2026, 9, extDay)).getUTCDay()]} ${extDay} Oct`;
  const avail = ext <= stay.freeNights;
  const keyChange = lateDone || extDone;

  const confirmLate = () => {
    const n = seq + 1;
    if (lateOpt.fee) {
      setExtra([
        ...extra,
        {
          id: `m${n}`,
          stayId: stay.id,
          date: "12 Oct",
          title: `Late checkout until ${lateOpt.id}`,
          src: `Desk charge DM-${n} · Late checkout policy`,
          dept: "Rooms",
          by: persona.name,
          amount: lateOpt.fee,
          mine: true,
        },
      ]);
    }
    setSeq(n);
    setLateDone(true);
  };

  const history: StayEvent[] = [...data.history];
  if (lateDone)
    history.push({
      id: "late",
      stayId: stay.id,
      status: "current",
      icon: "Clock",
      title: `Late checkout ${late} confirmed`,
      detail: `12 Oct 10:52 · ${persona.name}${lateOpt.fee ? ` · fee ${rwf(lateOpt.fee)} posted` : " · no fee"}`,
    });
  if (extDone)
    history.push({
      id: "extend",
      stayId: stay.id,
      status: "current",
      icon: "Calendar",
      title: `Extended to ${extDate}`,
      detail: `12 Oct 10:52 · ${persona.name} · ${stay.bookingId} updated`,
    });

  const until = extDone ? `${extDate} 11:00` : lateDone ? `12 Oct ${late}` : `12 Oct ${stay.dueOut}`;
  const access = data.access.map((a) => {
    if (a.kind === "mobileKey")
      return {
        ...a,
        detail: `${stay.guestFirstName}’s phone · valid to ${
          keyChange ? `12 Oct ${stay.dueOut}, change to ${until} requested 10:52` : until
        }`,
        state: keyChange ? "Change pending" : a.state,
        tone: keyChange ? ("warning" as const) : a.tone,
      };
    if (a.kind === "appClaim" && resent)
      return { ...a, detail: "Claim code re-sent by email 10:52 · claimed 6 Oct 19:20" };
    return a;
  });

  const recordView = (r: StayRecord) => {
    if (r.kind === "Stay") return { current: extDone ? 1 : r.current, desc: r.desc };
    if (r.kind === "Folio")
      return { current: r.current, desc: `Balance ${rwf(balance)} · ${uncounted} payments not verified` };
    return { current: r.current, desc: r.desc };
  };

  // ── Drawer: post a charge / take a payment ──
  const cAmount = parseAmount(cAmt);
  const cTooBig = cAmount > DESK_CHARGE_LIMIT;
  const canPost = !!cAmount && !cTooBig && !!cReason;
  const postCharge = () => {
    if (!canPost) return;
    const n = seq + 1;
    const line: FolioLine = {
      id: `m${n}`,
      stayId: stay.id,
      date: "12 Oct",
      title: cNote || `${cDept} charge`,
      src: `Desk charge DM-${n} · ${cReason}`,
      dept: cDept,
      by: persona.name,
      amount: cAmount,
      mine: true,
    };
    setExtra([...extra, line]);
    setSeq(n);
    setDrawerOpen(false);
    setSel(line.id);
    setCAmt("");
    setCReason("");
    setCNote("");
  };
  const T = data.tenders.find((t) => t.id === tender) ?? data.tenders[0];
  const isMobile = tender === "mtn" || tender === "airtel";
  const takePayment = () => {
    const amount = parseAmount(pAmt);
    if (!amount || T.blocked) return;
    const n = seq + 1;
    const cash = T.id === "cash";
    const p: FolioPayment = cash
      ? {
          id: `cash-${n}`,
          stayId: stay.id,
          tender: "Cash",
          icon: "Wallet",
          amount,
          state: "Recorded · Till 1",
          tone: "default",
          line1: `Counted by ${persona.name} at 10:52 · re-counted at shift close`,
          line2: `Allocated to ${stay.folioId}`,
          counted: true,
        }
      : {
          id: `PI-771${n - 7700}`,
          stayId: stay.id,
          tender: T.label,
          icon: T.icon,
          amount,
          state: "Pending",
          tone: "warning",
          line1: `${T.network} · intent PI-771${n - 7700} · request sent 10:52 to ${stay.payerPhone}`,
          line2: "Waiting for the guest to approve · not counted in the balance",
          counted: false,
        };
    setPays([...pays, p]);
    setSeq(n);
    setDrawerOpen(false);
  };
  const openCharge = () => {
    setCAmt("");
    setCReason("");
    setCNote("");
    setDrawer("charge");
    setDrawerOpen(true);
  };
  const openPay = () => {
    setPAmt("65000");
    setDrawer("payment");
    setDrawerOpen(true);
  };

  const staySpan = extDone
    ? `${stay.arrivalDay} to ${extDay} October · ${stay.nights + ext} nights`
    : `${stay.arrivalDay} to ${stay.departureDay} October · ${stay.nights} nights`;
  const dueLine = extDone ? `Departs ${extDate}` : `Due out today ${lateDone ? late : stay.dueOut}`;

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Front desk
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>In-house</span>
            <span aria-hidden="true">›</span>
            <span>Room {stay.room}</span>
          </>
        }
        title={`${stay.guest} · Room ${stay.room}`}
        description={
          <>
            Stay {stay.id} · {staySpan} · {dueLine} · <TextLink href={screenHref("Guests")}>Returning guest</TextLink>{" "}
            of {stay.company}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onPress={() => setChange("extend")}>
              <Calendar className="size-4" />
              Extend stay
            </Button>
            <Button variant="secondary" onPress={() => setChange("late")}>
              <Clock className="size-4" />
              Late checkout
            </Button>
            <Button variant="secondary" onPress={openCharge}>
              <Plus className="size-4" />
              Post charge
            </Button>
            <LinkButton href={screenHref("Checkout")}>
              <ArrowRightFromSquare className="size-4" />
              Check out
            </LinkButton>
          </>
        }
      />

      <section
        aria-label="Linked records and their states"
        className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]"
      >
        {data.records.map((r) => {
          const v = recordView(r);
          return <RecordCard key={r.id} record={r} current={v.current} desc={v.desc} />;
        })}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-4">
          <Card id="folio" aria-labelledby="fo-h" className="scroll-mt-6 gap-3.5 p-[18px]">
            <CardHeading
              id="fo-h"
              title={`Folio ${stay.folioId} · Charges`}
              sub={`Guest folio in RWF · ${stay.entity}, ${stay.entityTin} · each line keeps its source record`}
              action={
                <Segment
                  aria-label="Filter by department"
                  selectedKey={dept}
                  onSelectionChange={(k) => setDept(String(k) as "all" | FolioDepartment)}
                >
                  {DEPT_FILTERS.map((d) => (
                    <Segment.Item key={d.id} id={d.id}>
                      {d.label}
                    </Segment.Item>
                  ))}
                </Segment>
              }
            />

            <ul
              aria-label={deptAria}
              className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr))]"
            >
              {byDept.map((x) => (
                <li key={x.d} className="flex">
                  <StatTile className="flex-1 gap-1.5">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <DeptDot dept={x.d} />
                      <span className="text-muted">{x.d}</span>
                    </span>
                    <span className="font-semibold tabular">{rwf(x.v)}</span>
                    <ProgressBar
                      value={Math.max(0, Math.round((x.v / charges) * 100))}
                      size="sm"
                      aria-label={`${x.d} share of charges`}
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill style={{ background: DEPT_COLOR[x.d] }} />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </StatTile>
                </li>
              ))}
            </ul>

            <Table className="[&_td]:px-3 [&_th]:px-3">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={`Folio ${stay.folioId} charges`}
                  selectionMode="single"
                  selectedKeys={sel ? [sel] : []}
                  onSelectionChange={(keys: Selection) => {
                    const k = keys === "all" ? "" : String([...keys][0] ?? "");
                    if (k === "nights") setDept("Rooms");
                    else pick(k);
                  }}
                >
                  <Table.Header>
                    <Table.Column>Date</Table.Column>
                    <Table.Column isRowHeader>Charge and source</Table.Column>
                    <Table.Column>Department</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                    <Table.Column className="text-right">
                      <span className="sr-only">Actions</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {rows.map((r) => (
                      <Table.Row key={r.id} id={r.id}>
                        <Table.Cell className="text-[13px] whitespace-nowrap text-muted tabular">{r.date}</Table.Cell>
                        <Table.Cell>
                          <span className="flex min-w-[150px] flex-col whitespace-normal">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className={r.struck ? "font-medium text-muted line-through" : "font-medium"}>
                                {r.title}
                              </span>
                              {r.chip ? (
                                <ToneChip tone={r.chip.tone} size="sm">
                                  {r.chip.label}
                                </ToneChip>
                              ) : null}
                            </span>
                            <span className="text-[12px] leading-4 text-muted">{r.sub}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex items-center gap-1.5">
                            <DeptDot dept={r.dept} />
                            {r.dept}
                          </span>
                        </Table.Cell>
                        <Table.Cell
                          className={`text-right font-medium whitespace-nowrap tabular ${r.struck ? "text-muted line-through" : ""}`}
                        >
                          {rwf(r.amount)}
                        </Table.Cell>
                        <Table.Cell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" aria-label={r.action.aria} onPress={r.action.run}>
                            {r.action.icon === "lock" ? (
                              <Lock className="size-4" />
                            ) : r.action.icon === "void" ? (
                              <ArrowUturnCcwLeft className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                            {r.action.label}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>

            {selLine ? (
              <Card variant="secondary" className="gap-2.5 px-4 py-3.5" aria-live="polite">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[12px] text-muted">
                      Selected line · {selLine.date} · {selLine.dept}
                    </span>
                    <span className="font-semibold">
                      {selLine.title} · <span className="tabular">{rwf(selLine.amount)}</span>
                    </span>
                    <span className="text-[12px] text-muted">
                      Source {selLine.src} · posted by {selLine.by} · tax class follows the department’s configured rule
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label="Close line details"
                    onPress={() => setSel("")}
                  >
                    <Xmark className="size-4" />
                  </Button>
                </div>
                {selWhy ? (
                  <div className="flex flex-wrap items-start gap-2.5">
                    <Button variant="danger-soft" isDisabled>
                      <Lock className="size-4" />
                      Void
                    </Button>
                    <p className="flex-[1_1_260px] text-[13px] leading-[18px]">
                      <span className="font-medium">Beyond desk permission.</span>{" "}
                      <span className="text-muted">{selWhy}</span>
                    </p>
                    {canAsk ? (
                      <Button size="sm" variant="secondary" onPress={() => setAsked({ ...asked, [selLine.id]: true })}>
                        Ask a manager to correct
                      </Button>
                    ) : null}
                    {asked[selLine.id] ? (
                      <ToneChip tone="warning">Correction CR-1182 sent to Aline Uwase · Pending</ToneChip>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-3">
                      <SelectField
                        label="Void reason code"
                        value={vReason}
                        onChange={setVReason}
                        options={VOID_REASONS}
                        placeholder="Choose a reason"
                        className="flex-[1_1_240px]"
                      />
                      <Button variant="danger-soft" isDisabled={!vReason} onPress={doVoid}>
                        <ArrowUturnCcwLeft className="size-4" />
                        Void with reversal
                      </Button>
                    </div>
                    <p className="text-[12px] text-muted">
                      You can void your own desk charges from this shift up to RWF 20,000. A reversal line is added; the
                      original stays on the folio.
                    </p>
                  </>
                )}
              </Card>
            ) : null}
          </Card>

          <Card aria-labelledby="pay-h" className="gap-3 p-[18px]">
            <CardHeading
              id="pay-h"
              title="Payments and Balance"
              sub="Only verified tenders reduce the balance. Each tender shows its provider evidence."
              action={
                <Button size="sm" variant="secondary" onPress={openPay}>
                  <Plus className="size-4" />
                  Take payment
                </Button>
              }
            />
            <ListView aria-label="Payments on the folio" variant="secondary" items={allPays}>
              {(p) => (
                <ListView.Item id={p.id} textValue={`${p.tender} ${rwf(p.amount)}`} className="items-start">
                  <ListView.ItemContent className="items-start">
                    <IconTile name={p.icon} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <ListView.Title className="whitespace-normal">
                        {p.tender} · <span className="tabular">{rwf(p.amount)}</span>
                      </ListView.Title>
                      <ListView.Description className="whitespace-normal tabular">{p.line1}</ListView.Description>
                      <ListView.Description className="whitespace-normal">{p.line2}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ToneChip tone={p.tone}>{p.state}</ToneChip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
            <dl className="grid gap-2.5 pt-1 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
              {[
                { label: "Charges posted", value: rwf(charges) },
                { label: "Counted payments", value: rwf(paid) },
                { label: "Not counted yet", value: rwf(pend) },
              ].map((t) => (
                <div key={t.label} className="flex flex-col gap-0.5">
                  <dt className="text-[12px] text-muted">{t.label}</dt>
                  <dd className="font-semibold tabular">{t.value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-0.5">
                <dt className="text-[12px] text-muted">Balance due</dt>
                <dd className="text-[20px] leading-[26px] font-semibold tabular">{rwf(balance)}</dd>
              </div>
            </dl>
            <Note icon="TriangleExclamation" lead={`${rwf(pend)} is not counted until it is verified.`}>
              Do not ask the guest to pay these amounts again. Finance is matching the Umurage Consulting transfer.
            </Note>
          </Card>
        </div>

        <div className="flex min-w-0 max-w-[440px] flex-[1_1_340px] flex-col gap-4">
          <Card aria-labelledby="ch-h" className="gap-3 px-[18px] py-4">
            <CardHeading
              id="ch-h"
              title="Change the Stay"
              className="items-center"
              action={
                <Segment
                  aria-label="Stay change"
                  selectedKey={change}
                  onSelectionChange={(k) => setChange(String(k) as "late" | "extend")}
                >
                  <Segment.Item id="late">Late checkout</Segment.Item>
                  <Segment.Item id="extend">Extend</Segment.Item>
                </Segment>
              }
            />
            {change === "late" ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] text-muted">
                  Guest asked at 07:58 in Messages. Room {stay.room} has no arrival today.
                </p>
                <RadioButtonGroup
                  aria-label="Late checkout time"
                  value={late}
                  onChange={setLate}
                  isReadOnly={lateDone}
                  className="flex-row gap-2"
                >
                  {data.lateOptions.map((o) => (
                    <RadioButtonGroup.Item key={o.id} value={o.id} className="min-w-0 flex-1 px-3 py-2.5">
                      <RadioButtonGroup.ItemContent className="gap-0.5">
                        <span className="font-semibold tabular">{o.id}</span>
                        <span className="text-[12px] text-muted tabular">{o.fee ? rwf(o.fee) : "No fee"}</span>
                        <span className="text-[11px] leading-[14px] text-muted">{o.note}</span>
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  ))}
                </RadioButtonGroup>
                {lateDone ? (
                  <Alert status="success">
                    <Alert.Indicator>
                      <CircleCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Departure moved to {late} today</Alert.Title>
                      <Alert.Description>
                        {lateOpt.fee
                          ? `${rwf(lateOpt.fee)} posted to the folio as a desk charge.`
                          : "No fee under the Umurage Consulting agreement."}{" "}
                        Housekeeping told. Key validity change is pending at the lock provider.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : (
                  <Button size="sm" className="self-start" onPress={confirmLate}>
                    Confirm late checkout {late}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span id="ext-l" className="text-sm font-medium">
                      Extra nights
                    </span>
                    <span className="text-[12px] text-muted">New departure {extDate}</span>
                  </div>
                  <NumberStepper
                    aria-labelledby="ext-l"
                    value={ext}
                    minValue={1}
                    maxValue={5}
                    isReadOnly={extDone}
                    onChange={(v) => setExt(Number.isNaN(v) ? 1 : v)}
                  >
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label="One night fewer" />
                      <NumberStepper.Value className="min-w-9" aria-live="polite" />
                      <NumberStepper.IncrementButton aria-label="One more night" />
                    </NumberStepper.Group>
                  </NumberStepper>
                </div>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  <li className="flex items-start gap-2">
                    {avail ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <TriangleExclamation className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    )}
                    <span>
                      {avail
                        ? `Room ${stay.room} is free until ${stay.freeUntil}. No move needed.`
                        : `Room ${stay.room} is booked from ${stay.freeUntil} (${stay.nextBooking}). Longer stays need a room move first.`}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Tag className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Corporate rate {rwf(stay.rate)} a night comes from the booking. Rate changes are made by your
                      general manager.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Briefcase className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Umurage Consulting authorised 7 to 12 October. Extra nights go to the guest unless the company
                      extends its letter.
                    </span>
                  </li>
                </ul>
                {extDone ? (
                  <Alert status="success">
                    <Alert.Indicator>
                      <CircleCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Stay extended to {extDate}</Alert.Title>
                      <Alert.Description>
                        Booking {stay.bookingId} dates updated. Key validity change is pending at the lock provider.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : (
                  <Button size="sm" className="self-start" isDisabled={!avail} onPress={() => setExtDone(true)}>
                    Extend to {extDate}
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card aria-labelledby="mv-h" className="gap-3 px-[18px] py-4">
            <CardHeading
              id="mv-h"
              title="Room Moves and History"
              sub="Charges before a move keep their original room"
            />
            <Timeline size="sm" density="compact">
              {history.map((h) => (
                <Timeline.Item key={h.id} status={h.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name={h.icon} className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                    <span className="font-medium">{h.title}</span>
                    <span className="text-[12px] leading-4 text-muted tabular">{h.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>

          <Card aria-labelledby="ac-h" className="gap-2.5 px-[18px] py-4">
            <CardHeading id="ac-h" title="Keys and Guest App" />
            {access.map((a) => (
              <InfoRow
                key={a.id}
                icon={a.icon}
                title={a.title}
                detail={a.detail}
                trailing={<ToneChip tone={a.tone}>{a.state}</ToneChip>}
              />
            ))}
            <p className="text-[12px] leading-4 text-muted">
              Claiming the stay in the app is not proof of identity. The passport was checked at the desk on 7 October.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton href={screenHref("GuestKey")} size="sm" variant="ghost">
                <Key className="size-4" />
                Guest key view
              </LinkButton>
              <Button size="sm" variant="ghost" onPress={() => setResent(true)}>
                <PaperPlane className="size-4" />
                {resent ? "Claim code sent" : "Resend claim code"}
              </Button>
            </div>
          </Card>

          <Card id="docs" aria-labelledby="dc-h" className="scroll-mt-6 gap-2.5 px-[18px] py-4">
            <CardHeading id="dc-h" title="Documents" sub="Each document says what it is" />
            {data.documents.map((d) => (
              <InfoRow
                key={d.id}
                icon={d.icon}
                title={d.title}
                detail={d.detail}
                trailing={
                  <ToneChip tone={d.tone} emphasis={d.emphasis} size="sm">
                    {d.label}
                  </ToneChip>
                }
              />
            ))}
          </Card>
        </div>
      </div>

      <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="dr-h" className="w-full max-w-full gap-4 sm:w-[460px]">
            <Drawer.Header className="flex flex-row items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Drawer.Heading id="dr-h" className="text-[17px] leading-6 font-semibold">
                  {drawer === "charge" ? "Post a Charge" : "Take a Desk Payment"}
                </Drawer.Heading>
                <p className="text-[13px] text-muted">
                  Folio {stay.folioId} · {stay.guest} · Room {stay.room} · as {persona.name}
                </p>
              </div>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Close" onPress={() => setDrawerOpen(false)}>
                <Xmark className="size-4" />
              </Button>
            </Drawer.Header>
            {drawer === "charge" ? (
              <>
                <Drawer.Body className="flex flex-col gap-4">
                  <RadioButtonGroup
                    value={cDept}
                    onChange={(v) => setCDept(v as FolioDepartment)}
                    layout="grid"
                    className="grid-cols-2 gap-2"
                  >
                    <Label className="col-span-2">Department</Label>
                    {data.chargeDepartments.map((d) => (
                      <RadioButtonGroup.Item key={d.id} value={d.id} className="px-3 py-2.5">
                        <RadioButtonGroup.ItemContent className="gap-0.5">
                          <span className="text-[13px] font-medium">{d.id}</span>
                          <span className="text-[12px] text-muted">{d.hint}</span>
                        </RadioButtonGroup.ItemContent>
                      </RadioButtonGroup.Item>
                    ))}
                    <Description className="col-span-2">Room nights post automatically at night audit.</Description>
                  </RadioButtonGroup>
                  <TextField value={cAmt} onChange={setCAmt} isInvalid={cTooBig} fullWidth>
                    <Label>Amount (RWF)</Label>
                    <Input variant="secondary" inputMode="numeric" placeholder="e.g. 12,000" className="tabular" />
                    <FieldError>Desk charges above RWF 50,000 need a manager. Ask Aline Uwase.</FieldError>
                  </TextField>
                  <SelectField
                    label="Reason code"
                    value={cReason}
                    onChange={setCReason}
                    options={CHARGE_REASONS}
                    placeholder="Choose a reason"
                  />
                  <TextField value={cNote} onChange={setCNote} fullWidth>
                    <Label>Description on folio</Label>
                    <Input variant="secondary" placeholder="e.g. Minibar, 2 waters" />
                  </TextField>
                  <p className="text-[12px] leading-4 text-muted">
                    The charge is fiscalised once, at folio close. Wrong charges are reversed, never edited.
                  </p>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button variant="secondary" onPress={() => setDrawerOpen(false)}>
                    Cancel
                  </Button>
                  <Button isDisabled={!canPost} onPress={postCharge}>
                    Post charge
                  </Button>
                </Drawer.Footer>
              </>
            ) : (
              <>
                <Drawer.Body className="flex flex-col gap-4">
                  <RadioButtonGroup
                    value={tender}
                    onChange={(v) => setTender(v as DeskTender["id"])}
                    layout="grid"
                    className="grid-cols-2 gap-2"
                  >
                    <Label className="col-span-2">Tender</Label>
                    {data.tenders.map((t) => (
                      <RadioButtonGroup.Item key={t.id} value={t.id} isDisabled={t.blocked} className="px-3 py-2.5">
                        <RadioButtonGroup.ItemContent className="gap-0.5">
                          <span className="flex items-center gap-1.5 text-[13px] font-medium">
                            <Icon name={t.icon} className="size-4" />
                            {t.label}
                          </span>
                          <span className="text-[12px] text-muted">{t.hint}</span>
                        </RadioButtonGroup.ItemContent>
                      </RadioButtonGroup.Item>
                    ))}
                  </RadioButtonGroup>
                  <TextField value={pAmt} onChange={setPAmt} fullWidth>
                    <Label>Amount (RWF)</Label>
                    <Input variant="secondary" inputMode="numeric" className="tabular" />
                    <Description>
                      Balance due {rwf(balance)}. RWF 65,000 remains if the Airtel payment and the bank transfer are
                      verified.
                    </Description>
                  </TextField>
                  {isMobile ? (
                    <TextField defaultValue={stay.payerPhone} fullWidth>
                      <Label>Payer phone</Label>
                      <Input variant="secondary" className="tabular" />
                      <Description>
                        The guest approves on their phone. It stays Pending until {T.network || T.label} confirms.
                      </Description>
                    </TextField>
                  ) : null}
                  {tender === "cash" ? (
                    <p className="text-[13px] text-muted">Cash goes into Till 1 and is counted again at shift close.</p>
                  ) : null}
                  <GateChip icon={<Lock className="size-3" />} className="self-start">
                    Card through GT Bank: production not verified
                  </GateChip>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button variant="secondary" onPress={() => setDrawerOpen(false)}>
                    Cancel
                  </Button>
                  <Button onPress={takePayment}>{tender === "cash" ? "Record cash" : "Send payment request"}</Button>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </PageContent>
  );
}
