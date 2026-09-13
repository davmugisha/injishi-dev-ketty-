import { Module } from '@nestjs/common';

import { AuthModule } from '../../../modules/auth/auth.module';
import { StorageModule } from '../../../modules/storage/storage.module';
import { TrainingModule } from '../../../modules/training/training.module';
import {
  TrainingController,
  TrainingVerificationController,
} from './training.controller';
import { VerificationThrottlerGuard } from './verification-throttler.guard';

/**
 * The public half of training, as one unit (ADR-049).
 *
 * `AuthModule` is imported because three of these routes carry `SessionGuard`,
 * which resolves `AUTH_INSTANCE` from it. The catalogue reads carry no guard at
 * all: `/training` must be readable with no cookie (AC-1).
 *
 * `StorageModule` is imported for the signed url on the certificate PDF route.
 * The throttler's options and storage need no import, they come from the global
 * `ThrottlerModule` that `PublicApiModule` registers.
 *
 * `VerificationThrottlerGuard` is a PROVIDER here as well as a guard on the
 * controller. A guard used through `@UseGuards(Class)` is instantiated by the
 * module of the controller it guards, and its `@Inject(TRAINING_CONFIG)` field
 * resolves from this module's scope, which is why `TrainingModule` exports that
 * token. Miss either half and it fails at boot rather than at typecheck.
 */
@Module({
  imports: [AuthModule, StorageModule, TrainingModule],
  controllers: [TrainingController, TrainingVerificationController],
  providers: [VerificationThrottlerGuard],
})
export class TrainingPublicModule {}
