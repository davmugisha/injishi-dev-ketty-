import { Module } from '@nestjs/common';

import { MailerModule } from '../../../modules/mailer/mailer.module';
import { WaitlistMailProcessor } from './waitlist-mail.processor';
import { WaitlistWelcomeMailer } from './waitlist-welcome.mailer';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

/**
 * The waitlist as one unit (ADR-048), so `PublicApiModule` registers it with a
 * single import and launch day removes it with a single deletion.
 *
 * The processor is a provider here rather than in a worker-only list because
 * this repository has no such list: `AppModule` composes the same modules in
 * both processes and `main.ts` decides which role to start, so a `@Processor`
 * registered anywhere activates in the worker and lies dormant in the HTTP
 * process.
 *
 * No `AuthModule`: nothing here reads a session, by design. Somebody joining a
 * waitlist for an unlaunched product has no account. The throttler's options
 * and storage need no import either, they come from the global
 * `ThrottlerModule` that `PublicApiModule` registers, and the queue comes from
 * the global `QueuesModule`.
 */
@Module({
  imports: [MailerModule],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistWelcomeMailer, WaitlistMailProcessor],
})
export class WaitlistModule {}
