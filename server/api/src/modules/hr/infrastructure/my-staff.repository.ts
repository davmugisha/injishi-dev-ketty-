import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export type MyContractRow = {
  id: string;
  contract_type: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  created_at: Date;
};

export type MyDocumentRow = {
  id: string;
  title: string;
  status: string;
  issued_on: string | null;
  expires_on: string | null;
  reject_reason: string | null;
  updated_at: string;
};

export type ApproverCandidateRow = {
  employee_id: string | null;
  user_id: string;
  org_role: string;
  name: string;
  job_title: string | null;
};

/**
 * The staff phone's own reads of a person's file (real-data 1.3.3): their contracts, the documents kept
 * on their file, and who at the business could decide a leave request. Ownership is checked by the
 * caller (`MyWorkRepository.owned`) before any of these runs.
 */
@Injectable()
export class MyStaffRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async contracts(employeeId: string): Promise<MyContractRow[]> {
    const found = await this.db.execute<MyContractRow>(sql`
      select id, contract_type::text as contract_type, status::text as status, starts_on::text as starts_on,
             ends_on::text as ends_on, created_at
        from employment_contracts
       where employee_id = ${employeeId}
       order by starts_on desc
    `);
    return found.rows;
  }

  async documents(employeeId: string): Promise<MyDocumentRow[]> {
    const found = await this.db.execute<MyDocumentRow>(sql`
      select id, title, status::text as status, issued_on::text as issued_on, expires_on::text as expires_on,
             reject_reason,
             to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
        from employee_documents
       where employee_id = ${employeeId}
       order by created_at, title
    `);
    return found.rows;
  }

  async manager(employeeId: string): Promise<{ id: string; name: string; job_title: string | null } | null> {
    const found = await this.db.execute<{ id: string; name: string; job_title: string | null }>(sql`
      select m.id, coalesce(nullif(btrim(m.preferred_name), ''), m.legal_name) as name, jp.title as job_title
        from employees e
        join employees m on m.id = e.reporting_manager_id and m.status = 'active'
        left join job_positions jp on jp.id = m.job_position_id
       where e.id = ${employeeId}
    `);
    return found.rows[0] ?? null;
  }

  /**
   * Every active member of the business whose branch limits (ADR-054) cover the property, with their
   * file's name and job where they have one.
   */
  async members(orgId: string, propertyId: string | null): Promise<ApproverCandidateRow[]> {
    const found = await this.db.execute<ApproverCandidateRow>(sql`
      select e.id as employee_id, m.user_id, m.org_role::text as org_role,
             coalesce(nullif(btrim(e.preferred_name), ''), e.legal_name, u.name, u.email) as name, jp.title as job_title
        from org_memberships m
        join users u on u.id = m.user_id
        left join employees e on e.org_membership_id = m.id and e.status = 'active'
        left join job_positions jp on jp.id = e.job_position_id
       where m.org_id = ${orgId} and m.status = 'active'
         and (not exists (select 1 from org_membership_branches b where b.org_membership_id = m.id)
              ${propertyId ? sql`or exists (select 1 from org_membership_branches b where b.org_membership_id = m.id and b.property_id = ${propertyId})` : sql``})
       order by m.created_at, m.id
    `);
    return found.rows;
  }

  async roleOverrides(orgId: string): Promise<{ org_role: string; permission: string; granted: boolean }[]> {
    const found = await this.db.execute<{ org_role: string; permission: string; granted: boolean }>(sql`
      select org_role::text as org_role, permission, granted from org_role_permissions where org_id = ${orgId}
    `);
    return found.rows;
  }

  async leaveSteps(orgId: string, leaveTypeId: string | null): Promise<number | null> {
    const found = await this.db.execute<{ approval_steps: number }>(sql`
      select approval_steps from leave_types
       where org_id = ${orgId} and status = 'active'
         and ${leaveTypeId ? sql`id = ${leaveTypeId}` : sql`code = 'annual'`}
       limit 1
    `);
    const row = found.rows[0];
    return row ? Number(row.approval_steps) : null;
  }
}
