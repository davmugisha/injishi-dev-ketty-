import {
  AddPsfAssociationRequest,
  CreatePsfBandRequest,
  AddPsfSectorRequest,
  CreatePsfFormExtraRequest,
  CreatePsfLevelRequest,
  PsfMoneyQuery,
  SetPsfSplitRateRequest,
  ChangePsfAssociationRequest,
  UpdatePsfBandRequest,
  ChangePsfSectorRequest,
  UpdatePsfFormExtraRequest,
  UpdatePsfFormFieldSettingRequest,
  UpdatePsfLevelRequest,
  type PsfBandsView,
  type PsfFormConfig,
  type PsfFormSetupView,
  type PsfMoneyView,
  type PsfSplitRateView,
} from '@injishi/contracts';
import {
  CreatePsfFormFieldRequest,
  CreatePsfSubsectorRequest,
  SetPsfTierFeeRequest,
  type PsfOfficerFeesView,
  PsfAreaQuery,
  PsfMemberCardQuery,
  PsfQuoteQuery,
  SetPsfServiceFeeRequest,
  type PsfQuote,
  PsfResendRequest,
  type PsfClaimCardView,
  type PsfCardUploadResult,
  type PsfMemberCard,
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
  PsfRenewRequest,
  PsfMemberLookupRequest,
  PsfMemberLookupConfirm,
  type PsfMemberLookupResult,
  type PsfMemberLookupConfirmed,
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
import { BadRequestException, NotFoundException, Body, Controller, Get, Headers, HttpCode, HttpException, Logger, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PsfCertificatesService } from '../../../modules/organization/application/psf-certificates.service';

import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import { PsfPublicService } from '../../../modules/organization/application/psf-public.service';
import { PsfReportService } from '../../../modules/organization/application/psf-report.service';
import { PsfSetupService } from '../../../modules/organization/application/psf-setup.service';
import { MAX_CERTIFICATE_BYTES, MAX_LOGO_BYTES } from '../../../modules/storage/domain/storage-port';
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

  constructor(
    private readonly psf: PsfPublicService,
    private readonly certificates: PsfCertificatesService,
    private readonly formSetup: PsfSetupService,
  ) {}

  /** What the public form asks (2026-11-06): PSF's wording and fields. */
  @Get('form-config')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  formConfig(): Promise<PsfFormConfig> {
    return this.formSetup.publicFormConfig();
  }

  @Post('identity/lookup')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  lookup(@Body(new ZodValidationPipe(PsfIdentityLookupRequest)) body: PsfIdentityLookupRequest): Promise<PsfIdentityLookupResult> {
    return this.psf.lookup(body);
  }

  /** Tracking by membership number (2026-11-02): a code goes to the phone on file. */
  @Post('member-lookup')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  memberLookup(@Body(new ZodValidationPipe(PsfMemberLookupRequest)) body: PsfMemberLookupRequest): Promise<PsfMemberLookupResult> {
    return this.psf.memberLookup(body);
  }

  /** The code read back answers the docID, which opens the tracking page. */
  @Post('member-lookup/confirm')
  @HttpCode(200)
  @SkipThrottle({ 'psf-track': true, 'psf-logo': true })
  memberLookupConfirm(@Body(new ZodValidationPipe(PsfMemberLookupConfirm)) body: PsfMemberLookupConfirm): PsfMemberLookupConfirmed {
    return this.psf.memberLookupConfirm(body);
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

  /** A card holder's old PSF card (2026-11-02), under the form's ID check, like the logo. */
  @Post('card-upload')
  @HttpCode(201)
  @SkipThrottle({ 'psf-track': true, 'psf-form': true })
  async uploadCard(@Req() request: LogoRequest, @Headers(PSF_CHECK_TOKEN_HEADER) checkToken: string | undefined): Promise<PsfCardUploadResult> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.file !== 'function') {
      throw new BadRequestException('Send the card as multipart/form-data.');
    }
    const uploaded = await request.file({ limits: { fileSize: MAX_CERTIFICATE_BYTES } });
    if (!uploaded) throw new BadRequestException('No file was sent.');
    const body = await uploaded.toBuffer();
    if (uploaded.file?.truncated) throw new BadRequestException('The card must be 10 MB or smaller.');
    return this.psf.uploadCard(checkToken, { body, mime: uploaded.mimetype ?? 'application/octet-stream', filename: uploaded.filename ?? 'psf-card' });
  }

  /** Corrections to an application PSF sent back (2026-11-05). The docID is the bearer key, as for the page. */
  @Post('track/:docId/resend')
  @HttpCode(200)
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  resend(@Param('docId', docIdPipe) docId: string, @Body(new ZodValidationPipe(PsfResendRequest)) body: PsfResendRequest): Promise<PsfTrackView> {
    return this.psf.resend(docId, body);
  }

  /** A new card for an application sent back. */
  @Post('track/:docId/card')
  @HttpCode(201)
  @SkipThrottle({ 'psf-track': true, 'psf-form': true })
  async uploadResendCard(@Req() request: LogoRequest, @Param('docId', docIdPipe) docId: string): Promise<PsfCardUploadResult> {
    return this.psf.uploadResendCard(docId, await this.cardFile(request));
  }

  /** What the signed link for a card sent back opens. */
  @Get('claim-card')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  claimCard(@Query('token') token: string | undefined): Promise<PsfClaimCardView> {
    if (!token) throw new BadRequestException('This link is not complete.');
    return this.psf.claimCardView(token);
  }

  /** The card again, by that signed link. */
  @Post('claim-card')
  @HttpCode(204)
  @SkipThrottle({ 'psf-track': true, 'psf-form': true })
  async resendClaimCard(@Req() request: LogoRequest, @Query('token') token: string | undefined): Promise<void> {
    if (!token) throw new BadRequestException('This link is not complete.');
    await this.psf.resendClaimCard(token, await this.cardFile(request));
  }

  /** One card file from a multipart request, with the size limit. */
  private async cardFile(request: LogoRequest): Promise<{ body: Buffer; mime: string; filename: string }> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.file !== 'function') {
      throw new BadRequestException('Send the card as multipart/form-data.');
    }
    const uploaded = await request.file({ limits: { fileSize: MAX_CERTIFICATE_BYTES } });
    if (!uploaded) throw new BadRequestException('No file was sent.');
    const body = await uploaded.toBuffer();
    if (uploaded.file?.truncated) throw new BadRequestException('The card must be 10 MB or smaller.');
    return { body, mime: uploaded.mimetype ?? 'application/octet-stream', filename: uploaded.filename ?? 'psf-card' };
  }

  /** What the form's choices cost: the kind's floor, and each branch's price (2026-11-05). */
  @Get('quote')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  quote(@Query(new ZodValidationPipe(PsfQuoteQuery)) query: PsfQuoteQuery): Promise<PsfQuote> {
    return this.psf.quote(query);
  }

  /** A member's card, by its number (2026-11-02): what a certificate's QR code opens. */
  @Get('card')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  card(@Query(new ZodValidationPipe(PsfMemberCardQuery)) query: PsfMemberCardQuery): Promise<PsfMemberCard> {
    return this.certificates.card(query.number);
  }

  /** The owner's photo on a membership's public card (2026-11-05). */
  @Get('card/photo')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  async cardPhoto(@Query(new ZodValidationPipe(PsfMemberCardQuery)) query: PsfMemberCardQuery, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.certificates.photoOfNumber(query.number);
    if (!file) throw new NotFoundException('This membership has no photo.');
    reply.header('content-type', file.mime).header('cache-control', 'private, max-age=300').header('cross-origin-resource-policy', 'cross-origin').header('x-content-type-options', 'nosniff').send(file.bytes);
  }

  /** The membership card as a PDF (2026-11-05). */
  @Get('track/:docId/card')
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  async memberCard(@Param('docId', docIdPipe) docId: string, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.psf.card(docId);
    reply.header('content-type', 'application/pdf').header('content-disposition', `attachment; filename="${file.filename}"`).header('cache-control', 'no-store').send(file.content);
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

  /** Renew a membership (2026-11-02): the band, the amount within it, and the phone to prompt. */
  @Post('track/:docId/renew')
  @HttpCode(200)
  @SkipThrottle({ 'psf-form': true, 'psf-logo': true })
  renew(
    @Param('docId', docIdPipe) docId: string,
    @Body(new ZodValidationPipe(PsfRenewRequest)) body: PsfRenewRequest,
  ): Promise<PsfTrackPayResult> {
    return this.psf.renew(docId, body);
  }
}

/**
 * The PSF officer console's reads (2026-10-19): what the officer covers, the
 * report over a period, and the decision log, each narrowed by place inside
 * the officer's own region.
 */
@Controller({ path: 'oversight/psf', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
// BDEs read here (2026-11-02); every write below names the District Manager's role alone.
@RequireOversight('psf_membership_officer', 'psf_business_officer')
export class OversightPsfConsoleController {
  constructor(
    private readonly reports: PsfReportService,
    private readonly psf: PsfMembershipService,
    private readonly setup: PsfSetupService,
  ) {}

  // --- The money, and PSF's setup (2026-11-06). Managers read; the National Manager changes. --------

  @Get('money')
  @RequireOversight('psf_membership_officer')
  money(@CurrentOversight() grants: OversightGrant[], @Query(new ZodValidationPipe(PsfMoneyQuery)) query: PsfMoneyQuery): Promise<PsfMoneyView> {
    return this.setup.money(grants, query);
  }

  @Get('setup/split')
  @RequireOversight('psf_membership_officer')
  split(@CurrentOversight() grants: OversightGrant[]): Promise<PsfSplitRateView> {
    return this.setup.split(grants);
  }

  @Put('setup/split')
  @RequireOversight('psf_membership_officer')
  setSplit(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(SetPsfSplitRateRequest)) body: SetPsfSplitRateRequest,
  ): Promise<PsfSplitRateView> {
    return this.setup.setSplit(user.id, grants, body);
  }

  @Get('setup/bands')
  @RequireOversight('psf_membership_officer')
  bands(@CurrentOversight() grants: OversightGrant[]): Promise<PsfBandsView> {
    return this.setup.bands(grants);
  }

  @Post('setup/levels')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  createLevel(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfLevelRequest)) body: CreatePsfLevelRequest,
  ): Promise<PsfBandsView> {
    return this.setup.createLevel(user.id, grants, body);
  }

  @Patch('setup/levels/:code')
  @RequireOversight('psf_membership_officer')
  updateLevel(
    @Param('code') code: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfLevelRequest)) body: UpdatePsfLevelRequest,
  ): Promise<PsfBandsView> {
    return this.setup.updateLevel(user.id, grants, code, body);
  }

  @Post('setup/bands')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  createBand(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfBandRequest)) body: CreatePsfBandRequest,
  ): Promise<PsfBandsView> {
    return this.setup.createBand(user.id, grants, body);
  }

  @Patch('setup/bands/:code')
  @RequireOversight('psf_membership_officer')
  updateBand(
    @Param('code') code: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfBandRequest)) body: UpdatePsfBandRequest,
  ): Promise<PsfBandsView> {
    return this.setup.updateBand(user.id, grants, code, body);
  }

  @Get('setup/form')
  @RequireOversight('psf_membership_officer')
  formSetup(@CurrentOversight() grants: OversightGrant[]): Promise<PsfFormSetupView> {
    return this.setup.formSetup(grants);
  }

  @Patch('setup/form/fields/:key')
  @RequireOversight('psf_membership_officer')
  updateFormSetting(
    @Param('key') key: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfFormFieldSettingRequest)) body: UpdatePsfFormFieldSettingRequest,
  ): Promise<PsfFormSetupView> {
    return this.setup.updateFormField(user.id, grants, key, body);
  }

  @Post('setup/form/extras')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  createExtra(@CurrentOversight() grants: OversightGrant[], @Body(new ZodValidationPipe(CreatePsfFormExtraRequest)) body: CreatePsfFormExtraRequest): Promise<PsfFormSetupView> {
    return this.setup.createExtra(grants, body);
  }

  @Patch('setup/form/extras/:id')
  @RequireOversight('psf_membership_officer')
  updateExtra(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfFormExtraRequest)) body: UpdatePsfFormExtraRequest,
  ): Promise<PsfFormSetupView> {
    return this.setup.updateExtra(grants, id, body);
  }

  @Post('setup/clusters')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  async createCluster(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(AddPsfSectorRequest)) body: AddPsfSectorRequest,
  ): Promise<PsfSubsectorsView> {
    await this.setup.createCluster(user.id, grants, body);
    return this.psf.subsectorsForOfficer(grants);
  }

  @Patch('setup/clusters/:code')
  @RequireOversight('psf_membership_officer')
  async updateCluster(
    @Param('code') code: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(ChangePsfSectorRequest)) body: ChangePsfSectorRequest,
  ): Promise<PsfSubsectorsView> {
    await this.setup.updateCluster(user.id, grants, code, body);
    return this.psf.subsectorsForOfficer(grants);
  }

  @Post('setup/associations')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  async createAssociation(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(AddPsfAssociationRequest)) body: AddPsfAssociationRequest,
  ): Promise<PsfSubsectorsView> {
    await this.setup.createAssociation(user.id, grants, body);
    return this.psf.subsectorsForOfficer(grants);
  }

  @Patch('setup/associations/:code')
  @RequireOversight('psf_membership_officer')
  async updateAssociation(
    @Param('code') code: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(ChangePsfAssociationRequest)) body: ChangePsfAssociationRequest,
  ): Promise<PsfSubsectorsView> {
    await this.setup.updateAssociation(user.id, grants, code, body);
    return this.psf.subsectorsForOfficer(grants);
  }

  /** The sectors' subtypes the officer reads, and which of them they may change. */
  @Get('subsectors')
  subsectors(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfAreaQuery)) area: PsfAreaQuery,
  ): Promise<PsfSubsectorsView> {
    return this.psf.subsectorsForOfficer(grants, area);
  }

  @Post('subsectors')
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  createSubsector(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfSubsectorRequest)) body: CreatePsfSubsectorRequest,
  ): Promise<PsfSubsectorsView> {
    return this.psf.createSubsector(user.id, grants, body);
  }

  @Patch('subsectors/:id')
  @RequireOversight('psf_membership_officer')
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

  /** Set a kind of business's price in a district, or clear it (2026-11-05). */
  @Put('service-fees')
  @RequireOversight('psf_membership_officer')
  setServiceFee(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(SetPsfServiceFeeRequest)) body: SetPsfServiceFeeRequest,
  ): Promise<PsfOfficerFeesView> {
    return this.psf.setServiceFee(user.id, grants, body);
  }

  /** Set a band's price for a district (or nationally), or clear it. */
  @Put('fees')
  @RequireOversight('psf_membership_officer')
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
  @RequireOversight('psf_membership_officer')
  @HttpCode(201)
  createFormField(
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(CreatePsfFormFieldRequest)) body: CreatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    return this.psf.createFormField(grants, body);
  }

  @Patch('form-fields/:id')
  @RequireOversight('psf_membership_officer')
  updateFormField(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentOversight() grants: OversightGrant[],
    @Body(new ZodValidationPipe(UpdatePsfFormFieldRequest)) body: UpdatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    return this.psf.updateFormField(grants, id, body);
  }
}
