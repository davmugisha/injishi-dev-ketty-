import {
  AdminPayoutQuery,
  type AdminFailedChargeResponse,
  type AdminLedgerResponse,
  type AdminPayoutResponse,
  type AdminReconRunResponse,
} from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { FinanceAdminService } from './finance.service';

/**
 * Paging-only query params, for the three finance lists that take no filter.
 *
 * DERIVED from `AdminPayoutQuery` rather than declared beside it. Writing
 * `{ page: z.coerce.number()... }` here would be a second definition of the
 * page cap, and the failure mode is silent: the day the contract lowers
 * `pageSize`'s ceiling, three routes keep the old one and an uncapped page
 * becomes a denial of service handed to anyone with a staff session. `.omit()`
 * cannot drift.
 */
const AdminFinancePageQuery = AdminPayoutQuery.omit({ status: true });
type AdminFinancePageQuery = typeof AdminFinancePageQuery._output;

/**
 * The admin console's Finance section -> `/api/v1/admin/finance` (F-A06).
 *
 * `@UseGuards(SessionGuard, StaffGuard)`, in that order and never the other
 * way: `StaffGuard` throws a 500 when it runs with no session on the request,
 * because a 403 there would look like a working control from the outside and
 * read as "that staffer lost their access" in a log — nobody would go looking
 * for the missing decorator. The order is load bearing, not stylistic.
 *
 * Every route is `admin.finance.view`. There is no finer split, and inventing
 * one here would be inventing a permission: `staff-authz.ts` is the ONE model,
 * and a name this file made up would resolve to a power nobody holds and 403
 * every caller in production.
 *
 * These are the routes the class comment on `StaffGuard` names as the reason it
 * exists — `curl /api/v1/admin/finance/ledger` with a hotelier's own cookie is
 * the attack the console's client-side staff check does nothing about.
 */
@Controller({ path: 'admin/finance', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminFinanceController {
  constructor(private readonly finance: FinanceAdminService) {}

  /** Every posting in the book, newest first. */
  @Get('ledger')
  @RequireStaffPermission('admin.finance.view')
  ledger(
    @Query(new ZodValidationPipe(AdminFinancePageQuery))
    query: AdminFinancePageQuery,
  ): Promise<AdminLedgerResponse> {
    return this.finance.ledger(query);
  }

  /** Money owed out, optionally narrowed to one status. */
  @Get('payouts')
  @RequireStaffPermission('admin.finance.view')
  payouts(
    @Query(new ZodValidationPipe(AdminPayoutQuery)) query: AdminPayoutQuery,
  ): Promise<AdminPayoutResponse> {
    return this.finance.payouts(query);
  }

  /** Invoices — registration fees and subscription charges both — that failed. */
  @Get('failed-charges')
  @RequireStaffPermission('admin.finance.view')
  failedCharges(
    @Query(new ZodValidationPipe(AdminFinancePageQuery))
    query: AdminFinancePageQuery,
  ): Promise<AdminFailedChargeResponse> {
    return this.finance.failedCharges(query);
  }

  /** The match against the payment adapter. Discrepancies are flagged, never cleared. */
  @Get('reconciliation-runs')
  @RequireStaffPermission('admin.finance.view')
  reconciliationRuns(
    @Query(new ZodValidationPipe(AdminFinancePageQuery))
    query: AdminFinancePageQuery,
  ): Promise<AdminReconRunResponse> {
    return this.finance.reconciliationRuns(query);
  }
}
