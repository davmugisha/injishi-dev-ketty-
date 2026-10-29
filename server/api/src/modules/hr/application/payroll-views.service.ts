import type { ContractPage, ContractRow, ListQuery, PayrollDashboard, PayrollRules, UpdateContractPayTermsRequest } from '@injishi/contracts';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { pageOf } from '../../../shared/lists/list-query';
import { HR_RULE, HR_RULE_LABEL, type HrRuleType } from '../domain/hr-rules';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { PayItemsRepository } from '../infrastructure/pay-items.repository';
import { PayRecordsRepository, type ContractListRow } from '../infrastructure/pay-records.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * Payroll's read views (058-payroll AC-PY15): the dashboard, the national rules
 * in force with their history (replacing Horilla's income tax screen), and every
 * contract of the business with the pay terms it carries.
 */
@Injectable()
export class PayrollViewsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly records: PayRecordsRepository,
    private readonly items: PayItemsRepository,
  ) {}

  dashboard(ws: ScopedWorkspace): Promise<PayrollDashboard> {
    return this.records.dashboard(orgOf(ws));
  }

  /** Every `hr.rw.*` rule: the row in force today and each version before it. Read only. */
  async rules(): Promise<PayrollRules> {
    const types = Object.values(HR_RULE) as HrRuleType[];
    const rows = await this.records.ruleRows(types);
    const now = new Date();
    return {
      rules: types.map((type) => {
        const own = rows.filter((r) => r.configType === type);
        const inForce =
          own
            .filter((r) => (r.effectiveFrom === null || r.effectiveFrom <= now) && (r.effectiveTo === null || r.effectiveTo > now))
            .sort((a, b) => (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0) || b.version - a.version)[0] ?? null;
        return {
          configType: type,
          label: HR_RULE_LABEL[type],
          inForce: inForce
            ? { configEntryId: inForce.id, version: inForce.version, effectiveFrom: inForce.effectiveFrom?.toISOString() ?? null, value: inForce.value }
            : null,
          history: own.map((r) => ({
            configEntryId: r.id,
            version: r.version,
            effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
            effectiveTo: r.effectiveTo?.toISOString() ?? null,
          })),
        };
      }),
    };
  }

  async contracts(ws: ScopedWorkspace, query: ListQuery): Promise<ContractPage> {
    const page = await this.records.contractPage({ orgId: orgOf(ws), scope: ws.branchScope, query });
    return pageOf(page.rows.map(presentContract), page.total, query, { groups: page.groups, statusCounts: page.statusCounts });
  }

  /** `PATCH /ops/contracts/:id`: the structure a contract carries and its notice; applies to runs not yet confirmed. */
  async updateContract(ws: ScopedWorkspace, userId: string, id: string, body: UpdateContractPayTermsRequest): Promise<ContractRow> {
    const orgId = orgOf(ws);
    const contract = assertOwnedByOrg(await this.records.findContract(id), ws);
    assertPersonInReach(ws, contract.workPropertyId);
    if (body.payStructureId) {
      const structure = await this.items.findStructure(body.payStructureId);
      if (!structure || structure.orgId !== orgId || structure.status !== 'active') {
        throw new UnprocessableEntityException('That pay structure is not one of this business\'s.');
      }
    }
    await this.db.transaction(async (tx) => {
      await this.items.setContractPayTerms(tx, id, body);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: contract.employeeId,
        eventType: 'hr.contract_pay_terms_changed',
        orgId,
        diff: { contractId: id, ...body },
      });
    });
    const row = await this.records.findContract(id);
    if (!row) throw new NotFoundException();
    return presentContract(row);
  }
}

export function presentContract(r: ContractListRow): ContractRow {
  return {
    id: r.id,
    employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
    employeeNumber: r.employeeNumber,
    branchId: r.workPropertyId,
    contractType: r.contractType,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    wageBasis: r.wageBasis,
    wageRwf: r.wageRwf,
    status: r.status,
    payStructureId: r.payStructureId,
    noticeDays: r.noticeDays,
  };
}
