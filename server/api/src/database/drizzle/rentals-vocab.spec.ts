import {
  DepositRefundMethod,
  ExpenseCategory,
  ExpenseMethod,
  ExpenseSource,
  FaultAssigneeKind,
  FaultPhotoPhase,
  GuestHostKind,
  GuestRegistrationStatus,
  IdKind,
  LeaseActorRole,
  LeaseChargeKind,
  LeaseChargeStatus,
  LeaseDepositStatus,
  LeaseEventKind,
  LeaseFilingKind,
  LeaseFilingStatus,
  LeaseInvitationStatus,
  LeasePaymentChannel,
  LeasePaymentMethod,
  LeasePaymentStatus,
  LeaseReminderChannel,
  LeaseReminderKind,
  LeaseSignerRole,
  LeaseSigningMethod,
  LeaseStatus,
  LoanPurpose,
  MaintenanceStatus,
  MomoNetwork,
  MoveOutNoticeChannel,
  MoveOutNoticeStatus,
  MoveOutReasonCode,
  PayoutAccountKind,
  PayoutAccountStatus,
  RentalUnitState,
  TaxDeclarationStatus,
  TaxpayerKind,
  UnitKitchen,
  WorkOrderEventKind,
} from '@injishi/contracts';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  depositRefundMethodEnum,
  expenseCategoryEnum,
  expenseMethodEnum,
  expenseSourceEnum,
  filingStatusEnum,
  guestHostKindEnum,
  guestRegistrationStatusEnum,
  idKindEnum,
  invitationStatusEnum,
  leaseActorRoleEnum,
  leaseChargeKindEnum,
  leaseChargeStatusEnum,
  leaseDepositStatusEnum,
  leaseEventKindEnum,
  leaseFilingKindEnum,
  leasePaymentChannelEnum,
  leasePaymentMethodEnum,
  leasePaymentStatusEnum,
  leaseReminderChannelEnum,
  leaseReminderKindEnum,
  leaseSigningMethodEnum,
  leaseStatusEnum,
  loanPurposeEnum,
  maintenanceAssigneeKindEnum,
  maintenanceEventKindEnum,
  maintenancePhotoPhaseEnum,
  maintenanceStatusEnum,
  momoNetworkEnum,
  moveOutNoticeChannelEnum,
  moveOutNoticeStatusEnum,
  moveOutReasonEnum,
  payoutAccountKindEnum,
  payoutAccountStatusEnum,
  rentalUnitStateEnum,
  signerRoleEnum,
  taxDeclarationStatusEnum,
  taxpayerKindEnum,
  unitKitchenEnum,
} from './schema';

/**
 * Every rentals database enum holds exactly its zod list in
 * `packages/contracts/src/rentals/vocab.ts` (blueprint 1.1).
 *
 * The pgEnums are built from the zod `.options`, so they cannot drift in the
 * code; what this pins is the pairing itself, and the two types the rentals
 * tables share with older ones (`signer_role`, `invitation_status`), which are
 * written out by hand, and `filing_status`, which kept its name when
 * migration 0082 rebuilt it from `LeaseFilingStatus`. A value added to vocab.ts without its migration, or a
 * shared type widened for someone else, fails here.
 *
 * Order matters too: Postgres sorts enum values by their declared order, so a
 * list in another order is another type.
 */
const PAIRS: ReadonlyArray<readonly [string, { enumName: string; enumValues: readonly string[] }, { options: readonly string[] }]> = [
  ['lease_status', leaseStatusEnum, LeaseStatus],
  ['signer_role', signerRoleEnum, LeaseSignerRole],
  ['lease_signing_method', leaseSigningMethodEnum, LeaseSigningMethod],
  ['lease_actor_role', leaseActorRoleEnum, LeaseActorRole],
  ['lease_event_kind', leaseEventKindEnum, LeaseEventKind],
  ['invitation_status', invitationStatusEnum, LeaseInvitationStatus],
  ['lease_charge_kind', leaseChargeKindEnum, LeaseChargeKind],
  ['lease_charge_status', leaseChargeStatusEnum, LeaseChargeStatus],
  ['lease_payment_channel', leasePaymentChannelEnum, LeasePaymentChannel],
  ['lease_payment_method', leasePaymentMethodEnum, LeasePaymentMethod],
  ['lease_payment_status', leasePaymentStatusEnum, LeasePaymentStatus],
  ['lease_deposit_status', leaseDepositStatusEnum, LeaseDepositStatus],
  ['deposit_refund_method', depositRefundMethodEnum, DepositRefundMethod],
  ['lease_reminder_kind', leaseReminderKindEnum, LeaseReminderKind],
  ['lease_reminder_channel', leaseReminderChannelEnum, LeaseReminderChannel],
  ['rental_unit_state', rentalUnitStateEnum, RentalUnitState],
  ['unit_kitchen', unitKitchenEnum, UnitKitchen],
  ['id_kind', idKindEnum, IdKind],
  ['taxpayer_kind', taxpayerKindEnum, TaxpayerKind],
  ['payout_account_kind', payoutAccountKindEnum, PayoutAccountKind],
  ['payout_account_status', payoutAccountStatusEnum, PayoutAccountStatus],
  ['momo_network', momoNetworkEnum, MomoNetwork],
  ['move_out_notice_status', moveOutNoticeStatusEnum, MoveOutNoticeStatus],
  ['move_out_notice_channel', moveOutNoticeChannelEnum, MoveOutNoticeChannel],
  ['move_out_reason', moveOutReasonEnum, MoveOutReasonCode],
  ['lease_filing_kind', leaseFilingKindEnum, LeaseFilingKind],
  ['filing_status', filingStatusEnum, LeaseFilingStatus],
  // Guests (P5).
  ['guest_host_kind', guestHostKindEnum, GuestHostKind],
  ['guest_registration_status', guestRegistrationStatusEnum, GuestRegistrationStatus],
  // Faults (P4, migration 0087): the shared ticket lifecycle's states and timeline, assignees, photo phases.
  ['maintenance_status', maintenanceStatusEnum, MaintenanceStatus],
  ['maintenance_event_kind', maintenanceEventKindEnum, WorkOrderEventKind],
  ['maintenance_assignee_kind', maintenanceAssigneeKindEnum, FaultAssigneeKind],
  ['maintenance_photo_phase', maintenancePhotoPhaseEnum, FaultPhotoPhase],
  // Expenses (P4, migration 0088).
  ['expense_category', expenseCategoryEnum, ExpenseCategory],
  ['expense_method', expenseMethodEnum, ExpenseMethod],
  ['expense_source', expenseSourceEnum, ExpenseSource],
  ['loan_purpose', loanPurposeEnum, LoanPurpose],
  // Rental income tax (P4, migration 0089).
  ['tax_declaration_status', taxDeclarationStatusEnum, TaxDeclarationStatus],
];

describe('rentals database enums match the contracts vocabulary', () => {
  it.each(PAIRS)('%s', (name, pgEnum, zodEnum) => {
    expect(pgEnum.enumName).toBe(name);
    expect([...pgEnum.enumValues]).toEqual([...zodEnum.options]);
  });

  it('pairs every database enum built from a contracts list', () => {
    // A `pgEnum('x', Something.options)` anywhere in the schema without a pair
    // above would never be checked; read the schema files to find them all.
    const dir = __dirname;
    const built = new Set<string>();
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
      const text = readFileSync(join(dir, file), 'utf8');
      for (const m of text.matchAll(/pgEnum\(\s*'([a-z_]+)',\s*[A-Za-z]+\.options\s*\)/g)) built.add(m[1]);
    }
    const paired = new Set(PAIRS.map(([name]) => name));
    expect(built.size).toBeGreaterThan(0);
    expect([...built].filter((name) => !paired.has(name))).toEqual([]);
  });
});
