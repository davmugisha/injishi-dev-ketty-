import type {
  BrokerRegistrationSummary,
  CreateBrokerRegistrationRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import {
  BrokerRepository,
  DuplicateBrokerError,
  FeeNotPaidError,
} from '../infrastructure/broker.repository';
import { IdentityService } from '../../user/application/identity.service';
import { RegistrationDraftService } from './registration-draft.service';
import { ProfileService } from '../../user/application/profile.service';

/**
 * Broker registration (F-R09, ADR-026 assumption 2).
 *
 * The third arm of the registration funnel and the shortest one: a broker is a
 * person who places tenants, not a business that takes money from the public,
 * so none of the apparatus D20 built for orgs applies: no invoice, no RRA call,
 * no field verification and no approver. What a broker does need is the same
 * KYC'd identity every registrant needs, which is why Step 1 runs unchanged and
 * this service refuses an incomplete profile the same way the business path
 * does; the district they work in (the free plan shows its homes); and the
 * registration fee (2026-10-25, `registration_fees` broker row), paid by mobile
 * money first and tied to the new broker in the same transaction.
 *
 * Held in the organization module rather than a module of its own, because it
 * shares Step 1 with `RegistrationService` and shares nothing with anything
 * else. When F-R02 and F-R08 land the directory and the earnings, a broker
 * module is the right home and this moves into it whole.
 */
@Injectable()
export class BrokerRegistrationService {
  constructor(
    private readonly brokers: BrokerRepository,
    private readonly profiles: ProfileService,
    /** A broker is a verified person, where a check can run (ADR-060, MFP PRD KYC table). */
    private readonly identity: IdentityService,
    private readonly drafts: RegistrationDraftService,
  ) {}

  /**
   * Register the caller as a broker, or hand back the registration they have.
   *
   * Idempotent by lookup rather than by upsert: pressing the button twice is a
   * person who was not sure it worked, and the right answer is the broker they
   * already are, not a second row that `brokers_user_uk` would refuse anyway.
   */
  async register(
    request: CreateBrokerRegistrationRequest,
    userId: string,
  ): Promise<BrokerRegistrationSummary> {
    const existing = await this.brokers.findByUser(userId);
    if (existing) {
      return {
        brokerId: existing.brokerId,
        workspaceId: existing.workspaceId,
        name: existing.name ?? '',
        status: 'active',
      };
    }

    if (request.personal) {
      await this.profiles.save(userId, request.personal);
    }

    const profile = await this.profiles.read(userId);
    if (!(await this.profiles.isComplete(userId))) {
      throw new BadRequestException(
        'We still need your personal details before you can register as a broker.',
      );
    }
    await this.identity.assertMayRegister(userId);
    if (!(await this.brokers.districtExists(request.homeDistrictId))) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['homeDistrictId'], message: 'Choose the district you work in from the list.' }],
      });
    }

    // The full number, from the STORED document rather than from the request.
    // A returning registrant sends no `personal` block at all — their profile
    // already holds it — so reading the request here would refuse exactly the
    // people who have already given us the number.
    const nationalId = await this.profiles.nationalIdFor(userId);
    if (!nationalId) {
      throw new BadRequestException(
        'Broker registration needs a Rwandan National ID. Add one to your profile first.',
      );
    }

    try {
      const created = await this.brokers.create({
        userId,
        nationalId,
        name: profile.fullName,
        phone: profile.phoneE164,
        email: null,
        homeDistrictId: request.homeDistrictId,
        feePaymentId: request.feePaymentId,
      });
      // A broker's registration ends here, so the wizard's draft does too (ADR-060).
      await this.drafts.clear(userId);
      return {
        brokerId: created.brokerId,
        workspaceId: created.workspaceId,
        name: created.name ?? '',
        status: 'active',
      };
    } catch (err) {
      if (err instanceof DuplicateBrokerError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof FeeNotPaidError) {
        throw new ConflictException({ code: err.waiting ? 'fee_waiting' : 'fee_not_paid', message: err.message });
      }
      throw err;
    }
  }
}
