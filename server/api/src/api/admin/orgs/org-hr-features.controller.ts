import { HrFeature, SetHrFeatureRequest, type HrFeatureList } from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';

import { HrFeaturesService } from '../../../modules/hr/application/hr-features.service';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * A business's optional HR features, switched by Injishi staff (the owner does not): reading beside the rest
 * of the business's page, changing with the same power as switching a product, `admin.business.entitlement.edit`.
 * Switching off is refused while the feature still carries work.
 */
@Controller({ path: 'admin/orgs', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminOrgHrFeaturesController {
  constructor(private readonly features: HrFeaturesService) {}

  @Get(':orgId/hr-features')
  @RequireStaffPermission('admin.business.view')
  view(@Param('orgId', ParseUUIDPipe) orgId: string): Promise<HrFeatureList> {
    return this.features.list(orgId);
  }

  @Put(':orgId/hr-features/:feature')
  @RequireStaffPermission('admin.business.entitlement.edit')
  set(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('feature', new ZodValidationPipe(HrFeature)) feature: HrFeature,
    @Body(new ZodValidationPipe(SetHrFeatureRequest)) body: SetHrFeatureRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<HrFeatureList> {
    return this.features.set(orgId, user.id, feature, body.on, body.reason?.trim() || null);
  }
}
