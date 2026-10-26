import {
  cashVariance,
  type CashMovementRequest,
  type CloseShiftRequest,
  type DecideCashMovementRequest,
  type OpenShiftRequest,
  type PosShift,
  type ReviewShiftRequest,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { cashMovements, cashierShifts, posPayments, posRegisters } from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { expectedFrom, presentShift, shiftCash } from '../infrastructure/pos-present';
import { audit, outletInScope, type Tx } from '../infrastructure/pos-support';

/**
 * The cashier's register and shift (POS spec §9): open with a float, take
 * cash in and out with a reason, close with a count, and a second person
 * reviews the variance. At close the expected cash, the count and the
 * variance are frozen on the shift row.
 */
@Injectable()
export class PosShiftService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private has(ws: ScopedWorkspace, permission: string): boolean {
    return (ws.permissions as readonly string[]).includes(permission);
  }

  private async shift(tx: Tx, ws: ScopedWorkspace, shiftId: string): Promise<typeof cashierShifts.$inferSelect> {
    const [row] = await tx
      .select()
      .from(cashierShifts)
      .where(and(eq(cashierShifts.id, shiftId), eq(cashierShifts.workspaceId, ws.workspaceId)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That shift is not available to you.');
    await outletInScope(tx, ws, row.outletId);
    return row;
  }

  private async answer(ws: ScopedWorkspace, shiftId: string): Promise<PosShift> {
    const [row] = await this.db.select().from(cashierShifts).where(eq(cashierShifts.id, shiftId)).limit(1);
    if (!row || row.workspaceId !== ws.workspaceId) throw new NotFoundException('That shift is not available to you.');
    return presentShift(this.db, row);
  }

  /** The cashier's own shift, or a reviewer's: nobody else touches a drawer. */
  private assertMineOrReviewer(ws: ScopedWorkspace, shift: { cashierUserId: string }, userId: string): void {
    if (shift.cashierUserId !== userId && !this.has(ws, 'shift.review')) {
      throw new ForbiddenException('This is another cashier’s drawer.');
    }
  }

  async open(ws: ScopedWorkspace, body: OpenShiftRequest, userId: string): Promise<PosShift> {
    const id = await this.db.transaction(async (tx) => {
      const [register] = await tx
        .select()
        .from(posRegisters)
        .where(and(eq(posRegisters.id, body.registerId), eq(posRegisters.workspaceId, ws.workspaceId), isNull(posRegisters.archivedAt)))
        .limit(1)
        .for('update');
      if (!register) throw new NotFoundException('That register is not available to you.');
      await outletInScope(tx, ws, register.outletId);
      const [busy] = await tx
        .select({ id: cashierShifts.id })
        .from(cashierShifts)
        .where(and(eq(cashierShifts.registerId, register.id), eq(cashierShifts.status, 'open')))
        .limit(1);
      if (busy) throw new ConflictException(`${register.name} already has a shift open.`);
      const [mine] = await tx
        .select({ id: cashierShifts.id })
        .from(cashierShifts)
        .where(and(eq(cashierShifts.workspaceId, ws.workspaceId), eq(cashierShifts.cashierUserId, userId), eq(cashierShifts.status, 'open')))
        .limit(1);
      if (mine) throw new ConflictException('You already have a shift open. Close it first.');
      const [shift] = await tx
        .insert(cashierShifts)
        .values({
          workspaceId: ws.workspaceId,
          outletId: register.outletId,
          registerId: register.id,
          cashierUserId: userId,
          openingFloatRwf: body.openingFloatRwf,
        })
        .returning({ id: cashierShifts.id });
      if (!shift) throw new Error('The shift did not save.');
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: register.outletId,
        actorUserId: userId,
        action: 'shift.opened',
        entityType: 'cashier_shift',
        entityId: shift.id,
        after: { register: register.name, openingFloatRwf: body.openingFloatRwf },
      });
      return shift.id;
    });
    return this.answer(ws, id);
  }

  async movement(ws: ScopedWorkspace, shiftId: string, body: CashMovementRequest, userId: string): Promise<PosShift> {
    await this.db.transaction(async (tx) => {
      const shift = await this.shift(tx, ws, shiftId);
      if (shift.status !== 'open') throw new ConflictException('That shift is closed.');
      this.assertMineOrReviewer(ws, shift, userId);
      const approved = body.kind === 'paid_in' || this.has(ws, 'shift.review');
      const now = new Date();
      const [row] = await tx
        .insert(cashMovements)
        .values({
          workspaceId: ws.workspaceId,
          shiftId: shift.id,
          kind: body.kind,
          amountRwf: body.amountRwf,
          reason: body.reason,
          status: approved ? 'approved' : 'pending_approval',
          requestedByUserId: userId,
          decidedByUserId: approved ? userId : null,
          decidedAt: approved ? now : null,
        })
        .returning({ id: cashMovements.id });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: shift.outletId,
        actorUserId: userId,
        action: `cash.${body.kind}`,
        entityType: 'cash_movement',
        entityId: row?.id ?? null,
        after: { amountRwf: body.amountRwf, status: approved ? 'approved' : 'pending_approval' },
        reason: body.reason,
      });
    });
    return this.answer(ws, shiftId);
  }

  async decideMovement(ws: ScopedWorkspace, movementId: string, body: DecideCashMovementRequest, userId: string): Promise<PosShift> {
    const shiftId = await this.db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(cashMovements)
        .where(and(eq(cashMovements.id, movementId), eq(cashMovements.workspaceId, ws.workspaceId)))
        .limit(1)
        .for('update');
      if (!m) throw new NotFoundException('That cash movement is not available to you.');
      const shift = await this.shift(tx, ws, m.shiftId);
      if (m.status !== 'pending_approval') throw new ConflictException('That has already been decided.');
      if (m.requestedByUserId === userId) throw new ForbiddenException('Someone else approves your own paid out.');
      if (shift.status !== 'open') throw new ConflictException('That shift is closed.');
      const status = body.approve ? 'approved' : 'rejected';
      await tx
        .update(cashMovements)
        .set({ status, decidedByUserId: userId, decidedAt: new Date() })
        .where(eq(cashMovements.id, m.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: shift.outletId,
        actorUserId: userId,
        action: `cash.${m.kind}.${status}`,
        entityType: 'cash_movement',
        entityId: m.id,
        before: { status: m.status },
        after: { status },
      });
      return shift.id;
    });
    return this.answer(ws, shiftId);
  }

  /**
   * Close with the counted cash. Refused while a paid out waits for approval
   * or a payment on this shift waits for its provider, because either would
   * change what the drawer should hold after the count.
   */
  async close(ws: ScopedWorkspace, shiftId: string, body: CloseShiftRequest, userId: string): Promise<PosShift> {
    await this.db.transaction(async (tx) => {
      const shift = await this.shift(tx, ws, shiftId);
      if (shift.status !== 'open') throw new ConflictException('That shift is already closed.');
      this.assertMineOrReviewer(ws, shift, userId);
      const cash = await shiftCash(tx, shift.id);
      if (cash.pendingPaidOuts > 0) throw new ConflictException('A paid out is waiting for approval. Decide it before closing.');
      const [waiting] = await tx
        .select({ id: posPayments.id })
        .from(posPayments)
        .where(and(eq(posPayments.shiftId, shift.id), inArray(posPayments.status, ['initiated', 'pending'])))
        .limit(1);
      if (waiting) throw new ConflictException('A payment taken on this shift is still waiting for its answer.');
      const expected = expectedFrom(shift.openingFloatRwf, cash);
      const variance = cashVariance(body.countedCashRwf, expected);
      const now = new Date();
      await tx
        .update(cashierShifts)
        .set({
          status: 'closed',
          closedAt: now,
          expectedCashRwf: expected,
          countedCashRwf: body.countedCashRwf,
          varianceRwf: variance,
          closeNote: body.closeNote?.trim() || null,
          handoverNote: body.handoverNote?.trim() || null,
          updatedAt: now,
        })
        .where(eq(cashierShifts.id, shift.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: shift.outletId,
        actorUserId: userId,
        action: 'shift.closed',
        entityType: 'cashier_shift',
        entityId: shift.id,
        after: { expectedCashRwf: expected, countedCashRwf: body.countedCashRwf, varianceRwf: variance },
        reason: body.closeNote ?? null,
      });
    });
    return this.answer(ws, shiftId);
  }

  async review(ws: ScopedWorkspace, shiftId: string, body: ReviewShiftRequest, userId: string): Promise<PosShift> {
    await this.db.transaction(async (tx) => {
      const shift = await this.shift(tx, ws, shiftId);
      if (shift.status !== 'closed') throw new ConflictException(shift.status === 'open' ? 'Close the shift first.' : 'Already reviewed.');
      if (shift.cashierUserId === userId) throw new ForbiddenException('Someone else reviews your own shift.');
      const now = new Date();
      await tx
        .update(cashierShifts)
        .set({ status: 'reviewed', reviewedByUserId: userId, reviewedAt: now, reviewNote: body.note?.trim() || null, updatedAt: now })
        .where(eq(cashierShifts.id, shift.id));
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: shift.outletId,
        actorUserId: userId,
        action: 'shift.reviewed',
        entityType: 'cashier_shift',
        entityId: shift.id,
        before: { varianceRwf: shift.varianceRwf },
        reason: body.note ?? null,
      });
    });
    return this.answer(ws, shiftId);
  }
}
