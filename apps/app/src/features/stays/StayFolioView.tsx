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
  Toast,
  toast,
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
  Stay,
  StayAccess,
  StayDocument,
  StayEvent,
  StayRecord,
} from "@injishi/data/fixtures/stays";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useState, useTransition } from "react";
import type { Selection } from "react-aria-components";
import { checkOutGuest, postCharge, recordCash, resendClaimCode, voidCharge } from "./actions";
import { CardHeading, IconTile, InfoRow, Note, readFrancs, rwf, SelectField, StatTile, ToneChip } from "./parts";

export interface StayFolioData {
  stay: Stay;
  records: StayRecord[];
  lines: FolioLine[];
  payments: FolioPayment[];
  history: StayEvent[];
  access: StayAccess[];
  documents: StayDocument[];
  chargeDepartments: ChargeDepartment[];
  tenders: DeskTender[];
}

/** One colour per department, in the order the bill first names them. */
const CHART = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const VOID_REASONS = ["Posted to wrong room", "Duplicate posting", "Guest did not receive service", "Wrong amount"];
const CHARGE_REASONS = [
  "Service without POS ticket",
  "Minibar count",
  "Laundry ticket",
  "Damage or loss",
  "Under-charge correction",
];
/**
 * What this screen lets the desk do on its own. The API lets anyone holding `folio.charge` post or
 * void; these limits only ever narrow that, and anything beyond them goes to a manager.
 */
/**
 * Times a late checkout could run to. A property's late-checkout fee schedule is not kept anywhere yet
 * (stays.lateCheckoutOptions is deferred), so no fee is shown beside them, and the action is unavailable.
 */
const LATE_TIMES = ["13:00", "15:00", "18:00"] as const;
const DESK_VOID_LIMIT = 20000;
const DESK_CHARGE_LIMIT = 50000;

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function DeptDot({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
  );
}

/** One linked record (booking, stay, folio, fiscal receipt) with its state track. */
function RecordCard({ record, current, desc }: { record: StayRecord; current: number; desc: string }) {
  // The booking opens in Reservations with it selected; the others are sections of this page.
  const href =
    record.board === "ReservationDetail"
      ? `${screenHref("Reservations")}?booking=${encodeURIComponent(record.title)}`
      : record.board
        ? screenHref(record.board)
        : `#${record.anchor}`;
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
  dept: string;
  amount: number;
  struck: boolean;
  chip: { label: string; tone: "danger" | "default" } | null;
  action: { label: string; icon: "lock" | "void" | "show"; aria: string; run: () => void };
}

export function StayFolioView({ persona, data }: { persona: Persona; data: StayFolioData }) {
  const { stay } = data;
  const [dept, setDept] = useState<string>("all");
  const [sel, setSel] = useState("");
  const [vReason, setVReason] = useState("");
  const [drawer, setDrawer] = useState<"charge" | "payment">("charge");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cDept, setCDept] = useState<string>(data.chargeDepartments[0]?.id ?? "");
  const [cAmt, setCAmt] = useState("");
  const [cReason, setCReason] = useState("");
  const [cNote, setCNote] = useState("");
  const [tender, setTender] = useState<DeskTender["id"]>("cash");
  const [pAmt, setPAmt] = useState("");
  const [change, setChange] = useState<"late" | "extend">("late");
  const [late, setLate] = useState<string>(LATE_TIMES[0]);
  const [ext, setExt] = useState(1);
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, startBusy] = useTransition();

  /** Shown plainly for what has no route: nothing on screen changes as if it had worked. */
  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  const stayRecord = data.records.find((r) => r.kind === "Stay");
  const closed = stayRecord ? stayRecord.current === stayRecord.steps.length - 1 : false;

  // ── Folio ──
  const lines = data.lines;
  const charges = sum(lines);
  const depts = [...new Set([...lines.map((l) => String(l.dept)), ...data.chargeDepartments.map((d) => String(d.id))])];
  const colorOf = (d: string) => CHART[Math.max(0, depts.indexOf(d)) % CHART.length];
  const byDept = depts.map((d) => ({ d, v: sum(lines.filter((l) => l.dept === d)) })).filter((x) => x.v !== 0);
  const deptAria = `Charges by department: ${byDept.map((x) => `${x.d} ${rwf(x.v)}`).join(", ")}`;
  const filters = [{ id: "all", label: "All" }, ...byDept.map((x) => ({ id: x.d, label: x.d }))];

  const why = (l: FolioLine): string => {
    if (l.voided) return "Already voided. The reversal line keeps the history.";
    if (l.reversal) return "A reversal cannot be voided. Finance handles corrections to reversals.";
    if (l.night) return "Room nights post at night audit. Only a manager or Finance can correct them.";
    if (!l.mine)
      return `Posted by ${l.by}. Outlet and housekeeping charges are corrected by their supervisor or a manager.`;
    if (l.amount > DESK_VOID_LIMIT)
      return "Desk voids are limited to RWF 20,000 per line. A manager must void this one.";
    if (closed) return "The guest has checked out. Corrections to a closed stay go through Finance.";
    return "";
  };

  const pick = (id: string) => {
    setSel(id);
    setVReason("");
  };
  const toRow = (l: FolioLine): Row => {
    const w = why(l);
    return {
      id: l.id,
      date: l.date,
      title: l.title,
      sub: `${l.src} · ${l.by}`,
      dept: l.dept,
      amount: l.amount,
      struck: !!l.voided,
      chip: l.voided
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
  const nights = visible.filter((l) => l.night);
  if (dept === "all" && nights.length) {
    const byRoom = new Map<string, number>();
    for (const n of nights) byRoom.set(n.room ?? "", (byRoom.get(n.room ?? "") ?? 0) + 1);
    const rooms = [...byRoom].map(([room, count]) => `${room} × ${count}`).join(" · ");
    const first = nights[0];
    const last = nights[nights.length - 1];
    const roomsDept = String(first?.dept ?? "Rooms");
    rows = [
      {
        id: "nights",
        date: nights.length > 1 ? `${first?.date} – ${last?.date}` : (first?.date ?? ""),
        title: `Room nights × ${nights.length}`,
        sub: `${rooms} · Night audit`,
        dept: roomsDept,
        amount: sum(nights),
        struck: false,
        chip: null,
        action: {
          label: "Show nights",
          icon: "show",
          aria: `Show the ${plural(nights.length, "room night")} one per line`,
          run: () => setDept(roomsDept),
        },
      },
      ...rows.filter((r) => !lines.find((l) => l.id === r.id)?.night),
    ];
  }

  const selLine = lines.find((l) => l.id === sel);
  const selWhy = selLine ? why(selLine) : "";
  const canAsk = !!selLine && !!selWhy && !selLine.voided && !selLine.reversal;

  /** Void with reversal: one key per press, so a retried press never voids twice. */
  const doVoid = () => {
    if (!selLine || !vReason || selWhy || busy) return;
    const line = selLine;
    const reason = vReason;
    const idempotencyKey = crypto.randomUUID();
    startBusy(async () => {
      const result = await voidCharge({ stayRef: stay.id, chargeId: line.id, reason, idempotencyKey });
      if (!result.ok) {
        toast.danger(`${line.title} was not voided: ${result.error}`);
        return;
      }
      toast.success(`${line.title} voided · a reversal line was added · balance ${rwf(result.value.balanceRwf)}`);
      setVReason("");
    });
  };

  // ── Payments ──
  const paid = sum(data.payments.filter((p) => p.counted));
  const pend = sum(data.payments.filter((p) => !p.counted && p.state !== "Voided"));
  const balance = charges - paid;
  const uncounted = data.payments.filter((p) => !p.counted && p.state !== "Voided").length;

  // ── Change the stay ──
  const avail = ext <= stay.freeNights;

  const recordView = (r: StayRecord) => {
    if (r.kind === "Folio")
      return {
        current: r.current,
        desc: `Balance ${rwf(balance)}${uncounted ? ` · ${plural(uncounted, "payment")} not verified` : ""}`,
      };
    return { current: r.current, desc: r.desc };
  };

  // ── Drawer: post a charge / take a payment ──
  // Whole francs only: a decimal part or a stray character is refused with its reason, never folded in.
  const { amount: cAmount, error: cAmtError } = readFrancs(cAmt);
  const cTooBig = cAmount > DESK_CHARGE_LIMIT;
  const { amount: pAmount, error: pAmtError } = readFrancs(pAmt);
  const canPost = !!cAmount && !cTooBig && !!cReason && !!cDept && !busy;
  /** Post charge: the amount typed BEFORE VAT, one key per press. */
  const submitCharge = () => {
    if (!canPost) return;
    const input = {
      stayRef: stay.id,
      department: cDept,
      amountRwf: cAmount,
      description: cNote.trim() || `${cDept} charge`,
      reason: cReason,
      idempotencyKey: crypto.randomUUID(),
    };
    startBusy(async () => {
      const result = await postCharge(input);
      if (!result.ok) {
        toast.danger(`The charge was not posted: ${result.error}`);
        return;
      }
      toast.success(
        `${input.description} · ${rwf(input.amountRwf)} before VAT posted${
          result.value.movedToFolio ? " to the stay's next bill (this one is signed)" : ""
        } · balance ${rwf(result.value.balanceRwf)}`,
      );
      setDrawerOpen(false);
      if (result.value.chargeId) setSel(result.value.chargeId);
      setCAmt("");
      setCReason("");
      setCNote("");
    });
  };
  const T = data.tenders.find((t) => t.id === tender) ?? data.tenders[0];
  const isMobile = tender === "mtn" || tender === "airtel";
  /** Record cash: exactly the amount typed, one key per press. Prompts to a phone have no route. */
  const takePayment = () => {
    const amount = pAmount;
    if (!amount || !T || T.blocked || busy) return;
    if (T.id !== "cash") {
      unavailable(`A ${T.label} payment request from the desk`);
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    startBusy(async () => {
      const result = await recordCash({ stayRef: stay.id, amountRwf: amount, idempotencyKey });
      if (!result.ok) {
        toast.danger(`The cash was not recorded: ${result.error}`);
        return;
      }
      toast.success(`${rwf(amount)} cash recorded on ${stay.folioId} · balance ${rwf(result.value.balanceRwf)}`);
      setDrawerOpen(false);
      setPAmt("");
    });
  };
  const openCharge = () => {
    setCAmt("");
    setCReason("");
    setCNote("");
    setDrawer("charge");
    setDrawerOpen(true);
  };
  const openPay = () => {
    setPAmt("");
    setTender("cash");
    setDrawer("payment");
    setDrawerOpen(true);
  };

  /** Resend claim code: the API mails it to the stay's address, or refuses a guest who booked with an account. */
  const resend = () =>
    startBusy(async () => {
      const result = await resendClaimCode(stay.id);
      if (!result.ok) {
        toast.danger(`No claim code was sent: ${result.error}`);
        return;
      }
      const invite = result.value;
      if (invite.invitationSent && invite.email) toast.success(`Claim code emailed to ${invite.email}`);
      else
        toast.warning(
          `No email address on this stay, so nothing was sent.${invite.claimCode ? ` Give the guest code ${invite.claimCode}.` : ""}`,
        );
    });

  /** Check out: the stay closes, its room goes to Dirty, and a bill settled to zero is closed and locked. */
  const checkOut = () => {
    if (busy || closed) return;
    startBusy(async () => {
      const result = await checkOutGuest(stay.id, "StayFolio");
      setConfirmOut(false);
      if (!result.ok) {
        toast.danger(`${stay.guest} was not checked out: ${result.error}`);
        return;
      }
      const out = result.value;
      toast.success(
        `${out.guest} checked out of room ${out.room} · room set to Dirty · ${
          out.folioStatus === "closed"
            ? `bill ${out.folioNumber} closed`
            : `bill ${out.folioNumber ?? ""} left open (${rwf(out.balanceRwf)})`
        }`,
      );
    });
  };

  const staySpan = `In house since ${stay.inHouseSince} · ${plural(stay.nights, "night")}`;
  const dueLine = closed ? `Checked out ${stay.dueOut}` : `Due out ${stay.dueOut}`;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Front desk
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>{closed ? "Departed" : "In-house"}</span>
            <span aria-hidden="true">›</span>
            <span>Room {stay.room}</span>
          </>
        }
        title={`${stay.guest} · Room ${stay.room}`}
        description={
          <>
            Stay {stay.id} · {staySpan} · {dueLine}
            {stay.company ? ` · guest of ${stay.company}` : ""}
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
            {closed ? (
              <LinkButton href={screenHref("FrontDeskToday")} variant="secondary">
                Back to Today
              </LinkButton>
            ) : confirmOut ? (
              <>
                <Button variant="ghost" onPress={() => setConfirmOut(false)}>
                  Not yet
                </Button>
                <Button isDisabled={busy} onPress={checkOut}>
                  <ArrowRightFromSquare className="size-4" />
                  Confirm check out
                </Button>
              </>
            ) : (
              <Button
                isDisabled={balance > 0}
                onPress={() => setConfirmOut(true)}
                aria-label={balance > 0 ? `Check out: settle the ${rwf(balance)} balance first` : "Check out"}
              >
                <ArrowRightFromSquare className="size-4" />
                {balance > 0 ? `Check out · ${rwf(balance)} to settle` : "Check out"}
              </Button>
            )}
          </>
        }
      />

      {confirmOut && !closed ? (
        <Note icon="ArrowRightFromSquare" lead={`Check ${stay.guestFirstName} out of room ${stay.room} now?`}>
          The stay closes, the room goes to Dirty, and a bill settled to zero is closed and locked. A bill in credit is
          left open for Finance.
        </Note>
      ) : null}

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
              sub={`Guest folio in RWF · ${stay.entity}${stay.entityTin ? `, ${stay.entityTin}` : ""} · each line with its VAT · each keeps its source record`}
              action={
                <Segment
                  aria-label="Filter by department"
                  selectedKey={dept}
                  onSelectionChange={(k) => setDept(String(k))}
                >
                  {filters.map((d) => (
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
                      <DeptDot color={colorOf(x.d)} />
                      <span className="text-muted">{x.d}</span>
                    </span>
                    <span className="font-semibold tabular">{rwf(x.v)}</span>
                    <ProgressBar
                      value={charges > 0 ? Math.max(0, Math.round((x.v / charges) * 100)) : 0}
                      size="sm"
                      aria-label={`${x.d} share of charges`}
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill style={{ background: colorOf(x.d) }} />
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
                    if (k === "nights") setDept(String(nights[0]?.dept ?? "Rooms"));
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
                            <DeptDot color={colorOf(r.dept)} />
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
            {rows.length === 0 ? <p className="text-[13px] text-muted">Nothing is charged to this bill yet.</p> : null}

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
                      <span className="font-medium">Beyond what the desk voids here.</span>{" "}
                      <span className="text-muted">{selWhy}</span>
                    </p>
                    {canAsk ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => unavailable("Asking a manager to correct a line")}
                      >
                        Ask a manager to correct
                      </Button>
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
                      <Button variant="danger-soft" isDisabled={!vReason || busy} onPress={doVoid}>
                        <ArrowUturnCcwLeft className="size-4" />
                        Void with reversal
                      </Button>
                    </div>
                    <p className="text-[12px] text-muted">
                      You can void your own desk charges up to RWF 20,000 here. A reversal line is added, its VAT with
                      it; the original stays on the folio.
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
              sub="Only confirmed money is on the bill. Each payment shows where it came from."
              action={
                <Button size="sm" variant="secondary" onPress={openPay} isDisabled={closed}>
                  <Plus className="size-4" />
                  Take payment
                </Button>
              }
            />
            <ListView aria-label="Payments on the folio" variant="secondary" items={data.payments}>
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
            {data.payments.length === 0 ? (
              <p className="text-[13px] text-muted">No payment is on this bill yet.</p>
            ) : null}
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
                <dt className="text-[12px] text-muted">{balance < 0 ? "In credit" : "Balance due"}</dt>
                <dd className="text-[20px] leading-[26px] font-semibold tabular">{rwf(Math.abs(balance))}</dd>
              </div>
            </dl>
            {pend ? (
              <Note icon="TriangleExclamation" lead={`${rwf(pend)} is not counted until it is verified.`}>
                Do not ask the guest to pay these amounts again.
              </Note>
            ) : null}
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
                  Due out {stay.dueOut}. Moving the departure and posting its fee is not connected yet.
                </p>
                <RadioButtonGroup
                  aria-label="Late checkout time"
                  value={late}
                  onChange={setLate}
                  className="flex-row gap-2"
                >
                  {LATE_TIMES.map((time) => (
                    <RadioButtonGroup.Item key={time} value={time} className="min-w-0 flex-1 px-3 py-2.5">
                      <RadioButtonGroup.ItemContent className="gap-0.5">
                        <span className="font-semibold tabular">{time}</span>
                        <span className="text-[12px] text-muted">Fee not set</span>
                        <span className="text-[11px] leading-[14px] text-muted">No fee schedule is kept yet</span>
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  ))}
                </RadioButtonGroup>
                <Button
                  size="sm"
                  className="self-start"
                  isDisabled={closed}
                  onPress={() => unavailable(`Late checkout until ${late}`)}
                >
                  Confirm late checkout {late}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span id="ext-l" className="text-sm font-medium">
                      Extra nights
                    </span>
                    <span className="text-[12px] text-muted">{plural(ext, "night")} after the booked departure</span>
                  </div>
                  <NumberStepper
                    aria-labelledby="ext-l"
                    value={ext}
                    minValue={1}
                    maxValue={5}
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
                      {!stay.freeUntil
                        ? `Room ${stay.room} has no booking after this stay.`
                        : avail
                          ? `Room ${stay.room} is free until ${stay.freeUntil}. No move needed.`
                          : `Room ${stay.room} is booked from ${stay.freeUntil} (${stay.nextBooking}). Longer stays need a room move first.`}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Tag className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      The rate, {rwf(stay.rate)} a night, comes from the booking. Rate changes are made by your general
                      manager.
                    </span>
                  </li>
                  {stay.company ? (
                    <li className="flex items-start gap-2">
                      <Briefcase className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>Extra nights go to the guest unless {stay.company} extends its letter.</span>
                    </li>
                  ) : null}
                </ul>
                <Button
                  size="sm"
                  className="self-start"
                  isDisabled={!avail || closed}
                  onPress={() => unavailable("Extending a stay")}
                >
                  Extend by {plural(ext, "night")}
                </Button>
              </div>
            )}
          </Card>

          <Card aria-labelledby="mv-h" className="gap-3 px-[18px] py-4">
            <CardHeading
              id="mv-h"
              title="Room Moves and History"
              sub="Charges before a move keep their original room"
            />
            {data.history.length ? (
              <Timeline size="sm" density="compact">
                {data.history.map((h) => (
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
            ) : (
              <p className="text-[13px] text-muted">
                Checked in {stay.inHouseSince} to room {stay.room}. Moves and changes are not recorded on the stay yet.
              </p>
            )}
          </Card>

          <Card aria-labelledby="ac-h" className="gap-2.5 px-[18px] py-4">
            <CardHeading id="ac-h" title="Keys and Guest App" />
            {data.access.map((a) => (
              <InfoRow
                key={a.id}
                icon={a.icon}
                title={a.title}
                detail={a.detail}
                trailing={<ToneChip tone={a.tone}>{a.state}</ToneChip>}
              />
            ))}
            {data.access.length ? null : (
              <p className="text-[13px] text-muted">
                No lock provider is connected, so keys are physical and not recorded here.
              </p>
            )}
            <p className="text-[12px] leading-4 text-muted">
              Claiming the stay in the app is not proof of identity. Check the ID at the desk.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton href={screenHref("GuestKey")} size="sm" variant="ghost">
                <Key className="size-4" />
                Guest key view
              </LinkButton>
              <Button size="sm" variant="ghost" isDisabled={busy || closed} onPress={resend}>
                <PaperPlane className="size-4" />
                Resend claim code
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
            {data.documents.length ? null : (
              <p className="text-[13px] text-muted">
                Proformas, payment receipts and the fiscal receipt are not listed on this screen yet.
              </p>
            )}
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
                  <TextField value={cAmt} onChange={setCAmt} isInvalid={cTooBig || !!cAmtError} fullWidth>
                    <Label>Amount before VAT (RWF)</Label>
                    <Input variant="secondary" inputMode="numeric" placeholder="e.g. 12,000" className="tabular" />
                    <Description>VAT is added as its own line, at the rate in force when the charge posts.</Description>
                    <FieldError>{cAmtError ?? "Desk charges above RWF 50,000 need a manager to post them."}</FieldError>
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
                  <Button isDisabled={!canPost} onPress={submitCharge}>
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
                          <span className="text-[12px] text-muted">
                            {t.id === "mtn" || t.id === "airtel" ? "Prompt to the phone not connected yet" : t.hint}
                          </span>
                        </RadioButtonGroup.ItemContent>
                      </RadioButtonGroup.Item>
                    ))}
                  </RadioButtonGroup>
                  <TextField value={pAmt} onChange={setPAmt} isInvalid={!!pAmtError} fullWidth>
                    <Label>{tender === "cash" ? "Cash received (RWF)" : "Amount (RWF)"}</Label>
                    <Input variant="secondary" inputMode="numeric" placeholder="e.g. 20,000" className="tabular" />
                    <Description>
                      {balance > 0 ? `Balance due ${rwf(balance)}.` : "Nothing is due on this bill."} Exactly the amount
                      you type is recorded.
                    </Description>
                    <FieldError>{pAmtError}</FieldError>
                  </TextField>
                  {isMobile ? (
                    <TextField defaultValue={stay.payerPhone} fullWidth>
                      <Label>Payer phone</Label>
                      <Input variant="secondary" className="tabular" />
                      <Description>
                        A {T?.network || T?.label} prompt from the desk is not connected yet. Take cash, or the guest
                        pays in their app.
                      </Description>
                    </TextField>
                  ) : null}
                  {tender === "cash" ? (
                    <p className="text-[13px] text-muted">
                      Cash goes into the desk till and is counted again at shift close.
                    </p>
                  ) : null}
                  <GateChip icon={<Lock className="size-3" />} className="self-start">
                    Card through GT Bank: production not verified
                  </GateChip>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button variant="secondary" onPress={() => setDrawerOpen(false)}>
                    Cancel
                  </Button>
                  <Button isDisabled={!pAmount || busy} onPress={takePayment}>
                    {tender === "cash" ? `Record ${rwf(pAmount)} cash` : "Send payment request"}
                  </Button>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </PageContent>
  );
}
