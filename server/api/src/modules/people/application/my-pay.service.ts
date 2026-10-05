import type { CreateMyPayClaimRequest, MyLoanList, MyPayClaimList, MyPayslipList, PayClaim } from '@injishi/contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { LoansService } from './loans.service';
import { PayClaimsService } from './pay-claims.service';
import { PayslipsService } from './payslips.service';

/**
 * Self service for pay (058-self-service AC-SS7, the routes marked 6;
 * 058-payroll AC-PY9, AC-PY11): a person's confirmed payslips and their PDFs,
 * their loans with each installment, and their claims.
 *
 * Ownership is the guard, as everywhere under `me/work` (index contract 10). A
 * leaver reads everything, so a final payslip can still be fetched, and raises
 * or withdraws nothing. A draft payslip is never shown: it is a preview, and
 * the person would read a figure that may still move.
 */
@Injectable()
export class MyPayService {
  constructor(
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly payslipsService: PayslipsService,
    private readonly loansService: LoansService,
    private readonly claimsService: PayClaimsService,
  ) {}

  async payslips(userId: string, employeeId: string): Promise<MyPayslipList> {
    return this.payslipsService.mine((await this.mine(userId, employeeId)).id);
  }

  /** The first download marks the payslip sent (AC-PY11). */
  async payslipPdf(userId: string, employeeId: string, id: string): Promise<{ body: Buffer; filename: string }> {
    return this.payslipsService.myPdf((await this.mine(userId, employeeId)).id, id);
  }

  async loans(userId: string, employeeId: string): Promise<MyLoanList> {
    return { loans: await this.loansService.mine((await this.mine(userId, employeeId)).id) };
  }

  async claims(userId: string, employeeId: string): Promise<MyPayClaimList> {
    return { claims: await this.claimsService.mine((await this.mine(userId, employeeId)).id) };
  }

  /** A receipt is uploaded first, to `me/work/:employeeId/files`, and named here by its key. */
  async createClaim(userId: string, employeeId: string, key: string, body: CreateMyPayClaimRequest): Promise<PayClaim> {
    const employee = await this.mineActive(userId, employeeId);
    const id = await this.claimsService.createFor(
      { orgId: employee.orgId, workspaceId: await this.work.workspaceOf(employee.orgId), userId, selfService: true },
      employee,
      body,
      key,
    );
    return this.claimsService.presentById(id);
  }

  /** Withdraw a claim still waiting. A decided one is the office's to undo. */
  async cancelClaim(userId: string, employeeId: string, id: string): Promise<PayClaim> {
    const employee = await this.mineActive(userId, employeeId);
    return this.claimsService.cancelOwn({ orgId: employee.orgId, userId }, employee.id, id);
  }

  // --- Ownership -----------------------------------------------------------------------

  /** The caller's file, or 404: a probe for any other id learns nothing (index contract 10). */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  /** A write needs the file active (AC-S1). */
  private async mineActive(userId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.mine(userId, employeeId);
    if (employee.status !== 'active') throw new ConflictException('You no longer work here, so this file is read only.');
    return employee;
  }
}
