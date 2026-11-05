import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { expenses } from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { PosExpenseRow, RecordPosExpenseRequest, VoidPosExpenseRequest } from '../domain/pos-ops';
import { audit, outletInScope } from '../infrastructure/pos-support';

/** Today's date in Kigali as `YYYY-MM-DD`. */
function kigaliToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
}

/**
 * The business's expenses, as the profit and loss reads them (POS spec section 13).
 *
 * They live in the platform's `expenses` table (the one the rentals module keeps for landlords): the same
 * categories, payment methods, void rule and `expense.manage` permission, now usable by a bar or a
 * restaurant. An expense is never edited or deleted: it is voided with a reason, and both acts are audited.
 */
@Injectable()
export class PosExpenseService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(ws: ScopedWorkspace, body: RecordPosExpenseRequest, userId: string): Promise<PosExpenseRow> {
    if (!ws.orgId) throw new ConflictException('Expenses belong to a business.');
    return this.db.transaction(async (tx) => {
      const outlet = body.outletId ? await outletInScope(tx, ws, body.outletId) : null;
      const [row] = await tx
        .insert(expenses)
        .values({
          orgId: ws.orgId as string,
          workspaceId: ws.workspaceId,
          propertyId: outlet?.propertyId ?? null,
          category: body.category,
          amountRwf: body.amountRwf,
          paidOn: body.paidOn ?? kigaliToday(),
          method: body.method,
          payeeName: body.payeeName || null,
          note: body.note || null,
          source: 'recorded',
          createdByUserId: userId,
        })
        .returning();
      if (!row) throw new Error('The expense did not save.');
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: outlet?.id ?? null,
        actorUserId: userId,
        action: 'expense.recorded',
        entityType: 'expense',
        entityId: row.id,
        after: { category: row.category, amountRwf: Number(row.amountRwf), method: row.method, paidOn: row.paidOn },
      });
      return present(row);
    });
  }

  async void(ws: ScopedWorkspace, id: string, body: VoidPosExpenseRequest, userId: string): Promise<PosExpenseRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.workspaceId, ws.workspaceId)))
        .limit(1)
        .for('update');
      if (!row) throw new NotFoundException('That expense is not available to you.');
      if (row.voidedAt) throw new ConflictException('This expense is voided already.');
      const now = new Date();
      await tx
        .update(expenses)
        .set({ voidedAt: now, voidedByUserId: userId, voidReason: body.reason, updatedAt: now })
        .where(and(eq(expenses.id, id), isNull(expenses.voidedAt)));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: null,
        actorUserId: userId,
        action: 'expense.voided',
        entityType: 'expense',
        entityId: id,
        before: { category: row.category, amountRwf: Number(row.amountRwf) },
        after: { voided: true },
        reason: body.reason,
      });
      return present(row);
    });
  }
}

function present(row: typeof expenses.$inferSelect): PosExpenseRow {
  return {
    id: row.id,
    paidOn: row.paidOn,
    category: row.category,
    amountRwf: Number(row.amountRwf),
    method: row.method,
    payeeName: row.payeeName,
    note: row.note,
  };
}
