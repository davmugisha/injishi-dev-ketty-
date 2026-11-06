import { Module } from '@nestjs/common';

import { MailerModule } from '../mailer/mailer.module';
import { EntitlementsService } from './application/entitlements.service';
import { EntitlementMailer } from './infrastructure/entitlement.mailer';
import { EntitlementsRepository } from './infrastructure/entitlements.repository';

/**
 * Injishi staff switching a business's products on and off (ADR-076 G6 to G8),
 * behind `PUT /admin/orgs/:orgId/products/:productId`.
 *
 * ADR-074 puts the entitlement table under `platform/billing`, which Account
 * reads. The parts every module needs, the rules (G5), the check a guest or
 * public service asks (G10) and the defaults written on creation and on every
 * path into `active` (G2), are cross cutting like the guards and live in
 * `shared/entitlements/`; this module holds only the staff change.
 *
 * Exports the application service only, as the admin rule asks.
 */
@Module({
  imports: [MailerModule],
  providers: [EntitlementsService, EntitlementsRepository, EntitlementMailer],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
