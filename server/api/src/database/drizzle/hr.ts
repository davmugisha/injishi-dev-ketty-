/**
 * §HR LAYER — Phase 1: employee profiles (new domain, no ADR yet).
 *
 * "Employee" is a department_members row, not a new entity — that table
 * already models who works where; this adds the HR facts on top of it
 * (job title over time, employment type, dates). Versioned by insert, never
 * updated in place, mirroring staff_compensation and registration_fees: a
 * promotion or a title change must never rewrite what was true when a past
 * payslip or decision was made.
 */
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { departmentMembers } from './operations';
import { workspaces } from './org';

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'casual',
]);

export const employmentEventTypeEnum = pgEnum('employment_event_type', [
  'hired',
  'title_change',
  'department_change',
  'employment_type_change',
  'terminated',
]);

/**
 * One fact about one employee's employment, effective from a point in time.
 * Append-only: a title change inserts a new row rather than editing the old
 * one, the same reasoning `staff_compensation` documents.
 */
export const employmentHistory = pgTable(
  'employment_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventType: employmentEventTypeEnum('event_type').notNull(),
    jobTitle: text('job_title'),
    employmentType: employmentTypeEnum('employment_type'),
    note: text('note'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('employment_history_member_idx').on(t.departmentMemberId, t.effectiveFrom),
    index('employment_history_workspace_idx').on(t.workspaceId),
  ],
);