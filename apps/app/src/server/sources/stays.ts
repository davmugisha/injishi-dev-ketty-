/**
 * Live sources for the stays area: the desk's guest conversations (`GET /api/v1/ops/threads` and each
 * conversation's messages) and the business's reply templates (`GET /api/v1/ops/message-templates`),
 * presented as the stays fixture document types.
 *
 * What is not here stays on fixtures, each with its reason in the data map: the stay record and its
 * bill (folio lines are grouped by outlets the world does not have yet, and payments in flight have no
 * table), checkout (company accounts and the city ledger), guest profiles and the offline desk.
 */
import type { MessageTemplate, MessageThread, ThreadMessage } from "@injishi/data/fixtures/stays";
import { clock, dayMonth, kigaliDate, rwf } from "../format";
import {
  type ApiBoard,
  type ApiBooking,
  type ApiStay,
  channelOf,
  daysBetween,
  deskBoard,
  initialsOf,
  nameOf,
  span,
} from "./frontdesk";
import { defineSources, type SourceContext } from "./types";

/** GET /api/v1/ops/message-templates (DeskMessageTemplate in @injishi/contracts). */
interface ApiTemplate {
  id: string;
  key: string;
  label: string;
  bodies: { en: string; rw: string | null; fr: string | null };
}

/** GET /api/v1/ops/threads (OperatorThread in @injishi/contracts). */
interface ApiThread {
  id: string;
  scope: "booking" | "stay" | "lease";
  subjectId: string;
  counterpartName: string | null;
  departmentName: string | null;
  status: "active" | "archived";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

/** GET /api/v1/ops/threads/:id/messages (OperatorMessage). */
interface ApiMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string | null;
  fromUs: boolean;
  bodyType: "text" | "image" | "voice" | "system";
  body: string | null;
  serviceOrderId: string | null;
  createdAt: string;
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = [
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

/** "Today", "Yesterday", "Sunday 11 October". */
function dayHeading(day: string, today: string): string {
  const back = daysBetween(day, today);
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAY_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]}`;
}

/** "10:20" today, "Sat" earlier this week, "4 Oct" before that. */
function listTime(at: string | null, today: string): string {
  if (!at) return "";
  const day = kigaliDate(at);
  const back = daysBetween(day, today);
  if (back === 0) return clock(at);
  if (back < 7) return WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return dayMonth(day);
}

/** "18 min", "2 h", "3 days". */
function age(from: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(from)) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`;
}

/** What the conversation is about, in the desk's terms. */
function context(booking: ApiBooking | undefined, stay: ApiStay | undefined, board: ApiBoard) {
  const today = board.today;
  if (stay && stay.lifecycle === "closed") {
    return {
      ctx: `Checked out ${stay.actualExitAt ? dayMonth(stay.actualExitAt) : ""} · ${stay.reference ?? ""}`.trim(),
      who: "Thread read-only after checkout",
    };
  }
  if (stay) {
    return {
      ctx: `Room ${stay.roomLabel ?? ""} · Stay ${stay.reference ?? ""}`.trim(),
      who: `In-house · ${stay.roomTypeName}`,
    };
  }
  if (booking) {
    const when = booking.checkIn === today ? "arrives today" : dayMonth(booking.checkIn);
    return {
      ctx: `Pre-arrival · ${booking.reference} · ${when}`,
      who: `${channelOf(booking.channel)} booking · ${booking.nights} ${booking.nights === 1 ? "night" : "nights"}`,
    };
  }
  return { ctx: "Conversation", who: "" };
}

function facts(booking: ApiBooking | undefined, stay: ApiStay | undefined): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (booking)
    out.push({ label: "Booking", value: `${booking.reference} · ${span(booking.checkIn, booking.checkOut)}` });
  if (stay) {
    out.push({ label: "Stay", value: `${stay.reference ?? "Stay"} · room ${stay.roomLabel ?? ""}`.trim() });
    if (stay.plannedExitAt && stay.lifecycle === "open") {
      out.push({ label: "Due out", value: `${dayMonth(stay.plannedExitAt)} ${clock(stay.plannedExitAt)}` });
    }
    if (stay.folio) {
      out.push({
        label: "Folio",
        value:
          stay.folio.balanceRwf === null
            ? stay.folio.folioNumber
            : `${stay.folio.folioNumber} · ${rwf(stay.folio.balanceRwf)} ${stay.folio.balanceRwf > 0 ? "due" : "balance"}`,
      });
    }
  }
  return out;
}

function presentMessages(lines: ApiMessage[], today: string): ThreadMessage[] {
  const out: ThreadMessage[] = [];
  let day = "";
  for (const m of [...lines].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    // A system line (an order's status) and media have no rendering of their own here yet.
    if (m.bodyType !== "text" || !m.body) continue;
    const d = kigaliDate(m.createdAt);
    if (d !== day) {
      out.push({ t: "day", text: dayHeading(d, today) });
      day = d;
    }
    out.push(
      m.fromUs
        ? {
            t: "staff",
            text: m.body,
            meta: `${clock(m.createdAt)} · ${m.senderName ?? "Front desk"} · guest app`,
            delivery: [],
          }
        : { t: "guest", text: m.body, meta: `${clock(m.createdAt)} · guest app` },
    );
  }
  return out;
}

async function presentThread(ctx: SourceContext, t: ApiThread, board: ApiBoard, now: number): Promise<MessageThread> {
  const booking =
    t.scope === "booking"
      ? board.bookings.find((b) => b.id === t.subjectId)
      : t.scope === "stay"
        ? board.bookings.find((b) => b.stay?.id === t.subjectId)
        : undefined;
  const stay =
    t.scope === "stay"
      ? board.stays.find((s) => s.id === t.subjectId)
      : booking?.stay
        ? board.stays.find((s) => s.id === booking.stay?.id)
        : undefined;
  const { messages: lines } = await ctx
    .ops()
    .get<{ messages: ApiMessage[] }>(`/api/v1/ops/threads/${encodeURIComponent(t.id)}/messages`);
  const messages = presentMessages(lines, board.today);
  const text = lines
    .filter((m) => m.bodyType === "text" && m.body)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = text.at(-1);
  const closed = t.status === "archived";
  const name = nameOf(t.counterpartName ?? booking?.guestName ?? stay?.guestName);
  const waitingOnUs = !!last && !last.fromUs;
  const { ctx: where, who } = context(booking, stay, board);
  return {
    id: t.id,
    name,
    initials: initialsOf(name),
    ctx: where,
    who,
    dept: t.departmentName ?? "Front desk",
    channels: ["app"],
    // Threads carry no assignee, SLA or escalation yet: an unassigned conversation, as stored.
    assignee: "",
    assigneeFull: "",
    unread: 0,
    time: listTime(t.lastMessageAt ?? last?.createdAt ?? null, board.today),
    status: closed ? "Closed" : waitingOnUs ? "Open" : "Waiting on guest",
    sla: closed ? "" : waitingOnUs && last ? `guest waiting ${age(last.createdAt, now)}` : "waiting on the guest",
    escalated: null,
    closed,
    facts: facts(booking, stay),
    links: [
      ...(stay ? [{ label: "Stay and folio", board: "StayFolio" as const }] : []),
      { label: "Reservations", board: "Reservations" as const },
    ],
    consent: [],
    messages,
  };
}

export const sources = defineSources({
  "stays.messageTemplates": {
    async list(ctx): Promise<MessageTemplate[]> {
      const { templates } = await ctx.ops().get<{ templates: ApiTemplate[] }>("/api/v1/ops/message-templates");
      // A language the business has not written falls back to English rather than an empty reply.
      return templates.map((t) => ({
        id: t.key,
        label: t.label,
        EN: t.bodies.en,
        RW: t.bodies.rw ?? t.bodies.en,
        FR: t.bodies.fr ?? t.bodies.en,
      }));
    },
  },
  "stays.threads": {
    naturalKey: "name",
    async list(ctx): Promise<MessageThread[]> {
      const [board, { threads }] = await Promise.all([
        deskBoard(ctx),
        ctx.ops().get<{ threads: ApiThread[] }>("/api/v1/ops/threads"),
      ]);
      // A request to book is answered from Reservations → Requests, where its question is shown beside the
      // decision; its conversation joins the inbox once the booking is confirmed.
      const pending = new Set(board.bookings.filter((b) => b.state === "pending").map((b) => b.id));
      const shown = threads
        .filter((t) => t.scope !== "lease" && !(t.scope === "booking" && pending.has(t.subjectId)))
        .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
      const now = Date.parse(board.generatedAt);
      return Promise.all(shown.map((t) => presentThread(ctx, t, board, now)));
    },
  },
});
