import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AssistantUsageQuery, AssistantUsageReport } from '@injishi/contracts';

import { UsageLedger } from '../../../modules/assistant/application/usage-ledger';
import { monthOf } from '../../../modules/assistant/infrastructure/usage-queries';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The support assistant's monthly usage → `GET /api/v1/admin/assistant/usage`
 * (ADR-061 D-s): model requests, tokens, estimated cost, and how answers were
 * produced, for a UTC month (the current one when `month` is unset).
 *
 * No PII trail, and that is a property of what it reads: the report sums
 * `assistant_model_usage` and `assistant_answer_days` and returns no person,
 * conversation or text. A route that lists usage BY PERSON would be a PII read
 * and owe a written reason and a `record_access_logs` row.
 */
@Controller({ path: 'admin/assistant', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminAssistantUsageController {
  constructor(@Inject(UsageLedger) private readonly usage: Pick<UsageLedger, 'report'>) {}

  @Get('usage')
  @RequireStaffPermission('admin.analytics.view')
  async read(
    @Query(new ZodValidationPipe(AssistantUsageQuery)) query: AssistantUsageQuery,
  ): Promise<AssistantUsageReport> {
    // Parsed on the way out, so a value the database holds that the contract
    // does not allow (an unknown role) fails here, not in the console.
    return AssistantUsageReport.parse(await this.usage.report(query.month ?? monthOf(new Date())));
  }
}
