// server/api/src/modules/payroll/payroll.module.ts
import { Module } from '@nestjs/common';

import { HrModule } from '../hr/hr.module';
import { PayrollService } from './application/payroll.service';
import { PayrollRepository } from './infrastructure/payroll.repository';
import { PayslipPdfRenderer } from './infrastructure/payslip-pdf.renderer';

/**
 * HR / payroll (first pass — no ADR yet, pending team review).
 *
 * Layering matches every other module: application/ (use cases), domain/
 * (how a payslip is worked out and drawn, pure) and infrastructure/ (Drizzle,
 * and the PDF). The state machine (draft -> approved -> paid) is still simple
 * enough to live inline in the service.
 *
 * Imports `HrModule` for one thing: what the roster and the clock say about
 * a month, which a payslip is computed from. The import runs one way only. My
 * HR draws an employee's own payslip with the same renderer, but takes the
 * class itself rather than this module, so the two never import each other.
 *
 * Reuses the existing `team.manage` permission rather than introducing a
 * dedicated `payroll.manage` (or `hr.manage`) grant, which would require
 * hand-editing @injishi/contracts' compiled dist output (ADR-034 task 8 has
 * not reconstructed its source yet). Revisit once the shape here is stable
 * and the team has decided who should hold it.
 */
@Module({
  imports: [HrModule],
  providers: [PayrollRepository, PayrollService, PayslipPdfRenderer],
  exports: [PayrollService],
})
export class PayrollModule {}