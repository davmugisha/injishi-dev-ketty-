import {
  AdminActionRequest,
  type AdminOboAuditResponse,
  type AdminOboListResponse,
  type AdminOrgDetail,
  AdminOrgListQuery,
  type AdminOrgListResponse,
  type AdminOrgMoney,
  type AdminOrgPeopleResponse,
  type AdminOrgPropertiesResponse,
  type AdminOrgReviewQueueResponse,
  type AdminOrgStatusChange,
  type AdminOrgSubscription,
  type AdminOrgTimelineResponse,
  type AdminTinRecheckResult,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminOrgActionsService } from './org-actions.service';
import { AdminOrgsService } from './orgs.service';
import { PagedReasonQuery } from './reason.query';

/** Paging query for the routes that take no filters of their own. */
const PageOnlyQuery = AdminOrgListQuery.pick({ page: true, pageSize: true });

/**
 * Businesses → /api/v1/admin/orgs.
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order, and the order is the
 * whole contract: `StaffGuard` throws a 500 rather than treating the request as
 * anonymous when the session has not been resolved first, so a reversed pair
 * fails loudly instead of quietly refusing every staffer.
 *
 * Route ORDER matters here too, and for a different reason. Nest matches in
 * declaration order, so the literal paths `review-queue` and `obo` are declared
 * BEFORE the `:orgId` parameter route. Reversed, the parameter route swallows
 * both of them, `ParseUUIDPipe` rejects "review-queue" as a uuid, and the
 * review queue answers 400 for a reason nothing on the screen explains.
 *
 * Permissions split on the axis the console does: reading a business is
 * `admin.business.view`, working its registration queue is
 * `admin.business.review`, its money is `admin.finance.view`, and its OBO trail
 * is `admin.audit.read`. A compliance staffer holds the audit permission and
 * not the finance one, and these decorators are what makes that difference real
 * rather than a sidebar that hides a link.
 */
@Controller({ path: 'admin/orgs', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminOrgsController {
  constructor(
    private readonly orgs: AdminOrgsService,
    private readonly actions: AdminOrgActionsService,
  ) {}

  /** The business directory, filtered and paged. */
  @Get()
  @RequireStaffPermission('admin.business.view')
  list(
    @Query(new ZodValidationPipe(AdminOrgListQuery)) query: AdminOrgListQuery,
  ): Promise<AdminOrgListResponse> {
    return this.orgs.listOrgs(query);
  }

  /** Businesses waiting at a registration gate. Declared before `:orgId`. */
  @Get('review-queue')
  @RequireStaffPermission('admin.business.review')
  reviewQueue(
    @Query(new ZodValidationPipe(PageOnlyQuery))
    query: { page?: number; pageSize?: number },
  ): Promise<AdminOrgReviewQueueResponse> {
    return this.orgs.reviewQueue(query.page ?? 1, query.pageSize ?? 25);
  }

  /**
   * The on-behalf-of register. Declared before `:orgId`.
   *
   * Identity data, so `reason` is required and a `record_access_logs` row is
   * written before the answer. The reason is not decoration: it is the column
   * that makes a read of somebody else's record explainable afterwards, which
   * is the only reason that table exists.
   */
  @Get('obo')
  @RequireStaffPermission('admin.business.view')
  obo(
    @Query(new ZodValidationPipe(PagedReasonQuery)) query: PagedReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminOboListResponse> {
    return this.orgs.listObo(
      user.id,
      query.reason,
      query.page ?? 1,
      query.pageSize ?? 25,
    );
  }

  /** One business in full. */
  @Get(':orgId')
  @RequireStaffPermission('admin.business.view')
  detail(
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<AdminOrgDetail> {
    return this.orgs.orgDetail(orgId);
  }

  /** Everyone inside one business. Identity data: reason required and logged. */
  @Get(':orgId/people')
  @RequireStaffPermission('admin.business.view')
  people(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query(new ZodValidationPipe(PagedReasonQuery)) query: PagedReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminOrgPeopleResponse> {
    return this.orgs.orgPeople(
      orgId,
      user.id,
      query.reason,
      query.page ?? 1,
      query.pageSize ?? 25,
    );
  }

  /** This business's properties, with its inventory counted per property. */
  @Get(':orgId/properties')
  @RequireStaffPermission('admin.business.view')
  properties(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query(new ZodValidationPipe(PageOnlyQuery))
    query: { page?: number; pageSize?: number },
  ): Promise<AdminOrgPropertiesResponse> {
    return this.orgs.orgProperties(orgId, query.page ?? 1, query.pageSize ?? 25);
  }

  /**
   * The subscription and the invoices beside it.
   *
   * `admin.finance.view`, not `admin.business.view`: a compliance staffer may
   * read a business without reading what it pays.
   */
  @Get(':orgId/subscription')
  @RequireStaffPermission('admin.finance.view')
  subscription(
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<AdminOrgSubscription> {
    return this.orgs.orgSubscription(orgId);
  }

  /** Every money fact about one business on one screen. */
  @Get(':orgId/money')
  @RequireStaffPermission('admin.finance.view')
  money(@Param('orgId', ParseUUIDPipe) orgId: string): Promise<AdminOrgMoney> {
    return this.orgs.orgMoney(orgId);
  }

  /** What has happened to this business, from `audit_events`. */
  @Get(':orgId/timeline')
  @RequireStaffPermission('admin.business.view')
  timeline(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query(new ZodValidationPipe(PageOnlyQuery))
    query: { page?: number; pageSize?: number },
  ): Promise<AdminOrgTimelineResponse> {
    return this.orgs.orgTimeline(orgId, query.page ?? 1, query.pageSize ?? 25);
  }

  /**
   * Both audit trails for an on-behalf-of registration.
   *
   * `admin.audit.read` rather than `admin.business.view`. This route returns
   * WHO READ the intended owner's details, and a list of other staff members'
   * reads is itself audit data — the population allowed to see who has been
   * looking is smaller than the population allowed to look.
   */
  @Get(':orgId/obo-audit')
  @RequireStaffPermission('admin.audit.read')
  oboAudit(
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<AdminOboAuditResponse> {
    return this.orgs.oboAudit(orgId);
  }

  // -------------------------------------------------------------------------
  // Writes. Each takes a written reason, answers 409 on a move the business is
  // not in a position to make, and writes exactly one `audit_events` row when
  // it succeeds (`AdminOrgActionsService`).
  //
  // `@HttpCode(200)`: these change something that already exists and create
  // nothing, so Nest's default 201 for a POST would be a false statement.
  // -------------------------------------------------------------------------

  /**
   * Suspend an active business.
   *
   * `admin.business.suspend`, a power of its own rather than a flavour of
   * review: `ops` holds it and `compliance` does not, so a staffer who may
   * read a business is not thereby able to stop it trading.
   */
  @Post(':orgId/suspend')
  @HttpCode(200)
  @RequireStaffPermission('admin.business.suspend')
  suspend(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminOrgStatusChange> {
    return this.actions.move(orgId, 'suspended', user.id, body.reason);
  }

  /** Put a suspended business back to trading. 409 unless it is suspended. */
  @Post(':orgId/reinstate')
  @HttpCode(200)
  @RequireStaffPermission('admin.business.reinstate')
  reinstate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminOrgStatusChange> {
    return this.actions.move(orgId, 'reinstated', user.id, body.reason);
  }

  /**
   * Ask RRA about this business's TIN again.
   *
   * `admin.business.review`: retrying the automatic gate is working the
   * registration queue, the same power that shows a staffer that queue at all.
   * It decides nothing itself — RRA's answer moves the business, exactly as it
   * would have the first time.
   */
  @Post(':orgId/tin-recheck')
  @HttpCode(200)
  @RequireStaffPermission('admin.business.review')
  tinRecheck(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminTinRecheckResult> {
    return this.actions.recheckTin(orgId, user.id, body.reason);
  }
}
