import {
  ConfirmPsfClaimRequest,
  PsfClaimsQuery,
  RejectPsfClaimRequest,
  UploadPsfMemberListRequest,
  type PsfClaimsPage,
  type PsfMemberListResult,
  CreatePsfApplicationRequest,
  PayPsfMembershipRequest,
  PsfApproveRequest,
  PsfBusinessesQuery,
  PsfBranchDecisionRequest,
  PsfSendBackRequest,
  PsfFeesQuery,
  type PsfFeesView,
  PsfAreaQuery,
  PsfQueueAreaQuery,
  AppointPsfTeamRequest,
  PsfPaymentReminderRequest,
  type PsfPaymentReminderResult,
  EndPsfTeamQuery,
  type PsfTeamView,
  type OversightGrant,
  type PsfBusinessesPage,
  type PsfCatalogue,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfBusinessDetail,
  type PsfBusinessHistory,
  type PsfQueuePage,
  type PsfFormFieldsPublic,
  type PsfRegisterSummary,
  type PsfTier,
} from '@injishi/contracts';
import {
  Body,
  Delete,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import { PsfCertificatesService } from '../../../modules/organization/application/psf-certificates.service';
import { PsfPublicService } from '../../../modules/organization/application/psf-public.service';
import { PsfTeamService } from '../../../modules/organization/application/psf-team.service';
import type { FileReply } from '../ops/pay-runs.controller';
import {
  CurrentOversight,
  OversightGuard,
  RequireOversight,
} from '../../../shared/auth/oversight.guard';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * PSF membership (ADR-056, widened by the PSF path), in four controllers
 * because they answer four different callers: anyone reading PSF's price list
 * and sectors, a business's applicant, a PSF membership officer working the
 * queue, and the same officer reading the register of their region.
 */

/**
 * PSF's tiers and sectors. Public, like the registration fee quote: a price
 * nobody can see before signing in is a price nobody trusts, and the PSF page
 * shows both to a visitor deciding whether to register.
 */
@Controller({ path: 'psf', version: '1' })
export class PsfTiersController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('tiers')
  tiers(): Promise<PsfTier[]> {
    return this.psf.tiers();
  }

  /** `?district=` adds that district's own subtypes to the national ones. */
  @Get('catalogue')
  catalogue(@Query('district') district?: string): Promise<PsfCatalogue> {
    const id = Number(district);
    return this.psf.catalogue(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  /** What each band costs in a district: PSF sets it, the form shows it read only. */
  @Get('fees')
  fees(@Query(new ZodValidationPipe(PsfFeesQuery)) query: PsfFeesQuery): Promise<PsfFeesView> {
    return this.psf.feesIn(query.district);
  }

  /** Active officer-configured extras on the membership form (registration + public). */
  @Get('form-fields')
  formFields(): Promise<PsfFormFieldsPublic> {
    return this.psf.formFieldsPublic();
  }
}

/**
 * A business's PSF membership (AC-15 to AC-17). Guarded by the session and the
 * applicant rule the service applies, NOT by `WorkspaceGuard`: a business in
 * the registration pipeline holds no permission, and this must work there.
 */
@Controller({ path: 'orgs/:orgId', version: '1' })
@UseGuards(SessionGuard)
export class PsfMembershipController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('psf-membership')
  overview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.overview(orgId, user.id);
  }

  /** Throttled per person, like every write that reaches another party. */
  @Post('psf-applications')
  @HttpCode(201)
  @UseGuards(UserThrottlerGuard)
  apply(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(CreatePsfApplicationRequest))
    body: CreatePsfApplicationRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.apply(orgId, user.id, body);
  }

  @Post('psf-applications/:applicationId/withdraw')
  @HttpCode(200)
  withdraw(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.withdraw(orgId, user.id, applicationId);
  }

  /**
   * Pay an approved application's fee by mobile money (the PSF path). Money,
   * so throttled on the money bucket, like the TIN check that also reaches a
   * third party. Idempotent on the application: a second press finds the
   * first charge.
   */
  @Post('psf-applications/:applicationId/pay')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  pay(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PayPsfMembershipRequest)) body: PayPsfMembershipRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.pay(orgId, user.id, applicationId, body);
  }
}

/**
 * The Membership console's queue (AC-10 to AC-14). Bounded by the officer's
 * region: a district officer reads their district's applications, a country
 * officer every one.
 */
@Controller({ path: 'oversight/psf-applications', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
// BDEs read here (2026-11-02); every write below names the District Manager's role alone.
@RequireOversight('psf_membership_officer', 'psf_business_officer')
export class OversightPsfController {
  constructor(
    private readonly psf: PsfMembershipService,
    private readonly publicPsf: PsfPublicService,
  ) {}

  /** The member's certificate, for an officer covering the business. */
  @Get(':applicationId/certificate')
  async certificate(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.publicPsf.certificate(await this.docIdOf(user.id, grants, applicationId));
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.content);
  }

  /** Mail the certificate to the email the business gave with its application. */
  @Post(':applicationId/certificate/email')
  @RequireOversight('psf_membership_officer')
  @HttpCode(200)
  async emailCertificate(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<{ sentTo: string }> {
    return this.publicPsf.emailCertificate(await this.docIdOf(user.id, grants, applicationId));
  }

  /** The docID of an application in the officer's region; a hotel's has none. */
  private async docIdOf(userId: string, grants: OversightGrant[], applicationId: string): Promise<string> {
    const app = await this.psf.officerApplication(userId, grants, applicationId);
    if (!app.docId) throw new ConflictException('This application has no public certificate.');
    return app.docId;
  }

  @Get()
  queue(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfQueueAreaQuery)) query: PsfQueueAreaQuery,
  ): Promise<PsfQueuePage> {
    return this.psf.queue(user.id, grants, query);
  }

  /** The business behind an application: every payment, application and membership it has had. */
  @Get(':applicationId/history')
  history(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfBusinessHistory> {
    return this.psf.businessHistoryFor(grants, applicationId);
  }

  @Get(':applicationId')
  application(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.officerApplication(user.id, grants, applicationId);
  }

  @Post(':applicationId/approve')
  @RequireOversight('psf_membership_officer')
  @HttpCode(200)
  approve(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PsfApproveRequest)) body: PsfApproveRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.approve(user.id, grants, applicationId, body);
  }

  /** Send it back with what to fix (2026-11-05): PSF never rejects. */
  @Post(':applicationId/send-back')
  @RequireOversight('psf_membership_officer')
  @HttpCode(200)
  sendBack(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PsfSendBackRequest)) body: PsfSendBackRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.sendBack(user.id, grants, applicationId, body);
  }

  /** Admit or decline one branch: the officer of the branch's district decides it (2026-10-23). */
  @Post(':applicationId/branches/:branchId/decision')
  @RequireOversight('psf_membership_officer')
  @HttpCode(200)
  decideBranch(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body(new ZodValidationPipe(PsfBranchDecisionRequest)) body: PsfBranchDecisionRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.decideBranch(user.id, grants, applicationId, branchId, body);
  }
}

/**
 * The officer's register of businesses (the PSF path): every business in their
 * region, what kind it is, and how it stands with PSF, with a summary to read
 * the region at a glance.
 */
@Controller({ path: 'oversight/psf', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
// BDEs read here (2026-11-02); every write below names the District Manager's role alone.
@RequireOversight('psf_membership_officer', 'psf_business_officer')
export class OversightPsfRegisterController {
  constructor(
    private readonly psf: PsfMembershipService,
    private readonly certificates: PsfCertificatesService,
  ) {}

  @Get('businesses')
  businesses(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfBusinessesQuery)) query: PsfBusinessesQuery,
  ): Promise<PsfBusinessesPage> {
    return this.psf.register(grants, query);
  }

  /** One business, with every payment, application and membership it has had. */
  @Get('businesses/:orgId')
  business(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfBusinessDetail> {
    return this.psf.businessDetail(grants, orgId);
  }

  /** A member's certificate (2026-11-02), whichever way it became one: applied, or confirmed from its card. */
  @Get('businesses/:orgId/certificate')
  async certificate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    // The business must be one the officer covers: its page answers 404 otherwise.
    await this.psf.businessDetail(grants, orgId);
    const file = await this.certificates.forOrg(orgId);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.content);
  }

  /** A member's card as a PDF (2026-11-05), for the officer covering the business. */
  @Get('businesses/:orgId/card')
  async memberCard(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    await this.psf.businessDetail(grants, orgId);
    const file = await this.certificates.cardForOrg(orgId);
    reply.header('content-type', 'application/pdf').header('content-disposition', `attachment; filename="${file.filename}"`).header('cache-control', 'no-store').send(file.content);
  }

  /** The owner's passport photo (2026-11-05), for the officer covering the business. */
  @Get('businesses/:orgId/photo')
  async ownerPhoto(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    await this.psf.businessDetail(grants, orgId);
    const file = await this.certificates.photoOfOrg(orgId);
    if (!file) throw new NotFoundException('This business has no photo on file.');
    reply.header('content-type', file.mime).header('cache-control', 'no-store').header('cross-origin-resource-policy', 'cross-origin').header('x-content-type-options', 'nosniff').send(file.bytes);
  }

  /** Remind one business, or every one waiting in the region, that its application waits for its payment. */
  @Post('payment-reminders')
  @HttpCode(200)
  @RequireOversight('psf_membership_officer')
  paymentReminders(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(PsfPaymentReminderRequest)) body: PsfPaymentReminderRequest,
  ): Promise<PsfPaymentReminderResult> {
    return this.psf.sendPaymentReminders(user.id, grants, body.orgId);
  }

  @Get('summary')
  summary(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfAreaQuery)) area: PsfAreaQuery,
  ): Promise<PsfRegisterSummary> {
    return this.psf.registerSummary(grants, area);
  }

  /** Membership numbers businesses typed, waiting for PSF or decided (0121), in the officer's region. */
  @Get('claims')
  claims(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfClaimsQuery)) query: PsfClaimsQuery,
  ): Promise<PsfClaimsPage> {
    return this.psf.claims(grants, query);
  }

  /** Confirm a claim against PSF's records: the tier and dates; the business becomes a member. */
  @Post('claims/:id/confirm')
  @RequireOversight('psf_membership_officer')
  @HttpCode(204)
  async confirmClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(ConfirmPsfClaimRequest)) body: ConfirmPsfClaimRequest,
  ): Promise<void> {
    await this.psf.confirmClaim(user.id, grants, id, body);
  }

  /** Send a card back with what to fix (2026-11-05): the business resends it by a signed link. */
  @Post('claims/:id/send-back')
  @RequireOversight('psf_membership_officer')
  @HttpCode(204)
  async sendBackClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(RejectPsfClaimRequest)) body: RejectPsfClaimRequest,
  ): Promise<void> {
    await this.psf.sendBackClaim(user.id, grants, id, body);
  }

  /** PSF's own member list, from its spreadsheet; open claims it matches are confirmed. */
  @Post('member-list')
  @RequireOversight('psf_membership_officer')
  uploadMemberList(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(UploadPsfMemberListRequest)) body: UploadPsfMemberListRequest,
  ): Promise<PsfMemberListResult> {
    return this.psf.uploadMemberList(user.id, body);
  }
}

/**
 * The PSF team (2026-11-02): the District Managers and BDEs (Business
 * Development & Empowerment) in the caller's districts. A Regional Manager (or
 * the National Manager) appoints District Managers; a District Manager its BDEs.
 */
@Controller({ path: 'oversight/psf/team', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('psf_membership_officer', 'psf_business_officer')
export class OversightPsfTeamController {
  constructor(private readonly team: PsfTeamService) {}

  @Get()
  view(@CurrentOversight() grants: OversightGrant[]): Promise<PsfTeamView> {
    return this.team.view(grants);
  }

  @Post()
  @RequireOversight('psf_membership_officer')
  appoint(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(AppointPsfTeamRequest)) body: AppointPsfTeamRequest,
  ): Promise<PsfTeamView> {
    return this.team.appoint(user.id, grants, body);
  }

  /** End an appointment; the reason rides on the query, as the admin console's does. */
  @Delete(':assignmentId')
  @RequireOversight('psf_membership_officer')
  end(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query(new ZodValidationPipe(EndPsfTeamQuery)) query: EndPsfTeamQuery,
  ): Promise<PsfTeamView> {
    return this.team.end(user.id, grants, assignmentId, query.reason);
  }
}
