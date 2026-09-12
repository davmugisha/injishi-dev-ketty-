import { Module } from '@nestjs/common';

import { AuthModule } from '../../../modules/auth/auth.module';
import { SupportTicketService } from './support-ticket.service';
import { SupportController } from './support.controller';

/**
 * The support intake as one unit, so `PublicApiModule` registers it with a
 * single import rather than a controller and a provider spread through lists
 * other work edits too.
 *
 * AuthModule is imported for `OptionalSessionGuard`, which resolves the Better
 * Auth instance. The throttler's options and storage need no import: they come
 * from the global `ThrottlerModule` that `PublicApiModule` registers.
 */
@Module({
  imports: [AuthModule],
  controllers: [SupportController],
  providers: [SupportTicketService],
})
export class SupportModule {}
