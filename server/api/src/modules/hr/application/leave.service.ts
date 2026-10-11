import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { LeaveRepository, type LeaveRequestRow } from '../infrastructure/leave.repository';
import {
  DEFAULT_ENTITLEMENT,
  workOutAllowance,
  yearAllowance,
  type LeaveKind,
} from './leave-entitlement';

const LEAVE_KINDS: readonly LeaveKind[] = ['annual', 'sick', 'unpaid', 'other'];
const DAY_MS = 1000 * 60 * 60 * 24;

/** A leave type's rule as it applies: what the business saved, and the default wherever it saved nothing. */
export interface LeaveRule {
  leaveType: LeaveKind;
  isUnpaid: boolean;
  carryForward: boolean;
  applicableAfterDays: number;
  maxConsecutiveDays: number | null;
  /** Days a year an allowance is worked out from. Null: this type has no allowance. */
  yearlyDays: number | null;
  seniorityEveryYears: number | null;
  seniorityExtraDays: number | null;
  seniorityCapDays: number | null;
}

/**
 * Where an allowance came from: `manual` is a figure HR typed, `automatic` is
 * worked out from the rule, `none` is a type with no allowance at all.
 */
export type AllowanceSource = 'manual' | 'automatic' | 'none';

/** One employee record's allowance and days used, for one leave type. */
export interface LeaveBalance {
  departmentMemberId: string;
  leaveType: LeaveKind;
  allocated: number;
  used: number;
  source: AllowanceSource;
  /** Days of the allowance brought over from last year. */
  carried: number;
  /** How an automatic allowance was reached, in words. Null for one set by hand. */
  basis: string | null;
}

export interface LeaveSummary {
  allocated: number;
  used: number;
  remaining: number;
  source: AllowanceSource;
  carried: number;
  basis: string | null;
}

/** Days a stretch of leave covers, both ends counted. */
const daysOf = (r: { startDate: string; endDate: string }): number =>
  (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / DAY_MS + 1;

/**
 * Leave: requests, the rules for each type, and what everybody has left (HR
 * module, Phase 4).
 *
 * AN ALLOWANCE IS WORKED OUT, NOT KEPT. Nobody types eighteen beside every
 * name each January: a person's days follow from the type's rule and the day
 * they started (`leave-entitlement.ts`), read fresh each time, so a rule
 * changed today is everybody's allowance today. A figure HR types for one
 * person still replaces the rule for that person, type and year, and "back to
 * automatic" deletes it again.
 *
 * ONE ALLOWANCE PER PERSON, not per department record. Somebody who works in
 * two departments has two records; the worked-out allowance sits on one of
 * them (their primary, or their first) so that adding their records up gives
 * what the person has, not double it.
 *
 * EVERY ID IS CHECKED AGAINST THE WORKSPACE. A request id and a member id
 * arrive from a caller, so deciding a request and setting an allowance both
 * look the row up inside the workspace the guard proved.
 */
@Injectable()
export class LeaveService {
  constructor(private readonly leave: LeaveRepository) {}

  async list(ws: WorkspaceAccess): Promise<LeaveRequestRow[]> {
    return this.leave.listForWorkspace(ws.workspaceId);
  }

  /** Enforces applicableAfterDays, if the workspace has set one for this type. */
  async createRequest(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    leaveType: LeaveKind,
    startDate: string,
    endDate: string,
    reason?: string,
  ): Promise<{ id: string }> {
    const isDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
    if (!LEAVE_KINDS.includes(leaveType)) throw new BadRequestException('Choose a leave type.');
    if (!isDay(startDate) || !isDay(endDate)) {
      throw new BadRequestException('Choose the first and last day of the leave.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('The last day cannot be before the first day.');
    }
    if (!(await this.leave.memberInWorkspace(ws.workspaceId, departmentMemberId))) {
      throw new NotFoundException('That employee is not in this workspace.');
    }

    // Two requests for the same days would count those days twice against the
    // allowance, and leave somebody approved for leave they are already on.
    const clash = await this.leave.findOverlap(ws.workspaceId, departmentMemberId, startDate, endDate);
    if (clash) {
      throw new ConflictException(
        `There is already leave ${clash.status === 'approved' ? 'approved' : 'waiting'} from ${clash.startDate} to ${clash.endDate}.`,
      );
    }

    const settings = await this.leave.getTypeSettings(ws.workspaceId, leaveType);
    if (settings && settings.applicableAfterDays > 0) {
      const hireDate = await this.leave.getHireDate(departmentMemberId);
      if (hireDate) {
        const daysEmployed = Math.floor((new Date(startDate).getTime() - hireDate.getTime()) / DAY_MS);
        if (daysEmployed < settings.applicableAfterDays) {
          throw new BadRequestException(
            `This leave type is only available after ${settings.applicableAfterDays} days of employment.`,
          );
        }
      }
    }

    return this.leave.createRequest(ws.workspaceId, departmentMemberId, leaveType, startDate, endDate, reason);
  }

  async decide(
    ws: WorkspaceAccess,
    requestId: string,
    status: 'approved' | 'rejected',
    userId: string,
  ): Promise<void> {
    if (status !== 'approved' && status !== 'rejected') {
      throw new BadRequestException('Say whether the request is approved or rejected.');
    }
    if (!(await this.leave.decide(ws.workspaceId, requestId, status, userId))) {
      throw new NotFoundException('That leave request is not in this workspace.');
    }
  }

  // --- Rules ---------------------------------------------------------------

  /** Every leave type's rule as it applies, the four of them, saved or not. */
  async listTypeSettings(ws: WorkspaceAccess): Promise<LeaveRule[]> {
    const saved = await this.leave.listTypeSettings(ws.workspaceId);
    return LEAVE_KINDS.map((leaveType) => {
      const row = saved.find((s) => s.leaveType === leaveType);
      const defaults = DEFAULT_ENTITLEMENT[leaveType];
      return {
        leaveType,
        isUnpaid: row?.isUnpaid ?? leaveType === 'unpaid',
        carryForward: row?.carryForward ?? false,
        applicableAfterDays: row?.applicableAfterDays ?? 0,
        maxConsecutiveDays: row?.maxConsecutiveDays ?? null,
        // A column left null is "the default", so a rule saved before
        // allowances were worked out still gets its days a year.
        yearlyDays: row?.yearlyDays ?? defaults.yearlyDays,
        seniorityEveryYears: row?.seniorityEveryYears ?? defaults.seniorityEveryYears,
        seniorityExtraDays: row?.seniorityExtraDays ?? defaults.seniorityExtraDays,
        seniorityCapDays: row?.seniorityCapDays ?? defaults.seniorityCapDays,
      };
    });
  }

  async setTypeSettings(
    ws: WorkspaceAccess,
    leaveType: LeaveKind,
    settings: {
      isUnpaid: boolean;
      carryForward: boolean;
      applicableAfterDays: number;
      maxConsecutiveDays?: number;
      yearlyDays?: number | null;
      seniorityEveryYears?: number | null;
      seniorityExtraDays?: number | null;
      seniorityCapDays?: number | null;
    },
  ): Promise<void> {
    if (!LEAVE_KINDS.includes(leaveType)) throw new BadRequestException('Choose a leave type.');
    // A whole number in a range, or left out; anything else is refused in words.
    const whole = (value: number | null | undefined, low: number, high: number, what: string): number | null | undefined => {
      if (value === undefined || value === null) return value;
      const n = Number(value);
      if (!Number.isInteger(n) || n < low || n > high) {
        throw new BadRequestException(`${what} is a whole number between ${low} and ${high}.`);
      }
      return n;
    };
    await this.leave.setTypeSettings(ws.workspaceId, leaveType, {
      isUnpaid: Boolean(settings.isUnpaid),
      carryForward: Boolean(settings.carryForward),
      applicableAfterDays: whole(settings.applicableAfterDays, 0, 3650, 'The waiting period') ?? 0,
      maxConsecutiveDays: whole(settings.maxConsecutiveDays, 1, 366, 'The longest stretch') ?? undefined,
      yearlyDays: whole(settings.yearlyDays, 0, 366, 'Days a year'),
      seniorityEveryYears: whole(settings.seniorityEveryYears, 1, 50, 'The years between long service days'),
      seniorityExtraDays: whole(settings.seniorityExtraDays, 0, 30, 'The days long service adds'),
      seniorityCapDays: whole(settings.seniorityCapDays, 0, 366, 'The most long service can add'),
    });
  }

  // --- Allowances ----------------------------------------------------------

  /**
   * Every employee record's allowance and days used for a year, in one read:
   * what the allowances table on the Leave tab is drawn from, and what an
   * employee's own balance is added up from.
   */
  async balances(ws: WorkspaceAccess, year: number): Promise<{ year: number; balances: LeaveBalance[] }> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Choose a year.');
    }
    const [members, hires, rules, manual, manualBefore, approved, approvedBefore] = await Promise.all([
      this.leave.listActiveMembers(ws.workspaceId),
      this.leave.listHireDates(ws.workspaceId),
      this.listTypeSettings(ws),
      this.leave.listBalances(ws.workspaceId, year),
      this.leave.listBalances(ws.workspaceId, year - 1),
      this.leave.listApproved(ws.workspaceId, year),
      this.leave.listApproved(ws.workspaceId, year - 1),
    ]);

    // A person is their account; somebody with no account is their own record.
    const people = new Map<string, typeof members>();
    for (const m of members) {
      const key = m.userId ?? m.id;
      people.set(key, [...(people.get(key) ?? []), m]);
    }

    const out: LeaveBalance[] = [];
    for (const records of people.values()) {
      const ids = new Set(records.map((r) => r.id));
      // The record that carries a worked-out allowance: their primary, or their first.
      const holder = records.find((r) => r.isPrimary) ?? [...records].sort((a, b) => a.id.localeCompare(b.id))[0];
      // The day they first started, on any of their records.
      const started = records
        .map((r) => hires.get(r.id))
        .filter((d): d is Date => d !== undefined)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const hiredOn = started ? started.toISOString().slice(0, 10) : null;

      for (const leaveType of LEAVE_KINDS) {
        const rule = rules.find((r) => r.leaveType === leaveType)!;
        const mine = <T extends { departmentMemberId: string; leaveType: string }>(rows: readonly T[]): T[] =>
          rows.filter((r) => r.leaveType === leaveType && ids.has(r.departmentMemberId));
        const usedBy = new Map<string, number>();
        for (const r of mine(approved)) usedBy.set(r.departmentMemberId, (usedBy.get(r.departmentMemberId) ?? 0) + daysOf(r));
        const typed = mine(manual);

        if (typed.length > 0) {
          // Set by hand, on whichever of their records HR put it.
          for (const record of records) {
            const row = typed.find((t) => t.departmentMemberId === record.id);
            const used = usedBy.get(record.id) ?? 0;
            if (!row && used === 0) continue;
            out.push({ departmentMemberId: record.id, leaveType, allocated: row?.allocatedDays ?? 0, used, source: 'manual', carried: 0, basis: null });
          }
          continue;
        }

        // What last year left, where the type carries over and they were here for it.
        let previous: { allowance: number; used: number } | null = null;
        if (rule.carryForward && hiredOn && Number(hiredOn.slice(0, 4)) < year) {
          const typedBefore = mine(manualBefore);
          previous = {
            allowance:
              typedBefore.length > 0
                ? typedBefore.reduce((n, r) => n + r.allocatedDays, 0)
                : (yearAllowance(rule, hiredOn, year - 1) ?? 0),
            used: mine(approvedBefore).reduce((n, r) => n + daysOf(r), 0),
          };
        }
        const worked = workOutAllowance({ rule, hiredOn, year, previous });

        for (const record of records) {
          const used = usedBy.get(record.id) ?? 0;
          const holds = worked !== null && record.id === holder.id;
          if (!holds && used === 0) continue;
          out.push({
            departmentMemberId: record.id,
            leaveType,
            allocated: holds ? worked.days : 0,
            used,
            source: worked ? 'automatic' : 'none',
            carried: holds ? worked.carried : 0,
            basis: holds ? worked.basis : null,
          });
        }
      }
    }
    return { year, balances: out };
  }

  /** What some records add up to for one leave type: one person's balance when the records are theirs. */
  async summaryFor(
    ws: WorkspaceAccess,
    departmentMemberIds: readonly string[],
    leaveType: LeaveKind,
    year: number,
  ): Promise<LeaveSummary> {
    const { balances } = await this.balances(ws, year);
    return this.summarise(balances, departmentMemberIds, leaveType);
  }

  /** The same sum over balances already read, so several types cost one read. */
  summarise(balances: readonly LeaveBalance[], departmentMemberIds: readonly string[], leaveType: LeaveKind): LeaveSummary {
    const ids = new Set(departmentMemberIds);
    const rows = balances.filter((b) => b.leaveType === leaveType && ids.has(b.departmentMemberId));
    const allocated = rows.reduce((n, b) => n + b.allocated, 0);
    const used = rows.reduce((n, b) => n + b.used, 0);
    return {
      allocated,
      used,
      remaining: allocated - used,
      source: rows.some((b) => b.source === 'manual') ? 'manual' : rows.some((b) => b.source === 'automatic') ? 'automatic' : 'none',
      carried: rows.reduce((n, b) => n + b.carried, 0),
      basis: rows.find((b) => b.basis)?.basis ?? null,
    };
  }

  /** Set one record's allowance by hand. It replaces the rule for that person, type and year. */
  async setBalance(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    leaveType: LeaveKind,
    year: number,
    allocatedDays: number,
  ): Promise<void> {
    const days = Math.round(Number(allocatedDays));
    if (!LEAVE_KINDS.includes(leaveType)) throw new BadRequestException('Choose a leave type.');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Choose a year.');
    if (!Number.isFinite(days) || days < 0 || days > 366) {
      throw new BadRequestException('Enter a number of days between 0 and 366.');
    }
    if (!(await this.leave.memberInWorkspace(ws.workspaceId, departmentMemberId))) {
      throw new NotFoundException('That employee is not in this workspace.');
    }
    await this.leave.setBalance(ws.workspaceId, departmentMemberId, leaveType, year, days);
  }

  /** The same allowance for every employee, one per person, set by hand. */
  async setBalanceForEveryone(
    ws: WorkspaceAccess,
    leaveType: LeaveKind,
    year: number,
    allocatedDays: number,
  ): Promise<{ people: number }> {
    const days = Math.round(Number(allocatedDays));
    if (!Number.isFinite(days) || days < 0 || days > 366) {
      throw new BadRequestException('Enter a number of days between 0 and 366.');
    }
    const people = await this.leave.setBalanceForEveryone(ws.workspaceId, leaveType, year, days);
    return { people };
  }

  /**
   * Hand allowances back to the rule: forget the figures set by hand for a
   * year, for the records named or for everybody, for one type or for all.
   */
  async resetBalances(
    ws: WorkspaceAccess,
    body: { year?: number; leaveType?: LeaveKind; departmentMemberIds?: string[] },
  ): Promise<{ reset: number }> {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Choose a year.');
    if (body.leaveType !== undefined && !LEAVE_KINDS.includes(body.leaveType)) {
      throw new BadRequestException('Choose a leave type.');
    }
    if (body.departmentMemberIds !== undefined && !Array.isArray(body.departmentMemberIds)) {
      throw new BadRequestException('Say whose allowance to hand back.');
    }
    const reset = await this.leave.deleteBalances(ws.workspaceId, year, {
      leaveType: body.leaveType,
      departmentMemberIds: body.departmentMemberIds,
    });
    return { reset };
  }
}
