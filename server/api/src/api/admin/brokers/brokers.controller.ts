import {
  AdminActionRequest,
  AdminBrokerPlanUpdate,
  BrokerPlanCode,
  type AdminBrokerPlanList,
  type AdminBrokerSubscriptionList,
  type BrokerPlan,
  type AdminBrokerListResponse,
  type AdminBrokerStatusChange,
  AdminBrokerSubscriptionQuery,
  AdminOrgListQuery,
  type AdminRevealListResponse,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminBrokerActionsService } from './broker-actions.service';
import { AdminBrokerPlansService } from './broker-plans-admin.service';
import { AdminBrokersService } from './brokers.service';

/**
 * Paging alone. Taken from `AdminOrgListQuery` rather than written out again,
 * so the `pageSize` cap of 100 is defined once — an uncapped page size is a
 * denial of service handed to anyone with a staff session, and a second
 * hand-written copy of that cap is how one route ends up without it.
 */
const PageOnlyQuery = AdminOrgListQuery.pick({ page: true, pageSize: true });

/**
 * Brokers → /api/v1/admin/brokers.
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order, as everywhere in this
 * console: `StaffGuard` throws a 500 rather than treating the request as
 * anonymous when the session has not been resolved first.
 *
 * The one parameter route, `POST :brokerId/suspend`, is declared BELOW
 * `reveals` and could not swallow it anyway: it is a different method with a
 * different number of segments. Keep any future `GET :brokerId` below
 * `reveals` too, or Nest matches the parameter first and the reveal log
 * becomes a 400 on a uuid that is not one.
 *
 * Both reads require `admin.broker.view`, and the write requires
 * `admin.broker.approve`. A read route declaring the mutating permission would
 * quietly narrow who can look, so the two are kept apart.
 */
@Controller({ path: 'admin/brokers', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminBrokersController {
  constructor(
    private readonly brokers: AdminBrokersService,
    private readonly actions: AdminBrokerActionsService,
    private readonly plans: AdminBrokerPlansService,
  ) {}

  /** The three broker plans with their monthly prices (2026-10-25). */
  @Get('plans')
  @RequireStaffPermission('admin.broker.view')
  listPlans(): Promise<AdminBrokerPlanList> {
    return this.plans.plans();
  }

  /**
   * Change a plan's monthly price, with a reason, audited. The next payment
   * anyone makes uses it; a month already paid keeps its amount. District stays
   * free. `admin.fee.edit`, the fee catalog's power.
   */
  @Patch('plans/:code')
  @RequireStaffPermission('admin.fee.edit')
  pricePlan(
    @Param('code', new ZodValidationPipe(BrokerPlanCode)) code: BrokerPlanCode,
    @Body(new ZodValidationPipe(AdminBrokerPlanUpdate)) body: AdminBrokerPlanUpdate,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerPlan> {
    return this.plans.setPrice(code, body, user.id);
  }

  /** Every broker's paid plan, newest first, read only. */
  @Get('subscriptions')
  @RequireStaffPermission('admin.broker.view')
  subscriptions(
    @Query(new ZodValidationPipe(AdminBrokerSubscriptionQuery))
    query: AdminBrokerSubscriptionQuery,
  ): Promise<AdminBrokerSubscriptionList> {
    return this.plans.subscriptions(query);
  }

  /** The broker directory, with credits, reveals and placements counted. */
  @Get()
  @RequireStaffPermission('admin.broker.view')
  list(
    @Query(new ZodValidationPipe(PageOnlyQuery))
    query: { page?: number; pageSize?: number },
  ): Promise<AdminBrokerListResponse> {
    return this.brokers.listBrokers(query.page ?? 1, query.pageSize ?? 25);
  }

  /**
   * The contact-reveal log.
   *
   * No `reason` param, and that is the contract rather than an omission: this
   * route returns the FACT of a reveal and never the contact details it
   * revealed, so it discloses no third party's identity data and writes no
   * `record_access_logs` row. Add both the moment it starts returning a phone
   * number.
   */
  @Get('reveals')
  @RequireStaffPermission('admin.broker.view')
  reveals(
    @Query(new ZodValidationPipe(PageOnlyQuery))
    query: { page?: number; pageSize?: number },
  ): Promise<AdminRevealListResponse> {
    return this.brokers.listReveals(query.page ?? 1, query.pageSize ?? 25);
  }

  /**
   * Suspend an active broker. 409 when the broker is already suspended.
   *
   * `admin.broker.approve`, BECAUSE NO `admin.broker.suspend` EXISTS and this
   * route may not invent one — `staff-authz.ts` is the one model, and a
   * permission named only here would resolve to a power no role holds and
   * 403 every staffer. Approve is the one broker power that changes a broker's
   * standing, and it is held by exactly the roles that should be able to
   * withdraw that standing (`ops`, `super_admin`). If the two ever need to be
   * split, the new permission is added to `staff-authz.ts` first and this
   * decorator changes second.
   *
   * `@HttpCode(200)`: it changes a broker that exists and creates nothing.
   */
  @Post(':brokerId/suspend')
  @HttpCode(200)
  @RequireStaffPermission('admin.broker.approve')
  suspend(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminBrokerStatusChange> {
    return this.actions.suspend(brokerId, user.id, body.reason);
  }
}
