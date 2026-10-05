// server/api/src/modules/payroll/payroll.module.ts
import { Module } from '@nestjs/common';

import { PayrollService } from './application/payroll.service';
import { PayrollRepository } from './infrastructure/payroll.repository';

/**
 * HR / payroll (first pass — no ADR yet, pending team review).
 *
 * Layering matches every other module: application/ (use cases) -
 * infrastructure/ (Drizzle). No domain/ yet — the state machine here
 * (draft -> pending_approval -> approved -> paid) is still simple enough to
 * live inline in the service; split it out if it grows the way
 * `registration-status.ts` did for org registration.
 *
 * Reuses the existing `team.manage` permission rather than introducing a
 * dedicated `payroll.manage` (or `hr.manage`) grant, which would require
 * hand-editing @injishi/contracts' compiled dist output (ADR-034 task 8 has
 * not reconstructed its source yet). Revisit once the shape here is stable
 * and the team has decided who should hold it.
 */
@Module({
  providers: [PayrollRepository, PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}