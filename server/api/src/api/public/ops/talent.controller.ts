import {
  AddOfferRoundRequest,
  AgreeOfferRequest,
  type Candidate,
  CreateCandidateRequest,
  CreateInterviewRequest,
  CreateReviewCycleRequest,
  CreateVacancyRequest,
  type CurrentReviewCycle,
  type Interview,
  MoveCandidateRequest,
  type Review,
  type ReviewCycle,
  ScoreCandidateRequest,
  SetInterviewStatusRequest,
  type TalentBoard,
  UpdateReviewRequest,
  UpdateVacancyRequest,
  type Vacancy,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { HrFeatureOn } from '../../../modules/hr/application/hr-feature.guard';
import { TalentService } from '../../../modules/hr/application/talent.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Hiring -> /api/v1/ops/talent, vacancies, candidates and interviews (058-talent). Applicants'
 * details are personal data, so everything is `people.manage`, within the branches covered.
 */
@Controller({ path: 'ops', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsTalentController {
  constructor(private readonly talent: TalentService) {}

  @Get('talent')
  @RequirePermission('people.manage')
  board(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<TalentBoard> {
    return this.talent.board(workspace);
  }

  @HrFeatureOn('talent')
  @Post('vacancies')
  @RequirePermission('people.manage')
  openVacancy(
    @Body(new ZodValidationPipe(CreateVacancyRequest)) body: CreateVacancyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Vacancy> {
    return this.talent.createVacancy(workspace, user.id, body);
  }

  @HrFeatureOn('talent')
  @Patch('vacancies/:id')
  @RequirePermission('people.manage')
  changeVacancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVacancyRequest)) body: UpdateVacancyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Vacancy> {
    return this.talent.updateVacancy(workspace, user.id, id, body);
  }

  @HrFeatureOn('talent')
  @Post('candidates')
  @RequirePermission('people.manage')
  addCandidate(
    @Body(new ZodValidationPipe(CreateCandidateRequest)) body: CreateCandidateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Candidate> {
    return this.talent.addCandidate(workspace, user.id, body);
  }

  @HrFeatureOn('talent')
  @Post('candidates/:id/stage')
  @HttpCode(200)
  @RequirePermission('people.manage')
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MoveCandidateRequest)) body: MoveCandidateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Candidate> {
    return this.talent.moveCandidate(workspace, user.id, id, body);
  }

  @HrFeatureOn('talent')
  @Post('candidates/:id/offer-rounds')
  @RequirePermission('people.manage')
  addOfferRound(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddOfferRoundRequest)) body: AddOfferRoundRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Candidate> {
    return this.talent.addOfferRound(workspace, user.id, id, body);
  }

  @HrFeatureOn('talent')
  @Post('candidates/:id/offer/agree')
  @HttpCode(200)
  @RequirePermission('people.manage')
  agreeOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AgreeOfferRequest)) body: AgreeOfferRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Candidate> {
    return this.talent.agreeOffer(workspace, user.id, id, body);
  }

  @HrFeatureOn('talent')
  @Post('candidates/:id/scores')
  @RequirePermission('people.manage')
  score(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ScoreCandidateRequest)) body: ScoreCandidateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Candidate> {
    return this.talent.score(workspace, user.id, id, body);
  }

  @HrFeatureOn('talent')
  @Post('interviews')
  @RequirePermission('people.manage')
  book(
    @Body(new ZodValidationPipe(CreateInterviewRequest)) body: CreateInterviewRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Interview> {
    return this.talent.bookInterview(workspace, user.id, body);
  }

  @HrFeatureOn('talent')
  @Post('interviews/:id/status')
  @HttpCode(204)
  @RequirePermission('people.manage')
  interviewStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetInterviewStatusRequest)) body: SetInterviewStatusRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.talent.setInterviewStatus(workspace, user.id, id, body.status);
  }

  @Get('review-cycles/current')
  @RequirePermission('people.manage')
  currentCycle(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<CurrentReviewCycle> {
    return this.talent.currentCycle(workspace);
  }

  @HrFeatureOn('reviews')
  @Post('review-cycles')
  @RequirePermission('people.manage')
  openCycle(
    @Body(new ZodValidationPipe(CreateReviewCycleRequest)) body: CreateReviewCycleRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ReviewCycle> {
    return this.talent.openCycle(workspace, user.id, body);
  }

  @HrFeatureOn('reviews')
  @Post('review-cycles/:id/close')
  @HttpCode(204)
  @RequirePermission('people.manage')
  closeCycle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.talent.closeCycle(workspace, user.id, id);
  }

  @HrFeatureOn('reviews')
  @Patch('reviews/:id')
  @RequirePermission('people.manage')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateReviewRequest)) body: UpdateReviewRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Review> {
    return this.talent.updateReview(workspace, user.id, id, body);
  }
}
