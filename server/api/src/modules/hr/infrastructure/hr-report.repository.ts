import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export interface ReportPersonRow {
  id: string;
  name: string;
  job: string | null;
  team: string | null;
  branch: string | null;
  workPropertyId: string | null;
  hiredOn: string | null;
  status: string;
  offboardedOn: string | null;
  offboardReason: string | null;
}

export interface ReportShiftRow {
  id: string;
  employeeId: string;
  workDate: string;
  startsAt: Date;
  endsAt: Date;
}

export interface ReportRecordRow {
  employeeId: string;
  workDate: string;
  rosterEntryId: string | null;
  clockInAt: Date;
  status: string;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  approvedOvertimeMinutes: number | null;
  note: string | null;
}

export interface ReportLeaveRow {
  id: string;
  employeeId: string;
  type: string;
  startsOn: string;
  endsOn: string;
  days: number;
  status: string;
  reason: string | null;
}

export interface ReportPayslipRow {
  employeeId: string;
  month: string;
  runStatus: string;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  netRwf: number;
}

/** A request someone made in the period: who, what came of it, and an amount when it has one. */
export interface ReportAskRow {
  employeeId: string;
  status: string;
  amountRwf: number | null;
}

/**
 * The HR report's reads (058, HR reports): one business, one period, every row
 * the report is worked out from. Branch limits are applied by the service, on
 * the person each row belongs to.
 */
@Injectable()
export class HrReportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async people(orgId: string): Promise<ReportPersonRow[]> {
    const found = await this.db.execute<{
      id: string;
      name: string;
      job: string | null;
      team: string | null;
      branch: string | null;
      work_property_id: string | null;
      hired_on: string | null;
      status: string;
      offboarded_on: string | null;
      offboard_reason: string | null;
    }>(sql`
      select e.id, coalesce(nullif(btrim(e.preferred_name), ''), e.legal_name) as name, jp.title as job,
             (select t.name from hr_team_members m join hr_teams t on t.id = m.team_id
               where m.employee_id = e.id and m.status = 'active' order by m.created_at limit 1) as team,
             p.name as branch, e.work_property_id, e.hired_on::text as hired_on, e.status::text as status,
             e.offboarded_on::text as offboarded_on, e.offboard_reason
        from employees e
        left join job_positions jp on jp.id = e.job_position_id
        left join properties p on p.id = e.work_property_id
       where e.org_id = ${orgId}
       order by 2
    `);
    return found.rows.map((r) => ({
      id: r.id,
      name: r.name,
      job: r.job,
      team: r.team,
      branch: r.branch,
      workPropertyId: r.work_property_id,
      hiredOn: r.hired_on,
      status: r.status,
      offboardedOn: r.offboarded_on,
      offboardReason: r.offboard_reason,
    }));
  }

  /** Scheduled shifts in the period that had started by `now`. */
  async shifts(orgId: string, from: string, to: string, now: Date): Promise<ReportShiftRow[]> {
    const found = await this.db.execute<{ id: string; employee_id: string; work_date: string; starts_at: Date; ends_at: Date }>(sql`
      select id, employee_id, work_date::text as work_date, starts_at, ends_at
        from roster_entries
       where org_id = ${orgId} and status = 'scheduled'
         and work_date between ${from} and ${to}
         and starts_at <= ${now.toISOString()}::timestamptz
    `);
    return found.rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      workDate: r.work_date,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
    }));
  }

  /** Every record of the period but the superseded: a correction's original is not a second day. */
  async records(orgId: string, from: string, to: string): Promise<ReportRecordRow[]> {
    const found = await this.db.execute<{
      employee_id: string;
      work_date: string;
      roster_entry_id: string | null;
      clock_in_at: Date;
      status: string;
      late_minutes: number | null;
      early_minutes: number | null;
      worked_minutes: number | null;
      overtime_minutes: number | null;
      approved_overtime_minutes: number | null;
      note: string | null;
    }>(sql`
      select employee_id, work_date::text as work_date, roster_entry_id, clock_in_at, status::text as status,
             late_minutes, early_minutes, worked_minutes, overtime_minutes, approved_overtime_minutes, note
        from attendance_records
       where org_id = ${orgId} and work_date between ${from} and ${to} and status <> 'superseded'
    `);
    return found.rows.map((r) => ({
      employeeId: r.employee_id,
      workDate: r.work_date,
      rosterEntryId: r.roster_entry_id,
      clockInAt: new Date(r.clock_in_at),
      status: r.status,
      lateMinutes: r.late_minutes,
      earlyMinutes: r.early_minutes,
      workedMinutes: r.worked_minutes,
      overtimeMinutes: r.overtime_minutes,
      approvedOvertimeMinutes: r.approved_overtime_minutes,
      note: r.note,
    }));
  }

  /** Leave approved or still asked that touches the period. */
  async leave(orgId: string, from: string, to: string): Promise<ReportLeaveRow[]> {
    const found = await this.db.execute<{
      id: string;
      employee_id: string;
      type: string;
      starts_on: string;
      ends_on: string;
      days: string;
      status: string;
      reason: string | null;
    }>(sql`
      select lr.id, lr.employee_id, lt.name as type, lr.starts_on::text as starts_on, lr.ends_on::text as ends_on,
             lr.days::text as days, lr.status::text as status, lr.reason
        from leave_requests lr
        join leave_types lt on lt.id = lr.leave_type_id
       where lr.org_id = ${orgId} and lr.status in ('approved', 'requested')
         and lr.starts_on <= ${to} and lr.ends_on >= ${from}
       order by lr.starts_on
    `);
    return found.rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      type: r.type,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      days: Number(r.days),
      status: r.status,
      reason: r.reason,
    }));
  }

  /** Leave asked in the period, whatever came of it. */
  async leaveAsked(orgId: string, since: Date, until: Date): Promise<ReportAskRow[]> {
    return this.asks(sql`
      select employee_id, status::text as status, null::bigint as amount_rwf
        from leave_requests
       where org_id = ${orgId} and created_at >= ${since.toISOString()}::timestamptz and created_at < ${until.toISOString()}::timestamptz
    `);
  }

  async claims(orgId: string, since: Date, until: Date): Promise<ReportAskRow[]> {
    return this.asks(sql`
      select employee_id, status::text as status, amount_rwf
        from pay_claims
       where org_id = ${orgId} and created_at >= ${since.toISOString()}::timestamptz and created_at < ${until.toISOString()}::timestamptz
    `);
  }

  async corrections(orgId: string, since: Date, until: Date): Promise<ReportAskRow[]> {
    return this.asks(sql`
      select employee_id, status::text as status, null::bigint as amount_rwf
        from attendance_requests
       where org_id = ${orgId} and created_at >= ${since.toISOString()}::timestamptz and created_at < ${until.toISOString()}::timestamptz
    `);
  }

  /** Help desk questions opened in the period, and those closed in it (status `closed`). */
  async helpDesk(orgId: string, since: Date, until: Date): Promise<ReportAskRow[]> {
    return this.asks(sql`
      select employee_id, 'opened' as status, null::bigint as amount_rwf
        from hr_tickets
       where org_id = ${orgId} and created_at >= ${since.toISOString()}::timestamptz and created_at < ${until.toISOString()}::timestamptz
      union all
      select employee_id, 'closed' as status, null::bigint as amount_rwf
        from hr_tickets
       where org_id = ${orgId} and closed_at >= ${since.toISOString()}::timestamptz and closed_at < ${until.toISOString()}::timestamptz
    `);
  }

  /** Each month's latest pay run, payslip by payslip, from `fromMonth` to `toMonth` (first days). */
  async payslips(orgId: string, fromMonth: string, toMonth: string): Promise<ReportPayslipRow[]> {
    const found = await this.db.execute<{
      employee_id: string;
      month: string;
      run_status: string;
      gross_rwf: string;
      paye_rwf: string;
      employee_contributions_rwf: string;
      employer_contributions_rwf: string;
      other_deductions_rwf: string;
      net_rwf: string;
    }>(sql`
      with runs as (
        select distinct on (period_start) id, period_start, status
          from pay_runs
         where org_id = ${orgId} and period_start between ${fromMonth} and ${toMonth}
         order by period_start, computed_at desc
      )
      select ps.employee_id, to_char(r.period_start, 'YYYY-MM') as month, r.status::text as run_status,
             ps.gross_rwf, ps.paye_rwf, ps.employee_contributions_rwf, ps.employer_contributions_rwf,
             ps.other_deductions_rwf, ps.net_rwf
        from runs r
        join payslips ps on ps.pay_run_id = r.id
    `);
    return found.rows.map((r) => ({
      employeeId: r.employee_id,
      month: r.month,
      runStatus: r.run_status,
      grossRwf: Number(r.gross_rwf),
      payeRwf: Number(r.paye_rwf),
      employeeContributionsRwf: Number(r.employee_contributions_rwf),
      employerContributionsRwf: Number(r.employer_contributions_rwf),
      otherDeductionsRwf: Number(r.other_deductions_rwf),
      netRwf: Number(r.net_rwf),
    }));
  }

  private async asks(query: ReturnType<typeof sql>): Promise<ReportAskRow[]> {
    const found = await this.db.execute<{ employee_id: string; status: string; amount_rwf: string | null }>(query);
    return found.rows.map((r) => ({
      employeeId: r.employee_id,
      status: r.status,
      amountRwf: r.amount_rwf === null ? null : Number(r.amount_rwf),
    }));
  }
}
