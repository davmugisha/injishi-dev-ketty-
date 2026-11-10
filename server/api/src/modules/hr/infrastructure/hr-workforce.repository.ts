import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  departments,
  employeeDependants,
  employeeDocuments,
  employeeKioskPins,
  employeePayAccounts,
  employees,
  employmentContracts,
  hrTeamMembers,
  hrTeams,
  rosterCoverRequirements,
  shiftTemplates,
  users,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { writeHrAudit } from './hr-audit';

export interface TeamRow {
  id: string;
  code: string;
  name: string;
  propertyId: string;
  departmentId: string | null;
  departmentName: string | null;
  leadEmployeeId: string | null;
  sortOrder: number;
}

export interface PlacementRow {
  employeeId: string;
  teamId: string | null;
  grade: string | null;
  hasKioskPin: boolean;
  probationEndsOn: string | null;
}

export interface CoverRow {
  id: string;
  propertyId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  label: string;
  shiftTemplateIds: string[];
  minByWeekday: number[];
  note: string | null;
  setByName: string | null;
  sortOrder: number;
}

export interface ContractTermsRow {
  contractId: string;
  employeeId: string;
  contractType: 'permanent' | 'fixed_term' | 'casual';
  startsOn: string;
  endsOn: string | null;
  status: 'scheduled' | 'active' | 'ended';
  wageRwf: number;
  allowanceRwf: number;
  probationEndsOn: string | null;
  changeReason: string | null;
  endReason: string | null;
  decidedByName: string | null;
  decidedAt: Date;
}

export interface PayAccountRow {
  employeeId: string;
  kind: 'bank' | 'momo';
  bankName: string | null;
  accountNumber: string | null;
  momoPhone: string | null;
}

export interface ExpiringDocumentRow {
  documentId: string;
  employeeId: string;
  title: string;
  expiresOn: string;
}

export interface DependantRow {
  id: string;
  employeeId: string;
  name: string;
  relation: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  sex: 'female' | 'male' | null;
  dateOfBirth: string | null;
  phone: string | null;
  isEmergencyContact: boolean;
  medicalDependant: boolean;
  beneficiaryPercent: number | null;
}

const setBy = alias(employees, 'cover_set_by');

/**
 * The workforce reads behind the new interface's HR screens (real-data,
 * people): teams, minimum cover, contract terms, expiring documents,
 * checklists and dependants. The only place that touches Drizzle for them.
 *
 * Every read is filtered by the org and by the caller's branches through the
 * person's work branch (or, for a team and a cover rule, its own branch), the
 * same scope every HR list reads under (ADR-054).
 */
@Injectable()
export class HrWorkforceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Files still on the books: active, or leaving on a day not yet past. */
  private onBooks(today: string): SQL | undefined {
    return or(eq(employees.status, 'active'), gte(employees.offboardedOn, today));
  }

  async teams(orgId: string, scope: BranchScope): Promise<TeamRow[]> {
    return this.db
      .select({
        id: hrTeams.id,
        code: hrTeams.code,
        name: hrTeams.name,
        propertyId: hrTeams.propertyId,
        departmentId: hrTeams.departmentId,
        departmentName: departments.name,
        leadEmployeeId: hrTeams.leadEmployeeId,
        sortOrder: hrTeams.sortOrder,
      })
      .from(hrTeams)
      .leftJoin(departments, eq(departments.id, hrTeams.departmentId))
      .where(and(eq(hrTeams.orgId, orgId), eq(hrTeams.status, 'active'), inBranchScope(hrTeams.propertyId, scope)))
      .orderBy(asc(hrTeams.sortOrder), asc(hrTeams.name));
  }

  async placements(orgId: string, scope: BranchScope, today: string): Promise<PlacementRow[]> {
    const rows = await this.db
      .select({
        employeeId: employees.id,
        teamId: hrTeamMembers.teamId,
        grade: employees.grade,
        hasKioskPin: sql<boolean>`exists (select 1 from ${employeeKioskPins} where ${employeeKioskPins.employeeId} = ${employees.id})`,
        probationEndsOn: sql<string | null>`(
          select ${employmentContracts.probationEndsOn}::text from ${employmentContracts}
           where ${employmentContracts.employeeId} = ${employees.id} and ${employmentContracts.status} <> 'ended'
           order by ${employmentContracts.startsOn} desc limit 1)`,
      })
      .from(employees)
      .leftJoin(hrTeamMembers, and(eq(hrTeamMembers.employeeId, employees.id), eq(hrTeamMembers.status, 'active')))
      .where(and(eq(employees.orgId, orgId), this.onBooks(today), inBranchScope(employees.workPropertyId, scope)))
      .orderBy(asc(employees.employeeNumber));
    return rows.map((r) => ({ ...r, hasKioskPin: Boolean(r.hasKioskPin) }));
  }

  /** A team of this business, with its branch. */
  async teamOf(orgId: string, teamId: string): Promise<{ id: string; propertyId: string } | null> {
    const [row] = await this.db
      .select({ id: hrTeams.id, propertyId: hrTeams.propertyId })
      .from(hrTeams)
      .where(and(eq(hrTeams.id, teamId), eq(hrTeams.orgId, orgId)))
      .limit(1);
    return row ?? null;
  }

  /** Which of these shifts are active shifts of the branch. */
  async activeShiftIds(orgId: string, propertyId: string, ids: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: shiftTemplates.id })
      .from(shiftTemplates)
      .where(
        and(
          eq(shiftTemplates.orgId, orgId),
          eq(shiftTemplates.propertyId, propertyId),
          eq(shiftTemplates.status, 'active'),
          inArray(shiftTemplates.id, ids),
        ),
      );
    return rows.map((r) => r.id);
  }

  /** Set a team's minimum cover: its active row is changed, or the first one made. Audited. */
  async saveCover(
    orgId: string,
    actorUserId: string,
    input: {
      teamId: string;
      propertyId: string;
      shiftTemplateIds: string[];
      minByWeekday: number[];
      note: string | null;
    },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: rosterCoverRequirements.id })
        .from(rosterCoverRequirements)
        .where(and(eq(rosterCoverRequirements.teamId, input.teamId), eq(rosterCoverRequirements.status, 'active')))
        .orderBy(asc(rosterCoverRequirements.sortOrder))
        .limit(1);
      if (existing) {
        await tx
          .update(rosterCoverRequirements)
          .set({
            shiftTemplateIds: input.shiftTemplateIds,
            minByWeekday: input.minByWeekday,
            note: input.note,
            updatedAt: new Date(),
          })
          .where(eq(rosterCoverRequirements.id, existing.id));
      } else {
        await tx.insert(rosterCoverRequirements).values({
          orgId,
          propertyId: input.propertyId,
          teamId: input.teamId,
          label: 'Minimum cover',
          shiftTemplateIds: input.shiftTemplateIds,
          minByWeekday: input.minByWeekday,
          note: input.note,
        });
      }
      await writeHrAudit(tx, {
        actorUserId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.roster_cover_saved',
        orgId,
        diff: { teamId: input.teamId, minByWeekday: input.minByWeekday },
      });
    });
  }

  async cover(orgId: string, scope: BranchScope, propertyId: string | null): Promise<CoverRow[]> {
    const rows = await this.db
      .select({
        id: rosterCoverRequirements.id,
        propertyId: rosterCoverRequirements.propertyId,
        teamId: rosterCoverRequirements.teamId,
        teamCode: hrTeams.code,
        teamName: hrTeams.name,
        label: rosterCoverRequirements.label,
        shiftTemplateIds: rosterCoverRequirements.shiftTemplateIds,
        minByWeekday: rosterCoverRequirements.minByWeekday,
        note: rosterCoverRequirements.note,
        setByName: sql<string | null>`coalesce(${setBy.preferredName}, ${setBy.legalName})`,
        sortOrder: rosterCoverRequirements.sortOrder,
      })
      .from(rosterCoverRequirements)
      .innerJoin(hrTeams, eq(hrTeams.id, rosterCoverRequirements.teamId))
      .leftJoin(setBy, eq(setBy.id, rosterCoverRequirements.setByEmployeeId))
      .where(
        and(
          eq(rosterCoverRequirements.orgId, orgId),
          eq(rosterCoverRequirements.status, 'active'),
          inBranchScope(rosterCoverRequirements.propertyId, scope),
          propertyId ? eq(rosterCoverRequirements.propertyId, propertyId) : undefined,
        ),
      )
      .orderBy(asc(rosterCoverRequirements.propertyId), asc(rosterCoverRequirements.sortOrder), asc(hrTeams.name));
    return rows.map((r) => ({ ...r, shiftTemplateIds: r.shiftTemplateIds ?? [], minByWeekday: r.minByWeekday ?? [] }));
  }

  /**
   * Every contract of every file in scope, newest start first per person. The
   * allowance is the sum of the fixed allowances in the contract's pay
   * structure, the same components a pay run adds (058-payroll AC-PY5).
   */
  async contractTerms(orgId: string, scope: BranchScope): Promise<ContractTermsRow[]> {
    const rows = await this.db
      .select({
        contractId: employmentContracts.id,
        employeeId: employmentContracts.employeeId,
        contractType: employmentContracts.contractType,
        startsOn: employmentContracts.startsOn,
        endsOn: employmentContracts.endsOn,
        status: employmentContracts.status,
        wageRwf: employmentContracts.wageRwf,
        allowanceRwf: sql<string>`coalesce((
          select sum(pc.amount_rwf) from pay_structure_components psc
            join pay_components pc on pc.id = psc.component_id
           where psc.structure_id = ${employmentContracts.payStructureId}
             and pc.kind = 'allowance' and pc.amount_type = 'fixed' and pc.status = 'active'
             and pc.one_off_period is null), 0)`,
        probationEndsOn: employmentContracts.probationEndsOn,
        changeReason: employmentContracts.changeReason,
        endReason: employmentContracts.endReason,
        decidedByName: users.name,
        decidedAt: employmentContracts.createdAt,
      })
      .from(employmentContracts)
      .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
      .leftJoin(users, eq(users.id, employmentContracts.createdByUserId))
      .where(and(eq(employmentContracts.orgId, orgId), inBranchScope(employees.workPropertyId, scope)))
      .orderBy(asc(employees.employeeNumber), desc(employmentContracts.startsOn));
    return rows.map((r) => ({ ...r, allowanceRwf: Number(r.allowanceRwf) }));
  }

  async primaryPayAccounts(orgId: string, scope: BranchScope): Promise<PayAccountRow[]> {
    return this.db
      .select({
        employeeId: employeePayAccounts.employeeId,
        kind: employeePayAccounts.kind,
        bankName: employeePayAccounts.bankName,
        accountNumber: employeePayAccounts.accountNumber,
        momoPhone: employeePayAccounts.momoPhone,
      })
      .from(employeePayAccounts)
      .innerJoin(employees, eq(employees.id, employeePayAccounts.employeeId))
      .where(
        and(
          eq(employeePayAccounts.orgId, orgId),
          eq(employeePayAccounts.isPrimary, true),
          eq(employeePayAccounts.status, 'active'),
          inBranchScope(employees.workPropertyId, scope),
        ),
      );
  }

  async expiringDocuments(orgId: string, scope: BranchScope, from: string, to: string): Promise<ExpiringDocumentRow[]> {
    const rows = await this.db
      .select({
        documentId: employeeDocuments.id,
        employeeId: employeeDocuments.employeeId,
        title: employeeDocuments.title,
        expiresOn: employeeDocuments.expiresOn,
      })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employees.id, employeeDocuments.employeeId))
      .where(
        and(
          eq(employeeDocuments.orgId, orgId),
          ne(employeeDocuments.status, 'rejected'),
          isNotNull(employeeDocuments.expiresOn),
          gte(employeeDocuments.expiresOn, from),
          lte(employeeDocuments.expiresOn, to),
          eq(employees.status, 'active'),
          inBranchScope(employees.workPropertyId, scope),
        ),
      )
      .orderBy(asc(employeeDocuments.expiresOn));
    return rows.map((r) => ({ ...r, expiresOn: r.expiresOn as string }));
  }

  async dependants(orgId: string, scope: BranchScope, employeeIds: readonly string[] | null): Promise<DependantRow[]> {
    const rows = await this.db
      .select({
        id: employeeDependants.id,
        employeeId: employeeDependants.employeeId,
        name: employeeDependants.name,
        relation: employeeDependants.relation,
        sex: employeeDependants.sex,
        dateOfBirth: employeeDependants.dateOfBirth,
        phone: employeeDependants.phone,
        isEmergencyContact: employeeDependants.isEmergencyContact,
        medicalDependant: employeeDependants.medicalDependant,
        beneficiaryPercent: employeeDependants.beneficiaryPercent,
      })
      .from(employeeDependants)
      .innerJoin(employees, eq(employees.id, employeeDependants.employeeId))
      .where(
        and(
          eq(employeeDependants.orgId, orgId),
          eq(employeeDependants.status, 'active'),
          inBranchScope(employees.workPropertyId, scope),
          employeeIds ? inArray(employeeDependants.employeeId, [...employeeIds]) : undefined,
        ),
      )
      .orderBy(asc(employees.employeeNumber), desc(employeeDependants.beneficiaryPercent), asc(employeeDependants.name));
    return rows.map((r) => ({ ...r, relation: r.relation as DependantRow['relation'] }));
  }
}
