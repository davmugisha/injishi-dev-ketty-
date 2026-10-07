import type { EmployeeStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import {
  attendanceRecords,
  employees,
  jobPositions,
  orgMemberships,
  orgs,
  properties,
  workspaces,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export interface MyFileRow {
  employeeId: string;
  orgId: string;
  businessName: string;
  preferredName: string | null;
  legalName: string;
  employeeNumber: string;
  branchName: string | null;
  jobPositionTitle: string | null;
  status: EmployeeStatus;
  hasReports: boolean;
}

export interface ReportRow {
  id: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
}

const personName = sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;

/**
 * Self service's own reads (ADR-058, 058-self-service): which files are the
 * caller's, and who reports to a file. The only place that touches Drizzle
 * for them.
 *
 * Ownership runs through the membership, never a column on the request: a file
 * is the caller's when its `org_membership_id` names a membership whose user is
 * the session's, whatever that membership's status, so a leaver still reads
 * what is theirs.
 */
@Injectable()
export class MyWorkRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async filesOf(userId: string): Promise<MyFileRow[]> {
    const rows = await this.db
      .select({
        employeeId: employees.id,
        orgId: employees.orgId,
        businessName: orgs.legalName,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        employeeNumber: employees.employeeNumber,
        branchName: properties.name,
        jobPositionTitle: jobPositions.title,
        status: employees.status,
        hasReports: sql<boolean>`exists (select 1 from employees r where r.reporting_manager_id = ${employees.id} and r.status = 'active')`,
      })
      .from(employees)
      .innerJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
      .innerJoin(orgs, eq(orgs.id, employees.orgId))
      .leftJoin(properties, eq(properties.id, employees.workPropertyId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(eq(orgMemberships.userId, userId))
      .orderBy(sql`${employees.status} = 'active' desc`, asc(orgs.legalName));
    return rows.map((r) => ({ ...r, hasReports: Boolean(r.hasReports) }));
  }

  /** The file id when it is the caller's, else null: the caller learns nothing about any other id. */
  async owned(userId: string, employeeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .innerJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
      .where(and(eq(employees.id, employeeId), eq(orgMemberships.userId, userId)))
      .limit(1);
    return !!row;
  }

  /** Active files whose reporting manager is this file, read now (AC-SS15). */
  async directReports(managerId: string): Promise<ReportRow[]> {
    return this.db
      .select({
        id: employees.id,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        jobPositionTitle: jobPositions.title,
      })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(and(eq(employees.reportingManagerId, managerId), eq(employees.status, 'active')))
      .orderBy(asc(personName));
  }

  /** The open record of each file named, for "you are clocked in since". */
  async openRecords(employeeIds: readonly string[]): Promise<Map<string, { id: string; clockInAt: Date }>> {
    if (employeeIds.length === 0) return new Map();
    const rows = await this.db
      .select({ employeeId: attendanceRecords.employeeId, id: attendanceRecords.id, clockInAt: attendanceRecords.clockInAt })
      .from(attendanceRecords)
      .where(and(inArray(attendanceRecords.employeeId, [...employeeIds]), eq(attendanceRecords.status, 'open')));
    return new Map(rows.map((r) => [r.employeeId, { id: r.id, clockInAt: r.clockInAt }]));
  }

  /** The business's workspace, which the outbox rows a person's own request raises are filed under. */
  async workspaceOf(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.orgId, orgId), eq(workspaces.kind, 'business')))
      .limit(1);
    return row?.id ?? null;
  }
}
