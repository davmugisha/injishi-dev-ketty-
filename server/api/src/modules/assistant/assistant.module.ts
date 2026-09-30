import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WorkspaceService } from '../../shared/auth/workspace.service';
import { isWorkerProcess } from '../../shared/process/process-role';
import { BookingModule } from '../booking/booking.module';
import { RoomTypesService } from '../listing-setup/application/room-types.service';
import { ListingSetupModule } from '../listing-setup/listing-setup.module';
import { ListingModule } from '../listing/listing.module';
import { OperationsModule } from '../operations/operations.module';
import {
  ASSISTANT_SETTINGS,
  type AssistantSettings,
} from './application/assistant-settings';
import {
  ACTION_EXECUTOR,
  ActionApprovalService,
  type ActionExecutor,
} from './application/action-approval.service';
import { AssistantToolbox } from './application/assistant-tools';
import { AssistantService } from './application/assistant.service';
import { AssistantRetentionService } from './application/retention.service';
import {
  ASSISTANT_MODEL_PORT,
  type AssistantModelPort,
} from './domain/model-port';
import { AnthropicAssistantModel } from './infrastructure/anthropic-model.adapter';
import {
  type AssistantEnv,
  type ResolvedAssistantConfig,
  resolveAssistantConfig,
} from './infrastructure/assistant.config';
import { ConversationRepository } from './infrastructure/conversation.repository';
import { AssistantRetentionProcessor } from './infrastructure/assistant-retention.processor';
import { ProposalRepository } from './infrastructure/proposal.repository';
import { RetentionRepository } from './infrastructure/retention.repository';
import { MockAssistantModel } from './infrastructure/mock-model.adapter';

/**
 * The assistant seam's one wiring point (ADR-061 D-b).
 *
 * `ASSISTANT_ADAPTER_MODE`, `ASSISTANT_MODEL` and `ANTHROPIC_API_KEY` are read
 * HERE and nowhere else, once, through `ConfigService` in a factory (so `.env`
 * is loaded first, the mailer's reasoning). The Anthropic SDK is imported
 * nowhere outside `infrastructure/anthropic-model.adapter.ts`.
 *
 * In `off` mode the port is still bound, to the mock, so the module builds;
 * `AssistantService` refuses every send before the port is reached.
 */
const RESOLVED = Symbol('ASSISTANT_RESOLVED_CONFIG');

export function createAssistantModel(config: ResolvedAssistantConfig): AssistantModelPort {
  const logger = new Logger('AssistantModule');
  if (config.mode === 'live' && config.apiKey) {
    logger.log(`Assistant: live, model ${config.model}`);
    return new AnthropicAssistantModel(config.apiKey, config.model);
  }
  logger.log(`Assistant: ${config.mode}`);
  return new MockAssistantModel();
}

@Module({
  // The tools read through the services the public, /me and operator routes use.
  imports: [ListingModule, BookingModule, OperationsModule, ListingSetupModule],
  providers: [
    {
      provide: RESOLVED,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ResolvedAssistantConfig =>
        resolveAssistantConfig({
          mode: config.get<string>('ASSISTANT_ADAPTER_MODE'),
          model: config.get<string>('ASSISTANT_MODEL'),
          apiKey: config.get<string>('ANTHROPIC_API_KEY'),
          nodeEnv: config.get<string>('NODE_ENV'),
        } satisfies AssistantEnv),
    },
    {
      provide: ASSISTANT_SETTINGS,
      inject: [RESOLVED],
      useFactory: ({ mode, model }: ResolvedAssistantConfig): AssistantSettings => ({ mode, model }),
    },
    {
      provide: ASSISTANT_MODEL_PORT,
      inject: [RESOLVED],
      useFactory: createAssistantModel,
    },
    ConversationRepository,
    // The one resolver of what a person holds, as the guards use it. Stateless
    // over the database, and provided here as the admin modules provide it.
    WorkspaceService,
    AssistantToolbox,
    AssistantService,
    ProposalRepository,
    // The retention sweep (ADR-061 D-d, slice H). The service is always
    // provided; the scheduler and its worker run in the worker process only.
    RetentionRepository,
    AssistantRetentionService,
    ...(isWorkerProcess() ? [AssistantRetentionProcessor] : []),
    {
      // An approved proposal executes through the Inventory screen's own path
      // (ADR-061 D-k), which writes both price columns.
      provide: ACTION_EXECUTOR,
      inject: [RoomTypesService],
      useFactory: (roomTypes: RoomTypesService): ActionExecutor => ({
        readRoomType: async (ws, propertyId, roomTypeId) =>
          (await roomTypes.list(ws, propertyId)).find((r) => r.id === roomTypeId) ?? null,
        setRoomTypePrice: (ws, roomTypeId, priceRwf) => roomTypes.update(ws, roomTypeId, { workspaceId: ws.workspaceId, basePriceRwf: priceRwf }),
      }),
    },
    ActionApprovalService,
  ],
  exports: [AssistantService, ActionApprovalService],
})
export class AssistantModule {}
