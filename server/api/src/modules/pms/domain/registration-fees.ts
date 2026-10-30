import type { OrgRegistrationStatus, RegistrationSummary } from '@injishi/contracts';

/**
 * What paying a registration's fee needs from registration
 * (073-gtbank-payments AC-16), and nothing more.
 *
 * A narrow port rather than `RegistrationService` itself, so the payment side
 * names only the acts it relies on and stays loadable without the whole
 * registration graph. `BookingModule` binds it to `RegistrationService`.
 */
export const REGISTRATION_FEES = Symbol('REGISTRATION_FEES');

/** Who moved a registration: the registrant's press (free), or the payment settling. */
export type FeeMover = { trigger: 'registrant'; actorUserId: string } | { trigger: 'system'; actorUserId: null };

export interface RegistrationFees {
  /** Refuses (404) a caller who does not own the registration. */
  assertOwns(orgId: string, userId: string): Promise<void>;
  /** Where the registration stands and its pending invoice; null when absent. */
  feeFacts(orgId: string): Promise<{
    status: OrgRegistrationStatus;
    workspaceId: string | null;
    invoiceId: string | null;
    amountDueRwf: number | null;
    legalName: string;
  } | null>;
  /** The registration as the registrant reads it. */
  summary(orgId: string): Promise<RegistrationSummary>;
  /** Settle the fee with no money moving (payments off), then run the TIN check. */
  settleFeeAndVerify(orgId: string, mover: FeeMover): Promise<RegistrationSummary>;
  /** The org a registration invoice bills, or null. */
  orgOfRegistrationInvoice(invoiceId: string): Promise<string | null>;
  /** Settle the fee because a payment for it landed; once per claimed attempt. */
  settleFeeFromPayment(orgId: string): Promise<'settled' | 'already_settled' | 'not_payable'>;
  /**
   * The bank reversed the fee and two people chose not to carry it
   * (073-gtbank-payments AC-20): the paid invoice is pending again, to be
   * paid again. False when it was not paid.
   */
  reopenFeeAfterReversal(invoiceId: string): Promise<boolean>;
}
