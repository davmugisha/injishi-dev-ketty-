import type {
  ChangeMyKioskPinRequest,
  CreateKioskRequest,
  Kiosk,
  KioskList,
  KioskPairingCode,
  KioskPinState,
  KioskPunchRequest,
  KioskPunchResult,
  KioskSession,
  SetKioskPinRequest,
  UnlockKioskPinRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { KioskRepository, type KioskRow } from '../infrastructure/kiosk.repository';
import {
  HR_PIN_PEPPER,
  hashPin,
  newDeviceToken,
  newPairingCode,
  sha256Hex,
  verifyPin,
} from '../infrastructure/pin-hash';
import { TimeRepository } from '../infrastructure/time.repository';
import { displayNameOf } from './employee-presenter';
import { assertBranchInReach, assertPersonInReach, orgOf } from './hr-access';
import { TimeService } from './time.service';

const PAIRING_MS = 10 * 60_000;
/** A punch this soon after the same person's last is a double tap (AC-TM10). */
const DOUBLE_TAP_MS = 60_000;

/** The kiosk a device cookie resolved to: what `KioskGuard` hangs on the request. */
export interface KioskContext {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  branchName: string;
}

/** One message for every miss, so the kiosk never says which part was wrong or that a number exists. */
const MISMATCH = 'That employee number and PIN do not match.';

/**
 * Kiosks and PINs (ADR-058, 058-time AC-TM10, AC-TM11).
 *
 * A kiosk is a shared tablet at a branch. It pairs once with a code the
 * operator app shows for ten minutes, and from then on carries a device token
 * in an HttpOnly cookie; only hashes of either are kept. It never lists
 * people: a person types their number and PIN, and only a right PIN earns the
 * kiosk their name. Kiosk punches are validated as they are written, because
 * the PIN plus standing at the desk is the proof (058-time, calls made while
 * writing).
 */
@Injectable()
export class KioskService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly kiosks: KioskRepository,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly timeService: TimeService,
    @Inject(HR_PIN_PEPPER) private readonly pepper: string,
  ) {}

  // --- The operator side (`attendance.record` at the kiosk's branch) ----------------------------

  async list(ws: ScopedWorkspace): Promise<KioskList> {
    const rows = await this.kiosks.list(orgOf(ws), ws.branchScope);
    return { kiosks: rows.map(presentKiosk) };
  }

  /** `POST /ops/attendance/kiosks`: the code is shown once, here. */
  async create(ws: ScopedWorkspace, userId: string, body: CreateKioskRequest): Promise<KioskPairingCode> {
    const orgId = orgOf(ws);
    const property = assertOwnedByOrg(await this.employees.findProperty(body.propertyId), ws);
    assertInBranchScope(ws, property.id);
    assertBranchInReach(ws, property.id);
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_MS);
    const allowedIps = [...new Set((body.allowedIps ?? []).map(normalIp))];
    const id = await this.db.transaction(async (tx) => {
      const created = await this.kiosks.insert(tx, {
        orgId,
        propertyId: property.id,
        name: body.name.trim(),
        allowedIps,
        pairingCodeHash: sha256Hex(code),
        pairingExpiresAt: expiresAt,
        createdByUserId: userId,
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.kiosk_created',
        orgId,
        diff: { kioskId: created, propertyId: property.id, allowedIps },
      });
      return created;
    });
    return { kiosk: presentKiosk(await this.row(id)), pairingCode: code, expiresAt: expiresAt.toISOString() };
  }

  /** `POST /ops/attendance/kiosks/:id/pairing-code`: a new tablet, or the old code ran out. */
  async newPairingCode(ws: ScopedWorkspace, userId: string, id: string): Promise<KioskPairingCode> {
    const kiosk = await this.inReach(ws, id);
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_MS);
    await this.db.transaction(async (tx) => {
      if (!(await this.kiosks.setPairingCode(tx, kiosk.id, sha256Hex(code), expiresAt))) {
        throw new ConflictException('This kiosk was revoked. Add a new one instead.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: kiosk.orgId,
        eventType: 'hr.kiosk_code_issued',
        orgId: kiosk.orgId,
        diff: { kioskId: kiosk.id },
      });
    });
    return { kiosk: presentKiosk(await this.row(kiosk.id)), pairingCode: code, expiresAt: expiresAt.toISOString() };
  }

  /** `POST /ops/attendance/kiosks/:id/revoke`: final, and its cookie stops at once. */
  async revoke(ws: ScopedWorkspace, userId: string, id: string): Promise<Kiosk> {
    const kiosk = await this.inReach(ws, id);
    await this.db.transaction(async (tx) => {
      if (!(await this.kiosks.revoke(tx, kiosk.id, new Date()))) throw new ConflictException('This kiosk is already revoked.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: kiosk.orgId,
        eventType: 'hr.kiosk_revoked',
        orgId: kiosk.orgId,
        diff: { kioskId: kiosk.id },
      });
    });
    return presentKiosk(await this.row(kiosk.id));
  }

  /** `POST /ops/attendance/kiosks/:id/unlock-pin`: lift a person's wrong PIN lock on this kiosk. */
  async unlockPin(ws: ScopedWorkspace, userId: string, id: string, body: UnlockKioskPinRequest): Promise<void> {
    const kiosk = await this.inReach(ws, id);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    await this.kiosks.clearFailures(kiosk.id, employee.id);
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: employee.id,
      eventType: 'hr.kiosk_pin_unlocked',
      orgId: kiosk.orgId,
      diff: { kioskId: kiosk.id },
    });
  }

  // --- PINs (AC-TM11) ------------------------------------------------------------

  async pinState(ws: ScopedWorkspace, employeeId: string): Promise<KioskPinState> {
    const employee = assertOwnedByOrg(await this.employees.find(employeeId), ws);
    assertInBranchScope(ws, employee.workPropertyId);
    return this.ownPinState(employee.id);
  }

  /** Whether a person has a PIN, and since when: never the PIN. */
  async ownPinState(employeeId: string): Promise<KioskPinState> {
    const pin = await this.kiosks.pinOf(employeeId);
    return { hasPin: pin !== null, setAt: pin ? pin.setAt.toISOString() : null };
  }

  /** `PUT /ops/employees/:id/kiosk-pin`: set or reset. Never shown again; a reset lifts every lock. */
  async setPin(ws: ScopedWorkspace, userId: string, employeeId: string, body: SetKioskPinRequest): Promise<KioskPinState> {
    const employee = assertOwnedByOrg(await this.employees.find(employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left.`);
    const had = (await this.kiosks.pinOf(employee.id)) !== null;
    const pinHash = await hashPin(body.pin, this.pepper);
    await this.db.transaction(async (tx) => {
      await this.kiosks.putPin(tx, { employeeId: employee.id, orgId: employee.orgId, pinHash, setByUserId: userId });
      await this.kiosks.clearAllFailures(tx, employee.id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: had ? 'hr.kiosk_pin_reset' : 'hr.kiosk_pin_set',
        orgId: employee.orgId,
      });
    });
    return this.pinState(ws, employee.id);
  }

  /**
   * `PUT /me/work/:employeeId/kiosk-pin`: the person changes their own, proving
   * it with the current one. Wrong guesses count on the lock row with no kiosk,
   * so self service is no back door round the kiosk's lock (AC-TM11).
   */
  async changeMyPin(employee: EmployeeRow, userId: string, body: ChangeMyKioskPinRequest): Promise<KioskPinState> {
    const now = new Date();
    await this.assertNotLocked(null, employee.id, now);
    const pin = await this.kiosks.pinOf(employee.id);
    if (!pin) throw new ConflictException('You have no kiosk PIN yet. Ask whoever runs attendance at your branch to set one.');
    if (!(await verifyPin(body.currentPin, pin.pinHash, this.pepper))) {
      const state = await this.kiosks.recordFailure(employee.orgId, null, employee.id, now);
      if (state.lockedUntil && state.lockedUntil > now) throw lockedError(state.lockedUntil, now);
      throw new UnprocessableEntityException({ code: 'pin_mismatch', message: 'That is not your current PIN.' });
    }
    const pinHash = await hashPin(body.pin, this.pepper);
    await this.db.transaction(async (tx) => {
      await this.kiosks.putPin(tx, { employeeId: employee.id, orgId: employee.orgId, pinHash, setByUserId: userId });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.kiosk_pin_changed',
        orgId: employee.orgId,
      });
    });
    await this.kiosks.clearFailures(null, employee.id);
    return this.ownPinState(employee.id);
  }

  // --- The device side (`/kiosk/*`) -------------------------------------------------------

  /**
   * `POST /kiosk/pair`: trade the code for a device token. The token goes back
   * to the controller for the cookie and is never in a response body.
   */
  async pair(rawCode: string, ip: string | undefined): Promise<{ token: string; session: KioskSession }> {
    const now = new Date();
    const codeHash = sha256Hex(rawCode.trim());
    const pending = await this.kiosks.byPairingCode(codeHash, now);
    if (!pending) throw new UnprocessableEntityException('That code is wrong or has run out. Ask for a new one.');
    if (!ipAllowed(pending.allowedIps, ip)) {
      throw new ForbiddenException('This kiosk only works from the addresses it was set up for.');
    }
    const token = newDeviceToken();
    const paired = await this.db.transaction(async (tx) => {
      const row = await this.kiosks.pair(tx, codeHash, sha256Hex(token), now);
      if (!row) return null;
      await writeHrAudit(tx, {
        actorUserId: null,
        subjectType: 'org',
        subjectId: row.orgId,
        eventType: 'hr.kiosk_paired',
        orgId: row.orgId,
        diff: { kioskId: row.id, source: 'kiosk' },
      });
      return row;
    });
    if (!paired) throw new UnprocessableEntityException('That code is wrong or has run out. Ask for a new one.');
    const kiosk = await this.row(paired.id);
    return { token, session: { kioskName: kiosk.name, branchName: kiosk.branchName } };
  }

  /** What `KioskGuard` asks: the active kiosk this token names, from an allowed address. */
  async resolve(token: string, ip: string | undefined): Promise<KioskContext | null> {
    const kiosk = await this.kiosks.byToken(sha256Hex(token));
    if (!kiosk || !ipAllowed(kiosk.allowedIps, ip)) return null;
    await this.kiosks.touch(kiosk.id, new Date());
    return { id: kiosk.id, orgId: kiosk.orgId, propertyId: kiosk.propertyId, name: kiosk.name, branchName: kiosk.branchName };
  }

  session(kiosk: KioskContext): KioskSession {
    return { kioskName: kiosk.name, branchName: kiosk.branchName };
  }

  /**
   * `POST /kiosk/punch`: in when the person has no open record, else out.
   * Only somebody working at the kiosk's branch can punch at it.
   */
  async punch(kiosk: KioskContext, body: KioskPunchRequest): Promise<KioskPunchResult> {
    const now = new Date();
    const employeeId = await this.kiosks.personAtBranch(kiosk.orgId, kiosk.propertyId, body.employeeNumber.trim());
    if (!employeeId) throw new UnprocessableEntityException({ code: 'pin_mismatch', message: MISMATCH });
    await this.assertNotLocked(kiosk.id, employeeId, now);
    const pin = await this.kiosks.pinOf(employeeId);
    if (!pin || !(await verifyPin(body.pin, pin.pinHash, this.pepper))) {
      const state = await this.kiosks.recordFailure(kiosk.orgId, kiosk.id, employeeId, now);
      if (state.lockedUntil && state.lockedUntil > now) throw lockedError(state.lockedUntil, now);
      throw new UnprocessableEntityException({ code: 'pin_mismatch', message: MISMATCH });
    }
    await this.kiosks.clearFailures(kiosk.id, employeeId);
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    const last = await this.time.lastPunchAt(employee.id);
    if (last && now.getTime() - last.getTime() < DOUBLE_TAP_MS) {
      throw new ConflictException({ code: 'double_tap', message: 'You punched a moment ago, so this one was not counted.' });
    }
    const open = await this.time.findOpenRecord(employee.id);
    if (open) {
      await this.timeService.punchOut({ record: open, at: now, userId: null, kioskId: kiosk.id });
    } else {
      await this.timeService.punchIn({
        employee,
        at: now,
        source: 'kiosk',
        userId: null,
        validated: true,
        kioskId: kiosk.id,
      });
    }
    return { displayName: displayNameOf(employee), direction: open ? 'out' : 'in', at: now.toISOString() };
  }

  // --- Helpers -------------------------------------------------------------

  private async assertNotLocked(kioskId: string | null, employeeId: string, now: Date): Promise<void> {
    const lock = await this.kiosks.lockOf(kioskId, employeeId);
    if (lock?.lockedUntil && lock.lockedUntil > now) throw lockedError(lock.lockedUntil, now);
  }

  private async inReach(ws: ScopedWorkspace, id: string): Promise<KioskRow> {
    const kiosk = assertOwnedByOrg(await this.kiosks.find(id), ws);
    assertInBranchScope(ws, kiosk.propertyId);
    assertBranchInReach(ws, kiosk.propertyId);
    return kiosk;
  }

  private async row(id: string): Promise<KioskRow> {
    const row = await this.kiosks.find(id);
    if (!row) throw new NotFoundException();
    return row;
  }
}

function lockedError(until: Date, now: Date): HttpException {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return new HttpException(
    {
      code: 'pin_locked',
      message: `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask the desk to unlock it.`,
      lockedUntil: until.toISOString(),
    },
    HttpStatus.LOCKED,
  );
}

/** An IPv4 address seen through an IPv6 socket is still that IPv4 address. */
function normalIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  return trimmed.startsWith('::ffff:') && trimmed.includes('.') ? trimmed.slice(7) : trimmed;
}

/** An empty list allows any address (AC-TM10). */
export function ipAllowed(allowed: readonly string[], ip: string | undefined): boolean {
  if (allowed.length === 0) return true;
  if (!ip) return false;
  const seen = normalIp(ip);
  return allowed.some((a) => normalIp(a) === seen);
}

function presentKiosk(row: KioskRow): Kiosk {
  return {
    id: row.id,
    propertyId: row.propertyId,
    branchName: row.branchName,
    name: row.name,
    status: row.status,
    allowedIps: row.allowedIps,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    pairingExpiresAt: row.pairingExpiresAt ? row.pairingExpiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
