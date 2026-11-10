import type { HrFeature } from '@injishi/contracts';
import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { HrFeaturesService } from './hr-features.service';

const HR_FEATURE = 'hr-feature';

/**
 * Refuses a write through an HR feature the business has switched off. Put it on the route itself, so it runs
 * after the controller's own guards: the business comes from the workspace they set, or, for a person's own
 * file (`/me/work/:employeeId/...`), from that file.
 */
export function HrFeatureOn(feature: HrFeature): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(HR_FEATURE, feature), UseGuards(HrFeatureGuard));
}

@Injectable()
export class HrFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: HrFeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<HrFeature | undefined>(HR_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;
    const request = context.switchToHttp().getRequest<{
      workspace?: { orgId?: string };
      params?: { employeeId?: string };
    }>();
    const orgId =
      request.workspace?.orgId ??
      (request.params?.employeeId ? await this.features.orgOfEmployee(request.params.employeeId) : null);
    // No business to judge: the route's own checks refuse what it cannot place.
    if (orgId) await this.features.assertOn(orgId, feature);
    return true;
  }
}
