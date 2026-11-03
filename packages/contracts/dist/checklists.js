"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyChecklists = exports.StartChecklistRequest = exports.ChecklistBoard = exports.EmployeeChecklist = exports.ChecklistTask = exports.UpdateChecklistTemplateRequest = exports.CreateChecklistTemplateRequest = exports.ChecklistTemplateList = exports.ChecklistTemplate = exports.ChecklistTemplateItem = exports.CHECKLIST_KIND_LABEL = exports.ChecklistKind = void 0;
const zod_1 = require("zod");
const people_1 = require("./people");
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
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
exports.ChecklistKind = zod_1.z.enum(["onboarding", "offboarding"]);
exports.CHECKLIST_KIND_LABEL = {
    onboarding: "Joining",
    offboarding: "Leaving",
};
// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
exports.ChecklistTemplateItem = zod_1.z.object({
    id: Uuid,
    label: zod_1.z.string(),
    /** The person does this themselves; otherwise the office does. */
    byEmployee: zod_1.z.boolean(),
    /**
     * When it is due, in days from the day the checklist counts from: the first
     * day for somebody joining, the last day for somebody leaving. Negative is
     * before that day, as "collect the uniform" two days before a last day.
     */
    dueAfterDays: zod_1.z.number().int(),
    /** Only for people in this job; null is everybody. */
    jobPosition: zod_1.z.object({ id: Uuid, title: zod_1.z.string() }).nullable(),
});
exports.ChecklistTemplate = zod_1.z.object({
    id: Uuid,
    kind: exports.ChecklistKind,
    name: zod_1.z.string(),
    /** The one a new file, or an offboarding, starts from. One per kind. */
    isDefault: zod_1.z.boolean(),
    items: zod_1.z.array(exports.ChecklistTemplateItem),
});
exports.ChecklistTemplateList = zod_1.z.object({ templates: zod_1.z.array(exports.ChecklistTemplate) });
const TemplateItemInput = zod_1.z.object({
    label: zod_1.z.string().trim().min(2, "Say what is to be done.").max(160),
    byEmployee: zod_1.z.boolean().optional(),
    dueAfterDays: zod_1.z.number().int().min(-60, "At most 60 days before.").max(365, "At most a year after.").optional(),
    jobPositionId: Uuid.nullable().optional(),
});
/** `POST /ops/hr/checklist-templates`. */
exports.CreateChecklistTemplateRequest = zod_1.z.object({
    kind: exports.ChecklistKind,
    name: zod_1.z.string().trim().min(2, "Name the checklist.").max(80),
    isDefault: zod_1.z.boolean().optional(),
    items: zod_1.z.array(TemplateItemInput).min(1, "A checklist has at least one task.").max(40, "At most 40 tasks."),
});
/**
 * `PUT /ops/hr/checklist-templates/:id`: the whole template, its tasks
 * replaced in the order sent. Its kind never changes: a joining list that
 * became a leaving list would be a different list.
 */
exports.UpdateChecklistTemplateRequest = exports.CreateChecklistTemplateRequest.omit({ kind: true });
// ---------------------------------------------------------------------------
// A person's checklist
// ---------------------------------------------------------------------------
exports.ChecklistTask = zod_1.z.object({
    id: Uuid,
    label: zod_1.z.string(),
    byEmployee: zod_1.z.boolean(),
    dueOn: IsoDate,
    doneAt: zod_1.z.string().nullable(),
    doneByName: zod_1.z.string().nullable(),
});
exports.EmployeeChecklist = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    /** The branch the person works at: what branch limits read. */
    branchId: Uuid.nullable(),
    kind: exports.ChecklistKind,
    /** The template's name when it was copied. */
    templateName: zod_1.z.string(),
    /** The day the due dates count from: the first day, or the last. */
    anchorOn: IsoDate,
    startedAt: zod_1.z.string(),
    tasks: zod_1.z.array(exports.ChecklistTask),
    doneCount: zod_1.z.number().int(),
    /** Tasks not done whose day has passed, today in Kigali. Computed at read, never stored. */
    overdueCount: zod_1.z.number().int(),
});
/**
 * `GET /ops/hr/checklists`: every checklist in the caller's branches, the ones
 * still open first, and who joined or is leaving with none started.
 */
exports.ChecklistBoard = zod_1.z.object({
    today: IsoDate,
    checklists: zod_1.z.array(exports.EmployeeChecklist),
    unstarted: zod_1.z.array(zod_1.z.object({
        employee: people_1.RosterCard,
        kind: exports.ChecklistKind,
        /** The first day, or the last. */
        on: IsoDate,
    })),
});
/** `POST /ops/hr/checklists`: from a template named, or the default of that kind. */
exports.StartChecklistRequest = zod_1.z.object({
    employeeId: Uuid,
    kind: exports.ChecklistKind,
    templateId: Uuid.optional(),
});
/** `GET /me/work/:employeeId/checklists`: the person's own, every task shown, theirs to tick marked. */
exports.MyChecklists = zod_1.z.object({ today: IsoDate, checklists: zod_1.z.array(exports.EmployeeChecklist) });
//# sourceMappingURL=checklists.js.map