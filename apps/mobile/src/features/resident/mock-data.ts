// The resident app's sample data (prototype `d-resident.mjs`): Olivier Habineza in unit B-07 at
// Kacyiru Court, Kigali. Names, amounts, dates and photos are the prototype's design filler and live
// only here; `data.ts` is the one reader. The module keeps its state, and each action changes it and
// the next read builds fresh objects from it, so a flow clicked through feels real: pay rent and the
// home card turns paid; send a repair and it opens in Requests.

import type { TimelineStep } from "@/components/ui";
import { rwf } from "@/lib/money";
import { type ProtoImage, protoImages } from "@/proto/images";
import type {
  BuildingView,
  ConfirmView,
  Deduction,
  DeductionStatus,
  EmergencyView,
  HistoryRow,
  HomeView,
  HouseholdMember,
  HouseholdView,
  LeaseView,
  Message,
  MeView,
  MoveInRoom,
  MoveInView,
  MoveOutView,
  NewMember,
  Notice,
  PayDraft,
  PaymentsView,
  PayView,
  PendingView,
  Receipt,
  RenewalView,
  RepairCategory,
  RepairCategoryId,
  RepairForm,
  RepairInput,
  RepairPhoto,
  RepairSummary,
  RepairThread,
  RequestsView,
  StatusChip,
  TabCounts,
  VisitorCode,
  VisitorRow,
  VisitWindow,
} from "./types";

// ── The household and the place ─────────────────────────────────────────────

const UNIT = "B-07";
const PLACE = "Kacyiru Court";
const PAYEE = "Amahoro Residences Ltd";
const MTN = "0788 ••• 412";
/** The day the sample world stands on: Mon 26 Oct, six days before November's rent is due. */
const TODAY = { month: "Oct", day: "26", long: "Mon 26 Oct" } as const;

// ── Rent and payments ───────────────────────────────────────────────────────

type Payment = {
  id: string;
  /** The month the rent was for. */
  period: string;
  part: boolean;
  amount: number;
  paidOn: { month: string; day: string };
  method: "MTN MoMo" | "Airtel Money";
  note: string;
  providerRef: string;
  confirmed: string;
};

const rent = {
  period: "November",
  month: "Nov",
  day: "1",
  due: "Sun 1 Nov",
  dueIn: "Due in 6 days",
  next: "Tue 1 Dec",
  amount: 950_000,
  paid: 0,
  /** How much of the month has run toward the due date, for the home card's bar. */
  elapsed: 82,
};

/** Newest first. */
const payments: Payment[] = [
  {
    id: "PI-76410",
    period: "October",
    part: false,
    amount: 950_000,
    paidOn: { month: "Sep", day: "30" },
    method: "MTN MoMo",
    note: "MTN MoMo · on time",
    providerRef: "MP260930.1812.B76410",
    confirmed: "MTN confirmed your payment on Wed 30 Sep, 18:12",
  },
  {
    id: "PI-75388",
    period: "September",
    part: false,
    amount: 950_000,
    paidOn: { month: "Aug", day: "31" },
    method: "MTN MoMo",
    note: "MTN MoMo · on time",
    providerRef: "MP260831.0906.B75388",
    confirmed: "MTN confirmed your payment on Mon 31 Aug, 09:06",
  },
  {
    id: "PI-74302",
    period: "August",
    part: false,
    amount: 950_000,
    paidOn: { month: "Jul", day: "30" },
    method: "MTN MoMo",
    note: "Paid in two parts",
    providerRef: "MP260730.1744.B74302",
    confirmed: "MTN confirmed both parts by Thu 30 Jul, 17:44",
  },
  {
    id: "PI-73251",
    period: "July",
    part: false,
    amount: 950_000,
    paidOn: { month: "Jun", day: "29" },
    method: "Airtel Money",
    note: "Airtel Money · on time",
    providerRef: "AM260629.1120.B73251",
    confirmed: "Airtel confirmed your payment on Mon 29 Jun, 11:20",
  },
];

const year = { months: 10, paid: 9_500_000 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

let paymentSeq = 77162;
let airtelNumber: string | null = null;
let stampRequested = false;

function fullDraft(): PayDraft {
  return { kind: "full", amount: balance(), method: "mtn", newNumber: null };
}

let draft: PayDraft = fullDraft();

/** The MTN prompt waiting for approval: the prototype's sample until a new request replaces it. */
let pending: PendingView | null = {
  id: `PI-${paymentSeq}`,
  amount: 950_000,
  provider: "MTN",
  number: MTN,
  sentAt: "09:41",
  expiresAt: "09:46",
};

function balance(): number {
  return Math.max(0, rent.amount - rent.paid);
}

function rentState() {
  if (rent.paid >= rent.amount) return "paid" as const;
  return rent.paid > 0 ? ("part" as const) : ("due" as const);
}

/** "0788 412 117" as the prototype masks it: "0788 ••• 117". */
function mask(number: string): string {
  const digits = number.replace(/\D/g, "");
  return `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`;
}

function methodOf(id: PayDraft["method"]) {
  return id === "mtn"
    ? { name: "MTN MoMo", provider: "MTN", number: MTN }
    : { name: "Airtel Money", provider: "Airtel", number: airtelNumber ?? "" };
}

function draftAmount(): number {
  const due = balance() || rent.amount;
  return draft.kind === "full" ? due : Math.min(draft.amount, due);
}

function paymentLine(p: Payment): string {
  return `${p.period}${p.part ? ", part" : ""} paid ${Number(p.paidOn.day)} ${p.paidOn.month} · ${p.method}`;
}

export function mockHome(): HomeView {
  const state = rentState();
  const latest = payments[0];
  const paidNow = state === "paid" ? payments.find((p) => p.period === rent.period) : undefined;
  const newest = repairs.find((r) => r.status !== "fixed");
  const notice = notices.find((n) => n.isNew) ?? notices[0];
  return {
    place: { name: PLACE, unit: `Unit ${UNIT} · Gasabo`, photo: protoImages["courtyard-block-b"] },
    greeting: "Good morning,",
    firstName: "Olivier",
    rent: {
      state,
      eyebrow: `${rent.period} rent`,
      chip:
        state === "paid"
          ? { label: "Paid", tone: "success", icon: "CircleCheck" }
          : { label: rent.dueIn, tone: "warning" },
      amount: state === "paid" ? rent.amount : balance(),
      left: state === "paid" ? `Paid ${TODAY.long}` : `Due ${rent.due}`,
      right:
        state === "paid"
          ? `Next rent due ${rent.next}`
          : state === "part"
            ? `${rwf(rent.paid)} paid`
            : "Nothing paid yet",
      meter:
        state === "paid"
          ? { value: 100, tone: "success", label: "November rent paid in full" }
          : { value: rent.elapsed, tone: "warning", label: `${rent.dueIn}, ${rent.elapsed}% of the month gone` },
      receiptId: paidNow?.id ?? null,
      last: latest ? { line: paymentLine(latest), receiptId: latest.id } : null,
    },
    renewal:
      renewal.state === "offered"
        ? { title: "Your renewal offer is waiting", detail: "Lease ends 14 Nov · answer by Fri 30 Oct" }
        : null,
    notice: notice ? { icon: notice.icon, title: notice.headline, body: `${notice.body} · ${notice.author}` } : null,
    openRepair: newest
      ? { id: newest.id, title: newest.title, subtitle: newest.homeLine, status: statusChip(newest) }
      : null,
    unread: unreadCount(),
    hasNews: notices.some((n) => n.isNew),
  };
}

export function mockPay(): PayView {
  const state = rentState();
  const paidNow = payments.find((p) => p.period === rent.period && !p.part) ?? payments[0];
  return {
    state,
    month: rent.month,
    day: rent.day,
    title: `${rent.period} rent · ${UNIT}`,
    payee: "To Amahoro Residences",
    balance: balance(),
    clears: state === "part" ? `Clears the rest of ${rent.period}` : `Clears ${rent.period}`,
    due: rent.due,
    methods: [
      { id: "mtn", name: "MTN MoMo", number: MTN },
      { id: "airtel", name: "Airtel Money", number: airtelNumber },
    ],
    draft: { ...draft, amount: draft.kind === "full" ? balance() : draft.amount },
    paid:
      state === "paid" && paidNow
        ? {
            title: `${rent.period} rent is paid`,
            body: `${paidNow.method === "MTN MoMo" ? "MTN" : "Airtel"} confirmed it on ${TODAY.long}. December rent is due ${rent.next}.`,
            receiptId: paidNow.id,
          }
        : null,
  };
}

export function startPayment(next: PayDraft): void {
  draft = { ...next, amount: next.kind === "full" ? balance() : Math.max(1, Math.round(next.amount)) };
  if (next.method === "airtel" && next.newNumber) airtelNumber = mask(next.newNumber);
}

export function mockConfirm(): ConfirmView {
  const method = methodOf(draft.method);
  const full = draft.kind === "full";
  return {
    amount: draftAmount(),
    forLabel: `${full ? "" : "Part of "}${rent.period} rent · unit ${UNIT}`,
    rows: [
      { label: "Paid to", value: PAYEE },
      { label: "Landlord TIN", value: "102 345 990" },
      { label: "From", value: `${method.name} · ${method.number}` },
      { label: "Fee", value: "None from Injishi" },
    ],
    provider: method.provider,
  };
}

/** The prompt the current draft would send; a read, so it keeps nothing. */
function requestFromDraft(): PendingView {
  const method = methodOf(draft.method);
  return {
    id: `PI-${paymentSeq}`,
    amount: draftAmount(),
    provider: method.provider,
    number: method.number,
    sentAt: "09:41",
    expiresAt: "09:46",
  };
}

export function sendPaymentRequest(): string {
  pending = requestFromDraft();
  return pending.id;
}

export function mockPending(): PendingView {
  return { ...(pending ?? requestFromDraft()) };
}

export function resendPrompt(): { number: string; expiresAt: string } {
  const now = pending ?? requestFromDraft();
  pending = { ...now, sentAt: "09:46", expiresAt: "09:51" };
  return { number: pending.number, expiresAt: pending.expiresAt };
}

/** MTN (or Airtel) says yes: the money is recorded, the month's balance drops, and a receipt exists. */
export function confirmPayment(): string {
  // Already paid in full (the launcher opened the wait again): nothing more is taken.
  const latest = payments[0];
  if (balance() === 0 && latest) {
    pending = null;
    return latest.id;
  }
  const request = pending ?? requestFromDraft();
  const amount = Math.min(request.amount, balance() || request.amount);
  const part = rent.paid + amount < rent.amount;
  const digits = request.id.replace(/\D/g, "");
  const method = request.provider === "MTN" ? "MTN MoMo" : "Airtel Money";
  const payment: Payment = {
    id: request.id,
    period: rent.period,
    part,
    amount,
    paidOn: { month: TODAY.month, day: TODAY.day },
    method,
    note: `${method} · ${part ? "part payment" : "on time"}`,
    providerRef: `${request.provider === "MTN" ? "MP" : "AM"}261026.0941.B${digits}`,
    confirmed: `${request.provider} confirmed your payment at 09:43`,
  };
  payments.unshift(payment);
  rent.paid += amount;
  year.paid += amount;
  if (!part) year.months += 1;
  paymentSeq += 1;
  pending = null;
  draft = fullDraft();
  return payment.id;
}

export function mockReceipt(id: string | undefined): Receipt {
  const p = payments.find((one) => one.id === id) ?? payments[0];
  if (!p) throw new Error("No payment yet");
  return {
    id: p.id,
    amount: p.amount,
    forLabel: `${p.part ? "Part of " : ""}${p.period} rent · ${UNIT}`,
    payee: PAYEE,
    providerRef: p.providerRef,
    confirmed: p.confirmed,
  };
}

function historyRow(p: Payment): HistoryRow {
  return {
    id: p.id,
    month: p.paidOn.month,
    day: p.paidOn.day,
    title: `${p.period} rent${p.part ? ", part" : ""}`,
    subtitle: p.note,
    amount: p.amount,
  };
}

export function mockPayments(): PaymentsView {
  const millions = Math.round(year.paid / 100_000) / 10;
  return {
    leaseId: "L-KC-014",
    paidThisYear: { value: `${millions.toFixed(1)}M`, caption: `RWF · ${year.months} months` },
    deposit: { value: "1.9M", caption: "RWF · since Nov 2025" },
    statement: {
      title: "2026 rent statement",
      detail: `Jan–${MONTHS[year.months - 1] ?? "Dec"} · every payment with its provider ref. For a bank, visa or tax office.`,
    },
    stampRequested,
    history: payments.map(historyRow),
  };
}

export function mockPaymentsEmpty(): PaymentsView {
  return {
    ...mockPayments(),
    paidThisYear: { value: "0", caption: "RWF · nothing yet" },
    statement: {
      title: "2026 rent statement",
      detail: "Your first payment starts it. For a bank, visa or tax office.",
    },
    history: [],
  };
}

export function requestStamp(): void {
  stampRequested = true;
}

// ── Repairs ─────────────────────────────────────────────────────────────────

type Repair = {
  id: string;
  title: string;
  status: "sent" | "assigned" | "fixed";
  urgent: boolean;
  photo: ProtoImage | null;
  /** Requests' second line. */
  line: string;
  /** Home's second line. */
  homeLine: string;
  steps: TimelineStep[];
  messages: Message[];
  unread: number;
};

const SOLANGE = "Solange Uwimana";

function photoMessage(id: string, name: ProtoImage, time: string): Message {
  return { id, from: "me", text: null, photo: protoImages[name], time };
}

const repairs: Repair[] = [
  {
    id: "WO-345",
    title: "Kitchen sink leaking",
    status: "assigned",
    urgent: false,
    photo: "kitchen-sink-pipes",
    line: "WO-345 · plumber Tue 27 Oct, 10:00",
    homeLine: "Plumber Tue 27 Oct, 10:00 · staff may enter",
    steps: [
      { title: "Sent with 2 photos", detail: "Thu 22 Oct, 19:12", state: "done" },
      {
        title: "Kigali Plumbing Co. assigned",
        detail: "Thu 22 Oct · visitor pass 7730 made for them",
        state: "done",
      },
      {
        title: "Visit Tue 27 Oct, 10:00",
        detail: "Staff may enter · Ines home after 12:00",
        state: "now",
        icon: "Clock",
      },
      { title: "You confirm it is fixed", detail: "Then the request closes", state: "todo", icon: "SealCheck" },
    ],
    messages: [
      {
        id: "m1",
        from: "me",
        text: "Water is leaking under the kitchen sink. I have put a bucket under it for now.",
        photo: null,
        time: "You · Thu 19:12",
      },
      {
        id: "m2",
        from: "them",
        text: "Thank you, Olivier. A plumber from Kigali Plumbing Co. will come on Tuesday at 10:00. Is it fine to enter if you are at work?",
        photo: null,
        time: `${SOLANGE} · Thu 19:40`,
      },
      {
        id: "m3",
        from: "me",
        text: "Yes, that is fine. Ines will be home after 12.",
        photo: null,
        time: "You · Thu 20:02 · Read",
      },
    ],
    unread: 1,
  },
  {
    id: "WO-322",
    title: "Bedroom window latch broken",
    status: "fixed",
    urgent: false,
    photo: "window-latch",
    line: "WO-322 · fixed 2 Sep · you confirmed it works",
    homeLine: "Fixed 2 Sep",
    steps: [
      { title: "Sent with 1 photo", detail: "Mon 31 Aug, 08:10", state: "done" },
      { title: "Célestin assigned", detail: "Mon 31 Aug · the caretaker", state: "done" },
      { title: "Fixed: new latch fitted", detail: "Wed 2 Sep, 11:30", state: "done" },
      { title: "You confirmed it works", detail: "Wed 2 Sep, 18:04 · closed", state: "done" },
    ],
    messages: [
      photoMessage("m1", "window-latch", "You · Mon 08:10"),
      {
        id: "m2",
        from: "me",
        text: "The bedroom window latch is broken, so the window will not close.",
        photo: null,
        time: "You · Mon 08:10",
      },
      {
        id: "m3",
        from: "them",
        text: "Célestin will come on Wednesday morning with a new latch.",
        photo: null,
        time: `${SOLANGE} · Mon 09:02`,
      },
      { id: "m4", from: "me", text: "It closes properly now, thank you.", photo: null, time: "You · Wed 18:04 · Read" },
    ],
    unread: 0,
  },
  {
    id: "WO-301",
    title: "Low water pressure in shower",
    status: "fixed",
    urgent: false,
    photo: "shower-mixer",
    line: "WO-301 · fixed 4 Jul",
    homeLine: "Fixed 4 Jul",
    steps: [
      { title: "Sent with 1 photo", detail: "Thu 2 Jul, 07:40", state: "done" },
      { title: "Célestin assigned", detail: "Thu 2 Jul · the caretaker", state: "done" },
      { title: "Fixed: mixer cleaned of scale", detail: "Sat 4 Jul, 12:15", state: "done" },
      { title: "Closed", detail: "Sat 4 Jul", state: "done" },
    ],
    messages: [
      {
        id: "m1",
        from: "me",
        text: "The shower barely runs since this morning.",
        photo: null,
        time: "You · Thu 07:40",
      },
      {
        id: "m2",
        from: "them",
        text: "The mixer was blocked with scale. Célestin cleaned it; tell us if it comes back.",
        photo: null,
        time: `${SOLANGE} · Sat 12:15`,
      },
    ],
    unread: 0,
  },
];

let repairSeq = 346;
let messageSeq = 100;

const CATEGORIES: RepairCategory[] = [
  { value: "plumbing", label: "Plumbing", icon: "Droplet" },
  { value: "electrical", label: "Electrical", icon: "Thunderbolt" },
  { value: "doors", label: "Doors and windows" },
  { value: "appliances", label: "Appliances" },
  { value: "other", label: "Something else" },
];

/** What the camera "takes", in turn: the prototype's repair photos. */
const CAMERA: ProtoImage[] = ["dripping-tap", "leak-under-basin", "kitchen-sink-pipes", "cabinet-hinge"];
let shots = 0;
const photoById = new Map<string, ProtoImage>();

function repairPhoto(name: ProtoImage): RepairPhoto {
  const id = `${name}-${shots++}`;
  photoById.set(id, name);
  return { id, source: protoImages[name] };
}

/** The form as the phone kept it: a draft saved on this phone until it is sent. */
let repairDraft: { category: RepairCategoryId; description: string; photos: ProtoImage[]; staffMayEnter: boolean } = {
  category: "plumbing",
  description: "Water drips under the kitchen sink when the tap is on. Started last night.",
  photos: ["kitchen-sink-pipes", "leak-under-basin"],
  staffMayEnter: true,
};

function statusChip(r: Repair): StatusChip {
  if (r.status === "fixed") return { label: "Fixed", tone: "success", icon: "CircleCheck" };
  if (r.status === "assigned") return { label: "Assigned", tone: "info" };
  return r.urgent
    ? { label: "Urgent", tone: "danger", icon: "TriangleExclamation" }
    : { label: "Sent", tone: "accent" };
}

function summary(r: Repair): RepairSummary {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.line,
    photo: r.photo ? protoImages[r.photo] : null,
    status: statusChip(r),
    unread: r.unread,
  };
}

function unreadCount(): number {
  return repairs.reduce((sum, r) => sum + (r.status === "fixed" ? 0 : r.unread), 0);
}

export function mockRequests(): RequestsView {
  return {
    open: repairs.filter((r) => r.status !== "fixed").map(summary),
    done: repairs.filter((r) => r.status === "fixed").map(summary),
  };
}

export function mockRequestsEmpty(): RequestsView {
  return { open: [], done: [] };
}

export function mockRepairForm(): RepairForm {
  return {
    categories: CATEGORIES.map((c) => ({ ...c })),
    category: repairDraft.category,
    description: repairDraft.description,
    photos: repairDraft.photos.map(repairPhoto),
    staffMayEnter: repairDraft.staffMayEnter,
  };
}

export function takeRepairPhoto(): RepairPhoto {
  const name = CAMERA[shots % CAMERA.length] ?? "dripping-tap";
  return repairPhoto(name);
}

/** The first sentence, short enough for a list row: the request's title. */
function titleOf(description: string, category: RepairCategoryId): string {
  const first =
    description
      .trim()
      .split(/[.!?](?:\s|$)/)[0]
      ?.trim() ?? "";
  if (!first) return CATEGORIES.find((c) => c.value === category)?.label ?? "Repair";
  return first.length > 44 ? `${first.slice(0, 42).trimEnd()}…` : first;
}

export function sendRepair(input: RepairInput): string {
  const id = `WO-${repairSeq++}`;
  const photos = input.photoIds.map((p) => photoById.get(p)).filter((p): p is ProtoImage => Boolean(p));
  const count = photos.length;
  const sentWith = count === 0 ? "Sent" : `Sent with ${count} photo${count === 1 ? "" : "s"}`;
  repairs.unshift({
    id,
    title: titleOf(input.description, input.category),
    status: "sent",
    urgent: input.urgent,
    photo: photos[0] ?? null,
    line: `${id} · sent just now${input.urgent ? " · urgent" : ""}`,
    homeLine: input.urgent ? "Sent as urgent · the caretaker is told" : "Sent · Solange replies within a day",
    steps: [
      { title: sentWith, detail: `${TODAY.long}, 09:50`, state: "done" },
      input.urgent
        ? {
            title: "Caretaker and Solange told",
            detail: "Marked urgent · they call you back",
            state: "now",
            icon: "Clock",
          }
        : { title: "Solange assigns someone", detail: "Usually within a day", state: "now", icon: "Clock" },
      {
        title: "Visit planned",
        detail: input.staffMayEnter ? "Staff may enter if you are out" : "Only when you are home",
        state: "todo",
        icon: "Calendar",
      },
      { title: "You confirm it is fixed", detail: "Then the request closes", state: "todo", icon: "SealCheck" },
    ],
    messages: [
      ...photos.map((p) => photoMessage(`m${messageSeq++}`, p, "You · Mon 09:50")),
      { id: `m${messageSeq++}`, from: "me", text: input.description.trim(), photo: null, time: "You · Mon 09:50" },
    ],
    unread: 0,
  });
  repairDraft = { category: "plumbing", description: "", photos: [], staffMayEnter: true };
  return id;
}

export function mockRepairThread(id: string | undefined): RepairThread {
  const r = repairs.find((one) => one.id === id) ?? repairs.find((one) => one.id === "WO-345") ?? repairs[0];
  if (!r) throw new Error("No repair");
  return {
    id: r.id,
    title: r.title,
    subtitle: `${r.id} · with ${PLACE}`,
    steps: r.steps.map((s) => ({ ...s })),
    messages: r.messages.map((m) => ({ ...m })),
    contact: "Solange",
    unread: r.unread,
  };
}

export function sendRepairMessage(input: { id: string; text?: string; photo?: boolean }): void {
  const r = repairs.find((one) => one.id === input.id);
  if (!r) return;
  if (input.photo) {
    const name = CAMERA[shots++ % CAMERA.length] ?? "dripping-tap";
    r.messages.push(photoMessage(`m${messageSeq++}`, name, "You · Mon 09:52"));
  }
  const text = input.text?.trim();
  if (text) r.messages.push({ id: `m${messageSeq++}`, from: "me", text, photo: null, time: "You · Mon 09:52" });
}

export function markRepairRead(id: string): void {
  const r = repairs.find((one) => one.id === id);
  if (r) r.unread = 0;
}

// ── Emergency ───────────────────────────────────────────────────────────────

let lastCall: string | null = null;

export function mockEmergency(): EmergencyView {
  return {
    caretaker: { name: "Célestin", note: "on site 24 hours", phone: "0788 300 117" },
    management: { name: SOLANGE, hours: "07:00–20:00", phone: "0788 300 102" },
    kinds: [
      { value: "water", label: "Water leak", icon: "Droplet", category: "plumbing" },
      { value: "power", label: "No power", icon: "Thunderbolt", category: "electrical" },
      { value: "locked", label: "Locked out", icon: "Lock", category: "doors" },
      { value: "safety", label: "Safety", icon: "ShieldCheck", category: "other" },
    ],
    lastCall,
  };
}

export function logEmergencyCall(who: string): string {
  lastCall = `Call to ${who} logged at 09:52 for Solange`;
  return lastCall;
}

// ── Building ────────────────────────────────────────────────────────────────

type NoticeState = Notice & { headline: string; author: string };

const notices: NoticeState[] = [
  {
    id: "n-water",
    icon: "Droplet",
    tone: "warning",
    title: "Water off Thu, 09:00–12:00",
    headline: "Water off Thursday, 09:00–12:00",
    subtitle: "Block B tank cleaning · store water",
    body: "Block B tank cleaning. Please store water the night before.",
    author: "Solange",
    postedBy: `${SOLANGE} · ${TODAY.long}`,
    isNew: true,
  },
  {
    id: "n-meeting",
    icon: "Persons",
    tone: "accent",
    title: "Residents' meeting, Sat 7 Nov",
    headline: "Residents' meeting, Saturday 7 November",
    subtitle: "17:00 in the garden · parking and security",
    body: "Everyone is welcome in the garden at 17:00. On the agenda: visitor parking and the night guard rota.",
    author: "Solange",
    postedBy: `${SOLANGE} · Fri 23 Oct`,
    isNew: false,
  },
  {
    id: "n-codes",
    icon: "Key",
    tone: "default",
    title: "Visitor codes now expire by themselves",
    headline: "Visitor codes now expire by themselves",
    subtitle: "28 Sep · make one per visit",
    body: "A visitor code now works only for its time window and then stops by itself. Make a new code for each visit.",
    author: "Solange",
    postedBy: `${SOLANGE} · Mon 28 Sep`,
    isNew: false,
  },
];

export function markNoticeRead(id: string): void {
  const n = notices.find((one) => one.id === id);
  if (n) n.isNew = false;
}

type CodeState = Omit<VisitorCode, "windows" | "when" | "rule"> & { listed: boolean; day: string };

const WINDOWS: Record<string, VisitWindow[]> = {
  "VP-1031": [
    { value: "day", label: "10:00–16:00", detail: "Works once · expires at 16:00" },
    { value: "evening", label: "16:00–22:00", detail: "Works once · expires at 22:00" },
    { value: "overnight", label: "Overnight, until Sun 10:00", detail: "In and out · expires Sun 1 Nov, 10:00" },
  ],
  "VP-1029": [
    { value: "day", label: "14:00–20:00", detail: "Works once · expires at 20:00" },
    { value: "overnight", label: "Overnight, until Tue 10:00", detail: "In and out · expires Tue 27 Oct, 10:00" },
  ],
};

const codes: CodeState[] = [
  {
    id: "VP-1031",
    code: "6093",
    seed: "VP-1031-6093",
    name: "Grace Mukamana",
    firstName: "Grace",
    possessive: "her",
    day: "Sat 31 Oct",
    status: "active",
    sent: null,
    window: "day",
    listed: false,
  },
  {
    id: "VP-1029",
    code: "4821",
    seed: "VP-1029-4821",
    name: "Jean Uwizeye",
    firstName: "Jean",
    possessive: "his",
    day: "Today",
    status: "active",
    sent: "Sent by WhatsApp at 08:02",
    window: "day",
    listed: true,
  },
];

function windowOf(c: CodeState): VisitWindow {
  const list = WINDOWS[c.id] ?? [];
  return list.find((w) => w.value === c.window) ?? list[0] ?? { value: "day", label: "", detail: "" };
}

function codeRow(c: CodeState): VisitorRow {
  const w = windowOf(c);
  const status: StatusChip =
    c.status === "cancelled"
      ? { label: "Cancelled", tone: "danger" }
      : c.day === "Today"
        ? { label: "Expected", tone: "info" }
        : { label: "Sent", tone: "accent" };
  return {
    id: c.id,
    icon: "Person",
    tone: "info",
    name: c.name,
    subtitle: `${c.day} ${w.label} · ${c.code}`,
    status,
    repairId: null,
  };
}

const household: (HouseholdMember & { first: string; help: boolean })[] = [
  {
    id: "olivier",
    name: "Olivier Habineza",
    first: "You",
    initials: "OH",
    tone: "accent",
    subtitle: "You · lease holder · pays rent",
    role: { label: "Lease", tone: "accent" },
    help: false,
  },
  {
    id: "ines",
    name: "Ines Habineza",
    first: "Ines",
    initials: "IH",
    tone: "accent",
    subtitle: "On the lease · can request repairs and codes",
    role: { label: "Lease", tone: "accent" },
    help: false,
  },
  {
    id: "vestine",
    name: "Vestine Uwera",
    first: "Vestine",
    initials: "VU",
    tone: "warning",
    subtitle: "House help · standing pass Mon–Fri 07:30–17:30",
    role: { label: "Pass", tone: "warning" },
    help: true,
  },
];

let passOn = true;
let memberSeq = 1;

/** "You, Ines and Vestine (house help)". */
function householdLine(): string {
  const names = household.map((m) => (m.help ? `${m.first} (house help)` : m.first));
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function mockBuilding(): BuildingView {
  return {
    name: `${PLACE} Residences`,
    photo: protoImages["shared-garden"],
    homes: "24 homes · Block A and B",
    notices: notices.map(({ headline: _h, author: _a, ...n }) => ({ ...n })),
    visitors: [
      ...codes.filter((c) => c.listed).map(codeRow),
      {
        id: "pass-7730",
        icon: "Wrench",
        tone: "success",
        name: "Kigali Plumbing Co.",
        subtitle: "Tue 27 Oct · for your repair",
        status: { label: "Approved", tone: "success" },
        repairId: "WO-345",
      },
    ],
    household: {
      people: household.map((m) => ({ initials: m.initials, tone: m.tone, name: m.name })),
      summary: householdLine(),
    },
  };
}

export function mockBuildingEmpty(): BuildingView {
  return { ...mockBuilding(), notices: [], visitors: [] };
}

export function mockVisitorCode(id: string | undefined): VisitorCode {
  const c = codes.find((one) => one.id === id) ?? codes[0];
  if (!c) throw new Error("No visitor code");
  const w = windowOf(c);
  const { listed: _listed, day, ...rest } = c;
  return {
    ...rest,
    when: `${day} · ${w.label} · ${UNIT}`,
    rule: w.detail,
    windows: (WINDOWS[c.id] ?? []).map((one) => ({ ...one, label: `${day}, ${one.label}` })),
  };
}

export function changeVisitWindow(input: { id: string; window: string }): void {
  const c = codes.find((one) => one.id === input.id);
  if (c) c.window = input.window;
}

export function cancelVisitorCode(id: string): void {
  const c = codes.find((one) => one.id === id);
  if (c) c.status = "cancelled";
}

export function markCodeSent(id: string): void {
  const c = codes.find((one) => one.id === id);
  if (!c) return;
  c.sent = "Sent at 09:12";
  c.listed = true;
}

export function mockHousehold(): HouseholdView {
  const vestine = household.find((m) => m.id === "vestine");
  return {
    unit: `Unit ${UNIT}`,
    members: household.map(({ first: _f, help: _h, ...m }) =>
      m.id === "vestine" && !passOn
        ? { ...m, subtitle: "House help · pass paused", role: { label: "Paused", tone: "default" } }
        : { ...m, role: { ...m.role } },
    ),
    pass: vestine
      ? {
          name: "Vestine",
          on: passOn,
          rows: [
            { label: "Days", value: "Monday to Friday" },
            { label: "Hours", value: "07:30–17:30" },
            { label: "Renews", value: passOn ? "1 Nov · you confirm each month" : "Paused · the gate refuses it" },
          ],
          note: "She can enter, but cannot make visitor codes or see your payments.",
        }
      : null,
  };
}

export function setStandingPass(on: boolean): void {
  passOn = on;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function addHouseholdMember(input: NewMember): void {
  const name = input.name.trim();
  if (!name) return;
  const help = input.kind === "help";
  household.push({
    id: `member-${memberSeq++}`,
    name,
    first: name.split(/\s+/)[0] ?? name,
    initials: initialsOf(name),
    tone: help ? "warning" : "accent",
    subtitle: help ? "House help · pass from tomorrow, 07:30–17:30" : "Invited to the lease · Solange checks the ID",
    role: help ? { label: "Pass", tone: "warning" } : { label: "Invited", tone: "info" },
    help,
  });
}

// ── Me, lease and renewal ───────────────────────────────────────────────────

const renewal = { state: "offered" as "offered" | "signed" };

export function mockMe(): MeView {
  return {
    name: "Olivier Habineza",
    line: `Resident · ${PLACE} ${UNIT}`,
    lease: {
      subtitle: renewal.state === "signed" ? "Renewed to 14 Nov 2027" : "Ends 14 Nov",
      chip:
        renewal.state === "signed"
          ? { label: "Renewal signed", tone: "success" }
          : { label: "Answer by 30 Oct", tone: "warning" },
    },
    household: household
      .filter((m) => m.first !== "You")
      .map((m) => m.first)
      .join(", "),
    moveIn: "15 Nov 2025 · 24 photos · signed",
    reminders: "Rent reminders 3 days before",
  };
}

export function mockLease(): LeaseView {
  return {
    id: "L-KC-014",
    unitLine: `Unit ${UNIT} · ${PLACE}`,
    status: { label: "Active", tone: "success" },
    term: "15 Nov 2025 – 14 Nov 2026",
    progress: 94,
    day: "Day 346 of 365",
    left: "19 days left",
    renewal:
      renewal.state === "offered"
        ? {
            state: "offered",
            title: "Renewal offer: 12 months",
            detail: "RWF 980,000 a month · answer by Fri 30 Oct",
          }
        : {
            state: "signed",
            title: "Renewal signed: 12 more months",
            detail: "RWF 980,000 a month from 15 Nov · Solange countersigns next",
          },
    terms: [
      { label: "Monthly rent", value: rwf(950_000) },
      { label: "Caution deposit", value: rwf(1_900_000) },
      { label: "Notice period", value: "30 days in writing" },
      { label: "Landlord", value: PAYEE },
      { label: "Occupants", value: "You and Ines" },
    ],
    documents: [
      {
        id: "lease-v2",
        icon: "FileCheck",
        tone: "success",
        title: "Signed lease, version 2",
        subtitle: "Both signed · Nov 2025",
        opens: "file",
      },
      {
        id: "move-in",
        icon: "Picture",
        tone: "success",
        title: "Move-in inspection report",
        subtitle: "15 Nov 2025 · 24 photos",
        opens: "movein",
      },
      {
        id: "rules-2026",
        icon: "BookOpen",
        tone: "default",
        title: "House rules 2026",
        subtitle: "Acknowledged",
        opens: "file",
      },
    ],
  };
}

export function mockRenewal(): RenewalView {
  return {
    deadline: "Answer by Fri 30 Oct",
    title: "Stay another 12 months?",
    intro: "Solange sent this on 1 Oct. Your lease renews only after you and the landlord both sign.",
    now: 950_000,
    next: 980_000,
    from: "From 15 Nov",
    change: "+3.2%",
    rows: [
      { label: "New term", value: "15 Nov 2026 – 14 Nov 2027" },
      { label: "Deposit top-up", value: `${rwf(60_000)} with first rent` },
      { label: "Other terms", value: "Unchanged" },
    ],
    amendment: {
      title: "Amendment to lease L-KC-014",
      body: "Clause 3: the monthly rent is RWF 980,000 from 15 Nov 2026. Clause 5: the caution deposit grows by RWF 60,000, paid with the first rent. Every other clause stays as signed in November 2025.",
    },
    phone: MTN,
    manager: "Solange",
    state: renewal.state,
    signedLine:
      renewal.state === "signed"
        ? "You signed on Mon 26 Oct at 09:55 with the code we texted you. Solange and the landlord countersign next."
        : null,
  };
}

export function signRenewal(code: string): void {
  if (code.replace(/\D/g, "").length !== 6) throw new Error("That code has 6 digits");
  renewal.state = "signed";
}

// ── Moving in ───────────────────────────────────────────────────────────────

type RoomState = {
  id: string;
  name: string;
  photo: ProtoImage | null;
  photos: number;
  shoot: ProtoImage;
  count: number;
};

const rooms: RoomState[] = [
  { id: "living", name: "Living room", photo: "living-room-floor", photos: 5, shoot: "living-room-floor", count: 5 },
  { id: "kitchen", name: "Kitchen", photo: "kitchen-appliances", photos: 4, shoot: "kitchen-appliances", count: 4 },
  { id: "bed1", name: "Bedroom 1", photo: "bedroom-window", photos: 3, shoot: "bedroom-window", count: 3 },
  { id: "bed2", name: "Bedroom 2", photo: null, photos: 0, shoot: "twin-room", count: 4 },
  { id: "bath", name: "Bathroom", photo: null, photos: 0, shoot: "deluxe-bathroom", count: 3 },
  { id: "balcony", name: "Balcony", photo: null, photos: 0, shoot: "balcony-glass-door", count: 2 },
];

export function mockMoveIn(): MoveInView {
  const firstTodo = rooms.find((r) => !r.photo);
  const list: MoveInRoom[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    photo: r.photo ? protoImages[r.photo] : null,
    photos: r.photos,
    state: r.photo ? "done" : r === firstTodo ? "now" : "todo",
  }));
  const done = list.filter((r) => r.state === "done").length;
  const allDone = done === rooms.length;
  const total = rooms.reduce((sum, r) => sum + r.photos, 0);
  return {
    unit: `Unit C-04 · ${PLACE}`,
    step: allDone ? 5 : 4,
    total: 5,
    steps: [
      { title: "Invitation accepted", detail: "From Solange · 20 Oct", state: "done" },
      { title: "ID checked and lease signed", detail: "One-time code · 22 Oct", state: "done" },
      { title: "Deposit and first rent paid", detail: `${rwf(2_550_000)} · MTN MoMo · 23 Oct`, state: "done" },
      allDone
        ? {
            title: "Every room photographed",
            detail: `${rooms.length} rooms · ${total} photos · sent to Solange`,
            state: "done",
          }
        : {
            title: "Photograph every room",
            detail: "Before you unpack. They protect your deposit.",
            state: "now",
            icon: "Camera",
          },
      {
        title: "Keys and gate card",
        detail: "With the caretaker, Sun 1 Nov",
        state: allDone ? "now" : "todo",
        icon: "Key",
      },
    ],
    rooms: list,
    done,
    next: list.find((r) => r.state === "now") ?? null,
  };
}

export function photographRoom(id: string): void {
  const r = rooms.find((one) => one.id === id);
  if (!r || r.photo) return;
  r.photo = r.shoot;
  r.photos = r.count;
}

// ── Moving out ──────────────────────────────────────────────────────────────

type DeductionState = Omit<Deduction, "evidence"> & {
  evidence:
    | { kind: "photos"; before: ProtoImage; after: ProtoImage }
    | { kind: "meter"; photo: ProtoImage; reading: string };
};

const deductions: DeductionState[] = [
  {
    id: "d-holes",
    title: "Nail holes, living room wall",
    amount: 25_000,
    evidence: { kind: "photos", before: "loft-studio", after: "wall-nail-holes" },
    status: "pending",
  },
  {
    id: "d-water",
    title: "Water, 1–14 Nov",
    amount: 8_400,
    evidence: { kind: "meter", photo: "water-meter", reading: "Meter 4,812 → 4,826 m³ read with you at inspection" },
    status: "accepted",
  },
];

const HELD = 1_900_000;
let settlementSent = false;

export function mockMoveOut(): MoveOutView {
  const deducted = deductions.reduce((sum, d) => sum + d.amount, 0);
  return {
    stages: [
      { label: "Notice sent", state: "done" },
      { label: "Inspection 14 Nov", state: "done" },
      { label: "Settlement", state: settlementSent ? "done" : "now" },
      { label: "Refund", state: settlementSent ? "now" : "todo" },
    ],
    step: settlementSent ? 4 : 3,
    held: HELD,
    deductions: deductions.map((d) => ({
      id: d.id,
      title: d.title,
      amount: d.amount,
      status: d.status,
      evidence:
        d.evidence.kind === "photos"
          ? { kind: "photos", before: protoImages[d.evidence.before], after: protoImages[d.evidence.after] }
          : { kind: "meter", photo: protoImages[d.evidence.photo], reading: d.evidence.reading },
    })),
    deducted,
    refund: HELD - deducted,
    refundTo: `Refund goes to MTN MoMo ${MTN} after Solange approves`,
    submitted: settlementSent,
  };
}

export function answerDeduction(input: { id: string; status: DeductionStatus }): void {
  const d = deductions.find((one) => one.id === input.id);
  if (d && !settlementSent) d.status = input.status;
}

/** Accepts every deduction not disputed and sends the settlement to Solange. */
export function acceptDeductions(): void {
  for (const d of deductions) if (d.status === "pending") d.status = "accepted";
  settlementSent = true;
}

// ── The tab bar ─────────────────────────────────────────────────────────────

export function mockTabCounts(): TabCounts {
  return { requests: unreadCount(), building: notices.some((n) => n.isNew) };
}
