/**
 * The staff help desk and the things a business lends its staff (058-staff-services).
 *
 * A TICKET is a question a person asks HR or IT from Me or the staff phone, with its messages in
 * order: the person's and HR's answers. It is closed, never deleted. A LOAN is one item signed out
 * to one person, from the day it went out until the day it came back; a loan not returned stays
 * open, which is what a leaver's last day reads.
 *
 * The rules of people.ts hold here: every table carries `org_id`.
 */
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { orgs } from './org';
import { employees } from './people';

export const hrTicketTopicEnum = pgEnum('hr_ticket_topic', ['pay', 'leave', 'documents', 'uniform', 'it', 'other']);
export const hrTicketStatusEnum = pgEnum('hr_ticket_status', ['open', 'answered', 'closed']);
export const assetKindEnum = pgEnum('asset_kind', ['key', 'uniform', 'phone', 'laptop', 'tool', 'other']);

export const hrTickets = pgTable(
  'hr_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** HD-0001, HD-0002 within the business: what a person quotes. */
    number: integer('number').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    topic: hrTicketTopicEnum('topic').notNull(),
    subject: text('subject').notNull(),
    status: hrTicketStatusEnum('status').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('hr_tickets_number_uk').on(t.orgId, t.number),
    index('hr_tickets_org_status_idx').on(t.orgId, t.status),
    index('hr_tickets_employee_idx').on(t.employeeId),
  ],
);

export const hrTicketMessages = pgTable(
  'hr_ticket_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => hrTickets.id, { onDelete: 'cascade' }),
    /** The person who asked (true), or HR answering (false). */
    fromStaff: boolean('from_staff').notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('hr_ticket_messages_ticket_idx').on(t.ticketId, t.createdAt)],
);

export const assetLoans = pgTable(
  'asset_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    kind: assetKindEnum('kind').notNull(),
    name: text('name').notNull(),
    tag: text('tag'),
    issuedOn: date('issued_on').notNull(),
    dueBackOn: date('due_back_on'),
    returnedOn: date('returned_on'),
    note: text('note'),
    issuedByUserId: uuid('issued_by_user_id').references(() => users.id),
    returnedToUserId: uuid('returned_to_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('asset_loans_org_idx').on(t.orgId, t.returnedOn), index('asset_loans_employee_idx').on(t.employeeId)],
);
