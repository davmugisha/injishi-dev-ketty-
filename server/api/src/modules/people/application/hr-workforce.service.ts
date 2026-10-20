import type {
  ContractTerms,
  CoverRequirementList,
  EmployeeDependantList,
  ExpiringDocumentList,
  HrChecklistItem,
  HrChecklistItemList,
  HrChecklistKind,
  HrCompensation,
  HrTeamList,
  PayAccountLabel,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { addDays, kigaliToday } from '../domain/hr-calendar';
import { writeHrAudit } from '../infrastructure/hr-audit';
import {
  HrWorkforceRepository,
  type ChecklistRow,
  type PayAccountRow,
} from '../infrastructure/hr-workforce.repository';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * The workforce reads the new interface's HR screens draw with (real-data,
 * people), and the one write they add: ticking a checklist step.
 *
 * Each read sits behind its own route and permission (see the controller), so
 * a `people.view` reader gets teams and grades and nothing that says what a
 * contract pays or who a person's family are.
 */
@Injectable()
export class HrWorkforceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly workforce: HrWorkforceRepository,
  ) {}

  /**
   * `GET /ops/hr/teams`: the teams of the caller's branches and where each person works.
   *
   * The desk reads it too (`attendance.record`, to clock people onto their team's shifts), and what
   * the desk sees of a colleague is a name and a job title (index contract 4): a grade and a
   * probation end come from the file, so only a file reader gets them. Two literals, as the file's
   * own presenter builds its two views.
   */
  async teams(ws: ScopedWorkspace): Promise<HrTeamList> {
    const orgId = orgOf(ws);
    const [teams, rows] = await Promise.all([
      this.workforce.teams(orgId, ws.branchScope),
      this.workforce.placements(orgId, ws.branchScope, kigaliToday()),
    ]);
    const fileReader = ws.permissions.some((p) => p === 'people.view' || p === 'people.manage' || p === 'payroll.run');
    const placements = fileReader
      ? rows.map((r) => ({
          employeeId: r.employeeId,
          teamId: r.teamId,
          grade: r.grade,
          hasKioskPin: r.hasKioskPin,
          probationEndsOn: r.probationEndsOn,
        }))
      : rows.map((r) => ({
          employeeId: r.employeeId,
          teamId: r.teamId,
          grade: null,
          hasKioskPin: r.hasKioskPin,
          probationEndsOn: null,
        }));
    return { teams, placements };
  }

  /** `GET /ops/roster/cover`: minimum cover, for one branch or every branch in scope. */
  async cover(ws: ScopedWorkspace, propertyId: string | undefined): Promise<CoverRequirementList> {
    const orgId = orgOf(ws);
    if (propertyId) assertInBranchScope(ws, propertyId);
    const rows = await this.workforce.cover(orgId, ws.branchScope, propertyId ?? null);
    return { requirements: rows };
  }

  /** `GET /ops/hr/compensation`: what each contract pays and why, and where pay goes. */
  async compensation(ws: ScopedWorkspace): Promise<HrCompensation> {
    const orgId = orgOf(ws);
    const [contracts, accounts] = await Promise.all([
      this.workforce.contractTerms(orgId, ws.branchScope),
      this.workforce.primaryPayAccounts(orgId, ws.branchScope),
    ]);
    return {
      contracts: contracts.map(
        (c): ContractTerms => ({
          contractId: c.contractId,
          employeeId: c.employeeId,
          contractType: c.contractType,
          startsOn: c.startsOn,
          endsOn: c.endsOn,
          status: c.status,
          wageRwf: c.wageRwf,
          allowanceRwf: c.allowanceRwf,
          probationEndsOn: c.probationEndsOn,
          changeReason: c.changeReason,
          endReason: c.endReason,
          decidedByName: c.decidedByName,
          decidedAt: c.decidedAt.toISOString(),
        }),
      ),
      payAccounts: accounts.map(payAccountLabel),
    };
  }

  /** `GET /ops/hr/expiring-documents`: documents of people still working that expire within the window. */
  async expiringDocuments(ws: ScopedWorkspace, withinDays: number | undefined): Promise<ExpiringDocumentList> {
    const orgId = orgOf(ws);
    const today = kigaliToday();
    const documents = await this.workforce.expiringDocuments(orgId, ws.branchScope, today, addDays(today, withinDays ?? 45));
    return { documents };
  }

  /** `GET /ops/hr/checklists`: one kind of checklist, for everybody in scope or one person. */
  async checklists(ws: ScopedWorkspace, checklist: HrChecklistKind, employeeId: string | undefined): Promise<HrChecklistItemList> {
    const orgId = orgOf(ws);
    const rows = await this.workforce.checklists(orgId, ws.branchScope, checklist, employeeId ?? null);
    return { items: rows.map(presentItem) };
  }

  /**
   * `POST /ops/hr/checklist-items/:id`: tick a step or take the tick back. A
   * step marked owner only (taking an account away, which is staffing the
   * business) also needs `team.manage`, the owner's alone (AC-O2). The tick
   * and its audit row commit together.
   */
  async markChecklistItem(ws: ScopedWorkspace, userId: string, id: string, done: boolean): Promise<HrChecklistItem> {
    const orgId = orgOf(ws);
    const item = await this.workforce.findChecklistItem(id);
    if (!item || item.orgId !== orgId) throw new NotFoundException();
    // A write on a person outside the caller's branches is 403 in words (ADR-058).
    assertPersonInReach(ws, item.workPropertyId);
    if (item.ownerOnly && !ws.permissions.includes('team.manage')) {
      throw new ForbiddenException('Only someone who manages the team can tick this step.');
    }
    await this.db.transaction(async (tx) => {
      const moved = await this.workforce.markChecklistItem(tx, id, done, userId);
      if (!moved) {
        throw new ConflictException(done ? 'That step is already done.' : 'That step is not ticked.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: item.employeeId,
        eventType: done ? 'hr.checklist_step_done' : 'hr.checklist_step_reopened',
        orgId,
        diff: { checklist: item.checklist, code: item.code },
      });
    });
    const updated = await this.workforce.findChecklistItem(id);
    if (!updated) throw new NotFoundException();
    return presentItem(updated);
  }

  /** `GET /ops/hr/dependants`: beneficiaries and dependants, beneficiaries first. */
  async dependants(ws: ScopedWorkspace, employeeId: string | undefined): Promise<EmployeeDependantList> {
    const orgId = orgOf(ws);
    const rows = await this.workforce.dependants(orgId, ws.branchScope, employeeId ? [employeeId] : null);
    // The rows come in file order; within a file, the largest share first and the dependants after.
    const fileOrder = new Map<string, number>();
    for (const r of rows) if (!fileOrder.has(r.employeeId)) fileOrder.set(r.employeeId, fileOrder.size);
    const share = (p: number | null): number => (p === null ? -1 : Number(p));
    return {
      dependants: [...rows]
        .sort(
          (a, b) =>
            (fileOrder.get(a.employeeId) ?? 0) - (fileOrder.get(b.employeeId) ?? 0) ||
            share(b.beneficiaryPercent) - share(a.beneficiaryPercent) ||
            a.name.localeCompare(b.name),
        )
        .map((r) => ({ ...r, beneficiaryPercent: r.beneficiaryPercent === null ? null : Number(r.beneficiaryPercent) })),
    };
  }
}

function presentItem(row: ChecklistRow): HrChecklistItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    checklist: row.checklist,
    code: row.code,
    title: row.title,
    detail: row.detail,
    ownerOnly: row.ownerOnly,
    sortOrder: row.sortOrder,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    doneByName: row.doneAt ? row.doneByName : null,
  };
}

/**
 * The network of a Rwandan MoMo number from its prefix (078 and 079 are MTN,
 * 072 and 073 Airtel), and only the last digits of any account: a pay screen
 * names where pay goes, never the whole number.
 */
function payAccountLabel(row: PayAccountRow): PayAccountLabel {
  if (row.kind === 'momo') {
    const digits = (row.momoPhone ?? '').replace(/\D/g, '');
    const local = digits.startsWith('250') ? digits.slice(3) : digits.replace(/^0/, '');
    const provider = /^7[89]/.test(local) ? 'MTN MoMo' : /^7[23]/.test(local) ? 'Airtel Money' : 'Mobile money';
    return { employeeId: row.employeeId, kind: 'momo', provider, lastDigits: digits.slice(-3) };
  }
  const account = (row.accountNumber ?? '').replace(/\s/g, '');
  return { employeeId: row.employeeId, kind: 'bank', provider: row.bankName ?? 'Bank', lastDigits: account.slice(-4) };
}
