import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { PaymentsModule } from '../pay/payments.module';
import { RentalsMailer } from '../rentals/infrastructure/rentals.mailer';
import { StorageModule } from '../storage/storage.module';
import { BrokerHomesService } from './application/broker-homes.service';
import { BrokerPlansService } from './application/broker-plans.service';
import { BrokerRegistrationFeeService } from './application/broker-registration-fee.service';
import { BrokerPlansProcessor } from './infrastructure/broker-plans.processor';
import { BrokerPlansRepository } from './infrastructure/broker-plans.repository';
import { BrokersRepository } from './infrastructure/brokers.repository';

/**
 * Brokers (P5, 2026-10-25): the broker's own surface. Plans (District free,
 * Province and Country by the month on the gateway, renewed hourly with three
 * days' grace), the opted-in homes inside the plan's area, free reveals of a
 * landlord's contact, placements, recorded fees and ratings, and the
 * registration fee paid before the broker row exists.
 *
 * The landlord's side of brokers (the opt-in on a unit, the broker on a
 * lease, its fee record and ratings) lives in the rentals module. Mail goes
 * through its own `RentalsMailer` over the mailer seam; `DatabaseModule` and
 * the queues are global. The BrokerPlans processor runs in the worker only.
 */
@Module({
  imports: [PaymentsModule, StorageModule, MailerModule],
  providers: [
    RentalsMailer,
    BrokersRepository,
    BrokerPlansRepository,
    BrokerPlansService,
    BrokerHomesService,
    BrokerRegistrationFeeService,
    ...(isWorkerProcess() ? [BrokerPlansProcessor] : []),
  ],
  exports: [BrokerPlansService, BrokerHomesService, BrokerRegistrationFeeService, BrokerPlansRepository],
})
export class BrokersModule {}
