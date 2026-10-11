/**
 * §HR LAYER — Phase 5: the shift roster and attendance (clock in and out).
 * New domain, no ADR yet.
 *
 * Three tables, each answering one question:
 *
 *   `work_shifts`        what shifts does this business run?
 *   `shift_assignments`  who is on which shift, on which day?
 *   `attendance_entries` when did they actually arrive and leave?
 *
 * As everywhere in this layer, an "employee" is a `department_members` row
 * (see `hr.ts`), so somebody who works in two departments is rostered and
 * clocks once per department record.
 *
 * A DAY IS A KIGALI DAY. `work_date` is a bare date and means the day the
 * shift STARTS on the hotel's own clock, so a night shift that ends at 07:00
 * belongs to the evening it began. The two instants on an entry are real
 * timestamps.
 *
 * AN ENTRY REMEMBERS THE SHIFT IT WAS MEASURED AGAINST. `scheduled_start`,
 * `scheduled_end` and `late_minutes` are written when somebody clocks in and
 * never recomputed: moving a shift from 07:00 to 08:00 next month must not
 * turn last month's late arrivals into punctual ones. The same reasoning as
 * `employment_history` and `staff_compensation`, which are versioned rather
 * than edited.
 *
 * The names avoid `shift_templates`, `roster_entries` and
 * `attendance_records`, which main's Staff module already owns (ADR-058).
 */
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { departmentMembers } from './operations';
import { workspaces } from './org';

/** A shift the business runs: "Morning, 07:00 to 15:00". */
export const workShifts = pgTable(
  'work_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    /** Wall clock in Kigali. An end at or before the start is the next morning. */
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    /** How long after the start somebody may arrive and still be on time. */
    graceMinutes: integer('grace_minutes').notNull().default(10),
    /** Which step of the chart ramp it wears on the roster, 1 to 5. */
    colorSlot: integer('color_slot').notNull().default(1),
    /**
     * False once retired. A shift is never deleted: past rosters and clock
     * records point at it, and they must keep saying what was worked.
     */
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('work_shifts_workspace_idx').on(t.workspaceId, t.isActive)],
);

/** One person on one shift on one day. Clearing a day deletes the row. */
export const shiftAssignments = pgTable(
  'shift_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => workShifts.id),
    workDate: date('work_date').notNull(),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    // One shift a day per department record. Somebody covering two shifts in
    // one day is rare enough to be a note, not a second row to reconcile.
    unique('shift_assignments_member_day_uk').on(t.departmentMemberId, t.workDate),
    index('shift_assignments_workspace_day_idx').on(t.workspaceId, t.workDate),
  ],
);

export const attendanceSourceEnum = pgEnum('attendance_source', [
  // The employee pressed the button themselves.
  'self',
  // HR wrote or corrected it: a forgotten clock out, a phone left at home.
  'manual',
]);

/** One person's arrival and departure for one working day. */
export const attendanceEntries = pgTable(
  'attendance_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workDate: date('work_date').notNull(),
    clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
    /** Null while they are still at work. */
    clockOutAt: timestamp('clock_out_at', { withTimezone: true }),
    /** The shift they were rostered on that day, if any. Null is unrostered work. */
    shiftId: uuid('shift_id').references(() => workShifts.id),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    /** Minutes past the scheduled start, once past the grace. 0 is on time. */
    lateMinutes: integer('late_minutes').notNull().default(0),
    source: attendanceSourceEnum('source').notNull().default('self'),
    /** Why HR wrote or changed it. Shown to the employee too. */
    note: text('note'),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('attendance_entries_member_day_uk').on(t.departmentMemberId, t.workDate),
    index('attendance_entries_workspace_day_idx').on(t.workspaceId, t.workDate),
  ],
);
