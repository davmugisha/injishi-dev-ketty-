/**
 * Checklists (ADR-058): what a business does when somebody joins and when
 * somebody leaves.
 *
 * Two layers, and the split is the point. A TEMPLATE is the business's own
 * list, edited freely. A person's CHECKLIST is a copy of one, taken the day it
 * starts, with a due date on every task: editing a template later never
 * rewrites what somebody is partway through, and a template deleted leaves the
 * checklists it started standing, under the name it had.
 *
 * The rules of people.ts hold here. Every table carries `org_id`. A checklist
 * and its tasks are never deleted; a task not done stays not done, and one
 * ticked by mistake is unticked, which clears who and when rather than
 * removing the row. A template is the exception: it is configuration, not
 * history, and goes when the business drops it.
 *
 * One checklist of a kind per file. Somebody rehired is a new file
 * (058-people-file AC-PF14), so they join again on a list of their own.
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { orgs } from './org';
import { employees, jobPositions } from './people';

export const hrChecklistKindEnum = pgEnum('hr_checklist_kind', ['onboarding', 'offboarding']);

export const checklistTemplates = pgTable(
  'checklist_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    kind: hrChecklistKindEnum('kind').notNull(),
    name: text('name').notNull(),
    /** The one a new file, or an offboarding, starts from. */
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('checklist_templates_org_idx').on(t.orgId, t.kind),
    // One default per kind, and any number of others.
    uniqueIndex('checklist_templates_one_default_uk')
      .on(t.orgId, t.kind)
      .where(sql`${t.isDefault}`),
    uniqueIndex('checklist_templates_name_uk').on(t.orgId, t.kind, sql`lower(${t.name})`),
  ],
);

export const checklistTemplateItems = pgTable(
  'checklist_template_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /** The person does it themselves; otherwise the office does. */
    byEmployee: boolean('by_employee').notNull().default(false),
    /** Days from the first day (joining) or the last (leaving); negative is before it. */
    dueAfterDays: integer('due_after_days').notNull().default(0),
    /**
     * Only for people in this job; null is everybody. A position that is
     * removed leaves its tasks behind as everybody's rather than taking them
     * with it.
     */
    jobPositionId: uuid('job_position_id').references(() => jobPositions.id, { onDelete: 'set null' }),
  },
  (t) => [index('checklist_template_items_template_idx').on(t.templateId, t.sortOrder)],
);

export const employeeChecklists = pgTable(
  'employee_checklists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    kind: hrChecklistKindEnum('kind').notNull(),
    /** The template's name when it was copied: the template may be renamed or gone. */
    templateName: text('template_name').notNull(),
    /** The day the due dates count from: the hire date, or the last day. */
    anchorOn: date('anchor_on').notNull(),
    /** Null when the product started it on a hire or an offboarding, not a person from the board. */
    startedByUserId: uuid('started_by_user_id').references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('employee_checklists_one_per_kind_uk').on(t.employeeId, t.kind),
    index('employee_checklists_org_idx').on(t.orgId, t.kind),
  ],
);

export const employeeChecklistTasks = pgTable(
  'employee_checklist_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => employeeChecklists.id),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    byEmployee: boolean('by_employee').notNull().default(false),
    dueOn: date('due_on').notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByUserId: uuid('done_by_user_id').references(() => users.id),
  },
  (t) => [index('employee_checklist_tasks_checklist_idx').on(t.checklistId, t.sortOrder)],
);
