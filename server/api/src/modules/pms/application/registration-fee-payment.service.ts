import {
  instrumentProblem,
  type RegistrationFeeAttemptStatus,
  type RegistrationPayRequest,
  type RegistrationPayResult,
} from '@injishi/contracts';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { awaitsRegistrationFee } from '../../organization/domain/registration-status';
import { PaymentSeam } from '../../pay/domain/payment-seam';
import { REGISTRATION_FEES, type RegistrationFees } from '../domain/registration-fees';
import { PaymentAttemptService } from './payment-attempt.service';

/**
 * Paying a registration's fee (073-gtbank-payments AC-16).
 *
 * Joins the registration (organization module) to the attempt that waits on
 * the registrant's handset (this module), so neither module imports the other
 * the wrong way round. Every check runs BEFORE any prompt is sent: money taken
 * for a registration that cannot be settled is money that has to be refunded.
 */
@Injectable()
export class RegistrationFeePaymentService {
  constructor(
    @Inject(REGISTRATION_FEES) private readonly registrations: RegistrationFees,
    private readonly attempts: PaymentAttemptService,
    private readonly seam: PaymentSeam,
  ) {}

  async pay(orgId: string, userId: string, body: RegistrationPayRequest): Promise<RegistrationPayResult> {
    // Ownership, not just a session: a stranger must not learn a registration exists.
    await this.registrations.assertOwns(orgId, userId);

    // Free while payments are off for this purpose, exactly as before (call 9).
    if (this.seam.isOffFor('registration_fee')) {
      return {
        kind: 'settled',
        registration: await this.registrations.settleFeeAndVerify(orgId, {
          trigger: 'registrant',
          actorUserId: userId,
        }),
      };
    }

    const facts = await this.registrations.feeFacts(orgId);
    if (!facts) throw new NotFoundException('Registration not found.');
    // Already past the fee: nothing to charge, and nothing is. No contract is asked for first: ADR-075 moved the
    // agreement to after approval (AC-12).
    if (!awaitsRegistrationFee(facts.status)) {
      return { kind: 'settled', registration: await this.registrations.summary(orgId) };
    }
    if (!facts.invoiceId || facts.amountDueRwf == null || !facts.workspaceId) {
      // A registration awaiting its fee always has its invoice and workspace;
      // without them there is nothing to charge against.
      throw new InternalServerErrorException('This registration has no fee to pay. Contact support.');
    }

    const { attemptToken, instrument } = body;
    if (!attemptToken || !instrument) {
      throw new UnprocessableEntityException('Choose a mobile money number to pay the registration fee from.');
    }
    if (instrument.kind !== 'mobile_money') {
      throw new UnprocessableEntityException('The registration fee is paid by mobile money.');
    }
    const problem = instrumentProblem(instrument);
    if (problem) throw new UnprocessableEntityException(problem);
    // A network not prompted here, or a fee above the collection limit, is
    // refused before any attempt or prompt (073-gtbank-payments AC-23).
    const ruleFault = this.seam.ruleProblem(facts.amountDueRwf, instrument);
    if (ruleFault) throw new UnprocessableEntityException(ruleFault);

    const attempt = await this.attempts.beginForRegistrationFee({
      invoiceId: facts.invoiceId,
      workspaceId: facts.workspaceId,
      registrantUserId: userId,
      amountRwf: facts.amountDueRwf,
      legalName: facts.legalName,
      instrument,
      attemptToken,
    });
    return {
      kind: 'attempt',
      attempt: { ...attempt, registration: await this.registrations.summary(orgId) },
    };
  }

  /** The registrant's poll of one press. A token from another registration is a 404. */
  async poll(orgId: string, userId: string, attemptToken: string): Promise<RegistrationFeeAttemptStatus> {
    await this.registrations.assertOwns(orgId, userId);
    const { status, invoiceId } = await this.attempts.pollRegistrationFee(attemptToken, userId);
    if ((await this.registrations.orgOfRegistrationInvoice(invoiceId)) !== orgId) {
      throw new NotFoundException('No such payment attempt.');
    }
    return { ...status, registration: await this.registrations.summary(orgId) };
  }
}
