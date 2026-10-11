import type { KioskStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';

import {
  attendanceKiosks,
  employeeKioskPins,
  employees,
  kioskPinLocks,
  properties,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Tx } from './employees.repository';

/** Five wrong PINs lock a person on a kiosk for fifteen minutes (058-time AC-TM10). */
export const PIN_FAILURES_TO_LOCK = 5;
export const PIN_LOCK_MS = 15 * 60_000;

export interface KioskRow {
  id: string;
  orgId: string;
  propertyId: string;
  branchName: string;
  name: string;
  status: KioskStatus;
  allowedIps: string[];
  lastSeenAt: Date | null;
  pairingExpiresAt: Date | null;
  createdAt: Date;
}

export interface PinLockState {
  failedCount: number;
  lockedUntil: Date | null;
}

const kioskColumns = {
  id: attendanceKiosks.id,
  orgId: attendanceKiosks.orgId,
  propertyId: attendanceKiosks.propertyId,
  branchName: properties.name,
  name: attendanceKiosks.name,
  status: attendanceKiosks.status,
  allowedIps: attendanceKiosks.allowedIps,
  lastSeenAt: attendanceKiosks.lastSeenAt,
  pairingExpiresAt: attendanceKiosks.pairingExpiresAt,
  createdAt: attendanceKiosks.createdAt,
};

/**
 * Kiosks, PINs and the wrong PIN locks (ADR-058, 058-time AC-TM10, AC-TM11).
 * The only place that touches Drizzle for them. A token, a pairing code and a
 * PIN arrive here already hashed; nothing here sees one in the clear.
 */
@Injectable()
export class KioskRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Kiosks ------------------------------------------------------------------

  async list(orgId: string, scope: BranchScope): Promise<KioskRow[]> {
    return this.db
      .select(kioskColumns)
      .from(attendanceKiosks)
      .innerJoin(properties, eq(properties.id, attendanceKiosks.propertyId))
      .where(and(eq(attendanceKiosks.orgId, orgId), inBranchScope(attendanceKiosks.propertyId, scope)))
      .orderBy(asc(properties.name), asc(attendanceKiosks.name));
  }

  async find(id: string): Promise<KioskRow | null> {
    const [row] = await this.db
      .select(kioskColumns)
      .from(attendanceKiosks)
      .innerJoin(properties, eq(properties.id, attendanceKiosks.propertyId))
      .where(eq(attendanceKiosks.id, id))
      .limit(1);
    return row ?? null;
  }

  async insert(
    tx: Tx,
    values: {
      orgId: string;
      propertyId: string;
      name: string;
      allowedIps: string[];
      pairingCodeHash: string;
      pairingExpiresAt: Date;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(attendanceKiosks).values({ ...values, status: 'pairing' }).returning({ id: attendanceKiosks.id });
    return row.id;
  }

  /** A fresh pairing code for a kiosk not revoked. A paired kiosk keeps working until the new device pairs. */
  async setPairingCode(tx: Tx, id: string, codeHash: string, expiresAt: Date): Promise<boolean> {
    const rows = await tx
      .update(attendanceKiosks)
      .set({ pairingCodeHash: codeHash, pairingExpiresAt: expiresAt, updatedAt: new Date() })
      .where(and(eq(attendanceKiosks.id, id), ne(attendanceKiosks.status, 'revoked')))
      .returning({ id: attendanceKiosks.id });
    return rows.length > 0;
  }

  /**
   * Trade a live pairing code for a device token, once: the code is cleared in
   * the same statement, so of two tablets racing one code, one pairs.
   */
  async pair(tx: Tx, codeHash: string, tokenHash: string, now: Date): Promise<{ id: string; orgId: string; allowedIps: string[] } | null> {
    const [row] = await tx
      .update(attendanceKiosks)
      .set({
        tokenHash,
        status: 'active',
        pairingCodeHash: null,
        pairingExpiresAt: null,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceKiosks.pairingCodeHash, codeHash),
          gt(attendanceKiosks.pairingExpiresAt, now),
          ne(attendanceKiosks.status, 'revoked'),
        ),
      )
      .returning({ id: attendanceKiosks.id, orgId: attendanceKiosks.orgId, allowedIps: attendanceKiosks.allowedIps });
    return row ?? null;
  }

  /** What a live code would pair, without spending it: the IP list is checked before the trade. */
  async byPairingCode(codeHash: string, now: Date): Promise<{ id: string; allowedIps: string[] } | null> {
    const [row] = await this.db
      .select({ id: attendanceKiosks.id, allowedIps: attendanceKiosks.allowedIps })
      .from(attendanceKiosks)
      .where(
        and(
          eq(attendanceKiosks.pairingCodeHash, codeHash),
          gt(attendanceKiosks.pairingExpiresAt, now),
          ne(attendanceKiosks.status, 'revoked'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** The active kiosk a device token names. A revoked kiosk has no token, so its cookie names nothing. */
  async byToken(tokenHash: string): Promise<KioskRow | null> {
    const [row] = await this.db
      .select(kioskColumns)
      .from(attendanceKiosks)
      .innerJoin(properties, eq(properties.id, attendanceKiosks.propertyId))
      .where(and(eq(attendanceKiosks.tokenHash, tokenHash), eq(attendanceKiosks.status, 'active')))
      .limit(1);
    return row ?? null;
  }

  /** Seen now; written at most once a minute per kiosk. */
  async touch(id: string, now: Date): Promise<void> {
    await this.db
      .update(attendanceKiosks)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(attendanceKiosks.id, id),
          sql`(${attendanceKiosks.lastSeenAt} IS NULL OR ${attendanceKiosks.lastSeenAt} < ${new Date(now.getTime() - 60_000)})`,
        ),
      );
  }

  /** Revoking is final and stops the cookie at once: the token hash goes with it. */
  async revoke(tx: Tx, id: string, now: Date): Promise<boolean> {
    const rows = await tx
      .update(attendanceKiosks)
      .set({ status: 'revoked', tokenHash: null, pairingCodeHash: null, pairingExpiresAt: null, revokedAt: now, updatedAt: now })
      .where(and(eq(attendanceKiosks.id, id), ne(attendanceKiosks.status, 'revoked')))
      .returning({ id: attendanceKiosks.id });
    return rows.length > 0;
  }

  // --- People at a kiosk ----------------------------------------------------------

  /** The active file with this number at this branch, or null: the kiosk never learns which part missed. */
  async personAtBranch(orgId: string, propertyId: string, employeeNumber: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.orgId, orgId),
          eq(employees.workPropertyId, propertyId),
          eq(employees.status, 'active'),
          sql`upper(${employees.employeeNumber}) = upper(${employeeNumber})`,
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  // --- PINs ------------------------------------------------------------------

  async pinOf(employeeId: string): Promise<{ pinHash: string; setAt: Date } | null> {
    const [row] = await this.db
      .select({ pinHash: employeeKioskPins.pinHash, setAt: employeeKioskPins.setAt })
      .from(employeeKioskPins)
      .where(eq(employeeKioskPins.employeeId, employeeId))
      .limit(1);
    return row ?? null;
  }

  async putPin(tx: Tx, values: { employeeId: string; orgId: string; pinHash: string; setByUserId: string | null }): Promise<void> {
    const now = new Date();
    await tx
      .insert(employeeKioskPins)
      .values({ ...values, setAt: now })
      .onConflictDoUpdate({
        target: employeeKioskPins.employeeId,
        set: { pinHash: values.pinHash, setByUserId: values.setByUserId, setAt: now },
      });
  }

  // --- Wrong PIN locks ---------------------------------------------------------

  async lockOf(kioskId: string | null, employeeId: string): Promise<PinLockState | null> {
    const [row] = await this.db
      .select({ failedCount: kioskPinLocks.failedCount, lockedUntil: kioskPinLocks.lockedUntil })
      .from(kioskPinLocks)
      .where(
        and(
          kioskId ? eq(kioskPinLocks.kioskId, kioskId) : isNull(kioskPinLocks.kioskId),
          eq(kioskPinLocks.employeeId, employeeId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Count one wrong PIN. The fifth in a row locks the person on that kiosk (or,
   * for a self service change, on the row with no kiosk) and starts the count
   * again. One statement, so two wrong PINs at once both count.
   */
  async recordFailure(orgId: string, kioskId: string | null, employeeId: string, now: Date): Promise<PinLockState> {
    const lockAt = new Date(now.getTime() + PIN_LOCK_MS);
    const [row] = await this.db
      .insert(kioskPinLocks)
      .values({ orgId, kioskId, employeeId, failedCount: 1, lockedUntil: null, updatedAt: now })
      .onConflictDoUpdate({
        // The constraint is NULLS NOT DISTINCT, so the no kiosk row conflicts too.
        target: [kioskPinLocks.kioskId, kioskPinLocks.employeeId],
        set: {
          failedCount: sql`CASE WHEN ${kioskPinLocks.failedCount} + 1 >= ${PIN_FAILURES_TO_LOCK} THEN 0 ELSE ${kioskPinLocks.failedCount} + 1 END`,
          lockedUntil: sql`CASE WHEN ${kioskPinLocks.failedCount} + 1 >= ${PIN_FAILURES_TO_LOCK} THEN ${lockAt}::timestamptz ELSE ${kioskPinLocks.lockedUntil} END`,
          updatedAt: now,
        },
      })
      .returning({ failedCount: kioskPinLocks.failedCount, lockedUntil: kioskPinLocks.lockedUntil });
    return row;
  }

  /** A right PIN, or a holder of `attendance.record` lifting the lock, clears the count. */
  async clearFailures(kioskId: string | null, employeeId: string): Promise<void> {
    await this.db
      .delete(kioskPinLocks)
      .where(
        and(
          kioskId ? eq(kioskPinLocks.kioskId, kioskId) : isNull(kioskPinLocks.kioskId),
          eq(kioskPinLocks.employeeId, employeeId),
        ),
      );
  }

  /** A PIN reset lifts every lock the person holds, on every kiosk. */
  async clearAllFailures(tx: Tx, employeeId: string): Promise<void> {
    await tx.delete(kioskPinLocks).where(eq(kioskPinLocks.employeeId, employeeId));
  }
}
