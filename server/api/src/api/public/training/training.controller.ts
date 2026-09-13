import {
  CreateTrainingRegistration,
  TrainingCourseListQuery,
  TrainingMeQuery,
  type TrainingCertificatePdfLink,
  type TrainingCourseListResponse,
  type TrainingMeResponse,
  type TrainingRegistrationResult,
  type TrainingSessionDetail,
  type TrainingVerification,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { StorageService } from '../../../modules/storage/application/storage.service';
import { TrainingCatalogueService } from '../../../modules/training/application/training-catalogue.service';
import { TrainingRegistrationService } from '../../../modules/training/application/training-registration.service';
import { TrainingVerificationService } from '../../../modules/training/application/training-verification.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { VerificationThrottlerGuard } from './verification-throttler.guard';

/**
 * Training, as the public and its own learners see it (ADR-049).
 *
 * THE CLASS IS NOT GUARDED, AND THE GUARDS ARE PER ROUTE. That is deliberate
 * and is the opposite of every admin controller here: `/training` has to be
 * readable by a stranger with no cookie at all (AC-1), because somebody
 * deciding whether to get trained has not signed up for anything yet. Only the
 * three routes that act on a person carry `SessionGuard`.
 *
 * Declaration order matters in Nest: `sessions/:id` and `me` are both under
 * this controller, and a literal segment registered after a parameter segment
 * would be shadowed by it. `me` is declared before anything takes an `:id`.
 */
@Controller({ path: 'training', version: '1' })
export class TrainingController {
  constructor(
    private readonly catalogue: TrainingCatalogueService,
    private readonly registrations: TrainingRegistrationService,
    private readonly storage: StorageService,
  ) {}

  /** Every published course with its published sessions. Public (AC-1). */
  @Get('courses')
  courses(
    @Query(new ZodValidationPipe(TrainingCourseListQuery))
    query: TrainingCourseListQuery,
  ): Promise<TrainingCourseListResponse> {
    return this.catalogue.listPublicCourses(query);
  }

  /**
   * My registrations and my certificates.
   *
   * Declared before `sessions/:id` so the literal path is not captured by a
   * parameter route, and guarded, because this is the one read here that is
   * about a person rather than about the catalogue.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  me(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(TrainingMeQuery)) query: TrainingMeQuery,
  ): Promise<TrainingMeResponse> {
    return this.registrations.me(user.id, query);
  }

  /** One published session. A draft is a 404, the same as an unknown id (AC-6). */
  @Get('sessions/:id')
  session(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TrainingSessionDetail> {
    return this.catalogue.getPublicSession(id);
  }

  /**
   * Register for a session (AC-2, AC-3, AC-4).
   *
   * 200 rather than 201, because AC-4 makes a second attempt return the FIRST
   * registration. A 201 on a call that created nothing would be a lie the
   * client cannot see through, and `alreadyRegistered` on the body is the
   * honest signal instead.
   *
   * The email comes from the session, never from the body. See the service.
   */
  @Post('registrations')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  register(
    @Body(new ZodValidationPipe(CreateTrainingRegistration))
    body: CreateTrainingRegistration,
    @CurrentUser() user: SessionUser,
  ): Promise<TrainingRegistrationResult> {
    return this.registrations.register(body, {
      userId: user.id,
      email: user.email,
    });
  }

  /** Withdraw your own registration before the session starts (AC-29). */
  @Delete('registrations/:id')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  withdraw(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<{ status: 'withdrawn' }> {
    return this.registrations.withdraw(id, user.id);
  }

  /**
   * A short-lived link to my own certificate PDF (AC-13).
   *
   * The URL is minted here rather than in the service because minting it is
   * the storage seam's job and the service's job is deciding whether this
   * caller may have one. Keeping the two apart is what stops an authorization
   * check from living next to a URL builder.
   *
   * `isStaff` is false for every caller on this route. Staff read certificates
   * through the admin surface, behind `StaffGuard`; a public route that widened
   * itself for staff would be a public route with a privileged branch in it.
   */
  @Get('certificates/:id/pdf')
  @UseGuards(SessionGuard)
  async certificatePdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<TrainingCertificatePdfLink> {
    const { objectKey, ttlSeconds } = await this.registrations.pdfLink(id, {
      userId: user.id,
      isStaff: false,
    });

    return {
      url: await this.storage.signedUrl(objectKey, ttlSeconds),
      expiresInSeconds: ttlSeconds,
    };
  }
}

/**
 * The public verification endpoint (AC-15, AC-16).
 *
 * ITS OWN CONTROLLER, at `/api/v1/verify/:token` rather than under
 * `/api/v1/training/...`, because the URL is PRINTED ON PAPER and read by
 * strangers. `injishi.rw/verify/ABC` is a link somebody will retype from a
 * certificate held in their other hand; `injishi.rw/training/certificates/
 * verify/ABC` is a link they will get wrong. It also keeps the rate limiter on
 * exactly one route instead of on a controller that also serves the catalogue.
 *
 * ALWAYS 200, ALWAYS THE SAME SHAPE, for valid, withdrawn and unknown alike.
 * The service explains why; the thing to preserve here is that this method has
 * no error path at all. Adding a 404 for an unknown token would turn it into an
 * oracle that confirms which guessed tokens are real.
 */
@Controller({ path: 'verify', version: '1' })
@UseGuards(VerificationThrottlerGuard)
export class TrainingVerificationController {
  constructor(private readonly verification: TrainingVerificationService) {}

  @Get(':token')
  verify(@Param('token') token: string): Promise<TrainingVerification> {
    // No `ParseUUIDPipe` and no validation pipe, on purpose: the token is not a
    // uuid, and a malformed one has to produce the same answer as a
    // well-formed one that names nothing. A 400 here would leak the format.
    return this.verification.verify(token);
  }
}
