import { Module } from '@nestjs/common';

import { AssistantModule } from '../../../modules/assistant/assistant.module';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminAssistantUsageController } from './assistant-usage.controller';

/**
 * The support assistant's admin routes (ADR-061 slice I): the monthly usage
 * report. The ledger is the assistant module's own; this module only exposes
 * it to staff behind `StaffGuard` and `admin.analytics.view`.
 */
@Module({
  imports: [AdminSharedModule, AssistantModule],
  controllers: [AdminAssistantUsageController],
})
export class AssistantAdminModule {}
