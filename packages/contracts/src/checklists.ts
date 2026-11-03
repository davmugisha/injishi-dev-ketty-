import { z } from "zod";
import { RosterCard } from "./people";

/**
 * Checklists (ADR-058): what a business does when somebody joins, and when
 * somebody leaves.
 *
 * A TEMPLATE is the business's own list, written once: issue a uniform, show
 * the fire exits, collect the keys. Starting a checklist for a person COPIES
 * the template's tasks onto their file with a due date each, so a template
 * edited later never rewrites a checklist somebody is partway through.
 *
 * A task is done by the office, or by the person themselves (`byEmployee`:
 * read the handbook, bring a copy of an ID). The second kind is the only thing
 * a person ticks through `/me/work`; everything else is `people.manage`'s.
 *
 * Nothing here is pay, leave or a contract: a checklist records that a thing
 * was done and by whom, and decides nothing.
 */

const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");

export const ChecklistKind = z.enum(["onboarding", "offboarding"]);
export type ChecklistKind = z.infer<typeof ChecklistKind>;

export const CHECKLIST_KIND_LABEL: Readonly<Record<ChecklistKind, string>> = {
  onboarding: "Joining",
  offboarding: "Leaving",
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const ChecklistTemplateItem = z.object({
  id: Uuid,
  label: z.string(),
  /** The person does this themselves; otherwise the office does. */
  byEmployee: z.boolean(),
  /**
   * When it is due, in days from the day the checklist counts from: the first
   * day for somebody joining, the last day for somebody leaving. Negative is
   * before that day, as "collect the uniform" two days before a last day.
   */
  dueAfterDays: z.number().int(),
  /** Only for people in this job; null is everybody. */
  jobPosition: z.object({ id: Uuid, title: z.string() }).nullable(),
});
export type ChecklistTemplateItem = z.infer<typeof ChecklistTemplateItem>;

export const ChecklistTemplate = z.object({
  id: Uuid,
  kind: ChecklistKind,
  name: z.string(),
  /** The one a new file, or an offboarding, starts from. One per kind. */
  isDefault: z.boolean(),
  items: z.array(ChecklistTemplateItem),
});
export type ChecklistTemplate = z.infer<typeof ChecklistTemplate>;

export const ChecklistTemplateList = z.object({ templates: z.array(ChecklistTemplate) });
export type ChecklistTemplateList = z.infer<typeof ChecklistTemplateList>;

const TemplateItemInput = z.object({
  label: z.string().trim().min(2, "Say what is to be done.").max(160),
  byEmployee: z.boolean().optional(),
  dueAfterDays: z.number().int().min(-60, "At most 60 days before.").max(365, "At most a year after.").optional(),
  jobPositionId: Uuid.nullable().optional(),
});

/** `POST /ops/hr/checklist-templates`. */
export const CreateChecklistTemplateRequest = z.object({
  kind: ChecklistKind,
  name: z.string().trim().min(2, "Name the checklist.").max(80),
  isDefault: z.boolean().optional(),
  items: z.array(TemplateItemInput).min(1, "A checklist has at least one task.").max(40, "At most 40 tasks."),
});
export type CreateChecklistTemplateRequest = z.infer<typeof CreateChecklistTemplateRequest>;

/**
 * `PUT /ops/hr/checklist-templates/:id`: the whole template, its tasks
 * replaced in the order sent. Its kind never changes: a joining list that
 * became a leaving list would be a different list.
 */
export const UpdateChecklistTemplateRequest = CreateChecklistTemplateRequest.omit({ kind: true });
export type UpdateChecklistTemplateRequest = z.infer<typeof UpdateChecklistTemplateRequest>;

// ---------------------------------------------------------------------------
// A person's checklist
// ---------------------------------------------------------------------------

export const ChecklistTask = z.object({
  id: Uuid,
  label: z.string(),
  byEmployee: z.boolean(),
  dueOn: IsoDate,
  doneAt: z.string().nullable(),
  doneByName: z.string().nullable(),
});
export type ChecklistTask = z.infer<typeof ChecklistTask>;

export const EmployeeChecklist = z.object({
  id: Uuid,
  employee: RosterCard,
  /** The branch the person works at: what branch limits read. */
  branchId: Uuid.nullable(),
  kind: ChecklistKind,
  /** The template's name when it was copied. */
  templateName: z.string(),
  /** The day the due dates count from: the first day, or the last. */
  anchorOn: IsoDate,
  startedAt: z.string(),
  tasks: z.array(ChecklistTask),
  doneCount: z.number().int(),
  /** Tasks not done whose day has passed, today in Kigali. Computed at read, never stored. */
  overdueCount: z.number().int(),
});
export type EmployeeChecklist = z.infer<typeof EmployeeChecklist>;

/**
 * `GET /ops/hr/checklists`: every checklist in the caller's branches, the ones
 * still open first, and who joined or is leaving with none started.
 */
export const ChecklistBoard = z.object({
  today: IsoDate,
  checklists: z.array(EmployeeChecklist),
  unstarted: z.array(
    z.object({
      employee: RosterCard,
      kind: ChecklistKind,
      /** The first day, or the last. */
      on: IsoDate,
    }),
  ),
});
export type ChecklistBoard = z.infer<typeof ChecklistBoard>;

/** `POST /ops/hr/checklists`: from a template named, or the default of that kind. */
export const StartChecklistRequest = z.object({
  employeeId: Uuid,
  kind: ChecklistKind,
  templateId: Uuid.optional(),
});
export type StartChecklistRequest = z.infer<typeof StartChecklistRequest>;

/** `GET /me/work/:employeeId/checklists`: the person's own, every task shown, theirs to tick marked. */
export const MyChecklists = z.object({ today: IsoDate, checklists: z.array(EmployeeChecklist) });
export type MyChecklists = z.infer<typeof MyChecklists>;
