/**
 * §HR LAYER — Phase 3 (onboarding/offboarding checklists, with templates,
 * assignees and day offsets) and Phase 4 (leave requests, balances, and
 * per-type settings). New domain, no ADR yet.
 *
 * Checklists: a workspace defines templates once; hiring/terminating
 * someone stamps a COPY of the current template onto checklist_items for
 * that person, including each task's assignee and day offset, so a
 * dueDate can be computed at copy time — editing a template later must
 * never rewrite a checklist someone is partway through.
 *
 * Leave: a balance is an ALLOCATION, never a running total — days used
 * are computed from approved leave_requests at read time. leave_type_settings
 * is per-workspace configuration (unpaid, carry-forward, applicable-after,
 * and the days a year an allowance is worked out from) for a leave type; it
 * decides nothing by itself, the service enforces it.
 *
 * A leave_balances row is an allowance SET BY HAND. Where there is none, the
 * allowance is worked out from the type's rule and the person's start date at
 * read time, and nothing is stored: a rule changed today is everybody's
 * allowance today, with no rows to rewrite.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { departmentMembers, departments } from './operations';
import { workspaces } from './org';

// --- Phase 3: onboarding/offboarding checklists ------------------------

export const checklistKindEnum = pgEnum('checklist_kind', [
  'onboarding',
  'offboarding',
]);

export const checklistTemplates = pgTable(
  'checklist_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: checklistKindEnum('kind').notNull(),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('checklist_templates_workspace_idx').on(t.workspaceId, t.kind),
    // ONE default per kind, and any number of others. This used to be a plain
    // unique over (workspace, kind, is_default), which also allowed only one
    // NON-default template per kind — so a second template of a kind could
    // never be created at all.
    uniqueIndex('checklist_templates_one_default_uk')
      .on(t.workspaceId, t.kind)
      .where(sql`${t.isDefault}`),
  ],
);

/** One task within a template. `assigneeRole` is free text (e.g. "HR",
 * "IT", "Manager") rather than an enum — a first pass, not every workspace
 * will use the same words for who owns a task. `beginOnDays` is an offset
 * from the hire/terminate date (0 = day one), copied onto each
 * checklist_items row so a due date can be computed without rejoining the
 * template later. */
export const checklistTemplateItems = pgTable(
  'checklist_template_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    assigneeRole: text('assignee_role'),
    beginOnDays: integer('begin_on_days').notNull().default(0),
    /**
     * Which department this task is for; null is everybody. It decides whose
     * checklist the task is copied onto — a housekeeper is not handed the
     * engineer's tasks. A department that is deleted leaves its tasks behind
     * as everybody's rather than taking them with it.
     */
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [index('checklist_template_items_template_idx').on(t.templateId)],
);

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: checklistKindEnum('kind').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    assigneeRole: text('assignee_role'),
    beginOnDays: integer('begin_on_days').notNull().default(0),
    /** Computed at copy time: the checklist's own start date + beginOnDays. */
    dueDate: date('due_date'),
    done: boolean('done').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('checklist_items_member_idx').on(t.departmentMemberId, t.kind),
    index('checklist_items_workspace_idx').on(t.workspaceId),
  ],
);

// --- Phase 4: leave ------------------------------------------------------

export const leaveTypeEnum = pgEnum('leave_type', [
  'annual',
  'sick',
  'unpaid',
  'other',
]);

export const leaveRequestStatusEnum = pgEnum('leave_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leaveType: leaveTypeEnum('leave_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    reason: text('reason'),
    status: leaveRequestStatusEnum('status').notNull().default('pending'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('leave_requests_member_idx').on(t.departmentMemberId),
    index('leave_requests_workspace_status_idx').on(t.workspaceId, t.status),
  ],
);

export const leaveBalances = pgTable(
  'leave_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leaveType: leaveTypeEnum('leave_type').notNull(),
    year: integer('year').notNull(),
    allocatedDays: integer('allocated_days').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('leave_balances_member_type_year_uk').on(t.departmentMemberId, t.leaveType, t.year),
  ],
);

/**
 * Per-workspace configuration for a leave type (not per-request).
 * `isUnpaid`: whether this type deducts pay (informational for now — no
 * payroll wiring yet, that's a separate discussion). `carryForward`:
 * whether an unused balance should roll into next year — stored here but
 * not yet auto-applied; rolling it over is a scheduled job, future work.
 * `applicableAfterDays`: how many days employed before this type may be
 * requested at all, checked against the employee's earliest 'hired' event.
 */
export const leaveTypeSettings = pgTable(
  'leave_type_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leaveType: leaveTypeEnum('leave_type').notNull(),
    isUnpaid: boolean('is_unpaid').notNull().default(false),
    carryForward: boolean('carry_forward').notNull().default(false),
    applicableAfterDays: integer('applicable_after_days').notNull().default(0),
    maxConsecutiveDays: integer('max_consecutive_days'),
    /**
     * What an allowance is worked out from (see `leave-entitlement.ts`): the
     * days a year, and the days long service adds. NULL IS "THE DEFAULT FOR
     * THIS TYPE", not "none": a business that saved a rule before these
     * columns existed still gets eighteen days of annual leave worked out.
     * Zero days a year is how a business says a type has no allowance.
     */
    yearlyDays: integer('yearly_days'),
    seniorityEveryYears: integer('seniority_every_years'),
    seniorityExtraDays: integer('seniority_extra_days'),
    seniorityCapDays: integer('seniority_cap_days'),
    ...timestamps,
  },
  (t) => [unique('leave_type_settings_workspace_type_uk').on(t.workspaceId, t.leaveType)],
);
