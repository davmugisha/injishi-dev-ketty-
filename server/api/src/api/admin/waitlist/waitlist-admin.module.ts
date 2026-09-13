import { Module } from '@nestjs/common';

import { AdminSharedModule } from '../admin-shared.module';
import { AdminWaitlistController } from './waitlist-admin.controller';
import { AdminWaitlistService } from './waitlist-admin.service';

/**
 * The waitlist area of the admin console (ADR-048 AC-17).
 *
 * A fifth area module beside orgs, users, finance and platform, rather than a
 * controller bolted onto one of them, for the reason `AdminApiModule` gives for
 * the other four: the console is navigated by area, and this whole area is
 * deleted at launch. One folder in, one folder out.
 *
 * `AdminSharedModule` is imported for the two things every guarded admin route
 * needs, `AuthModule` and `TwoFactorService`, which is what lets `StaffGuard`
 * resolve at all.
 */
@Module({
  imports: [AdminSharedModule],
  controllers: [AdminWaitlistController],
  providers: [AdminWaitlistService],
})
export class WaitlistAdminModule {}
