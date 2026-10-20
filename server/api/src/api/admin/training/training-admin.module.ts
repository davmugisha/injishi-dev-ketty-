import { Module } from '@nestjs/common';

import { TrainingModule } from '../../../modules/training/training.module';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminTrainingController } from './training-admin.controller';

/**
 * The training area of the admin console (ADR-049).
 *
 * An area module beside orgs, users, finance and platform, for the reason
 * `AdminApiModule` gives for the others: the console is navigated by area, and
 * an area can be built and verified on its own.
 *
 * `AdminSharedModule` supplies what every guarded admin route needs so
 * `StaffGuard` can resolve at all. `TrainingModule` supplies the services; the
 * controller holds no logic of its own beyond turning a staff permission into
 * the `SessionActor` the services take.
 */
@Module({
  imports: [AdminSharedModule, TrainingModule],
  controllers: [AdminTrainingController],
})
export class TrainingAdminModule {}
