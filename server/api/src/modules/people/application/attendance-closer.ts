import { Injectable } from '@nestjs/common';

import { kigaliDateOf, yearOf } from '../domain/hr-calendar';
import {
  DEFAULT_ATTENDANCE_RULES,
  closeFigures,
  dayKindOf,
  linkEntry,
  type AttendanceRules,
  type DayKind,
} from '../domain/time-rules';
import type { Tx } from '../infrastructure/employees.repository';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { TimeRepository, type CloseValues, type RosterEntryRow } from '../infrastructure/time.repository';
import { TimeSettingsRepository } from '../infrastructure/time-settings.repository';

/**
 * What every way of clocking in and out shares (ADR-058, 058-time): which shift
 * a clock in links to (AC-TM15), and what a record stores when it closes
 * (AC-TM7, AC-TM8). A supervisor's punch, a phone's, a kiosk's, a correction,
 * an approved attendance request and the sweep all come through here, so the
 * figures of one record never depend on which door it came in by.
 */
@Injectable()
export class AttendanceCloser {
  constructor(
    private readonly time: TimeRepository,
    private readonly settings: TimeSettingsRepository,
    private readonly rules: HrRulesRepository,
  ) {}

  /** The policy that governs a branch: its own, else the business's, else no grace and no cutoff. */
  async rulesFor(orgId: string, propertyId: string | null, tx?: Tx): Promise<AttendanceRules> {
    const row = await this.settings.policyFor(orgId, propertyId, tx);
    if (!row) return DEFAULT_ATTENDANCE_RULES;
    return {
      graceInMinutes: row.graceInMinutes,
      graceOutMinutes: row.graceOutMinutes,
      overtimeCutoffMinutes: row.overtimeCutoffMinutes,
      overtimeAutoApprove: row.overtimeAutoApprove,
      overtimeMinMinutes: row.overtimeMinMinutes,
      linkWindowMinutes: row.linkWindowMinutes,
      staleOpenHours: row.staleOpenHours,
      defaultShiftMinutes: row.defaultShiftMinutes,
    };
  }

  /**
   * The scheduled shift a clock in belongs to, and the record's work date: the
   * shift's date when linked, else the clock in's Kigali date, so a night shift
   * that crosses midnight stays on the day it started (AC-TM15).
   */
  async link(
    input: { orgId: string; employeeId: string; propertyId: string | null; at: Date },
    tx?: Tx,
  ): Promise<{ entry: RosterEntryRow | null; workDate: string }> {
    const rules = await this.rulesFor(input.orgId, input.propertyId, tx);
    const candidates = await this.time.linkCandidates(input.employeeId, input.at, tx);
    const entry = linkEntry(input.at, candidates, rules.linkWindowMinutes);
    return { entry, workDate: entry ? entry.workDate : kigaliDateOf(input.at) };
  }

  /**
   * What closing a record stores. The day kind is left empty when the year's
   * national holidays are not recorded: refusing a clock out for that would be
   * absurd, and pay, which reads it, refuses on its own (058-time, calls made
   * while building).
   */
  async figures(
    input: {
      orgId: string;
      propertyId: string | null;
      rosterEntryId: string | null;
      workDate: string;
      clockInAt: Date;
      clockOutAt: Date;
      autoClosed?: boolean;
    },
    tx?: Tx,
  ): Promise<CloseValues> {
    const [entry, rules, dayKind] = await Promise.all([
      input.rosterEntryId ? this.time.findEntry(input.rosterEntryId, tx) : Promise.resolve(null),
      this.rulesFor(input.orgId, input.propertyId, tx),
      this.dayKind(input.orgId, input.propertyId, input.workDate, tx),
    ]);
    const figures = closeFigures({
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt,
      shift: entry
        ? {
            startsAt: entry.startsAt,
            endsAt: entry.endsAt,
            breakMinutes: entry.breakMinutes,
            minWorkMinutes: entry.minWorkMinutes,
          }
        : null,
      rules,
      autoClosed: input.autoClosed,
    });
    return { ...figures, dayKind };
  }

  /** A national or business holiday, else a weekly day off of the branch, else a weekday (AC-TM7). */
  async dayKind(orgId: string, propertyId: string | null, date: string, tx?: Tx): Promise<DayKind | null> {
    const national = await this.rules.publicHolidays(yearOf(date), tx);
    if (!national) return null;
    const [orgHolidays, weeklyOffs] = await Promise.all([
      this.settings.holidays(orgId, tx),
      this.settings.weeklyOffs(orgId, tx),
    ]);
    return dayKindOf(date, {
      propertyId,
      nationalHolidays: new Set(national.value.dates.map((d) => d.date)),
      orgHolidays,
      weeklyOffs,
    });
  }
}
