import {
  EXPENSE_RECEIPT_MAX_BYTES,
  ExpenseCategory,
  expenseYearProblem,
  kigaliToday,
  type ExpenseList,
  type ExpenseListQuery,
  type ExpenseView,
  type RecordExpenseRequest,
  type VoidExpenseRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { buildingIdsOf } from '../domain/attention';
import { assertBuildingInScope, assertResidence, coversBuilding } from '../domain/residence';
import { ExpensesRepository, type ExpenseRow } from '../infrastructure/expenses.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { ReceiptUpload } from './fault-payments.service';

export const EXPENSE_NOT_FOUND = 'Expense not found.';

/**
 * Expenses (blueprint 2.3 "Expenses and taxes", WP 4.3): a year of what the
 * business spent, with totals by category; writing down one paid outside
 * Injishi, with its receipt; and voiding one with a reason. A fixer paid for a
 * fault lands here too (`FaultPaymentsService`). One paid through Injishi
 * cannot be voided: the money moved. Residence businesses only; a member
 * limited to some buildings sees and writes only theirs.
 */
@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly expenses: ExpensesRepository,
    private readonly files: RentalsFilesStorage,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async list(ws: ScopedWorkspace, query: ExpenseListQuery): Promise<ExpenseList> {
    const r = assertResidence(ws);
    const year = query.year ?? Number(kigaliToday(this.now()).slice(0, 4));
    if (query.propertyId) assertBuildingInScope(ws, query.propertyId, 'Building');
    const rows = await this.expenses.list({
      orgId: r.orgId,
      year,
      propertyId: query.propertyId ?? null,
      category: query.category ?? null,
      buildings: buildingIdsOf(ws.branchScope),
    });
    const items = await Promise.all(rows.map((row) => this.present(row)));
    const live = rows.filter((row) => !row.voidedAt);
    const byCategory = ExpenseCategory.options
      .map((category) => {
        const of = live.filter((row) => row.category === category);
        return { category, amountRwf: of.reduce((s, row) => s + row.amountRwf, 0), count: of.length };
      })
      .filter((c) => c.count > 0);
    return {
      year,
      items,
      totals: { totalRwf: live.reduce((s, row) => s + row.amountRwf, 0), count: live.length, byCategory },
    };
  }

  /** Write down an expense paid outside Injishi, with the receipt if there is one. */
  async record(ws: ScopedWorkspace, userId: string, body: RecordExpenseRequest, receipt: ReceiptUpload | null): Promise<ExpenseView> {
    const r = assertResidence(ws);
    const yearProblem = expenseYearProblem(Number(body.paidOn.slice(0, 4)), kigaliToday(this.now()));
    if (yearProblem) throw new BadRequestException({ message: yearProblem, issues: [{ path: ['paidOn'], message: yearProblem }] });
    const place = await this.placeOf(ws, r.workspaceId, body);
    const stored = receipt ? await this.storeReceipt(r.workspaceId, userId, receipt) : null;
    const id = await this.db.transaction(async (tx) => {
      const expenseId = await this.expenses.insert(tx, {
        orgId: r.orgId,
        workspaceId: r.workspaceId,
        propertyId: place.propertyId,
        unitId: place.unitId,
        ticketId: null,
        category: body.category,
        amountRwf: body.amountRwf,
        paidOn: body.paidOn,
        method: body.method,
        payeeName: body.payeeName ?? null,
        payeePhone: body.payeePhone ?? null,
        note: body.note ?? null,
        receiptObjectId: stored?.id ?? null,
        source: 'recorded',
        payoutId: null,
        loanPurpose: body.category === 'loan_interest' ? (body.loanPurpose ?? null) : null,
        createdByUserId: userId,
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'expense',
        subjectId: expenseId,
        eventType: 'expense.recorded',
        diff: {
          category: body.category,
          amountRwf: body.amountRwf,
          paidOn: body.paidOn,
          method: body.method,
          propertyId: place.propertyId,
          unitId: place.unitId,
          loanPurpose: body.loanPurpose ?? null,
          receipt: Boolean(stored),
        },
      });
      return expenseId;
    });
    return this.view(ws, id);
  }

  /** Strike out a recorded expense, with the reason. A payment through Injishi cannot be voided. */
  async void(ws: ScopedWorkspace, userId: string, id: string, body: VoidExpenseRequest): Promise<ExpenseView> {
    const row = await this.owned(ws, id);
    if (row.source === 'gateway') {
      throw new ConflictException({ code: 'expense_gateway', message: "This was paid through Injishi, so it can't be voided. The money moved." });
    }
    if (row.voidedAt) throw new ConflictException({ code: 'expense_voided', message: 'This expense is voided already.' });
    await this.db.transaction(async (tx) => {
      if (!(await this.expenses.void(tx, row.id, userId, body.reason))) {
        throw new ConflictException({ code: 'expense_voided', message: 'This expense is voided already.' });
      }
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'expense',
        subjectId: row.id,
        eventType: 'expense.voided',
        diff: { category: row.category, amountRwf: row.amountRwf, paidOn: row.paidOn, ticketId: row.ticketId },
        reason: body.reason,
      });
    });
    return this.view(ws, id);
  }

  /** Attach or replace the receipt (a bank's interest statement, a fixer's slip). */
  async attachReceipt(ws: ScopedWorkspace, userId: string, id: string, receipt: ReceiptUpload): Promise<ExpenseView> {
    const row = await this.owned(ws, id);
    if (row.voidedAt) throw new ConflictException({ code: 'expense_voided', message: 'This expense is voided.' });
    const stored = await this.storeReceipt(row.workspaceId, userId, receipt);
    await this.db.transaction(async (tx) => {
      await this.expenses.setReceipt(tx, row.id, stored.id);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'expense',
        subjectId: row.id,
        eventType: 'expense.receipt_added',
        diff: { replaced: Boolean(row.receiptObjectId) },
      });
    });
    return this.view(ws, id);
  }

  async view(ws: ScopedWorkspace, id: string): Promise<ExpenseView> {
    return this.present(await this.owned(ws, id));
  }

  // --- Inside -------------------------------------------------------------------

  private async owned(ws: ScopedWorkspace, id: string): Promise<ExpenseRow> {
    const r = assertResidence(ws);
    const row = await this.expenses.find(id);
    if (!row || row.orgId !== r.orgId) throw new NotFoundException(EXPENSE_NOT_FOUND);
    if (row.propertyId) assertBuildingInScope(ws, row.propertyId, 'Expense');
    else if (buildingIdsOf(ws.branchScope) !== null) throw new NotFoundException(EXPENSE_NOT_FOUND);
    return row;
  }

  /**
   * Where an expense belongs: the unit's building, the building named, the
   * business's only building, or the whole business. A member limited to some
   * buildings names one of theirs.
   */
  private async placeOf(ws: ScopedWorkspace, workspaceId: string, body: RecordExpenseRequest): Promise<{ propertyId: string | null; unitId: string | null }> {
    if (body.unitId) {
      const unit = await this.expenses.unit(body.unitId);
      if (!unit || unit.workspaceId !== workspaceId) throw new NotFoundException('Unit not found.');
      assertBuildingInScope(ws, unit.propertyId, 'Unit');
      if (body.propertyId && body.propertyId !== unit.propertyId) {
        throw new BadRequestException({ message: 'That unit is in another building.', issues: [{ path: ['unitId'], message: 'That unit is in another building.' }] });
      }
      return { propertyId: unit.propertyId, unitId: unit.id };
    }
    if (body.propertyId) {
      const property = await this.expenses.property(body.propertyId);
      if (!property || property.workspaceId !== workspaceId) throw new NotFoundException('Building not found.');
      assertBuildingInScope(ws, property.id, 'Building');
      return { propertyId: property.id, unitId: null };
    }
    const buildings = (await this.expenses.buildingsOf(workspaceId)).filter((id) => coversBuilding(ws.branchScope, id));
    if (buildings.length === 1) return { propertyId: buildings[0] as string, unitId: null };
    if (buildingIdsOf(ws.branchScope) !== null) {
      throw new BadRequestException({ message: 'Pick the building it was for.', issues: [{ path: ['propertyId'], message: 'Pick the building it was for.' }] });
    }
    return { propertyId: null, unitId: null };
  }

  private storeReceipt(workspaceId: string, userId: string, receipt: ReceiptUpload): Promise<{ id: string; objectKey: string }> {
    return this.files.putDocument({
      kind: 'expense_receipt',
      body: receipt.body,
      mime: receipt.mime,
      filename: receipt.filename,
      maxBytes: EXPENSE_RECEIPT_MAX_BYTES,
      uploadedByUserId: userId,
      workspaceId,
    });
  }

  private async present(row: ExpenseRow): Promise<ExpenseView> {
    return {
      id: row.id,
      category: row.category,
      amountRwf: row.amountRwf,
      paidOn: row.paidOn,
      method: row.method,
      payeeName: row.payeeName,
      payeePhone: row.payeePhone,
      note: row.note,
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      unitId: row.unitId,
      unitLabel: row.unitLabel,
      ticketId: row.ticketId,
      ticketTitle: row.ticketTitle,
      source: row.source,
      loanPurpose: row.loanPurpose,
      hasReceipt: Boolean(row.receiptObjectKey),
      receiptUrl: row.receiptObjectKey ? await this.files.signedUrl(row.receiptObjectKey) : null,
      canVoid: row.source === 'recorded' && !row.voidedAt,
      voided: row.voidedAt ? { at: row.voidedAt.toISOString(), byName: row.voidedByName, reason: row.voidReason ?? '' } : null,
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
