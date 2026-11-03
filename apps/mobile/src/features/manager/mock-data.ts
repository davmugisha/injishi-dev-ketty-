// The manager app's sample data, from the prototype (`e-mgrdesk.mjs`, MANAGER): Aline Uwase, general
// manager of Isangano Lakeside, on Tuesday 13 October. Read only by `data.ts`; its mock actions decide
// requests, mark alerts read and change settings here, and every read returns fresh objects.

import type {
  Approval,
  ApprovalDetail,
  ApprovalsView,
  ConfirmWith,
  FlashView,
  InboxItem,
  InboxView,
  ManagerMe,
  TodayView,
} from "./types";

// ---------------------------------------------------------------- approvals

/** Rooms ready to sell today; releasing 305 adds one. */
let readyRooms = 21;

const details: ApprovalDetail[] = [
  {
    id: "room-305",
    group: "rooms",
    state: "waiting",
    icon: "Wrench",
    tone: "warning",
    title: "Release room 305",
    detail: "AC fixed · inspected · waiting 40 min",
    tag: { label: "Sellable", tone: "success" },
    heading: "Release room 305",
    askedBy: "Asked by Beatrice · 10:40",
    kicker: "Room block · Deluxe Lake View",
    figure: "Room 305",
    figureNote: "Blocked since 08:05 · AC not cooling",
    checks: [{ label: "AC fixed 10:12", icon: "CircleCheck" }, { label: "Inspected 10:40" }],
    evidence: [
      { label: "Work order", value: "WO-331 · AC not cooling" },
      { label: "Fixed", value: "Jean-Paul · 10:12 · drain cleared" },
      { label: "Inspected", value: "Beatrice · 10:40 · 18 of 18 checks" },
      { label: "Faults this month", value: "3 · same unit" },
      { label: "Next arrival", value: "BK-20466 · tonight 18:00" },
    ],
    after: [
      { title: "You release it", detail: "Recorded with the inspection", icon: "Person" },
      { title: "The desk can sell 305", detail: "It shows as Ready on the rack", icon: "House" },
      { title: "The work order closes", detail: "The repair joins 305's history", icon: "Wrench" },
    ],
    approveLabel: "Release",
    declineLabel: "Keep blocked",
    approvedWord: "Released",
  },
  {
    id: "refund-20417",
    group: "money",
    state: "waiting",
    icon: "Wallet",
    tone: "warning",
    title: "Refund RWF 60,000",
    detail: "BK-20417 · cancelled 3 days out · 1 h",
    heading: "Refund request",
    askedBy: "Asked by Eric · 09:50",
    kicker: "Refund to guest",
    figure: "RWF 60,000",
    figureNote: "Back to MTN MoMo +250 78• ••• 214",
    checks: [{ label: "Inside policy", icon: "CircleCheck" }, { label: "Under your limit" }],
    evidence: [
      { label: "Booking", value: "BK-20417 · Twin · 16–18 Oct" },
      { label: "Cancelled", value: "13 Oct 08:41 · 3 days out" },
      { label: "Deposit paid", value: "RWF 120,000" },
      { label: "Policy", value: "Flexible 14-day · v4 · tier 2" },
      { label: "Tier 2 refund", value: "50% · RWF 60,000" },
      { label: "Original payment", value: "PI-77131 · verified 20 Sep" },
    ],
    after: [
      { title: "You approve", detail: "Recorded with policy version 4", icon: "Person" },
      { title: "Payments sends RWF 60,000", detail: "Through MTN MoMo", icon: "PaperPlane" },
      { title: "Refunded when MTN confirms", detail: "The guest gets an SMS and a receipt", icon: "CircleCheck" },
    ],
    approveLabel: "Approve",
    declineLabel: "Decline",
    approvedWord: "Approved",
  },
  {
    id: "leave-jeanne",
    group: "people",
    state: "waiting",
    icon: "Calendar",
    tone: "info",
    title: "Leave · Jeanne Nyiraneza",
    detail: "3–4 Nov · annual · Beatrice approved first",
    heading: "Leave request",
    askedBy: "Asked by Jeanne · Mon 12 Oct",
    kicker: "Annual leave",
    figure: "2 days",
    figureNote: "Tue 3 – Wed 4 Nov · back Thu 5 Nov",
    checks: [{ label: "Beatrice approved", icon: "CircleCheck" }, { label: "Cover found" }],
    evidence: [
      { label: "Housekeeper", value: "Jeanne Nyiraneza · floor 2" },
      { label: "Leave left", value: "14 of 18 days this year" },
      { label: "Cover", value: "Claudine · both days" },
      { label: "Forecast", value: "71% on 3 Nov · 68% on 4 Nov" },
      { label: "Supervisor", value: "Beatrice · approved Fri 9 Oct" },
    ],
    after: [
      { title: "You approve", detail: "Recorded against her leave balance", icon: "Person" },
      { title: "HR updates the rota", detail: "Diane moves Claudine onto floor 2", icon: "Calendar" },
      { title: "Jeanne is told", detail: "Her schedule shows the days off", icon: "CircleCheck" },
    ],
    approveLabel: "Approve",
    declineLabel: "Decline",
    approvedWord: "Approved",
  },
  {
    id: "discount-kivu",
    group: "money",
    state: "waiting",
    icon: "Tag",
    tone: "warning",
    title: "Discount 12% · Kivu Hall lunch",
    detail: "Eric for EAC Health Forum · 25 covers",
    heading: "Discount request",
    askedBy: "Asked by Eric · 10:15",
    kicker: "Group lunch discount",
    figure: "12% off",
    figureNote: "RWF 1,125,000 becomes RWF 990,000",
    checks: [{ label: "Under your 15% limit", icon: "CircleCheck" }, { label: "Group rate applies" }],
    evidence: [
      { label: "Event", value: "EAC Health Forum · Thu 22 Oct" },
      { label: "Covers", value: "25 · set lunch RWF 45,000" },
      { label: "Discount", value: "12% · RWF 135,000 off" },
      { label: "Group rate", value: "10% from 20 covers" },
      { label: "Asked by", value: "Eric Habimana · front desk" },
    ],
    after: [
      { title: "You approve", detail: "Recorded against your discount limit", icon: "Person" },
      { title: "Eric sends the quote", detail: "To the forum's organiser, new total", icon: "PaperPlane" },
      { title: "The bill shows it", detail: "And the flash report, under F&B", icon: "CircleCheck" },
    ],
    approveLabel: "Approve",
    declineLabel: "Decline",
    approvedWord: "Approved",
  },
];

const owner: Approval[] = [
  {
    id: "refund-20418",
    group: "money",
    state: "owner",
    icon: "Persons",
    tone: "default",
    title: "Refund RWF 480,000",
    detail: "BK-20418 · above your limit · with Didier since 08:10",
    tag: { label: "Owner", tone: "default" },
  },
];

const decidedEarlier: Approval[] = [
  {
    id: "overtime-joseph",
    group: "people",
    state: "declined",
    icon: "Clock",
    tone: "default",
    title: "Overtime · Joseph K. · 3 h",
    detail: "Lake Bar · Sat 10 Oct",
    decidedAt: "10:02",
    reason: "Cover found on the morning shift",
  },
  {
    id: "comp-20412",
    group: "money",
    state: "approved",
    icon: "Cup",
    tone: "success",
    title: "Comp breakfast · BK-20412",
    detail: "2 covers · late room on arrival",
    decidedAt: "09:15",
  },
  {
    id: "late-208",
    group: "rooms",
    state: "approved",
    icon: "Clock",
    tone: "success",
    title: "Late checkout · room 208",
    detail: "Until 14:00 · no arrival tonight",
    decidedAt: "08:40",
  },
];

/** The list row of a request: what the approvals list and Today show. */
function rowOf(d: ApprovalDetail): Approval {
  const { id, group, state, icon, tone, title, detail, tag, decidedAt, reason } = d;
  return { id, group, state, icon, tone, title, detail, tag: tag ? { ...tag } : undefined, decidedAt, reason };
}

function copyDetail(d: ApprovalDetail): ApprovalDetail {
  return {
    ...d,
    tag: d.tag ? { ...d.tag } : undefined,
    checks: d.checks.map((c) => ({ ...c })),
    evidence: d.evidence.map((e) => ({ ...e })),
    after: d.after.map((a) => ({ ...a })),
  };
}

export function mockApprovals(): ApprovalsView {
  const waiting = details.filter((d) => d.state === "waiting").map(rowOf);
  const decided = details
    .filter((d) => d.state === "approved" || d.state === "declined")
    .map(rowOf)
    .reverse();
  return {
    place: "Isangano Lakeside",
    limit: "RWF 300,000",
    waiting,
    owner: owner.map((o) => ({ ...o, tag: o.tag ? { ...o.tag } : undefined })),
    done: [...decided, ...decidedEarlier.map((d) => ({ ...d }))],
  };
}

export function emptyApprovals(): ApprovalsView {
  return { place: "Isangano Lakeside", limit: "RWF 300,000", waiting: [], owner: [], done: [] };
}

/** The request the prototype opens when no id is given: Eric's refund. */
const DEFAULT_APPROVAL = "refund-20417";

export function mockApproval(id: string | undefined): ApprovalDetail | null {
  const found = details.find((d) => d.id === (id ?? DEFAULT_APPROVAL));
  return found ? copyDetail(found) : null;
}

/** Approve or decline a waiting request; it moves to Done today. */
export function decide(input: { id: string; approve: boolean; at: string; reason?: string }): ApprovalDetail | null {
  const found = details.find((d) => d.id === input.id);
  if (!found) return null;
  if (found.state !== "waiting") return copyDetail(found);
  found.state = input.approve ? "approved" : "declined";
  found.decidedAt = input.at;
  found.reason = input.approve ? undefined : input.reason?.trim() || undefined;
  found.tone = input.approve ? "success" : "default";
  if (found.id === "room-305") readyRooms += input.approve ? 1 : 0;
  return copyDetail(found);
}

// ---------------------------------------------------------------- today

export function mockToday(): TodayView {
  const waiting = details.filter((d) => d.state === "waiting");
  const room = waiting.find((d) => d.id === "room-305");
  return {
    date: "Tuesday 13 October",
    place: "Isangano Lakeside",
    occupancy: { value: "82%", caption: "+6 pts vs last Tue", trend: [50, 62, 58, 70, 66, 76, 90] },
    revenue: { value: "4.8", unit: "M", caption: "RWF · all outlets", trend: [40, 55, 48, 62, 58, 75, 84] },
    arrivals: { value: "9", unit: "/ 14", caption: "checked in · 2 VIP" },
    ready: { value: String(readyRooms), unit: "/ 26", caption: `${26 - readyRooms} being cleaned` },
    feature: room
      ? {
          id: room.id,
          kicker: "Room block · 305 · Deluxe Lake View",
          title: "Put room 305 back on sale?",
          trail: [
            { label: "AC fixed", at: "10:12" },
            { label: "Inspected", at: "10:40" },
          ],
          approveLabel: room.approveLabel,
          declineLabel: room.declineLabel,
          approvedNote: "Room 305 is back on sale",
          declinedNote: "Room 305 stays blocked",
        }
      : null,
    next: waiting
      .filter((d) => d.id !== "room-305")
      .slice(0, 2)
      .map(rowOf),
    waitingCount: waiting.length,
    housekeeping: { done: readyRooms, total: 26 },
    workOrders: 3,
    guestMessages: 2,
    unreadAlerts: inbox.filter((i) => i.unread && i.tags.includes("alerts")).length,
  };
}

// ---------------------------------------------------------------- inbox

const inbox: InboxItem[] = [
  {
    id: "audit-ishyamba",
    section: "action",
    tags: ["alerts"],
    icon: "TriangleExclamation",
    tone: "danger",
    title: "Night audit failed · Ishyamba",
    detail: "02:00 · attempt 3 · Tuesday's charges not posted",
    body: "The night audit for Ishyamba Forest Lodge stopped at 02:00 after three attempts. Tuesday's room charges are not posted, so the flash report leaves Ishyamba's Tuesday out until it runs.",
    unread: true,
    live: "danger",
    action: {
      label: "Run the audit again",
      doneTitle: "Night audit posted · Ishyamba",
      doneDetail: "Run again by you · Tuesday's charges posted",
    },
  },
  {
    id: "complaint-211",
    section: "action",
    tags: ["alerts", "guests"],
    icon: "FaceSad",
    tone: "warning",
    title: "Complaint · room 211",
    detail: "“Music from Kivu Hall until midnight” · 08:14",
    body: "“Music from Kivu Hall until midnight.” The guest in 211 checks out Thursday. Eric has apologised at the desk and the event ends at 22:00 tonight.",
    unread: true,
    live: "warning",
    action: {
      label: "Offer a late checkout",
      doneTitle: "Complaint answered · room 211",
      doneDetail: "Late checkout until 14:00 offered",
    },
  },
  {
    id: "payment-20452",
    section: "action",
    tags: ["alerts", "guests"],
    icon: "Wallet",
    tone: "warning",
    title: "Payment failed · BK-20452",
    detail: "MoMo prompt expired twice · arrives tomorrow",
    body: "The MoMo prompt for BK-20452's deposit, RWF 95,000, expired twice. The guest arrives tomorrow; the room is held until 18:00 today.",
    unread: true,
    action: {
      label: "Send a new MoMo prompt",
      doneTitle: "New MoMo prompt sent · BK-20452",
      doneDetail: "Waiting for the guest to approve it",
    },
  },
  {
    id: "didier",
    section: "earlier",
    tags: ["team"],
    icon: "Comments",
    tone: "default",
    title: "Didier Mugenzi",
    detail: "“Can we look at the October pay run before Thursday?”",
    body: "“Can we look at the October pay run before Thursday? I'd like the overtime at Ishyamba explained before it goes to the bank.”",
    unread: false,
  },
  {
    id: "lake-bar",
    section: "earlier",
    tags: ["team"],
    icon: "CloudSlash",
    tone: "default",
    title: "Lake Bar till synced",
    detail: "4 tickets from last night arrived 07:58",
    body: "The Lake Bar till found signal at 07:58 and sent 4 tickets from last night. They are in Monday's F&B on the flash report.",
    unread: false,
  },
  {
    id: "ready-204",
    section: "earlier",
    tags: ["team"],
    icon: "CheckDouble",
    tone: "success",
    title: "Room 204 ready",
    detail: "Inspected by Beatrice · arrival at 14:00",
    body: "Beatrice inspected 204 and passed all 18 checks. It is ready for the 14:00 arrival.",
    unread: false,
  },
];

export function mockInbox(): InboxView {
  return { items: inbox.map((i) => ({ ...i, tags: [...i.tags], action: i.action ? { ...i.action } : undefined })) };
}

export function emptyInbox(): InboxView {
  return { items: [] };
}

/** Opened, or "mark all read" when no id is given. */
export function markRead(id?: string): void {
  for (const item of inbox) if (!id || item.id === id) item.unread = false;
}

/** The inbox action was done: the row moves down to Earlier, saying what happened. */
export function resolve(input: { id: string; at: string }): void {
  const item = inbox.find((i) => i.id === input.id);
  if (!item?.action) return;
  item.title = item.action.doneTitle;
  item.detail = `${item.action.doneDetail} · ${input.at}`;
  item.body = `${item.action.doneDetail}, at ${input.at}.`;
  item.section = "earlier";
  item.tone = "success";
  item.icon = "CircleCheck";
  item.unread = false;
  item.live = undefined;
  item.action = undefined;
  inbox.splice(inbox.indexOf(item), 1);
  const firstEarlier = inbox.findIndex((i) => i.section === "earlier");
  inbox.splice(firstEarlier < 0 ? inbox.length : firstEarlier, 0, item);
}

// ---------------------------------------------------------------- flash

export function mockFlash(): FlashView {
  return {
    day: "Yesterday · Mon 12 Oct",
    revenue: "RWF 5,563,000",
    sold: "47 rooms and tents sold · ADR RWF 118,400",
    week: [
      { day: "Tue", value: 58 },
      { day: "Wed", value: 64 },
      { day: "Thu", value: 70 },
      { day: "Fri", value: 88 },
      { day: "Sat", value: 96 },
      { day: "Sun", value: 72 },
      { day: "Mon", value: 80 },
    ],
    properties: [
      { name: "Isangano", value: "81%", caption: "34 of 42 rooms" },
      { name: "Ishyamba", value: "72%", caption: "13 of 18 tents" },
    ],
    revpar: { value: "92.7", unit: "k", caption: "+6.9% vs Monday" },
    fnb: { value: "1.9", unit: "M", caption: "Terrace, Lake Bar, rooms" },
    methods: [
      { name: "MTN MoMo", share: 62 },
      { name: "Card", share: 18 },
      { name: "Cash", share: 12 },
      { name: "Bank transfer", share: 8 },
    ],
    openAudit: inbox.some((i) => i.id === "audit-ishyamba" && i.action)
      ? {
          title: "Ishyamba's Tuesday audit is still open",
          body: "These figures cover Monday, which closed at 23:31.",
        }
      : null,
  };
}

// ---------------------------------------------------------------- me

const me: ManagerMe = {
  name: "Aline Uwase",
  initials: "AU",
  role: "General manager · Amahoro Hospitality Ltd",
  places: "Isangano · Ishyamba",
  limits: [
    { label: "Refunds", value: "Up to RWF 300,000" },
    { label: "Discounts", value: "Up to 15%" },
    { label: "Leave and overtime", value: "Any request" },
    { label: "Above your limits", value: "Didier Mugenzi, owner" },
  ],
  limitsSummary: "Refunds RWF 300k · discounts 15%",
  confirmWith: "fingerprint",
  alerts: { urgent: true, flash: true },
};

export function mockMe(): ManagerMe {
  return { ...me, limits: me.limits.map((l) => ({ ...l })), alerts: { ...me.alerts } };
}

export function setConfirmWith(value: ConfirmWith): void {
  me.confirmWith = value;
}

export function setAlerts(input: Partial<ManagerMe["alerts"]>): void {
  me.alerts = { ...me.alerts, ...input };
}
