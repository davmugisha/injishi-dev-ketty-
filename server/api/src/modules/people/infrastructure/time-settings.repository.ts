import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';

import {
  attendancePolicies,
  branchClockSettings,
  orgHolidays,
  orgWeeklyOffs,
  properties,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { AttendanceRules, OrgHolidayRule, WeeklyOffRule } from '../domain/time-rules';
import type { Tx } from './employees.repository';

/** The default geofence radius when a branch has none saved (058-time AC-TM9). */
export const DEFAULT_RADIUS_M = 150;

export interface Centre {
  lat: number;
  lng: number;
}

function centreOf(latitude: string | null, longitude: string | null): Centre | null {
  if (latitude === null || longitude === null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export interface PolicyRow extends AttendanceRules {
  id: string;
  orgId: string;
  propertyId: string | null;
}

export interface HolidayRow extends OrgHolidayRule {
  id: string;
  orgId: string;
  name: string;
}

export interface WeeklyOffRow extends WeeklyOffRule {
  id: string;
  orgId: string;
  weeks: number[];
}

const policyColumns = {
  id: attendancePolicies.id,
  orgId: attendancePolicies.orgId,
  propertyId: attendancePolicies.propertyId,
  graceInMinutes: attendancePolicies.graceInMinutes,
  graceOutMinutes: attendancePolicies.graceOutMinutes,
  overtimeCutoffMinutes: attendancePolicies.overtimeCutoffMinutes,
  overtimeAutoApprove: attendancePolicies.overtimeAutoApprove,
  overtimeMinMinutes: attendancePolicies.overtimeMinMinutes,
  linkWindowMinutes: attendancePolicies.linkWindowMinutes,
  staleOpenHours: attendancePolicies.staleOpenHours,
  defaultShiftMinutes: attendancePolicies.defaultShiftMinutes,
};

/**
 * The time settings of a business (ADR-058, 058-time): attendance policies,
 * each branch's geofence, its own holidays and weekly days off. The only place
 * that touches Drizzle for them. These are settings, edited in place.
 */
@Injectable()
export class TimeSettingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Policies (AC-TM4, AC-TM7, AC-TM8) ----------------------------------------------

  async policies(orgId: string, tx?: Tx): Promise<PolicyRow[]> {
    return (tx ?? this.db)
      .select(policyColumns)
      .from(attendancePolicies)
      .where(eq(attendancePolicies.orgId, orgId))
      .orderBy(asc(attendancePolicies.propertyId));
  }

  /** The row that governs a branch: its own, else the business default; null when neither is saved. */
  async policyFor(orgId: string, propertyId: string | null, tx?: Tx): Promise<PolicyRow | null> {
    const rows = await (tx ?? this.db)
      .select(policyColumns)
      .from(attendancePolicies)
      .where(
        and(
          eq(attendancePolicies.orgId, orgId),
          propertyId
            ? or(eq(attendancePolicies.propertyId, propertyId), isNull(attendancePolicies.propertyId))
            : isNull(attendancePolicies.propertyId),
        ),
      );
    return rows.find((r) => r.propertyId === propertyId) ?? rows.find((r) => r.propertyId === null) ?? null;
  }

  /** One row per business and branch: write it whole. */
  async putPolicy(tx: Tx, values: Omit<PolicyRow, 'id'>): Promise<void> {
    await tx
      .insert(attendancePolicies)
      .values(values)
      .onConflictDoUpdate({
        // The constraint is NULLS NOT DISTINCT, so the business default (no branch) conflicts too.
        target: [attendancePolicies.orgId, attendancePolicies.propertyId],
        set: {
          graceInMinutes: values.graceInMinutes,
          graceOutMinutes: values.graceOutMinutes,
          overtimeCutoffMinutes: values.overtimeCutoffMinutes,
          overtimeAutoApprove: values.overtimeAutoApprove,
          overtimeMinMinutes: values.overtimeMinMinutes,
          linkWindowMinutes: values.linkWindowMinutes,
          staleOpenHours: values.staleOpenHours,
          defaultShiftMinutes: values.defaultShiftMinutes,
          updatedAt: new Date(),
        },
      });
  }

  // --- The geofence (AC-TM9) ---------------------------------------------------------

  async clockSettings(orgId: string): Promise<{ propertyId: string; geofenceRadiusM: number; centre: Centre | null }[]> {
    const rows = await this.db
      .select({
        propertyId: branchClockSettings.propertyId,
        geofenceRadiusM: branchClockSettings.geofenceRadiusM,
        latitude: branchClockSettings.latitude,
        longitude: branchClockSettings.longitude,
      })
      .from(branchClockSettings)
      .where(eq(branchClockSettings.orgId, orgId));
    return rows.map((r) => ({ propertyId: r.propertyId, geofenceRadiusM: r.geofenceRadiusM, centre: centreOf(r.latitude, r.longitude) }));
  }

  /**
   * The geofence a phone punch is measured against (AC-TM9): the radius, else
   * 150 m; the centre set here, else the property's own coordinates, else none.
   */
  async geofenceFor(propertyId: string): Promise<{ radiusM: number; centre: Centre | null }> {
    const [row] = await this.db
      .select({
        radiusM: branchClockSettings.geofenceRadiusM,
        latitude: branchClockSettings.latitude,
        longitude: branchClockSettings.longitude,
        propertyLatitude: properties.latitude,
        propertyLongitude: properties.longitude,
      })
      .from(properties)
      .leftJoin(branchClockSettings, eq(branchClockSettings.propertyId, properties.id))
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!row) return { radiusM: DEFAULT_RADIUS_M, centre: null };
    return {
      radiusM: row.radiusM ?? DEFAULT_RADIUS_M,
      centre: centreOf(row.latitude, row.longitude) ?? centreOf(row.propertyLatitude, row.propertyLongitude),
    };
  }

  /** `centre` undefined leaves the stored one; null clears it back to the property's pin. */
  async putClockSettings(
    tx: Tx,
    values: { propertyId: string; orgId: string; geofenceRadiusM: number; centre?: Centre | null },
  ): Promise<void> {
    const centre =
      values.centre === undefined
        ? {}
        : {
            latitude: values.centre ? values.centre.lat.toFixed(6) : null,
            longitude: values.centre ? values.centre.lng.toFixed(6) : null,
          };
    await tx
      .insert(branchClockSettings)
      .values({ propertyId: values.propertyId, orgId: values.orgId, geofenceRadiusM: values.geofenceRadiusM, ...centre })
      .onConflictDoUpdate({
        target: branchClockSettings.propertyId,
        set: { geofenceRadiusM: values.geofenceRadiusM, ...centre, updatedAt: new Date() },
      });
  }

  /** The business's branches with their coordinates, for the geofence screen. */
  async branches(orgId: string): Promise<{ id: string; name: string; hasCoordinates: boolean }[]> {
    const rows = await this.db
      .select({ id: properties.id, name: properties.name, latitude: properties.latitude, longitude: properties.longitude })
      .from(properties)
      .where(eq(properties.orgId, orgId))
      .orderBy(asc(properties.name));
    return rows.map((r) => ({ id: r.id, name: r.name, hasCoordinates: r.latitude !== null && r.longitude !== null }));
  }

  // --- Holidays and weekly days off (AC-TM12) --------------------------------------------

  private readonly holidayColumns = {
    id: orgHolidays.id,
    orgId: orgHolidays.orgId,
    propertyId: orgHolidays.propertyId,
    name: orgHolidays.name,
    fromDate: orgHolidays.fromDate,
    toDate: orgHolidays.toDate,
    recurringYearly: orgHolidays.recurringYearly,
  };

  async holidays(orgId: string, tx?: Tx): Promise<HolidayRow[]> {
    return (tx ?? this.db)
      .select(this.holidayColumns)
      .from(orgHolidays)
      .where(eq(orgHolidays.orgId, orgId))
      .orderBy(asc(orgHolidays.fromDate));
  }

  async findHoliday(id: string): Promise<HolidayRow | null> {
    const [row] = await this.db.select(this.holidayColumns).from(orgHolidays).where(eq(orgHolidays.id, id)).limit(1);
    return row ?? null;
  }

  async insertHoliday(tx: Tx, values: Omit<HolidayRow, 'id'>): Promise<string> {
    const [row] = await tx.insert(orgHolidays).values(values).returning({ id: orgHolidays.id });
    return row.id;
  }

  async updateHoliday(
    tx: Tx,
    id: string,
    values: Partial<Pick<HolidayRow, 'name' | 'fromDate' | 'toDate' | 'recurringYearly'>>,
  ): Promise<void> {
    await tx.update(orgHolidays).set({ ...values, updatedAt: new Date() }).where(eq(orgHolidays.id, id));
  }

  async deleteHoliday(tx: Tx, id: string): Promise<void> {
    await tx.delete(orgHolidays).where(eq(orgHolidays.id, id));
  }

  private readonly weeklyOffColumns = {
    id: orgWeeklyOffs.id,
    orgId: orgWeeklyOffs.orgId,
    propertyId: orgWeeklyOffs.propertyId,
    weekday: orgWeeklyOffs.weekday,
    weeks: orgWeeklyOffs.weeks,
  };

  async weeklyOffs(orgId: string, tx?: Tx): Promise<WeeklyOffRow[]> {
    return (tx ?? this.db)
      .select(this.weeklyOffColumns)
      .from(orgWeeklyOffs)
      .where(eq(orgWeeklyOffs.orgId, orgId))
      .orderBy(asc(orgWeeklyOffs.weekday));
  }

  async findWeeklyOff(id: string): Promise<WeeklyOffRow | null> {
    const [row] = await this.db.select(this.weeklyOffColumns).from(orgWeeklyOffs).where(eq(orgWeeklyOffs.id, id)).limit(1);
    return row ?? null;
  }

  async insertWeeklyOff(tx: Tx, values: Omit<WeeklyOffRow, 'id'>): Promise<string> {
    const [row] = await tx.insert(orgWeeklyOffs).values(values).returning({ id: orgWeeklyOffs.id });
    return row.id;
  }

  async updateWeeklyOff(tx: Tx, id: string, weeks: number[]): Promise<void> {
    await tx.update(orgWeeklyOffs).set({ weeks, updatedAt: new Date() }).where(eq(orgWeeklyOffs.id, id));
  }

  async deleteWeeklyOff(tx: Tx, id: string): Promise<void> {
    await tx.delete(orgWeeklyOffs).where(eq(orgWeeklyOffs.id, id));
  }

  /** The branches of these ids that belong to the business, for checking a setting's branch. */
  async ownBranches(orgId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.orgId, orgId), inArray(properties.id, [...ids])));
    return new Set(rows.map((r) => r.id));
  }
}
