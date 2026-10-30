import {
  CreatePsfFormFieldRequest,
  CreatePsfSubsectorRequest,
  SetPsfTierFeeRequest,
  type PsfOfficerFeesView,
  PsfAreaQuery,
  UpdatePsfFormFieldRequest,
  UpdatePsfSubsectorRequest,
  type PsfSubsectorsView,
  PsfDecisionsQuery,
  PsfDocId,
  PsfIdentityConfirmRequest,
  PsfIdentityLookupRequest,
  PsfPublicSubmitRequest,
  PsfReportQuery,
  PsfTrackPayRequest,
  PSF_CHECK_TOKEN_HEADER,
  type OversightGrant,
  type PsfFormFieldsOfficerView,
  type PsfLogoUploadResult,
  type PsfDecisionsPage,
  type PsfIdentityLookupResult,
  type PsfOfficerScope,
  type PsfPublicSubmitResult,
  type PsfRegistrationProfile,
  type PsfReport,
  type PsfTrackPayResult,
  type PsfTrackView,
  type PsfVerifiedApplicant,
} from '@injishi/contracts';
import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpException, Logger, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import { PsfPublicService } from '../../../modules/organization/application/psf-public.service';
import { PsfReportService } from '../../../modules/organization/application/psf-report.service';
import { MAX_LOGO_BYTES } from '../../../modules/storage/domain/storage-port';
import { CurrentOversight, OversightGuard, RequireOversight } from '../../../shared/auth/oversight.guard';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../ops/pay-runs.controller';
import { PsfPublicThrottlerGuard } from './psf-public-throttler.guard';

const docIdPipe = new ZodValidationPipe(PsfDocId);

/** The multipart surface this controller reads, as the uploads controller types it. */
interface LogoRequest {
  isMultipart?: () => boolean;
  file?: (options?: { limits?: { fileSize?: number } }) => Promise<
    { filename?: string; mimetype?: string; file?: { truncated?: boolean }; toBuffer: () => Promise<Buffer> } | undefined
  >;
}

/**
 * THE PUBLIC PSF PATH (2026-10-19): register a business for PSF with no
 * account, and follow it by docID. Nothing here takes a session.
 *
 * The form routes count against `psf-form`, the tracking routes against
 * `psf-track` (`PsfPublicThrottlerGuard`).
 */
@Controller({ path: 'psf', version: '1' })
@UseGuards(PsfPublicThrottlerGuard)
export class PsfPublicController {
  private readonly logger = new Logger(PsfPublicController.name);

  constructor(private readonly psf: PsfPublicService) {}

  @Post('identity/lookup')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  lookup(@Body(new ZodValidationPipe(PsfIdentityLookupRequest)) body: PsfIdentityLookupRequest): Promise<PsfIdentityLookupResult> {
    return this.psf.lookup(body);
  }

  @Post('identity/confirm')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  confirm(@Body(new ZodValidationPipe(PsfIdentityConfirmRequest)) body: PsfIdentityConfirmRequest): Promise<PsfVerifiedApplicant> {
    return this.psf.confirm(body);
  }

  @Post('applications')
  @HttpCode(201)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  async submit(@Body(new ZodValidationPipe(PsfPublicSubmitRequest)) body: PsfPublicSubmitRequest): Promise<PsfPublicSubmitResult> {
    try {
      return await this.psf.submit(body);
    } catch (error) {
      // A refused form is logged by field and reason (never by value), so a
      // business stuck on "send" can be helped from the log.
      if (error instanceof HttpException && error.getStatus() < 500) {
        const res = error.getResponse() as { message?: unknown; issues?: { path?: unknown[]; message?: string }[] };
        const why = res.issues?.map((i) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ') ?? String(res.message ?? error.message);
        this.logger.warn(`PSF form refused (${error.getStatus()}): ${why}`);
      }
      throw error;
    }
  }

  /**
   * The business's logo, from the form (2026-10-23). Multipart, one `file`,
   * 2 MB at most (the parser stops there), under the form's verified ID check
   * in the `x-psf-check-token` header: there is no session on this path, and
   * no anonymous upload either.
   */
  @Post('logo')
  @HttpCode(201)
  @SkipThrottle({ 'psf-track': true, 'psf-form': true })
  async uploadLogo(@Req() request: LogoRequest, @Headers(PSF_CHECK_TOKEN_HEADER) checkToken: string | undefined): Promise<PsfLogoUploadResult> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.file !== 'function') {
      throw new BadRequestException('Send the logo as multipart/form-data.');
    }
    const uploaded = await request.file({ limits: { fileSize: MAX_LOGO_BYTES } });
    if (!uploaded) throw new BadRequestException('No file was sent.');
    const body = await uploaded.toBuffer();
    if (uploaded.file?.truncated) throw new BadRequestException('A logo must be 2 MB or smaller.');
    return this.psf.uploadLogo(checkToken, { body, mime: uploaded.mimetype ?? 'application/octet-stream', filename: uploaded.filename ?? 'logo' });
  }

  /** The business's logo, for its tracking page and certificate. */
  @Get('track/:docId/logo')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  async logo(@Param('docId', docIdPipe) docId: string, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.psf.logo(docId);
    reply
      .header('content-type', file.mime)
      .header('cache-control', 'private, max-age=300')
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('x-content-type-options', 'nosniff')
      .send(file.bytes);
  }

  @Get('track/:docId')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  track(@Param('docId', docIdPipe) docId: string): Promise<PsfTrackView> {
    return this.psf.track(docId);
  }

  /** The member's certificate as a PDF. */
  @Get('track/:docId/certificate')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  async certificate(@Param('docId', docIdPipe) docId: string, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.psf.certificate(docId);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.content);
  }

  /** Mail the certificate to the email the application gave; never to one typed here. */
  @Post('track/:docId/certificate/email')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  emailCertificate(@Param('docId', docIdPipe) docId: string): Promise<{ sentTo: string }> {
    return this.psf.emailCertificate(docId);
  }

  @Post('track/:docId/pay-registration')
  @HttpCode(200)
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  payRegistration(
    @Param('docId', docIdPipe) docId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- validated, so a malformed number is refused; the service reads the phone from the application
    @Body(new ZodValidationPipe(PsfTrackPayRequest)) _body: PsfTrackPayRequest,
  ): Promise<PsfTrackPayResult> {
    return this.psf.payRegistration(docId);
  }

  @Post('track/:docId/pay')
  @HttpCode(200)
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  pay(
    @Param('docId', docIdPipe) docId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- validated, so a malformed number is refused; the service reads the phone from the application
    @Body(new ZodValidationPipe(PsfTrackPayRequest)) _body: PsfTrackPayRequest,
  ): Promise<PsfTrackPayResult> {
    return this.psf.payMembership(docId);
  }
}

/**
 * The PSF officer console's reads (2026-10-19): what the officer covers, the
 * report over a period, and the decision log, each narrowed by place inside
 * the officer's own region.
 */
@Controller({ path: 'oversight/psf', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('psf_membership_officer')
export class OversightPsfConsoleController {
  constructor(
    private readonly reports: PsfReportService,
    private readonly psf: PsfMembershipService,
  ) {}

  /** The sectors' subtypes the officer reads, and which of them they may change. */
  @Get('subsectors')
  subsectors(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfAreaQuery)) area: PsfAreaQuery,
  ): Promise<PsfSubsectorsView> {
    return this.psf.subsectorsForOfficer(grants, area);
  }

  @Post('subsectors')
  @HttpCode(201)
  createSubsector(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfSubsectorRequest)) body: CreatePsfSubsectorRequest,
  ): Promise<PsfSubsectorsView> {
    return this.psf.createSubsector(user.id, grants, body);
  }

  @Patch('subsectors/:id')
  updateSubsector(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfSubsectorRequest)) body: UpdatePsfSubsectorRequest,
  ): Promise<PsfSubsectorsView> {
    return this.psf.updateSubsector(user.id, grants, id, body);
  }

  /** What each band costs in the district shown, and whether the officer may set it. */
  @Get('fees')
  fees(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfAreaQuery)) area: PsfAreaQuery,
  ): Promise<PsfOfficerFeesView> {
    return this.psf.feesForOfficer(grants, area);
  }

  /** Set a band's price for a district (or nationally), or clear it. */
  @Put('fees')
  setFee(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(SetPsfTierFeeRequest)) body: SetPsfTierFeeRequest,
  ): Promise<PsfOfficerFeesView> {
    return this.psf.setTierFee(user.id, grants, body);
  }

  @Get('scope')
  scope(@CurrentOversight() grants: OversightGrant[]): Promise<PsfOfficerScope> {
    return this.reports.scope(grants);
  }

  @Get('report')
  report(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfReportQuery)) query: PsfReportQuery,
  ): Promise<PsfReport> {
    return this.reports.report(grants, query);
  }

  /** One business's registration and listing on Injishi, whatever its standing (2026-10-30). */
  @Get('registrations/:orgId')
  registration(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfRegistrationProfile> {
    return this.reports.registrationProfile(grants, orgId);
  }

  @Get('decisions')
  decisions(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfDecisionsQuery)) query: PsfDecisionsQuery,
  ): Promise<PsfDecisionsPage> {
    return this.reports.decisions(grants, query);
  }

  /** Dynamic extras on the membership form; only a national officer may edit. */
  @Get('form-fields')
  formFields(@CurrentOversight() grants: OversightGrant[]): Promise<PsfFormFieldsOfficerView> {
    return this.psf.formFieldsForOfficer(grants);
  }

  @Post('form-fields')
  @HttpCode(201)
  createFormField(
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfFormFieldRequest)) body: CreatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    return this.psf.createFormField(grants, body);
  }

  @Patch('form-fields/:id')
  updateFormField(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfFormFieldRequest)) body: UpdatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    return this.psf.updateFormField(grants, id, body);
  }
}
