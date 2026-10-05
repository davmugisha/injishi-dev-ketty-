import type {
  AttendancePolicy,
  AttendanceSettings,
  BranchClockSettings,
  CreateOrgHolidayRequest,
  CreateWeeklyOffRequest,
  OrgHoliday,
  OrgHolidayList,
  PutAttendancePolicyRequest,
  PutBranchClockSettingsRequest,
  UpdateOrgHolidayRequest,
  UpdateWeeklyOffRequest,
  WeeklyOff,
  WeeklyOffList,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import {
  assertCoversEveryBranch,
  assertInBranchScope,
  coversProperty,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../booking/domain/pricing';
import { DEFAULT_ATTENDANCE_RULES, type AttendanceRules } from '../domain/time-rules';
import { violatedConstraint } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import {
  DEFAULT_RADIUS_M,
  TimeSettingsRepository,
  type HolidayRow,
  type WeeklyOffRow,
} from '../infrastructure/time-settings.repository';
import { assertBranchInReach, orgOf } from './hr-access';

/**
 * The time settings of a business (ADR-058, 058-time AC-TM4, AC-TM7 to AC-TM9,
 * AC-TM12): the attendance policy (a business default, and a branch's own),
 * each branch's geofence, and the business's own holidays and weekly days off.
 *
 * A setting of the whole business (the default policy, a holiday or weekly day
 * off of every branch) is written only by somebody covering every branch
 * (ADR-054); a branch's own by somebody covering that branch. Every write is
 * audited against the business.
 */
@Injectable()
export class TimeSettingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly settings: TimeSettingsRepository,
  ) {}

  // --- Policies and the geofence ---------------------------------------------------------

  /** `GET /ops/attendance/policies`: the default (built in when unsaved), the branches' own, each branch's geofence. */
  async attendanceSettings(ws: ScopedWorkspace): Promise<AttendanceSettings> {
    const orgId = orgOf(ws);
    const [policies, clock, branches] = await Promise.all([
      this.settings.policies(orgId),
      this.settings.clockSettings(orgId),
      this.settings.branches(orgId),
    ]);
    const saved = policies.find((p) => p.propertyId === null);
    const own = new Map(clock.map((c) => [c.propertyId, c]));
    return {
      policies: [
        presentPolicy(saved ?? DEFAULT_ATTENDANCE_RULES, null, saved !== undefined),
        ...policies
          .filter((p) => p.propertyId !== null && coversProperty(ws.branchScope, p.propertyId))
          .map((p) => presentPolicy(p, p.propertyId, true)),
      ],
      clock: branches
        .filter((b) => coversProperty(ws.branchScope, b.id))
        .map(
          (b): BranchClockSettings => {
            const setting = own.get(b.id);
            const centre = setting?.centre ?? null;
            return {
              propertyId: b.id,
              branchName: b.name,
              geofenceRadiusM: setting?.geofenceRadiusM ?? DEFAULT_RADIUS_M,
              centre,
              propertyHasCoordinates: b.hasCoordinates,
              hasCoordinates: centre !== null || b.hasCoordinates,
            };
          },
        ),
    };
  }

  /** `PUT /ops/attendance/policies`: the business default (no branch) or one branch's own, written whole. */
  async putPolicy(ws: ScopedWorkspace, userId: string, body: PutAttendancePolicyRequest): Promise<AttendanceSettings> {
    const orgId = orgOf(ws);
    const propertyId = body.propertyId ?? null;
    await this.assertBranchSetting(ws, orgId, propertyId);
    const { propertyId: _ignored, ...rules } = body;
    void _ignored;
    await this.db.transaction(async (tx) => {
      await this.settings.putPolicy(tx, { orgId, propertyId, ...rules });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.attendance_policy_set',
        orgId,
        diff: { propertyId, ...rules },
      });
    });
    return this.attendanceSettings(ws);
  }

  /**
   * `PUT /ops/attendance/clock-settings/:propertyId`: one branch's geofence
   * (AC-TM9), its radius and, when the property has no map pin or staff clock
   * in somewhere else, its centre.
   */
  async putClockSettings(
    ws: ScopedWorkspace,
    userId: string,
    propertyId: string,
    body: PutBranchClockSettingsRequest,
  ): Promise<AttendanceSettings> {
    const orgId = orgOf(ws);
    await this.assertBranchSetting(ws, orgId, propertyId);
    await this.db.transaction(async (tx) => {
      await this.settings.putClockSettings(tx, { propertyId, orgId, geofenceRadiusM: body.geofenceRadiusM, centre: body.centre });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.geofence_set',
        orgId,
        diff: { propertyId, geofenceRadiusM: body.geofenceRadiusM, ...(body.centre !== undefined ? { centre: body.centre } : {}) },
      });
    });
    return this.attendanceSettings(ws);
  }

  // --- Holidays (AC-TM12) -----------------------------------------------------------

  async holidays(ws: ScopedWorkspace): Promise<OrgHolidayList> {
    const rows = await this.settings.holidays(orgOf(ws));
    return { holidays: rows.filter((h) => h.propertyId === null || coversProperty(ws.branchScope, h.propertyId)).map(presentHoliday) };
  }

  async createHoliday(ws: ScopedWorkspace, userId: string, body: CreateOrgHolidayRequest): Promise<OrgHoliday> {
    const orgId = orgOf(ws);
    const propertyId = body.propertyId ?? null;
    await this.assertBranchSetting(ws, orgId, propertyId);
    assertHolidayDates(body.fromDate, body.toDate);
    const id = await this.db.transaction(async (tx) => {
      const created = await this.settings.insertHoliday(tx, {
        orgId,
        propertyId,
        name: body.name.trim(),
        fromDate: body.fromDate,
        toDate: body.toDate,
        recurringYearly: body.recurringYearly ?? false,
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.holiday_added',
        orgId,
        diff: { holidayId: created, propertyId, from: body.fromDate, to: body.toDate },
      });
      return created;
    });
    return presentHoliday(await this.holidayRow(id));
  }

  async updateHoliday(ws: ScopedWorkspace, userId: string, id: string, body: UpdateOrgHolidayRequest): Promise<OrgHoliday> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.settings.findHoliday(id), ws);
    await this.assertBranchSetting(ws, orgId, row.propertyId);
    assertHolidayDates(body.fromDate ?? row.fromDate, body.toDate ?? row.toDate);
    await this.db.transaction(async (tx) => {
      await this.settings.updateHoliday(tx, row.id, {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.fromDate !== undefined ? { fromDate: body.fromDate } : {}),
        ...(body.toDate !== undefined ? { toDate: body.toDate } : {}),
        ...(body.recurringYearly !== undefined ? { recurringYearly: body.recurringYearly } : {}),
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.holiday_changed',
        orgId,
        diff: { holidayId: row.id, ...body },
      });
    });
    return presentHoliday(await this.holidayRow(row.id));
  }

  /** A holiday is a setting: removing one is allowed, and audited. */
  async deleteHoliday(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.settings.findHoliday(id), ws);
    await this.assertBranchSetting(ws, orgId, row.propertyId);
    await this.db.transaction(async (tx) => {
      await this.settings.deleteHoliday(tx, row.id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.holiday_removed',
        orgId,
        diff: { holidayId: row.id, name: row.name, from: row.fromDate, to: row.toDate },
      });
    });
  }

  // --- Weekly days off (AC-TM12) ---------------------------------------------------------

  async weeklyOffs(ws: ScopedWorkspace): Promise<WeeklyOffList> {
    const rows = await this.settings.weeklyOffs(orgOf(ws));
    return {
      weeklyOffs: rows.filter((w) => w.propertyId === null || coversProperty(ws.branchScope, w.propertyId)).map(presentWeeklyOff),
    };
  }

  async createWeeklyOff(ws: ScopedWorkspace, userId: string, body: CreateWeeklyOffRequest): Promise<WeeklyOff> {
    const orgId = orgOf(ws);
    const propertyId = body.propertyId ?? null;
    await this.assertBranchSetting(ws, orgId, propertyId);
    const weeks = normalWeeks(body.weeks ?? []);
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const created = await this.settings.insertWeeklyOff(tx, { orgId, propertyId, weekday: body.weekday, weeks });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.weekly_off_added',
          orgId,
          diff: { weeklyOffId: created, propertyId, weekday: body.weekday, weeks },
        });
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'org_weekly_offs_uk') {
        throw new ConflictException('That weekday is already a day off here. Change its weeks instead.');
      }
      throw error;
    }
    return presentWeeklyOff(await this.weeklyOffRow(id));
  }

  async updateWeeklyOff(ws: ScopedWorkspace, userId: string, id: string, body: UpdateWeeklyOffRequest): Promise<WeeklyOff> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.settings.findWeeklyOff(id), ws);
    await this.assertBranchSetting(ws, orgId, row.propertyId);
    const weeks = normalWeeks(body.weeks);
    await this.db.transaction(async (tx) => {
      await this.settings.updateWeeklyOff(tx, row.id, weeks);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.weekly_off_changed',
        orgId,
        diff: { weeklyOffId: row.id, weeks: { from: row.weeks, to: weeks } },
      });
    });
    return presentWeeklyOff(await this.weeklyOffRow(row.id));
  }

  async deleteWeeklyOff(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.settings.findWeeklyOff(id), ws);
    await this.assertBranchSetting(ws, orgId, row.propertyId);
    await this.db.transaction(async (tx) => {
      await this.settings.deleteWeeklyOff(tx, row.id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.weekly_off_removed',
        orgId,
        diff: { weeklyOffId: row.id, propertyId: row.propertyId, weekday: row.weekday },
      });
    });
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * A setting of the whole business needs every branch; a branch's own needs
   * that branch, which must be the business's (404 otherwise, like any id).
   */
  private async assertBranchSetting(ws: ScopedWorkspace, orgId: string, propertyId: string | null): Promise<void> {
    if (propertyId === null) {
      assertCoversEveryBranch(ws);
      return;
    }
    const own = await this.settings.ownBranches(orgId, [propertyId]);
    if (!own.has(propertyId)) throw new NotFoundException('That branch is not available to you.');
    assertInBranchScope(ws, propertyId);
    assertBranchInReach(ws, propertyId);
  }

  private async holidayRow(id: string): Promise<HolidayRow> {
    const row = await this.settings.findHoliday(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async weeklyOffRow(id: string): Promise<WeeklyOffRow> {
    const row = await this.settings.findWeeklyOff(id);
    if (!row) throw new NotFoundException();
    return row;
  }
}

function assertHolidayDates(from: string, to: string): void {
  if (!isCalendarDate(from) || !isCalendarDate(to)) throw new UnprocessableEntityException('That is not a real date.');
  if (to < from) throw new UnprocessableEntityException('It ends before it starts.');
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 31 * 86_400_000) {
    throw new UnprocessableEntityException('A holiday runs at most a month. Record a longer closure as several.');
  }
}

/** Weeks of the month, each once, in order. All five is every week, which is stored empty. */
function normalWeeks(weeks: readonly number[]): number[] {
  const set = [...new Set(weeks)].sort((a, b) => a - b);
  return set.length === 5 ? [] : set;
}

function presentPolicy(rules: AttendanceRules, propertyId: string | null, saved: boolean): AttendancePolicy {
  return {
    propertyId,
    saved,
    graceInMinutes: rules.graceInMinutes,
    graceOutMinutes: rules.graceOutMinutes,
    overtimeCutoffMinutes: rules.overtimeCutoffMinutes,
    overtimeAutoApprove: rules.overtimeAutoApprove,
    overtimeMinMinutes: rules.overtimeMinMinutes,
    linkWindowMinutes: rules.linkWindowMinutes,
    staleOpenHours: rules.staleOpenHours,
    defaultShiftMinutes: rules.defaultShiftMinutes,
  };
}

function presentHoliday(row: HolidayRow): OrgHoliday {
  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    fromDate: row.fromDate,
    toDate: row.toDate,
    recurringYearly: row.recurringYearly,
  };
}

function presentWeeklyOff(row: WeeklyOffRow): WeeklyOff {
  return { id: row.id, propertyId: row.propertyId, weekday: row.weekday, weeks: row.weeks };
}
