/**
 * Staff announcements through the API (058-people-file AC-PF9): what HR's Staff services lists and
 * posts. Any HR permission reads them; posting and taking down are `people.manage`, which the API holds to.
 */
import type { AnnouncementAudience, HrAnnouncement, NewAnnouncement } from "@injishi/product-hr";
import { ApiError } from "./api";
import { dayMonth } from "./format";
import { NoWorkspaceError, type SourceContext } from "./sources/types";

export type { AnnouncementAudience, HrAnnouncement, NewAnnouncement };

interface ApiAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "targeted";
  targets: { departmentIds: string[]; jobPositionIds: string[]; employeeIds: string[] };
  expiresOn: string | null;
  status: "published" | "archived";
  createdAt: string;
}

const ops = (ctx: SourceContext) => ctx.ops("hospitality");
const one = (id: string) => `/api/v1/ops/staff-announcements/${encodeURIComponent(id)}`;

/** A read the person may not hold answers nothing rather than failing the screen. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return empty;
    throw error;
  }
}

/** Every announcement of the business, and who a new one can be aimed at. `people` names who a target names. */
export async function readAnnouncementBoard(
  ctx: SourceContext,
  people: { id: string; name: string }[],
): Promise<{ announcements: HrAnnouncement[]; audience: AnnouncementAudience }> {
  let api: ReturnType<typeof ops>;
  try {
    api = ops(ctx);
  } catch (error) {
    if (error instanceof NoWorkspaceError) return { announcements: [], audience: { departments: [], positions: [] } };
    throw error;
  }
  const [{ announcements }, { departments }, { items }] = await Promise.all([
    orEmpty(api.get<{ announcements: ApiAnnouncement[] }>("/api/v1/ops/staff-announcements"), { announcements: [] }),
    orEmpty(api.get<{ departments: { id: string; name: string }[] }>("/api/v1/ops/departments"), { departments: [] }),
    orEmpty(
      api.get<{ items: { id: string; title: string; status: string }[] }>("/api/v1/ops/hr/catalog/job-positions"),
      {
        items: [],
      },
    ),
  ]);
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name;
  const positions = items.map((p) => ({ id: p.id, name: p.title, status: p.status }));
  const today = ctx.today.iso;
  return {
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience:
        a.audience === "all"
          ? "Everyone"
          : [
              ...a.targets.departmentIds.map((id) => name(departments, id)),
              ...a.targets.jobPositionIds.map((id) => name(positions, id)),
              ...a.targets.employeeIds.map((id) => name(people, id)),
            ]
              .filter(Boolean)
              .join(", ") || "Chosen staff",
      posted: dayMonth(a.createdAt),
      until: a.expiresOn ? dayMonth(a.expiresOn) : null,
      status: a.status === "archived" ? "down" : a.expiresOn && a.expiresOn < today ? "ended" : "showing",
    })),
    audience: {
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      positions: positions.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name })),
    },
  };
}

/** Comments stay off: no screen reads or writes them yet. */
export async function postAnnouncement(ctx: SourceContext, input: NewAnnouncement): Promise<void> {
  const id = input.targetId;
  await ops(ctx).post("/api/v1/ops/staff-announcements", {
    title: input.title.trim(),
    body: input.body.trim(),
    expiresOn: input.expiresOn || null,
    commentsAllowed: false,
    ...(input.who === "all"
      ? { audience: "all" }
      : {
          audience: "targeted",
          targets: {
            departmentIds: input.who === "department" ? [id] : [],
            jobPositionIds: input.who === "position" ? [id] : [],
            employeeIds: input.who === "person" ? [id] : [],
          },
        }),
  });
}

/** Take an announcement down, or put it back up. */
export async function setAnnouncementShown(ctx: SourceContext, id: string, shown: boolean): Promise<void> {
  await ops(ctx).patch(one(id), { status: shown ? "published" : "archived" });
}
