import { type HrFeaturesOff, type MyAnnouncementList, type MyReview, type MyReviewList, SendSelfReviewRequest } from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { HrFeatureOn } from '../../../modules/hr/application/hr-feature.guard';
import { MyContentService } from '../../../modules/hr/application/my-content.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * What HR shares with a person -> /api/v1/me/work/:employeeId: the announcements that are for them,
 * and their own reviews. `SessionGuard` only, as every `me/work` route: ownership is the guard, and
 * any id that is not the caller's answers 404.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkContentController {
  constructor(private readonly content: MyContentService) {}

  @Get(':employeeId/announcements')
  announcements(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyAnnouncementList> {
    return this.content.announcements(user.id, employeeId);
  }

  /** What the person's business has switched off, so Me and the phone hide it. */
  @Get(':employeeId/features')
  features(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<HrFeaturesOff> {
    return this.content.features(user.id, employeeId);
  }

  @Get(':employeeId/reviews')
  reviews(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyReviewList> {
    return this.content.reviews(user.id, employeeId);
  }

  @HrFeatureOn('reviews')
  @Post(':employeeId/reviews/:id/self')
  @HttpCode(200)
  sendSelfReview(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SendSelfReviewRequest)) body: SendSelfReviewRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<MyReview> {
    return this.content.sendSelfReview(user.id, employeeId, id, body);
  }
}
