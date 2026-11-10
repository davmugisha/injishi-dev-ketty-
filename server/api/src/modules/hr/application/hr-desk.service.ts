import type {
  AssetLoan,
  AssetLoanList,
  CreateAssetLoanRequest,
  CreateHrTicketRequest,
  HrTicket,
  HrTicketList,
  ReplyHrTicketRequest,
  ReturnAssetLoanRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { assetLoans, employees, hrTicketMessages, hrTickets, jobPositions, users } from '../../../database/drizzle/schema';
import { coversProperty, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { displayNameOf } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

type TicketRow = typeof hrTickets.$inferSelect;
type LoanRow = typeof assetLoans.$inferSelect;

interface Person {
  id: string;
  name: string;
  title: string | null;
  workPropertyId: string | null;
  active: boolean;
}

const ref = (n: number): string => `HD-${String(n).padStart(4, '0')}`;

/**
 * The staff help desk and the things lent to staff (058-staff-services).
 *
 * A person asks from Me or the phone, on their own file only (ownership is the guard, as everywhere
 * under `me/work`); HR answers in the thread and closes it. A loan is recorded when an item goes
 * out and closed when it comes back. HR reads and acts within the branches they cover.
 */
@Injectable()
export class HrDeskService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly work: MyWorkRepository,
    private readonly employeesRepo: EmployeesRepository,
  ) {}

  // --- The person's own --------------------------------------------------------------------

  async myTickets(userId: string, employeeId: string): Promise<HrTicketList> {
    const me = await this.mine(userId, employeeId);
    const rows = await this.db
      .select()
      .from(hrTickets)
      .where(eq(hrTickets.employeeId, me.id))
      .orderBy(desc(hrTickets.updatedAt));
    return { tickets: await this.present(rows) };
  }

  /** Ask HR or IT: the ticket and its first message, numbered within the business. */
  async ask(userId: string, employeeId: string, body: CreateHrTicketRequest): Promise<HrTicket> {
    const me = await this.mineActive(userId, employeeId);
    const id = await this.db.transaction(async (tx) => {
      // One number after another per business; the unique index refuses a duplicate if two race.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`hr_tickets:${me.orgId}`}))`);
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${hrTickets.number}), 0) + 1` })
        .from(hrTickets)
        .where(eq(hrTickets.orgId, me.orgId));
      const [row] = await tx
        .insert(hrTickets)
        .values({
          orgId: me.orgId,
          number: Number(next),
          employeeId: me.id,
          topic: body.topic,
          subject: body.subject.trim(),
        })
        .returning({ id: hrTickets.id });
      await tx.insert(hrTicketMessages).values({ ticketId: row.id, fromStaff: true, authorUserId: userId, body: body.body.trim() });
      return row.id;
    });
    return this.presentOne(id);
  }

  /** The person writes again in their own thread; a closed one opens again. */
  async replyMine(userId: string, employeeId: string, ticketId: string, body: ReplyHrTicketRequest): Promise<HrTicket> {
    const me = await this.mineActive(userId, employeeId);
    const ticket = await this.find(ticketId);
    if (!ticket || ticket.employeeId !== me.id) throw new NotFoundException();
    await this.db.transaction(async (tx) => {
      await tx.insert(hrTicketMessages).values({ ticketId, fromStaff: true, authorUserId: userId, body: body.body.trim() });
      await tx
        .update(hrTickets)
        .set({ status: 'open', closedAt: null, closedByUserId: null, updatedAt: new Date() })
        .where(eq(hrTickets.id, ticketId));
    });
    return this.presentOne(ticketId);
  }

  async myLoans(userId: string, employeeId: string): Promise<AssetLoanList> {
    const me = await this.mine(userId, employeeId);
    const rows = await this.db
      .select()
      .from(assetLoans)
      .where(eq(assetLoans.employeeId, me.id))
      .orderBy(desc(assetLoans.issuedOn));
    return { loans: await this.presentLoans(rows) };
  }

  // --- HR ----------------------------------------------------------------------------------

  /** Every ticket of the business, open first, of the people the caller covers. */
  async tickets(ws: ScopedWorkspace): Promise<HrTicketList> {
    const rows = await this.db
      .select()
      .from(hrTickets)
      .where(eq(hrTickets.orgId, orgOf(ws)))
      .orderBy(asc(sql`case ${hrTickets.status} when 'open' then 0 when 'answered' then 1 else 2 end`), desc(hrTickets.updatedAt));
    const people = await this.people(rows.map((r) => r.employeeId));
    const mine = rows.filter((r) => coversProperty(ws.branchScope, people.get(r.employeeId)?.workPropertyId ?? null));
    return { tickets: await this.present(mine, people) };
  }

  /** HR answers in the thread; `close` closes it with this answer. */
  async reply(ws: ScopedWorkspace, userId: string, id: string, body: ReplyHrTicketRequest): Promise<HrTicket> {
    const ticket = await this.inReach(ws, id);
    await this.db.transaction(async (tx) => {
      await tx.insert(hrTicketMessages).values({ ticketId: id, fromStaff: false, authorUserId: userId, body: body.body.trim() });
      await tx
        .update(hrTickets)
        .set(
          body.close
            ? { status: 'closed', closedAt: new Date(), closedByUserId: userId, updatedAt: new Date() }
            : { status: 'answered', updatedAt: new Date() },
        )
        .where(eq(hrTickets.id, id));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: ticket.employeeId,
        eventType: body.close ? 'hr.ticket_closed' : 'hr.ticket_answered',
        orgId: ticket.orgId,
        diff: { ticketId: id },
      });
    });
    return this.presentOne(id);
  }

  /** Close a ticket without another word: the question was dealt with elsewhere. */
  async close(ws: ScopedWorkspace, userId: string, id: string): Promise<HrTicket> {
    const ticket = await this.inReach(ws, id);
    if (ticket.status === 'closed') throw new ConflictException('That ticket is already closed.');
    await this.db.transaction(async (tx) => {
      await tx
        .update(hrTickets)
        .set({ status: 'closed', closedAt: new Date(), closedByUserId: userId, updatedAt: new Date() })
        .where(eq(hrTickets.id, id));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: ticket.employeeId,
        eventType: 'hr.ticket_closed',
        orgId: ticket.orgId,
        diff: { ticketId: id },
      });
    });
    return this.presentOne(id);
  }

  /** Everything lent and not yet back first, then what came back, of the people the caller covers. */
  async loans(ws: ScopedWorkspace): Promise<AssetLoanList> {
    const rows = await this.db
      .select()
      .from(assetLoans)
      .where(eq(assetLoans.orgId, orgOf(ws)))
      .orderBy(asc(sql`${assetLoans.returnedOn} is not null`), desc(assetLoans.issuedOn));
    const people = await this.people(rows.map((r) => r.employeeId));
    const mine = rows.filter((r) => coversProperty(ws.branchScope, people.get(r.employeeId)?.workPropertyId ?? null));
    return { loans: await this.presentLoans(mine, people) };
  }

  async lend(ws: ScopedWorkspace, userId: string, body: CreateAssetLoanRequest): Promise<AssetLoan> {
    const orgId = orgOf(ws);
    const employee = await this.employeesRepo.find(body.employeeId);
    if (!employee || employee.orgId !== orgId) throw new NotFoundException();
    assertPersonInReach(ws, employee.workPropertyId);
    if (employee.status !== 'active') throw new UnprocessableEntityException(`${displayNameOf(employee)} has left.`);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(assetLoans)
        .values({
          orgId,
          employeeId: employee.id,
          kind: body.kind,
          name: body.name.trim(),
          tag: body.tag?.trim() || null,
          issuedOn: body.issuedOn,
          dueBackOn: body.dueBackOn ?? null,
          note: body.note?.trim() || null,
          issuedByUserId: userId,
        })
        .returning({ id: assetLoans.id });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.asset_lent',
        orgId,
        diff: { loanId: row.id, kind: body.kind },
      });
      return row.id;
    });
    return this.presentLoan(id);
  }

  async giveBack(ws: ScopedWorkspace, userId: string, id: string, body: ReturnAssetLoanRequest): Promise<AssetLoan> {
    const orgId = orgOf(ws);
    const [loan] = await this.db.select().from(assetLoans).where(eq(assetLoans.id, id));
    if (!loan || loan.orgId !== orgId) throw new NotFoundException();
    const employee = await this.employeesRepo.find(loan.employeeId);
    assertPersonInReach(ws, employee?.workPropertyId ?? null);
    if (loan.returnedOn) throw new ConflictException('That item is already back.');
    if (body.returnedOn < loan.issuedOn) throw new UnprocessableEntityException('It cannot come back before it went out.');
    await this.db.transaction(async (tx) => {
      const done = await tx
        .update(assetLoans)
        .set({
          returnedOn: body.returnedOn,
          returnedToUserId: userId,
          note: body.note?.trim() || loan.note,
          updatedAt: new Date(),
        })
        .where(and(eq(assetLoans.id, id), isNull(assetLoans.returnedOn)))
        .returning({ id: assetLoans.id });
      if (done.length === 0) throw new ConflictException('That item was recorded back a moment ago.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: loan.employeeId,
        eventType: 'hr.asset_returned',
        orgId,
        diff: { loanId: id },
      });
    });
    return this.presentLoan(id);
  }

  // --- Reading ----------------------------------------------------------------------------

  private async find(id: string): Promise<TicketRow | undefined> {
    const [row] = await this.db.select().from(hrTickets).where(eq(hrTickets.id, id));
    return row;
  }

  private async inReach(ws: ScopedWorkspace, id: string): Promise<TicketRow> {
    const ticket = await this.find(id);
    if (!ticket || ticket.orgId !== orgOf(ws)) throw new NotFoundException();
    const employee = await this.employeesRepo.find(ticket.employeeId);
    assertPersonInReach(ws, employee?.workPropertyId ?? null);
    return ticket;
  }

  private async people(ids: string[]): Promise<Map<string, Person>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: employees.id,
        legalName: employees.legalName,
        preferredName: employees.preferredName,
        title: jobPositions.title,
        workPropertyId: employees.workPropertyId,
        status: employees.status,
      })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(inArray(employees.id, unique));
    return new Map(
      rows.map((r) => [
        r.id,
        { id: r.id, name: displayNameOf(r), title: r.title, workPropertyId: r.workPropertyId, active: r.status === 'active' },
      ]),
    );
  }

  private async present(rows: TicketRow[], known?: Map<string, Person>): Promise<HrTicket[]> {
    if (rows.length === 0) return [];
    const people = known ?? (await this.people(rows.map((r) => r.employeeId)));
    const messages = await this.db
      .select({
        id: hrTicketMessages.id,
        ticketId: hrTicketMessages.ticketId,
        fromStaff: hrTicketMessages.fromStaff,
        body: hrTicketMessages.body,
        createdAt: hrTicketMessages.createdAt,
        authorName: users.name,
      })
      .from(hrTicketMessages)
      .leftJoin(users, eq(users.id, hrTicketMessages.authorUserId))
      .where(
        inArray(
          hrTicketMessages.ticketId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(hrTicketMessages.createdAt));
    return rows.map((r) => {
      const p = people.get(r.employeeId);
      return {
        id: r.id,
        reference: ref(r.number),
        employee: { employeeId: r.employeeId, displayName: p?.name ?? '', jobPositionTitle: p?.title ?? null },
        topic: r.topic,
        subject: r.subject,
        status: r.status,
        messages: messages
          .filter((m) => m.ticketId === r.id)
          .map((m) => ({
            id: m.id,
            fromStaff: m.fromStaff,
            authorName: m.fromStaff ? (p?.name ?? m.authorName) : (m.authorName ?? 'HR'),
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          })),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        closedAt: r.closedAt?.toISOString() ?? null,
      };
    });
  }

  private async presentOne(id: string): Promise<HrTicket> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException();
    return (await this.present([row]))[0];
  }

  private async presentLoans(rows: LoanRow[], known?: Map<string, Person>): Promise<AssetLoan[]> {
    if (rows.length === 0) return [];
    const people = known ?? (await this.people(rows.map((r) => r.employeeId)));
    const issuers = rows.map((r) => r.issuedByUserId).filter((x): x is string => !!x);
    const names = issuers.length
      ? new Map(
          (await this.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...new Set(issuers)]))).map(
            (u) => [u.id, u.name],
          ),
        )
      : new Map<string, string | null>();
    return rows.map((r) => {
      const p = people.get(r.employeeId);
      return {
        id: r.id,
        employee: { employeeId: r.employeeId, displayName: p?.name ?? '', jobPositionTitle: p?.title ?? null },
        employeeActive: p?.active ?? false,
        kind: r.kind,
        name: r.name,
        tag: r.tag,
        issuedOn: r.issuedOn,
        dueBackOn: r.dueBackOn,
        returnedOn: r.returnedOn,
        note: r.note,
        issuedByName: r.issuedByUserId ? (names.get(r.issuedByUserId) ?? null) : null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  private async presentLoan(id: string): Promise<AssetLoan> {
    const [row] = await this.db.select().from(assetLoans).where(eq(assetLoans.id, id));
    if (!row) throw new NotFoundException();
    return (await this.presentLoans([row]))[0];
  }

  // --- Ownership --------------------------------------------------------------------------

  /** The caller's file, or 404: a probe for any other id learns nothing. */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employeesRepo.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  private async mineActive(userId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.mine(userId, employeeId);
    if (employee.status !== 'active') throw new ConflictException('You no longer work here, so this file is read only.');
    return employee;
  }
}
