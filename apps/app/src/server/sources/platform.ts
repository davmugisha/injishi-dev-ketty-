/** Live sources for the platform area: API responses presented as the platform fixture document types. */
import type {
  ComplianceEvent,
  HousekeepingDone,
  HousekeepingTask,
  OwnerKpi,
  OwnerProperty,
  RevenueDay,
  Tone,
} from "@injishi/data/fixtures/platform";
import { clock, dayMonth, kigaliDate, rwf } from "../format";
import {
  businessesWith,
  certificatesOf,
  daysUntil,
  EXPIRING_WITHIN_DAYS,
  initials,
  inWorkspace,
  licenceDocs,
  psfOf,
  spacedTin,
} from "./owner";
import { defineSources, type SourceContext } from "./types";

/** GET /api/v1/ops/housekeeping-tasks (OperatorHousekeepingTask in @injishi/contracts). */
interface ApiHousekeepingTask {
  id: string;
  roomId: string;
  roomLabel: string | null;
  taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
  status: "pending" | "in_progress" | "done" | "inspected" | "blocked";
  assignedToUserId: string | null;
  assignedToName: string | null;
  priority: number;
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const KIND: Record<ApiHousekeepingTask["taskType"], { label: string; tone: Tone }> = {
  checkout_clean: { label: "Checkout", tone: "accent" },
  stayover_clean: { label: "Stayover", tone: "default" },
  deep_clean: { label: "Deep clean", tone: "info" },
  inspection: { label: "Inspection", tone: "warning" },
  turndown: { label: "Turndown", tone: "default" },
};

/** People who work the board from a phone see their own rooms; anyone supervising sees the whole board. */
const OWN_LIST = new Set(["housekeeper", "supervisor", "technician"]);

async function tasksFor(ctx: SourceContext): Promise<ApiHousekeepingTask[]> {
  const { tasks } = await ctx.ops().get<{ tasks: ApiHousekeepingTask[] }>("/api/v1/ops/housekeeping-tasks");
  const me = ctx.account?.user.id;
  return ctx.persona && OWN_LIST.has(ctx.persona.id) ? tasks.filter((t) => t.assignedToUserId === me) : tasks;
}

/** A note that opens with a due time ("Due 12:00 · …") carries the board's flag. */
function splitDue(note: string | null): { flag: string | null; note: string } {
  const m = (note ?? "").match(/^(Due \d{2}:\d{2})(?: · )?(.*)$/);
  return m ? { flag: m[1], note: m[2] } : { flag: null, note: note ?? "" };
}

// ── The owner's home (/owner) ─────────────────────────────────────────────────────────────────────────

/** GET /api/v1/ops/dashboard/owner (OwnerDashboard in @injishi/contracts). */
interface ApiNight {
  availableRooms: number;
  soldRooms: number;
  roomRevenueRwf: number;
}
interface ApiDashboard {
  date: string;
  domain: "hospitality" | "residence";
  legalName: string;
  tin: string | null;
  tonight: ApiNight;
  sameNightLastWeek: ApiNight;
  collectionsTodayRwf: number;
  collectionsTodayCount: number;
  openFolioBalanceRwf: number;
  openFoliosOwing: number;
  unverifiedPaymentsRwf: number;
  unverifiedPaymentsCount: number;
  fiscalPendingOver2h: number;
  paymentsMode: "mock" | "live" | "off";
  branches: {
    propertyId: string;
    name: string;
    branchCode: string | null;
    district: string | null;
    roomCount: number;
    tonight: ApiNight;
    openExceptions: number;
    fiscalPendingOver2h: number;
    leasedUnits: number | null;
    leasesInArrears: number | null;
  }[];
}

/** The owner's dashboards: every business the person reads the money of, hotel first. */
async function dashboards(ctx: SourceContext): Promise<ApiDashboard[]> {
  const businesses = businessesWith(ctx, "money.view").filter(
    (w) => w.domain === "hospitality" || w.domain === "residence",
  );
  return Promise.all(
    businesses.map((ws) =>
      inWorkspace(ctx, ws).get<ApiDashboard>("/api/v1/ops/dashboard/owner", { query: { date: ctx.today.iso } }),
    ),
  );
}

const share = (sold: number, available: number) => (available > 0 ? sold / available : 0);

/** A tone and arrow for a change: up is good, down is bad, none is neither. */
function trendOf(change: number, text: string): Pick<OwnerKpi, "trend" | "trendTone" | "trendIcon"> {
  if (change > 0) return { trend: text, trendTone: "success", trendIcon: "ArrowUpRight" };
  if (change < 0) return { trend: text, trendTone: "danger", trendIcon: "ArrowDownRight" };
  return { trend: text, trendTone: "default", trendIcon: "Minus" };
}

/** The change from one figure to another, in percent; "new" when there was nothing before. */
function pct(now: number, before: number): { change: number; text: string } {
  if (before === 0) return { change: now > 0 ? 1 : 0, text: now > 0 ? "new" : "0%" };
  const change = ((now - before) / before) * 100;
  return { change, text: `${Math.abs(change).toFixed(1)}%` };
}

function ownerKpis(d: ApiDashboard): OwnerKpi[] {
  const { tonight: t, sameNightLastWeek: w } = d;
  const occ = share(t.soldRooms, t.availableRooms);
  const occPts = Math.round((occ - share(w.soldRooms, w.availableRooms)) * 100);
  const adr = t.soldRooms > 0 ? Math.round(t.roomRevenueRwf / t.soldRooms) : 0;
  const adrBefore = w.soldRooms > 0 ? Math.round(w.roomRevenueRwf / w.soldRooms) : 0;
  const revpar = t.availableRooms > 0 ? Math.round(t.roomRevenueRwf / t.availableRooms) : 0;
  const revparBefore = w.availableRooms > 0 ? Math.round(w.roomRevenueRwf / w.availableRooms) : 0;
  const adrChange = pct(adr, adrBefore);
  const revparChange = pct(revpar, revparBefore);
  const items = d.openFoliosOwing + d.unverifiedPaymentsCount;
  return [
    {
      id: "occupancy",
      label: "Occupancy tonight",
      value: Math.round(occ * 100) / 100,
      format: { style: "percent" },
      ...trendOf(occPts, `${Math.abs(occPts)} pts`),
      foot: `${t.soldRooms} of ${t.availableRooms} rooms`,
      board: "Reports",
    },
    {
      id: "adr",
      label: "ADR",
      value: adr,
      format: { style: "currency", currency: "RWF" },
      ...trendOf(adrChange.change, adrChange.text),
      foot: "Average daily rate on the books tonight",
      board: "Reports",
    },
    {
      id: "revpar",
      label: "RevPAR",
      value: revpar,
      format: { style: "currency", currency: "RWF" },
      ...trendOf(revparChange.change, revparChange.text),
      foot: "Against the same night last week",
      board: "Reports",
    },
    {
      id: "collections",
      label: "Verified collections",
      value: d.collectionsTodayRwf,
      format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 },
      trend: "today",
      trendTone: "default",
      trendIcon: "Check",
      foot: `${d.collectionsTodayCount} ${d.collectionsTodayCount === 1 ? "payment" : "payments"} confirmed by the provider`,
      board: "FinanceHome",
    },
    {
      id: "unsettled",
      label: "Unsettled and receivables",
      value: d.openFolioBalanceRwf + d.unverifiedPaymentsRwf,
      format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 },
      trend: `${items} ${items === 1 ? "item" : "items"}`,
      trendTone: items > 0 ? "danger" : "default",
      trendIcon: items > 0 ? "TriangleExclamation" : "Check",
      foot: "Open folios and payments the provider has not confirmed",
      board: "FinanceHome",
    },
  ];
}

/** The business's PSF membership, as the owner's compliance panel says it. */
async function psfEvent(ctx: SourceContext): Promise<ComplianceEvent> {
  const base = { id: "psf", icon: "PaperPlane", board: "Compliance" as const };
  const psf = await psfOf(ctx);
  if (!psf) return { ...base, status: "default", title: "No PSF membership yet", detail: "Not applied" };
  if (psf.current) {
    return {
      ...base,
      status: "success",
      title: `PSF member${psf.current.tierName ? ` · ${psf.current.tierName}` : ""}`,
      detail: `Membership ${psf.current.membershipNumber}${psf.current.expiresOn ? ` · renews ${dayMonth(psf.current.expiresOn)}` : ""}`,
    };
  }
  if (psf.open) {
    return {
      ...base,
      status: "current",
      title: "PSF membership application sent",
      detail:
        psf.open.stage === "with_psf"
          ? `Awaiting PSF’s decision · submitted ${dayMonth(psf.open.submittedAt)}`
          : `Waiting for the TIN check before it reaches PSF · submitted ${dayMonth(psf.open.submittedAt)}`,
    };
  }
  return psf.history[0]?.status === "declined"
    ? { ...base, status: "warning", title: "PSF declined the membership application", detail: "You can apply again" }
    : {
        ...base,
        status: "default",
        title: "No PSF membership yet",
        detail: "Apply from Compliance when you are ready",
      };
}

/** The licence, fiscal, bank and PSF lines of the owner's compliance panel, each from its own record. */
async function ownerCompliance(ctx: SourceContext): Promise<ComplianceEvent[]> {
  const [boards, lists, psf] = await Promise.all([dashboards(ctx), certificatesOf(ctx), psfEvent(ctx)]);
  const hotel = boards.find((d) => d.domain === "hospitality") ?? boards[0];
  const fiscal = boards.reduce((s, d) => s + d.fiscalPendingOver2h, 0);
  const onFile = licenceDocs(ctx, lists).length;
  // The soonest expiry among documents on file (a requested one has no expiry yet).
  const dated = lists
    .flatMap((l) => l.certificates.map((c) => ({ c, holder: c.propertyName ?? l.legalName })))
    .filter(({ c }) => c.status === "on_file" && c.expiresOn)
    .sort((a, b) => (a.c.expiresOn as string).localeCompare(b.c.expiresOn as string));
  const next = dated[0];
  const left = next ? daysUntil(ctx, next.c.expiresOn as string) : null;
  const what = next
    ? next.c.kind === "tourism_license"
      ? "tourism licence"
      : (next.c.kindOther ?? "document").toLowerCase()
    : "";
  const place = next ? (next.holder.split(/\s+/)[0] ?? next.holder) : "";
  const licence: ComplianceEvent =
    next && left !== null && left <= EXPIRING_WITHIN_DAYS
      ? {
          id: "licence",
          status: "warning",
          icon: "Clock",
          title: left < 0 ? `${place} ${what} expired ${-left} days ago` : `${place} ${what} expires in ${left} days`,
          detail: next.c.followUp
            ? `${next.c.followUp.charAt(0).toUpperCase()}${next.c.followUp.slice(1)}`
            : "No renewal on file yet",
          board: "Compliance",
        }
      : {
          id: "licence",
          status: "success",
          icon: "FileCheck",
          title: "Licences and registrations are current",
          detail: `${onFile} ${onFile === 1 ? "document" : "documents"} on file`,
          board: "Compliance",
        };
  const vsdc: ComplianceEvent =
    fiscal > 0
      ? {
          id: "vsdc",
          status: "warning",
          icon: "FileExclamation",
          title: `${fiscal} fiscal ${fiscal === 1 ? "receipt" : "receipts"} pending at the VSDC for over 2 hours`,
          detail: "Each is retried from its own record; a send with an unknown outcome is held, never resent",
          board: "FiscalReceipts",
        }
      : {
          id: "vsdc",
          status: "success",
          icon: "FileCheck",
          title: "No fiscal receipt waiting over 2 hours",
          detail: "Every receipt raised is certified or inside its retry window",
          board: "FiscalReceipts",
        };
  const mode = hotel?.paymentsMode ?? "mock";
  const bank: ComplianceEvent =
    mode === "live"
      ? {
          id: "gtbank",
          status: "success",
          icon: "Lock",
          title: "Bank and mobile money production access verified",
          detail: "Payments are taken through the live provider",
          board: "Integrations",
        }
      : {
          id: "gtbank",
          status: mode === "off" ? "warning" : "default",
          icon: "Lock",
          title:
            mode === "off" ? "Payments are switched off on this platform" : "GT Bank production access not verified",
          detail:
            mode === "off"
              ? "Every charge is refused until a payment provider is connected"
              : "Payments run on the sandbox adapter · no production provider is connected yet",
          board: "Integrations",
        };
  return [licence, vsdc, bank, psf];
}

export const sources = defineSources({
  "platform.ownerKpis": {
    naturalKey: "id",
    async list(ctx): Promise<OwnerKpi[]> {
      const hotel = (await dashboards(ctx)).find((d) => d.domain === "hospitality");
      return hotel ? ownerKpis(hotel) : [];
    },
  },

  "platform.revenueDays": {
    naturalKey: "id",
    async list(ctx): Promise<RevenueDay[]> {
      const ws = businessesWith(ctx, "money.view").find((w) => w.domain === "hospitality");
      if (!ws) return [];
      const day = (offset: number) =>
        new Date(ctx.today.noon.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
      // The fourteen days ending today, tonight's takings so far included.
      const { days } = await inWorkspace(ctx, ws).get<{
        days: { date: string; roomsRwf: number; foodBeverageRwf: number; otherRwf: number }[];
      }>("/api/v1/ops/revenue/daily", { query: { from: day(-13), to: day(1) } });
      return days.map((d, i) => ({
        id: `d${String(i + 1).padStart(2, "0")}`,
        label: d.date === ctx.today.iso ? "Today" : dayMonth(d.date),
        rooms: d.roomsRwf,
        fb: d.foodBeverageRwf,
      }));
    },
  },

  "platform.ownerProperties": {
    naturalKey: "name",
    async list(ctx): Promise<OwnerProperty[]> {
      return (await dashboards(ctx)).flatMap((d) =>
        d.branches.map((b): OwnerProperty => {
          const residence = d.domain === "residence";
          const occupancyValue = residence
            ? Math.round(share(b.leasedUnits ?? 0, b.roomCount) * 100)
            : Math.round(share(b.tonight.soldRooms, b.tonight.availableRooms) * 100);
          const adr = b.tonight.soldRooms > 0 ? Math.round(b.tonight.roomRevenueRwf / b.tonight.soldRooms) : 0;
          const arrears = b.leasesInArrears ?? 0;
          const exceptions = residence ? arrears : b.openExceptions;
          return {
            id: b.branchCode?.toLowerCase() ?? b.propertyId,
            // A place is known by its first two words ("Isangano Lakeside" → IL), a person by first and last.
            initials: initials(b.name.split(/\s+/).slice(0, 2).join(" ")),
            name: b.name,
            kind: [residence ? "Residence" : null, b.district, `${b.roomCount} ${residence ? "units" : "rooms"}`]
              .filter(Boolean)
              .join(" · "),
            entity: d.legalName,
            tin: d.tin ? `TIN ${spacedTin(d.tin)}` : "No TIN on file",
            occupancy: residence ? `${b.leasedUnits ?? 0} of ${b.roomCount} leased` : `${occupancyValue}% tonight`,
            occupancyValue,
            adr: residence ? "Not nightly" : adr > 0 ? rwf(adr) : "No rooms sold tonight",
            exceptions: residence
              ? arrears > 0
                ? `${arrears} in arrears`
                : "None in arrears"
              : exceptions > 0
                ? `${exceptions} open`
                : "None open",
            exceptionsTone: exceptions > 0 ? "warning" : "success",
            fiscal: b.fiscalPendingOver2h > 0 ? `${b.fiscalPendingOver2h} pending over 2h` : "All issued",
            fiscalTone: b.fiscalPendingOver2h > 0 ? "warning" : "success",
            board: residence ? "ResidenceHome" : "FrontDeskToday",
          };
        }),
      );
    },
  },

  "platform.ownerCompliance": {
    naturalKey: "id",
    list: (ctx): Promise<ComplianceEvent[]> => ownerCompliance(ctx),
  },

  "platform.housekeepingTasks": {
    naturalKey: "room",
    async list(ctx): Promise<HousekeepingTask[]> {
      const open = (await tasksFor(ctx)).filter((t) => ["pending", "in_progress", "blocked"].includes(t.status));
      return open
        .map((t) => {
          const { flag, note } = splitDue(t.note);
          return {
            id: t.id,
            room: t.roomLabel ?? "",
            kind: KIND[t.taskType].label,
            kindTone: KIND[t.taskType].tone,
            note,
            flag: t.status === "blocked" ? "Blocked" : flag,
            status: t.status === "in_progress" ? "active" : "waiting",
            priority: t.priority,
          } as HousekeepingTask & { priority: number };
        })
        .sort(
          (a, b) =>
            b.priority - a.priority ||
            (a.flag ?? "~").localeCompare(b.flag ?? "~") ||
            a.room.localeCompare(b.room, undefined, { numeric: true }),
        )
        .map(({ priority: _priority, ...task }) => task);
    },
  },
  "platform.housekeepingDone": {
    naturalKey: "room",
    async list(ctx): Promise<HousekeepingDone[]> {
      const today = ctx.today.iso;
      return (await tasksFor(ctx))
        .filter((t) => (t.status === "done" || t.status === "inspected") && t.completedAt)
        .filter((t) => kigaliDate(t.completedAt as string) === today)
        .sort((a, b) => (a.completedAt as string).localeCompare(b.completedAt as string))
        .map((t) => {
          const inspected = t.status === "inspected";
          const awaiting = !inspected && t.taskType === "checkout_clean";
          return {
            id: t.id,
            room: t.roomLabel ?? "",
            kind: KIND[t.taskType].label,
            when: `Cleaned ${clock(t.completedAt)}${inspected ? " · inspected" : awaiting ? " · waiting for inspection" : ""}`,
            state: inspected ? "Inspected" : "Clean",
            stateTone: "success",
          };
        });
    },
  },
});
