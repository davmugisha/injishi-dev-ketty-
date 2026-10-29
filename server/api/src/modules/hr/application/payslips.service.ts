import type { BulkResponse, ListIds, ListQuery, MarkPaidParams, MyPayslipList, PayslipBulkRequest, PayslipPage, PayslipRow } from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, coversProperty, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { runBulk } from '../../../shared/lists/bulk';
import { pageOf } from '../../../shared/lists/list-query';
import { isCalendarDate, localMidnight } from '../../booking/domain/pricing';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { PayRecordsRepository, type PayslipFullRow, type PayslipListRow } from '../infrastructure/pay-records.repository';
import { PayrollRepository } from '../infrastructure/payroll.repository';
import { PayslipPdfRenderer } from '../infrastructure/payslip-pdf.renderer';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * Payslips across runs (058-payroll AC-PY10, AC-PY11). Everything here is
 * `payroll.run`'s, except a person reading their own through self service.
 *
 * Paid status is the only thing that ever changes on a confirmed payslip:
 * marked once, with a date, a way and a reference, and unmarked only with a
 * reason, on the trail. A PDF is drawn on request from the frozen lines and the
 * snapshot the confirm stored, and never kept.
 */
@Injectable()
export class PayslipsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly records: PayRecordsRepository,
    private readonly payroll: PayrollRepository,
    private readonly pdf: PayslipPdfRenderer,
  ) {}

  async list(ws: ScopedWorkspace, query: ListQuery): Promise<PayslipPage> {
    const page = await this.records.payslipPage({ orgId: orgOf(ws), scope: ws.branchScope, query });
    return pageOf(page.rows.map(presentRow), page.total, query, { groups: page.groups, statusCounts: page.statusCounts });
  }

  ids(ws: ScopedWorkspace, query: ListQuery): Promise<ListIds> {
    return this.records.payslipIds({ orgId: orgOf(ws), scope: ws.branchScope, query });
  }

  /** `POST /ops/payslips/bulk` (`mark_paid`): each payslip marked as the single command would. */
  bulk(ws: ScopedWorkspace, userId: string, body: PayslipBulkRequest): Promise<BulkResponse> {
    return runBulk(body.ids, (id) => this.markPaid(ws, userId, id, body.params));
  }

  /**
   * Mark one confirmed payslip paid. Marking is idempotent by nature: a payslip
   * already paid with the same reference answers as it is; with another, 409.
   */
  async markPaid(ws: ScopedWorkspace, userId: string, id: string, params: MarkPaidParams): Promise<PayslipRow> {
    const orgId = orgOf(ws);
    const slip = assertOwnedByOrg(await this.records.findPayslip(id), ws);
    assertPersonInReach(ws, slip.workPropertyId);
    if (!isCalendarDate(params.paidOn)) throw new ConflictException('That is not a real date.');
    if (slip.status !== 'confirmed') throw new ConflictException('Only a confirmed payslip is paid. Confirm the run first.');
    if (slip.paidAt) {
      if (slip.paidReference === params.reference.trim() && slip.paidMethod === params.method) return presentRow(slip);
      throw new ConflictException(`That payslip is marked paid already, by ${slip.paidMethod} with reference ${slip.paidReference}. Unmark it first to correct it.`);
    }
    await this.db.transaction(async (tx) => {
      const marked = await this.records.markPaid(tx, id, { paidAt: localMidnight(params.paidOn), method: params.method, reference: params.reference.trim(), userId });
      if (!marked) throw new ConflictException('That payslip was marked a moment ago.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: slip.employeeId,
        eventType: 'hr.payslip_marked_paid',
        orgId,
        diff: { payslipId: id, period: slip.period, method: params.method, reference: params.reference.trim(), paidOn: params.paidOn },
      });
    });
    return this.row(id);
  }

  /** `POST /ops/payslips/:id/unmark-paid`: to correct a wrong reference, with a reason on the trail. */
  async unmarkPaid(ws: ScopedWorkspace, userId: string, id: string, reason: string): Promise<PayslipRow> {
    const orgId = orgOf(ws);
    const slip = assertOwnedByOrg(await this.records.findPayslip(id), ws);
    assertPersonInReach(ws, slip.workPropertyId);
    await this.db.transaction(async (tx) => {
      if (!(await this.records.unmarkPaid(tx, id))) throw new ConflictException('That payslip is not marked paid.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: slip.employeeId,
        eventType: 'hr.payslip_unmarked_paid',
        orgId,
        diff: { payslipId: id, period: slip.period, was: { method: slip.paidMethod, reference: slip.paidReference } },
        reason,
      });
    });
    return this.row(id);
  }

  /** `GET /ops/payslips/:id/pdf`: a confirmed payslip only, drawn from what was frozen. */
  async pdfOf(ws: ScopedWorkspace, id: string): Promise<{ body: Buffer; filename: string }> {
    const slip = assertOwnedByOrg(await this.records.findPayslip(id), ws);
    assertInBranchScope(ws, slip.workPropertyId);
    return this.render([slip]);
  }

  /** `GET /ops/pay-runs/:id/payslips.pdf`: a page per person, for printing for staff without accounts. */
  async runPdf(ws: ScopedWorkspace, runId: string): Promise<{ body: Buffer; filename: string }> {
    assertOwnedByOrg(await this.payroll.findRun(runId), ws);
    const slips = (await this.records.payslipsOfRun(runId)).filter((s) => coversProperty(ws.branchScope, s.workPropertyId));
    if (slips.length === 0) throw new NotFoundException('No payslip of this run is yours to print.');
    return this.render(slips);
  }

  /** A person's own confirmed payslips (058-self-service AC-SS7). */
  async mine(employeeId: string): Promise<MyPayslipList> {
    const rows = await this.records.confirmedOf(employeeId);
    return { payslips: rows.map((r) => ({ id: r.id, period: r.period, grossRwf: r.grossRwf, netRwf: r.netRwf, paidAt: r.paidAt ? r.paidAt.toISOString() : null })) };
  }

  /** The person's own PDF; the first download marks it sent (AC-PY11). */
  async myPdf(employeeId: string, id: string): Promise<{ body: Buffer; filename: string }> {
    const slip = await this.records.findPayslip(id);
    if (!slip || slip.employeeId !== employeeId || slip.status !== 'confirmed') throw new NotFoundException();
    const out = await this.render([slip]);
    await this.records.markSent(id);
    return out;
  }

  private async render(slips: readonly PayslipFullRow[]): Promise<{ body: Buffer; filename: string }> {
    const unconfirmed = slips.find((s) => s.status !== 'confirmed' || !s.snapshot);
    if (unconfirmed) throw new ConflictException('A payslip prints once its run is confirmed: until then it is a preview.');
    const body = await this.pdf.render(
      slips.map((s) => ({
        period: s.period,
        snapshot: s.snapshot as NonNullable<PayslipFullRow['snapshot']>,
        grossRwf: s.grossRwf,
        payeRwf: s.payeRwf,
        employeeContributionsRwf: s.employeeContributionsRwf,
        employerContributionsRwf: s.employerContributionsRwf,
        otherDeductionsRwf: s.otherDeductionsRwf,
        nonIncomeRwf: s.nonIncomeRwf,
        netRwf: s.netRwf,
        lines: s.lines,
      })),
    );
    const first = slips[0];
    const filename = slips.length === 1 ? `payslip-${first.period}-${first.employeeNumber}.pdf` : `payslips-${first.period}.pdf`;
    return { body, filename };
  }

  private async row(id: string): Promise<PayslipRow> {
    const slip = await this.records.findPayslip(id);
    if (!slip) throw new NotFoundException();
    return presentRow(slip);
  }
}

export function presentRow(r: PayslipListRow): PayslipRow {
  return {
    id: r.id,
    payRunId: r.payRunId,
    period: r.period,
    employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
    employeeNumber: r.employeeNumber,
    branchId: r.workPropertyId,
    grossRwf: r.grossRwf,
    netRwf: r.netRwf,
    status: r.status,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    paidMethod: r.paidMethod,
    paidReference: r.paidReference,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  };
}
