import {
  AdminTrainingCertificateListQuery,
  AdminTrainingCourseListQuery,
  AdminTrainingSessionListQuery,
  AdminTrainingTrainerListQuery,
  AdminTrainingVenueListQuery,
  CancelAdminTrainingSession,
  CreateAdminTrainingCourse,
  CreateAdminTrainingSession,
  CreateAdminTrainingVenue,
  CreateTrainingWalkIn,
  PublishAdminTrainingCourse,
  RecordTrainingAttendance,
  RevokeTrainingCertificate,
  TrainingRosterQuery,
  UpdateAdminTrainingCourse,
  UpdateAdminTrainingSession,
  UpdateAdminTrainingVenue,
  staffAllows,
  type AdminTrainingCertificate,
  type AdminTrainingCertificateListResponse,
  type AdminTrainingCourse,
  type AdminTrainingCourseListResponse,
  type AdminTrainingSession,
  type AdminTrainingSessionListResponse,
  type AdminTrainingTrainerListResponse,
  type AdminTrainingVenue,
  type AdminTrainingVenueListResponse,
  type CancelAdminTrainingSessionResult,
  type CloseTrainingRosterResult,
  type RecordTrainingAttendanceResult,
  type RetireAdminTrainingVenueResult,
  type StaffAccess,
  type StaffPermission,
  type TrainingRosterResponse,
  type TrainingWalkInResult,
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

import { TrainingCatalogueService } from '../../../modules/training/application/training-catalogue.service';
import { TrainingCertificateService } from '../../../modules/training/application/training-certificate.service';
import { TrainingRosterService } from '../../../modules/training/application/training-roster.service';
import {
  TrainingSessionService,
  type SessionActor,
} from '../../../modules/training/application/training-session.service';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentStaff, StaffGuard } from '../../../shared/auth/staff.guard';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Training in the admin console (ADR-049).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` IN THAT ORDER, like every admin
 * controller here: `StaffGuard` throws a 500 rather than treating the request
 * as anonymous when the session guard did not run first, so reversing them
 * fails loudly instead of reading, in a log, as "that staffer lost access".
 *
 * THE CLASS DECLARES `training.view` AND EVERY WRITE OVERRIDES IT. That split is
 * the feature's authorization design, not boilerplate:
 *
 *   - `training.view`, `training.session.manage`, `training.attendance.mark`
 *     and `training.certificate.revoke` are held by `trainer` and by
 *     `super_admin`.
 *   - `training.course.manage`, `training.venue.manage` and
 *     `training.session.publish` are held by platform admins ONLY (AC-24). The
 *     company decides what the credential is, where it happens and when it
 *     opens; the trainer decides who attended.
 *
 * A SECOND CHECK SITS BEHIND THE FIRST on the session verbs, and the two answer
 * different questions. The permission asks "may this kind of staff do this kind
 * of thing"; `assertMayManage` asks "is this session yours" (AC-7). A trainer
 * holding `training.session.manage` may still only touch sessions they are on.
 * Neither substitutes for the other, and `isPlatformAdmin` below is what lets
 * an admin act on any session without holding the trainer's membership.
 */
@Controller({ path: 'admin/training', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
@RequireStaffPermission('training.view')
export class AdminTrainingController {
  constructor(
    private readonly catalogue: TrainingCatalogueService,
    private readonly sessions: TrainingSessionService,
    private readonly roster: TrainingRosterService,
    private readonly certificates: TrainingCertificateService,
  ) {}

  // -------------------------------------------------------------------------
  // Courses. Platform admin only.
  // -------------------------------------------------------------------------

  @Get('courses')
  listCourses(
    @Query(new ZodValidationPipe(AdminTrainingCourseListQuery))
    query: AdminTrainingCourseListQuery,
  ): Promise<AdminTrainingCourseListResponse> {
    return this.catalogue.listCourses(query);
  }

  @Post('courses')
  @RequireStaffPermission('training.course.manage')
  createCourse(
    @Body(new ZodValidationPipe(CreateAdminTrainingCourse))
    body: CreateAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    return this.catalogue.createCourse(body);
  }

  @Patch('courses/:id')
  @RequireStaffPermission('training.course.manage')
  updateCourse(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateAdminTrainingCourse))
    body: UpdateAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    return this.catalogue.updateCourse(id, body);
  }

  @Post('courses/:id/publish')
  @HttpCode(200)
  @RequireStaffPermission('training.course.manage')
  publishCourse(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PublishAdminTrainingCourse))
    body: PublishAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    return this.catalogue.publishCourse(id, body);
  }

  // -------------------------------------------------------------------------
  // Venues. Platform admin only: the company decides where training happens.
  // -------------------------------------------------------------------------

  /**
   * The venue list.
   *
   * Readable with `training.view`, so a trainer's session form can be filled
   * from it. Retired venues are excluded unless asked for, which is what keeps
   * one out of that picker (AC-32).
   */
  @Get('venues')
  listVenues(
    @Query(new ZodValidationPipe(AdminTrainingVenueListQuery))
    query: AdminTrainingVenueListQuery,
  ): Promise<AdminTrainingVenueListResponse> {
    return this.catalogue.listVenues(query);
  }

  @Post('venues')
  @RequireStaffPermission('training.venue.manage')
  createVenue(
    @Body(new ZodValidationPipe(CreateAdminTrainingVenue))
    body: CreateAdminTrainingVenue,
  ): Promise<AdminTrainingVenue> {
    return this.catalogue.createVenue(body);
  }

  @Patch('venues/:id')
  @RequireStaffPermission('training.venue.manage')
  updateVenue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateAdminTrainingVenue))
    body: UpdateAdminTrainingVenue,
  ): Promise<AdminTrainingVenue> {
    return this.catalogue.updateVenue(id, body);
  }

  /** Retiring is one way, and reports how many drafts it just blocked (AC-32). */
  @Post('venues/:id/retire')
  @HttpCode(200)
  @RequireStaffPermission('training.venue.manage')
  retireVenue(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RetireAdminTrainingVenueResult> {
    return this.catalogue.retireVenue(id);
  }

  // -------------------------------------------------------------------------
  // Sessions. A trainer drafts and runs; an admin publishes.
  // -------------------------------------------------------------------------

  @Get('sessions')
  listSessions(
    @Query(new ZodValidationPipe(AdminTrainingSessionListQuery))
    query: AdminTrainingSessionListQuery,
  ): Promise<AdminTrainingSessionListResponse> {
    return this.sessions.list(query);
  }

  /**
   * The trainers a session form may offer (AC-7).
   *
   * Paged, read only, and on the class's `training.view` with NO override, so a
   * trainer drafting their own session can fill its lead and co trainer
   * pickers. It answers id, name and email and nothing else; see
   * `AdminTrainingTrainer` for why the shape stops there.
   *
   * It exists because the only other reader of staff roles is
   * `GET /admin/users`, which needs `admin.user.view` (a trainer lacks it) and a
   * stated PII reason per read, so a picker on it would scan the people
   * directory and write an access log row on every form load.
   */
  @Get('trainers')
  listTrainers(
    @Query(new ZodValidationPipe(AdminTrainingTrainerListQuery))
    query: AdminTrainingTrainerListQuery,
  ): Promise<AdminTrainingTrainerListResponse> {
    return this.sessions.listTrainers(query);
  }

  @Post('sessions')
  @RequireStaffPermission('training.session.manage')
  createSession(
    @Body(new ZodValidationPipe(CreateAdminTrainingSession))
    body: CreateAdminTrainingSession,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminTrainingSession> {
    return this.sessions.create(body, user.id);
  }

  @Patch('sessions/:id')
  @RequireStaffPermission('training.session.manage')
  updateSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateAdminTrainingSession))
    body: UpdateAdminTrainingSession,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<AdminTrainingSession> {
    return this.sessions.update(id, body, actorFrom(user, staff));
  }

  /**
   * Publish (AC-6).
   *
   * `training.session.publish`, which `trainer` does not hold. This is the
   * single line that makes a trainer unable to put their own session in front
   * of the public, and it is the reason the permission set is split three ways.
   */
  @Post('sessions/:id/publish')
  @HttpCode(200)
  @RequireStaffPermission('training.session.publish')
  publishSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminTrainingSession> {
    return this.sessions.publish(id, user.id);
  }

  @Post('sessions/:id/cancel')
  @HttpCode(200)
  @RequireStaffPermission('training.session.manage')
  cancelSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CancelAdminTrainingSession))
    body: CancelAdminTrainingSession,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<CancelAdminTrainingSessionResult> {
    return this.sessions.cancel(id, body, actorFrom(user, staff));
  }

  // -------------------------------------------------------------------------
  // The roster and the tick. Any trainer on the session, or an admin.
  // -------------------------------------------------------------------------

  @Get('sessions/:id/roster')
  @RequireStaffPermission('training.attendance.mark')
  getRoster(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(TrainingRosterQuery))
    query: TrainingRosterQuery,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<TrainingRosterResponse> {
    return this.roster.roster(id, query, actorFrom(user, staff));
  }

  /** Somebody who turned up without registering (AC-8). */
  @Post('sessions/:id/attendees')
  @RequireStaffPermission('training.attendance.mark')
  addWalkIn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateTrainingWalkIn))
    body: CreateTrainingWalkIn,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<TrainingWalkInResult> {
    return this.roster.addWalkIn(id, body, actorFrom(user, staff));
  }

  /**
   * The tick (AC-9).
   *
   * 200 rather than 201: a replayed call with the same idempotency key creates
   * nothing and returns the first answer, so a 201 would claim a certificate
   * had just been minted when none had. `issuedNow` on the body carries that
   * fact instead.
   */
  @Post('registrations/:id/attendance')
  @HttpCode(200)
  @RequireStaffPermission('training.attendance.mark')
  recordAttendance(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RecordTrainingAttendance))
    body: RecordTrainingAttendance,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<RecordTrainingAttendanceResult> {
    return this.roster.recordAttendance(id, body, actorFrom(user, staff));
  }

  @Post('sessions/:id/close-roster')
  @HttpCode(200)
  @RequireStaffPermission('training.attendance.mark')
  closeRoster(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<CloseTrainingRosterResult> {
    return this.sessions.closeRoster(id, actorFrom(user, staff));
  }

  // -------------------------------------------------------------------------
  // Certificates.
  // -------------------------------------------------------------------------

  @Get('certificates')
  listCertificates(
    @Query(new ZodValidationPipe(AdminTrainingCertificateListQuery))
    query: AdminTrainingCertificateListQuery,
  ): Promise<AdminTrainingCertificateListResponse> {
    return this.certificates.list(query);
  }

  /** Withdraw, with a reason, an audit row and a cache purge (AC-22, AC-23). */
  @Post('certificates/:id/revoke')
  @HttpCode(200)
  @RequireStaffPermission('training.certificate.revoke')
  revokeCertificate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RevokeTrainingCertificate))
    body: RevokeTrainingCertificate,
    @CurrentUser() user: SessionUser,
    @CurrentStaff() staff: StaffAccess,
  ): Promise<AdminTrainingCertificate> {
    return this.certificates.revoke(id, body, actorFrom(user, staff));
  }
}

/**
 * Who is acting, resolved from what the guard already established.
 *
 * `isPlatformAdmin` IS A PERMISSION TEST, NOT A ROLE TEST, and that matters.
 * Reading `roles.includes('super_admin')` would put a second copy of the
 * role-to-power table in this file, which is the drift `@injishi/contracts`
 * exists to prevent. Instead it asks whether the caller holds
 * `training.session.publish`: the company-level power in this feature. Anybody
 * who may publish a session is by definition acting for the company rather than
 * as one of its trainers, so they may act on any session.
 *
 * `staffAllows` is the same predicate `StaffGuard` and the console both call,
 * so a refusal here and a hidden control there can never disagree.
 */
function actorFrom(
  user: SessionUser,
  staff: StaffAccess,
): SessionActor {
  const companyPower: StaffPermission = 'training.session.publish';
  return {
    userId: user.id,
    isPlatformAdmin: staffAllows(staff.permissions, companyPower),
  };
}
