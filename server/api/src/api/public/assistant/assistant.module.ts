import { Module } from '@nestjs/common';

import { AssistantModule } from '../../../modules/assistant/assistant.module';
import { AuthModule } from '../../../modules/auth/auth.module';
import { TwoFactorService } from '../../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { AssistantController } from './assistant.controller';
import { OperatorScopeResolver } from './operator-scope';

/**
 * The assistant's HTTP surface as one unit, so `PublicApiModule` registers it
 * with a single import (the support intake's pattern).
 *
 * AuthModule is imported for `OptionalSessionGuard`, and for the `OtpMailer`
 * `TwoFactorService` needs. The throttler's storage
 * comes from the global `ThrottlerModule` that `PublicApiModule` registers.
 */
@Module({
  imports: [AuthModule, AssistantModule],
  controllers: [AssistantController],
  // The operator workspace is resolved here, beside the guards whose steps it
  // repeats; both services are stateless over the database, provided as the
  // admin modules provide them.
  providers: [WorkspaceService, TwoFactorService, OperatorScopeResolver],
})
export class AssistantPublicModule {}
