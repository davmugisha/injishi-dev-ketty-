// Sample data for the technician app (proto-ui): Jean-Paul, Isangano Lakeside, Mon 12 Oct 2026 around
// 11:00, copied from the prototype (`c-staff.mjs`). Imported only by `data.ts`. The actions below
// change this module's state and every read returns fresh objects, so a note, a part, the timer, a
// resolved job or a new work order shows on every screen as it would with the API.

import { type ProtoImage, protoImages } from "@/proto/images";
import type { Asset, JobDetail, JobPart, JobRow, JobsBoard, ResolveInput, ScanView, StorePart, Tag } from "./types";

/** The prototype's clock while Jean-Paul works the job (11:14) and resolves it (11:20). */
const NOW = "11:15";
const RESOLVED_AT = "11:20";
/** When this sample data was loaded: the running timer counts from here. */
const LOADED = Date.now();

const URGENT: Tag = { label: "Urgent", tone: "danger" };
const HIGH: Tag = { label: "High", tone: "warning" };
const NORMAL: Tag = { label: "Normal", tone: "default" };
const REQUESTED: Tag = { label: "Requested", tone: "warning", icon: "Hourglass" };
const ISSUED: Tag = { label: "Issued", tone: "success" };

type Job = {
  id: string;
  place: string;
  what: string;
  room: string | null;
  photo: ProtoImage;
  photos: number;
  reporter: string | null;
  ago: string;
  priority: Tag;
  opened: string;
  state: "todo" | "parts" | "done";
  /** The line under a job waiting for parts, and its chip. */
  waiting?: { detail: string; tag: Tag };
  seconds: number;
  since: number | null;
  started: string | null;
  block: { title: string; body: string } | null;
  report: string;
  reportAt: string;
  notes: { id: string; text: string; time: string }[];
  parts: JobPart[];
  fix: { note: string; photos: ProtoImage[]; spare: ProtoImage[] };
  resolved: string | null;
};

const STORE: readonly StorePart[] = [
  { id: "washer", name: "Sink trap washer", stock: "12 in store" },
  { id: "waste-pipe", name: "Basin waste pipe 32 mm", stock: "3 in store" },
  { id: "sealant", name: "Silicone sealant", stock: "6 in store" },
  { id: "drain-pump", name: "Condensate drain pump", stock: "Out of stock" },
];

const JOBS: Job[] = [
  {
    id: "WO-318",
    place: "Room 112",
    what: "basin leak",
    room: "112",
    photo: "leak-under-basin",
    photos: 1,
    reporter: "Jeanne",
    ago: "20 min ago",
    priority: URGENT,
    opened: "10:52",
    state: "todo",
    seconds: 12 * 60 + 4,
    since: LOADED,
    started: "11:02",
    block: {
      title: "Out-of-order request waiting",
      body: "Jeanne asked to block 112. It stays on sale until Aline approves. Arrival at 14:00.",
    },
    report: "Water leaking under the sink. Floor is wet. I put a towel down and closed the tap.",
    reportAt: "10:52",
    notes: [],
    parts: [{ id: "washer-1", title: "Sink trap washer × 1", detail: "Issued by Patrick · 11:08", tag: ISSUED }],
    fix: {
      note: "Replaced the sink trap washer. No leak after 10 minutes of running water.",
      photos: ["kitchen-sink-pipes"],
      spare: ["dripping-tap"],
    },
    resolved: null,
  },
  {
    id: "WO-326",
    place: "Lake Bar",
    what: "ice machine leak",
    room: null,
    photo: "kitchen-sink-pipes",
    photos: 1,
    reporter: "Joseph",
    ago: "1 h ago",
    priority: HIGH,
    opened: "10:05",
    state: "todo",
    seconds: 0,
    since: null,
    started: null,
    block: null,
    report: "The ice machine leaks onto the floor behind the bar. We put a bucket under it for now.",
    reportAt: "10:05",
    notes: [],
    parts: [],
    fix: { note: "", photos: [], spare: ["kitchen-appliances"] },
    resolved: null,
  },
  {
    id: "WO-324",
    place: "Room 302",
    what: "window latch",
    room: "302",
    photo: "window-latch",
    photos: 1,
    reporter: "Chantal",
    ago: "Sat 10 Oct",
    priority: NORMAL,
    opened: "Sat 10 Oct",
    state: "parts",
    waiting: { detail: "hinge set requested", tag: REQUESTED },
    seconds: 21 * 60,
    since: null,
    started: "Sat 09:20",
    block: {
      title: "Room blocked",
      body: "302 stays out of order until the hinge set arrives. Aline approved the block.",
    },
    report: "The window latch is broken and the window does not close.",
    reportAt: "Sat 09:05",
    notes: [],
    parts: [{ id: "hinge-1", title: "Hinge set × 1", detail: "Asked Patrick · Sat 09:40", tag: REQUESTED }],
    fix: { note: "", photos: [], spare: ["bedroom-window"] },
    resolved: null,
  },
  {
    id: "WO-325",
    place: "Kivu Hall",
    what: "projector flicker",
    room: null,
    photo: "ceiling-projector",
    photos: 1,
    reporter: "Joseph",
    ago: "Fri 9 Oct",
    priority: NORMAL,
    opened: "Fri 9 Oct",
    state: "parts",
    waiting: { detail: "HDMI cable on order · PO-26-0142", tag: { label: "On order", tone: "default" } },
    seconds: 15 * 60,
    since: null,
    started: "Fri 15:10",
    block: null,
    report: "The projector flickers when a laptop is plugged in. The conference on Wednesday needs it.",
    reportAt: "Fri 14:50",
    notes: [],
    parts: [
      {
        id: "hdmi-1",
        title: "HDMI cable 10 m × 1",
        detail: "On order · PO-26-0142",
        tag: { label: "On order", tone: "default" },
      },
    ],
    fix: { note: "", photos: [], spare: ["kivu-hall-conference"] },
    resolved: null,
  },
  {
    id: "WO-317",
    place: "Room 204",
    what: "shower mixer",
    room: "204",
    photo: "shower-mixer",
    photos: 1,
    reporter: "Jeanne",
    ago: "07:45",
    priority: HIGH,
    opened: "07:45",
    state: "done",
    seconds: 25 * 60,
    since: null,
    started: "08:15",
    block: null,
    report: "The shower mixer drips when it is closed. VIP arrival at 14:00.",
    reportAt: "07:45",
    notes: [],
    parts: [{ id: "cartridge-1", title: "Mixer cartridge × 1", detail: "Issued by Patrick · 08:20", tag: ISSUED }],
    fix: { note: "Replaced the mixer cartridge. No drip after closing.", photos: ["shower-mixer"], spare: [] },
    resolved: "fixed 08:40 · 25 min",
  },
];

/** Finished jobs, the latest first. */
const DONE_ORDER: string[] = ["WO-317"];

function findJob(id: string): Job | undefined {
  return JOBS.find((j) => j.id === id);
}

function secondsOf(job: Job): number {
  return job.seconds + (job.since ? Math.floor((Date.now() - job.since) / 1000) : 0);
}

const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Normal: 2 };

function rowOf(job: Job): JobRow {
  const detail =
    job.state === "done"
      ? `${job.id} · ${job.resolved ?? "fixed"}`
      : job.state === "parts"
        ? `${job.id} · ${job.waiting?.detail ?? "waiting for parts"}`
        : `${job.id} · from ${job.reporter ?? "you"} · ${job.ago}`;
  const tag: Tag =
    job.state === "done"
      ? { label: "Done", tone: "success", icon: "CircleCheck" }
      : job.state === "parts"
        ? (job.waiting?.tag ?? REQUESTED)
        : job.priority;
  return {
    id: job.id,
    title: `${job.place} · ${job.what.charAt(0).toUpperCase()}${job.what.slice(1)}`,
    detail,
    photo: protoImages[job.photo],
    tag,
  };
}

export function jobsBoard(): JobsBoard {
  const todo = JOBS.filter((j) => j.state === "todo").sort(
    (a, b) => (PRIORITY_ORDER[a.priority.label] ?? 9) - (PRIORITY_ORDER[b.priority.label] ?? 9),
  );
  return {
    eyebrow: "Mon 12 Oct · Jean-Paul",
    alert: {
      title: "Third AC fault in 305 this month",
      body: "Same unit, two drips and a no-cool. Check the condensate drain before it becomes a complaint.",
      tag: "AST-0305-AC",
    },
    todo: todo.map(rowOf),
    parts: JOBS.filter((j) => j.state === "parts").map(rowOf),
    partsNote: "Patrick, store",
    // Newest first: what he just resolved above what he fixed this morning.
    done: DONE_ORDER.map((id) => findJob(id))
      .filter((j): j is Job => j?.state === "done")
      .map(rowOf),
  };
}

/** No jobs at all (`?proto=empty`). */
export function emptyJobsBoard(): JobsBoard {
  return { eyebrow: "Mon 12 Oct · Jean-Paul", alert: null, todo: [], parts: [], partsNote: "Patrick, store", done: [] };
}

export function jobDetail(id: string): JobDetail {
  const job = findJob(id) ?? JOBS[0];
  return {
    id: job.id,
    title: `${job.place} · ${job.what}`,
    room: job.room,
    photo: protoImages[job.photo],
    photoNote: job.reporter ? `${job.photos} photo · ${job.reporter}` : "Asset photo",
    priority: job.priority,
    opened: job.opened,
    state: job.state,
    timer: { seconds: job.seconds, since: job.since, started: job.started },
    block: job.block,
    report: {
      heading: job.reporter ? `From ${job.reporter} · ${job.reportAt}` : `Your note · ${job.reportAt}`,
      text: job.report,
      mine: !job.reporter,
    },
    notes: job.notes.map((n) => ({ ...n })),
    parts: job.parts.map((p) => ({ ...p })),
    store: STORE,
    fix: {
      note: job.fix.note,
      photos: job.fix.photos.map((p) => protoImages[p]),
      spare: job.fix.spare.map((p) => protoImages[p]),
    },
    resolved: job.resolved,
  };
}

export function toggleTimer(id: string): void {
  const job = findJob(id);
  if (!job || job.state === "done") return;
  if (job.since) {
    job.seconds = secondsOf(job);
    job.since = null;
  } else {
    job.since = Date.now();
    job.started ??= NOW;
  }
}

export function addNote({ job: id, text }: { job: string; text: string }): void {
  const job = findJob(id);
  if (!job || !text.trim()) return;
  job.notes.push({ id: `note-${job.notes.length + 1}`, text: text.trim(), time: NOW });
}

export function requestPart({ job: id, part }: { job: string; part: string }): { message: string } {
  const job = findJob(id);
  const item = STORE.find((p) => p.id === part);
  if (!job || !item) throw new Error("no such job or part");
  const out = item.stock === "Out of stock";
  job.parts.push({
    id: `${part}-${job.parts.length + 1}`,
    title: `${item.name} × 1`,
    detail: `Asked Patrick · ${NOW}`,
    tag: out ? { label: "To order", tone: "warning", icon: "Hourglass" } : REQUESTED,
  });
  return {
    message: out ? `Patrick orders the ${item.name.toLowerCase()}` : `Patrick brings the ${item.name.toLowerCase()}`,
  };
}

export function resolveJob({ job: id, note, photos, askRelease }: ResolveInput): { message: string } {
  const job = findJob(id);
  if (!job) throw new Error(`no job ${id}`);
  const minutes = Math.max(1, Math.round(secondsOf(job) / 60));
  job.seconds = secondsOf(job);
  job.since = null;
  job.state = "done";
  DONE_ORDER.unshift(job.id);
  job.fix = { ...job.fix, note, photos: job.fix.photos.concat(job.fix.spare).slice(0, photos) };
  job.resolved = `fixed ${RESOLVED_AT} · ${minutes} min`;
  if (job.block && askRelease && job.room)
    job.block = { title: "Release asked", body: `Beatrice checks ${job.room}, then Aline puts it back on sale.` };
  const who = job.reporter ? `${job.reporter} gets a message` : "Saved to the asset's history";
  return { message: `${job.id} resolved · ${who}` };
}

// ---------- assets

type AssetRecord = Omit<Asset, "photo"> & {
  photo: ProtoImage;
  place: string;
  room: string | null;
  /** The work order a new job from this asset opens with. */
  draft: { what: string; report: string; spare: ProtoImage };
};

const ASSETS: AssetRecord[] = [
  {
    tag: "AST-0305-AC",
    name: "AC indoor unit",
    place: "Room 305",
    room: "305",
    subtitle: "Room 305 · tag AST-0305-AC",
    photo: "ac-indoor-unit",
    where: "Room 305 · above the window",
    stats: [
      { label: "Faults", value: "3", caption: "last 30 days", tone: "danger" },
      { label: "Installed", value: "2023", caption: "LG 12k BTU" },
      { label: "Serviced", value: "Jun", caption: "4 months ago" },
    ],
    suggestion: {
      title: "Replace the condensate drain pump",
      body: "Two of three faults were water dripping. It does not create work or block the room by itself.",
      stock: { label: "Out of stock", tone: "danger", hint: "ask Patrick to order" },
      asked: false,
    },
    history: [
      { key: "WO-331", title: "Not cooling · WO-331", detail: "Sat 10 Oct · fan cleaned · you" },
      { key: "WO-322", title: "Dripping water · WO-322", detail: "Mon 28 Sep · drain cleared · you" },
      { key: "WO-309", title: "Dripping water · WO-309", detail: "Sat 19 Sep · drain cleared · Eric" },
    ],
    draft: {
      what: "AC drain pump",
      report: "Third fault this month: two drips and a no-cool. Replace the condensate drain pump.",
      spare: "ac-outdoor-unit",
    },
  },
  {
    tag: "AST-YARD-GEN",
    name: "Standby generator",
    place: "Yard",
    room: null,
    subtitle: "Yard · tag AST-YARD-GEN",
    photo: "standby-generator",
    where: "Yard · behind the kitchen",
    stats: [
      { label: "Faults", value: "0", caption: "last 30 days" },
      { label: "Installed", value: "2021", caption: "Perkins 60 kVA" },
      { label: "Serviced", value: "Sep", caption: "1 month ago" },
    ],
    suggestion: null,
    history: [
      { key: "test-5-oct", title: "Weekly test run", detail: "Mon 5 Oct · 20 min on load · you" },
      { key: "service-14-sep", title: "Service · 500 hours", detail: "Mon 14 Sep · oil and filters · Eric" },
    ],
    draft: { what: "generator check", report: "Opened from the generator's tag.", spare: "standby-generator" },
  },
  {
    tag: "AST-0112-WH",
    name: "Water heater",
    place: "Room 112",
    room: "112",
    subtitle: "Room 112 · tag AST-0112-WH",
    photo: "water-heater",
    where: "Room 112 · bathroom ceiling",
    stats: [
      { label: "Faults", value: "1", caption: "last 30 days" },
      { label: "Installed", value: "2022", caption: "Ariston 80 L" },
      { label: "Serviced", value: "Aug", caption: "2 months ago" },
    ],
    suggestion: null,
    history: [{ key: "WO-301", title: "No hot water · WO-301", detail: "Tue 15 Sep · element reset · you" }],
    draft: { what: "water heater", report: "Opened from the water heater's tag.", spare: "water-heater" },
  },
];

/** The work order already opened from each asset's page, so a second press opens the same one. */
const ASSET_JOBS = new Map<string, string>();

function findAsset(tag: string): AssetRecord | undefined {
  const wanted = tag.trim().toUpperCase();
  return ASSETS.find((a) => a.tag === wanted);
}

export function asset(tag: string): Asset {
  const a = findAsset(tag) ?? ASSETS[0];
  return {
    tag: a.tag,
    name: a.name,
    subtitle: a.subtitle,
    photo: protoImages[a.photo],
    where: a.where,
    stats: a.stats.map((s) => ({ ...s })),
    suggestion: a.suggestion ? { ...a.suggestion, stock: { ...a.suggestion.stock } } : null,
    history: a.history.map((h) => ({ ...h })),
  };
}

export function askStore(tag: string): { message: string } {
  const a = findAsset(tag);
  if (!a?.suggestion) throw new Error(`nothing to order for ${tag}`);
  a.suggestion.asked = true;
  a.suggestion.stock = { label: "Asked Patrick", tone: "warning", hint: "he orders it today" };
  return { message: "Patrick orders the condensate drain pump" };
}

/** A new work order, filled in from the asset; the same one if it was opened already. */
export function createJob(tag: string): { job: string } {
  const a = findAsset(tag) ?? ASSETS[0];
  const existing = ASSET_JOBS.get(a.tag);
  if (existing) return { job: existing };
  const id = `WO-${332 + ASSET_JOBS.size}`;
  JOBS.push({
    id,
    place: a.place,
    what: a.draft.what,
    room: a.room,
    photo: a.photo,
    photos: 1,
    reporter: null,
    ago: "just now",
    priority: a.suggestion ? HIGH : NORMAL,
    opened: "11:31",
    state: "todo",
    seconds: 0,
    since: null,
    started: null,
    block: null,
    report: a.draft.report,
    reportAt: "11:31",
    notes: [],
    parts: [],
    fix: { note: "", photos: [], spare: [a.draft.spare] },
    resolved: null,
  });
  ASSET_JOBS.set(a.tag, id);
  return { job: id };
}

export function scanView(): ScanView {
  return {
    camera: protoImages["ac-indoor-unit"],
    inView: "AST-0305-AC",
    recent: [
      { tag: "AST-0305-AC", label: "AC · 305" },
      { tag: "AST-YARD-GEN", label: "Generator · yard" },
      { tag: "AST-0112-WH", label: "Water heater · 112" },
    ],
    known: ASSETS.map((a) => a.tag),
  };
}
