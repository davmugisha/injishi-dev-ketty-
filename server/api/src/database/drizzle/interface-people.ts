/**
 * What the HR screens of the new interface (apps/app: People home, Employees,
 * Roster, Attendance, Leave) need beyond ADR-058's tables.
 *
 * - TEAMS. A USALI department is one per category per property
 *   (`departments_property_category_uk`), so Housekeeping and Front office are
 *   both "Rooms" and Kitchen is "Food and Beverage". HR rosters, counts presence
 *   and sets minimum cover by the team people actually work in, so a team is a
 *   named group inside a department, at one branch, with a lead. One active team
 *   per person.
 * - MINIMUM COVER. How many of a team must be on which shifts on each weekday,
 *   and who set it. The roster grid's cover rows and People home's gaps are
 *   counted against it.
 * - CHECKLISTS. The steps of an onboarding or an offboarding, ticked one by one.
 *   The final act of an offboarding stays `POST /ops/employees/:id/offboard`; a
 *   step the owner alone may tick (taking an account away) says so.
 * - DEPENDANTS. A person's beneficiaries and dependants, read by `people.manage`
 *   only: personal data under Law N° 058/2021, like the rest of the full file.
 *
 * The rules of people.ts hold here too: every table carries `org_id`, and
 * nothing a person did is deleted (a team or a cover rule is archived, a member
 * or a dependant removed, a checklist step un-ticked by writing the stamp back
 * to null).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { properties } from './inventory';
import { departmentMemberStatusEnum, departments } from './operations';
import { orgs } from './org';
import { employees, hrCatalogStatusEnum, hrSexEnum } from './people';

/** A team inside a department at one branch: Housekeeping and Front office under Rooms. */
export const hrTeams = pgTable(
  'hr_teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    /** The USALI department the team's work is reported under. */
    departmentId: uuid('department_id').references(() => departments.id),
    /** A short key the business chooses ("hk"), unique among its active teams. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Who leads it: the team's first line for its people's requests. */
    leadEmployeeId: uuid('lead_employee_id').references(() => employees.id),
    sortOrder: integer('sort_order').notNull().default(0),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('hr_teams_name_uk')
      .on(t.propertyId, sql`lower(${t.name})`)
      .where(sql`${t.status} = 'active'`),
    uniqueIndex('hr_teams_code_uk').on(t.orgId, t.code).where(sql`${t.status} = 'active'`),
    check('hr_teams_code_ck', sql`${t.code} ~ '^[a-z0-9-]{1,12}$'`),
    index('hr_teams_org_idx').on(t.orgId, t.status),
  ],
);

/** Who works in which team. One active team per person; leaving a team is `removed`, never a delete. */
export const hrTeamMembers = pgTable(
  'hr_team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => hrTeams.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    status: departmentMemberStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('hr_team_members_active_uk').on(t.employeeId).where(sql`${t.status} = 'active'`),
    index('hr_team_members_team_idx').on(t.teamId, t.status),
  ],
);

/**
 * The fewest people of a team on the counted shifts, per weekday (ISO, Monday
 * first). `shift_template_ids` are shift templates of the same branch.
 */
export const rosterCoverRequirements = pgTable(
  'roster_cover_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => hrTeams.id),
    /** What the cover row is called on the roster ("Morning cover"). */
    label: text('label').notNull(),
    shiftTemplateIds: jsonb('shift_template_ids').$type<string[]>().notNull(),
    /** Seven minimums, Monday to Sunday. */
    minByWeekday: integer('min_by_weekday').array().notNull(),
    note: text('note'),
    setByEmployeeId: uuid('set_by_employee_id').references(() => employees.id),
    sortOrder: integer('sort_order').notNull().default(0),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('roster_cover_requirements_label_uk')
      .on(t.teamId, sql`lower(${t.label})`)
      .where(sql`${t.status} = 'active'`),
    check(
      'roster_cover_requirements_min_ck',
      sql`cardinality(${t.minByWeekday}) = 7 AND 0 <= ALL(${t.minByWeekday})`,
    ),
    check(
      'roster_cover_requirements_shifts_ck',
      sql`jsonb_typeof(${t.shiftTemplateIds}) = 'array' AND jsonb_array_length(${t.shiftTemplateIds}) BETWEEN 1 AND 12`,
    ),
    index('roster_cover_requirements_property_idx').on(t.propertyId, t.status),
  ],
);

/** One step of a person's onboarding or offboarding. */
export const hrChecklistItems = pgTable(
  'hr_checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    checklist: text('checklist').notNull(),
    /** Stable within a checklist ("assets", "access"), so a step is named the same on every file. */
    code: text('code').notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    /** Only someone who may manage the team ticks it (taking an account away is staffing the business). */
    ownerOnly: boolean('owner_only').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByUserId: uuid('done_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('hr_checklist_items_code_uk').on(t.employeeId, t.checklist, t.code),
    check('hr_checklist_items_checklist_ck', sql`${t.checklist} IN ('onboarding', 'offboarding')`),
    check('hr_checklist_items_done_ck', sql`(${t.doneAt} IS NULL) = (${t.doneByUserId} IS NULL)`),
    index('hr_checklist_items_org_idx').on(t.orgId, t.checklist),
  ],
);

/** A beneficiary or dependant on a person's file. */
export const employeeDependants = pgTable(
  'employee_dependants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    name: text('name').notNull(),
    relation: text('relation').notNull(),
    sex: hrSexEnum('sex'),
    dateOfBirth: date('date_of_birth'),
    /** E.164. */
    phone: text('phone'),
    isEmergencyContact: boolean('is_emergency_contact').notNull().default(false),
    /** Covered by the person's medical scheme. */
    medicalDependant: boolean('medical_dependant').notNull().default(false),
    /** Share of a death benefit, 0 to 100; null when not a beneficiary. */
    beneficiaryPercent: numeric('beneficiary_percent', { precision: 5, scale: 2, mode: 'number' }),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    check('employee_dependants_relation_ck', sql`${t.relation} IN ('spouse', 'child', 'parent', 'sibling', 'other')`),
    check(
      'employee_dependants_share_ck',
      sql`${t.beneficiaryPercent} IS NULL OR (${t.beneficiaryPercent} > 0 AND ${t.beneficiaryPercent} <= 100)`,
    ),
    check('employee_dependants_status_ck', sql`${t.status} IN ('active', 'removed')`),
    index('employee_dependants_employee_idx').on(t.employeeId, t.status),
  ],
);
